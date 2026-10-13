import * as THREE from 'three'
import { runtime } from '../systems/runtime'
import { resolveCollisions } from '../systems/collision'
import { LANDMARKS, landmarkById } from '../layout'
import { useStore, selectReducedMotion } from '../../state/store'

// Character movement: input → desired velocity → smoothed velocity → position + facing.
//
// Two things make movement feel weighty instead of robotic:
//  • Velocity is SMOOTHED toward the desired velocity (exponential damping). Starts,
//    stops and turns take a fraction of a second, so the body accelerates and arcs
//    through turns instead of snapping to full speed in one frame.
//  • Facing follows the velocity with its own, slightly slower damping, so the body
//    visibly turns into a new direction.
// Damping is written as 1 - exp(-λ·dt), which is frame-rate independent: it behaves the
// same at 30, 60 or 144 fps (a plain lerp by a constant factor does not).

export const WALK_SPEED = 1.7 // m/s: matches the walk clip's stride, so feet don't slide
export const RUN_SPEED = 4.6 // m/s: matches the run clip's stride
const VELOCITY_LAMBDA = 7.5
const TURN_LAMBDA = 11
const ARRIVE_RADIUS = 0.2 // metres: close enough to a destination
const SLOW_RADIUS = 1.4 // start easing in this far from a destination
const AUTO_RUN_DISTANCE = 6 // auto-walks longer than this run instead

const UP = new THREE.Vector3(0, 1, 0)
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _desired = new THREE.Vector3()
const _toTarget = new THREE.Vector3()

export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt))

/** Damp an angle along the shortest way round. */
export function dampAngle(current, target, lambda, dt) {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * (1 - Math.exp(-lambda * dt))
}

// Where the character should face once it has arrived (e.g. toward a landmark), or null.
let arrivalFacing = null

const faceLandmarkFrom = (lm) => Math.atan2(lm.position[0] - lm.approach[0], lm.position[2] - lm.approach[2])

/** Put the character at a section's landmark instantly and open it (deep links, reduced motion). */
export function placeAt(sectionId) {
  const lm = landmarkById(sectionId)
  if (!lm) return
  const c = runtime.character
  c.position.set(...lm.approach)
  c.velocity.set(0, 0, 0)
  c.speed = 0
  c.heading = faceLandmarkFrom(lm)
  arrivalFacing = c.heading
  runtime.moveTarget = null
  useStore.getState().openSection(sectionId)
}

/** Start walking to a section's landmark (or appear there, under reduced motion). */
export function beginTravel(sectionId) {
  const lm = landmarkById(sectionId)
  if (!lm) return
  if (selectReducedMotion(useStore.getState())) {
    placeAt(sectionId)
    return
  }
  const c = runtime.character
  const target = new THREE.Vector3(...lm.approach)
  runtime.moveTarget = target
  runtime.moveTargetSprint = c.position.distanceTo(target) > AUTO_RUN_DISTANCE
  arrivalFacing = faceLandmarkFrom(lm)
}

/**
 * Switching sections from inside an open sheet: the content changes instantly, and the
 * character runs to the new landmark in the background so the world catches up.
 */
export function beginBackgroundTravel(sectionId) {
  const lm = landmarkById(sectionId)
  if (!lm) return
  if (selectReducedMotion(useStore.getState())) {
    const c = runtime.character
    c.position.set(...lm.approach)
    c.velocity.set(0, 0, 0)
    c.speed = 0
    c.heading = faceLandmarkFrom(lm)
    arrivalFacing = c.heading
    return
  }
  runtime.moveTarget = new THREE.Vector3(...lm.approach)
  runtime.moveTargetSprint = true
  runtime.backgroundTravel = true
  arrivalFacing = faceLandmarkFrom(lm)
}

/** Tap/click-to-move: walk to a point on the ground. */
export function beginMoveTo(point) {
  runtime.moveTarget = new THREE.Vector3(point.x, 0, point.z)
  runtime.moveTargetSprint = runtime.character.position.distanceTo(runtime.moveTarget) > AUTO_RUN_DISTANCE
  arrivalFacing = null
  const store = useStore.getState()
  if (store.travelTarget) store.clearTravel()
}

/**
 * Advance the character by one frame. `camera` provides the camera-relative basis for
 * keyboard input. Returns nothing; writes runtime.character.
 */
export function stepLocomotion(camera, dt) {
  const c = runtime.character
  const store = useStore.getState()
  // An open sheet freezes player input, except for a background run to the landmark of
  // the section the sheet just switched to.
  const sheetOpen = store.activeSection !== null
  if (!sheetOpen) runtime.backgroundTravel = false
  const paused = store.phase !== 'explore' || (sheetOpen && !runtime.backgroundTravel)
  const keys = runtime.keys

  _desired.set(0, 0, 0)
  let targetSpeed = 0

  if (!paused) {
    const anyKey = keys.forward || keys.backward || keys.left || keys.right
    if (anyKey) {
      // Camera-relative: "forward" is wherever the camera looks, flattened onto the ground.
      camera.getWorldDirection(_forward)
      _forward.y = 0
      _forward.normalize()
      _right.crossVectors(_forward, UP).normalize()
      if (keys.forward) _desired.add(_forward)
      if (keys.backward) _desired.sub(_forward)
      if (keys.right) _desired.add(_right)
      if (keys.left) _desired.sub(_right)
      if (_desired.lengthSq() > 0) {
        _desired.normalize()
        targetSpeed = keys.sprint ? RUN_SPEED : WALK_SPEED
      }
    } else if (runtime.moveTarget) {
      _toTarget.subVectors(runtime.moveTarget, c.position)
      _toTarget.y = 0
      const dist = _toTarget.length()
      if (dist < ARRIVE_RADIUS) {
        runtime.moveTarget = null
        runtime.backgroundTravel = false
        // Arrived at a section's landmark: open it.
        if (store.travelTarget) store.openSection(store.travelTarget)
      } else {
        _desired.copy(_toTarget).divideScalar(dist)
        const cruise = runtime.moveTargetSprint ? RUN_SPEED : WALK_SPEED
        // Ease into the stop: speed tapers inside SLOW_RADIUS instead of braking hard.
        targetSpeed = Math.min(cruise, Math.max(0.55, (dist / SLOW_RADIUS) * cruise))
      }
    }
  }

  // Smooth the velocity toward the desired velocity.
  const k = 1 - Math.exp(-VELOCITY_LAMBDA * dt)
  c.velocity.x += (_desired.x * targetSpeed - c.velocity.x) * k
  c.velocity.z += (_desired.z * targetSpeed - c.velocity.z) * k
  c.speed = Math.hypot(c.velocity.x, c.velocity.z)
  if (c.speed < 0.01 && targetSpeed === 0) {
    c.velocity.set(0, 0, 0)
    c.speed = 0
  }

  // Integrate, then slide around obstacles and stay on the island.
  c.position.x += c.velocity.x * dt
  c.position.z += c.velocity.z * dt
  resolveCollisions(c.position)

  // Facing: follow the direction of travel; when standing still after a travel, turn to
  // face the landmark so the camera framing shows both.
  if (c.speed > 0.15) {
    c.heading = dampAngle(c.heading, Math.atan2(c.velocity.x, c.velocity.z), TURN_LAMBDA, dt)
  } else if (arrivalFacing !== null) {
    c.heading = dampAngle(c.heading, arrivalFacing, TURN_LAMBDA * 0.6, dt)
  }
  if (runtime.moveTarget === null && c.speed < 0.05 && arrivalFacing !== null && store.activeSection === null && !store.travelTarget) {
    arrivalFacing = null
  }

  // Which landmark are we standing at? (nearest within its radius)
  let near = null
  let best = Infinity
  for (const lm of LANDMARKS) {
    const dx = c.position.x - lm.position[0]
    const dz = c.position.z - lm.position[2]
    const d2 = dx * dx + dz * dz
    if (d2 < lm.radius * lm.radius && d2 < best) {
      best = d2
      near = lm.id
    }
  }
  store.setNearSection(near)
}
