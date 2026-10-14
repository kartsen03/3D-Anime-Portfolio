import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { runtime, FRAME } from '../systems/runtime'
import { damp } from '../character/locomotion'
import { landmarkById, skyNamePlacement, SPAWN } from '../layout'
import { useStore } from '../../state/store'
import { sheetCoverage } from '../../ui/layoutMetrics'
import { lensFor } from './lens'

const { ACTION } = CameraControlsImpl

const TARGET_HEIGHT = 1.2 // look at roughly chest height
const FOLLOW_LAMBDA = 8 // how tightly the camera tracks the character (1/s)
const LEAD_SECONDS = 0.3 // look slightly ahead of where the character is heading
// Zooming out past the follow range turns the camera into an overview: the look-at point
// drifts from the character to high above the island's centre and the tilt limit
// relaxes, so fully zoomed out you see the whole island with the name in the sky beyond.
const FOLLOW_RANGE = 13 // metres: closer than this, the camera simply follows
const OVERVIEW_DISTANCE = 60 // metres: fully zoomed out
const OVERVIEW_TARGET = new THREE.Vector3(0, 16, 0)
const POLAR_MAX_NEAR = 1.47 // ~6° above the target: never under the island up close
const POLAR_MAX_FAR = 1.62 // from far away, look slightly up into the sky
const EXPLORE_POLAR = 1.32 // the follow camera's usual tilt (~14° look-down)
const OVERVIEW_POLAR = 1.53 // fully zoomed out: level enough to see the sky name above the island
const _eye = new THREE.Vector3()
const _target = new THREE.Vector3()

// Third-person camera.
//
// Built on camera-controls (via drei) because its damping is time-based: the same feel
// at 60, 120 or 144 Hz. The old OrbitControls rig damped per *call* and was updated
// twice per frame, so it felt different on every monitor. It also enforces the limits
// the old camera lacked: no zooming into the character, no orbiting under the island.
//
// Each frame, before camera-controls updates (priority -2 < -1), the follow point is
// damped toward the character and the whole rig is translated there. Input, movement
// and camera all land in the same frame, so there's no lag between them.
export default function CameraRig() {
  const ref = useRef()
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const get = useThree((s) => s.get)

  const follow = useRef(new THREE.Vector3())
  const mode = useRef('follow') // 'follow' | 'focus' | 'returning' | 'intro'
  const viewShift = useRef({ x: 0, y: 0 })
  const intro = useRef(null)
  const overview = useRef(0) // last overview blend, 0 (following) … 1 (fully zoomed out)

  // Opening shot: start looking up at the name written across the sky, hold a beat,
  // then pan down and glide in to the character, who stands facing the camera with the
  // shrine behind them. Any key or tap hurries it along. (Under reduced motion the splash
  // skips straight to 'explore'.)
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.phase,
        (phase) => {
          const cc = ref.current
          if (phase !== 'intro' || !cc) return
          const to = { eye: cc.getPosition(new THREE.Vector3()), target: cc.getTarget(new THREE.Vector3()) }
          const back = to.eye.clone().sub(to.target).setY(0).normalize()
          const { size } = get()
          const from = {
            eye: to.eye.clone().addScaledVector(back, 5).add(new THREE.Vector3(0, 2.2, 0)),
            target: new THREE.Vector3(...skyNamePlacement(lensFor(size.width, size.height).hFov).position),
          }
          // The gaze is blended as a direction (yaw, pitch), not as a look-at point. A point
          // that starts 350 m away and slides toward the camera barely changes the view
          // angle until the last moment, so the tilt would bunch into a whip-pan at the end.
          const look = (eye, target) => {
            const d = target.clone().sub(eye)
            const dist = d.length()
            return { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y / dist), dist }
          }
          from.look = look(from.eye, from.target)
          to.look = look(to.eye, to.target)
          intro.current = { t: 0, hold: 1.8, duration: 3.6, from, to, hurry: false }
          mode.current = 'intro'
          cc.enabled = false
          cc.setLookAt(from.eye.x, from.eye.y, from.eye.z, from.target.x, from.target.y, from.target.z, false)
          const hurry = () => {
            const it = intro.current
            if (!it || it.hurry) return
            it.hurry = true
            // Finish the remaining move in about half a second.
            const progress = Math.max(0, (it.t - it.hold) / it.duration)
            it.hold = Math.min(it.hold, it.t)
            it.duration = Math.max(0.55, it.duration * 0.15)
            it.t = it.hold + progress * it.duration
          }
          window.addEventListener('keydown', hurry, { once: true })
          window.addEventListener('pointerdown', hurry, { once: true })
          intro.current.cleanup = () => {
            window.removeEventListener('keydown', hurry)
            window.removeEventListener('pointerdown', hurry)
          }
        },
      ),
    [get],
  )

  // Responsive lens (see lens.js).
  useEffect(() => {
    camera.fov = lensFor(width, height).fov
    camera.updateProjectionMatrix()
  }, [camera, width, height])

  // Limits, input mapping and the opening pose.
  useEffect(() => {
    const cc = ref.current
    cc.minDistance = 3.4
    cc.maxDistance = OVERVIEW_DISTANCE
    cc.minPolarAngle = 0.45 // ~26° from straight down
    cc.maxPolarAngle = POLAR_MAX_NEAR
    cc.smoothTime = 0.2
    cc.draggingSmoothTime = 0.09
    cc.azimuthRotateSpeed = 0.85
    cc.polarRotateSpeed = 0.7
    cc.dollySpeed = 0.45
    cc.mouseButtons.left = ACTION.ROTATE
    cc.mouseButtons.right = ACTION.ROTATE
    cc.mouseButtons.middle = ACTION.DOLLY
    cc.mouseButtons.wheel = ACTION.DOLLY
    cc.touches.one = ACTION.TOUCH_ROTATE
    cc.touches.two = ACTION.TOUCH_DOLLY
    cc.touches.three = ACTION.NONE

    // From the layout, not runtime.character: this effect runs before the character
    // (still loading behind Suspense) has been placed at the spawn.
    const [sx, sy, sz] = SPAWN.position
    follow.current.set(sx, sy + TARGET_HEIGHT, sz)
    const portrait = width < height
    cc.moveTo(follow.current.x, follow.current.y, follow.current.z, false)
    // Looking along the spawn view, a little above: a shallow ~14° look-down keeps the
    // horizon (sky, sea of clouds) in the top third instead of a frame of grass. Close
    // enough that the character, facing the camera, reads as a portrait.
    cc.rotateTo(SPAWN.view + Math.PI, EXPLORE_POLAR, false)
    cc.dollyTo(portrait ? 8.4 : 6.2, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Section focus: frame the landmark beside the character while its sheet is open;
  // ease back behind the character when it closes.
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.activeSection,
        (id) => {
          const cc = ref.current
          if (!cc) return
          if (id) {
            const lm = landmarkById(id)
            // Frame the landmark and its approach point (where the character stands, or
            // is running to when the section was switched from inside the sheet).
            const target = new THREE.Vector3(
              lm.position[0] * 0.55 + lm.approach[0] * 0.45,
              1.7,
              lm.position[2] * 0.55 + lm.approach[2] * 0.45,
            )
            // Stand off to the side of the landmark's front, for a three-quarter view.
            const side = lm.yaw + 0.55
            const eye = new THREE.Vector3(
              target.x + Math.sin(side) * 7.5,
              target.y + 1.6,
              target.z + Math.cos(side) * 7.5,
            )
            mode.current = 'focus'
            cc.enabled = false
            cc.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true)
          } else {
            const c = runtime.character
            follow.current.set(c.position.x, c.position.y + TARGET_HEIGHT, c.position.z)
            mode.current = 'returning'
            cc.moveTo(follow.current.x, follow.current.y, follow.current.z, true).then(() => {
              if (mode.current === 'returning') {
                mode.current = 'follow'
                cc.enabled = useStore.getState().phase === 'explore'
              }
            })
          }
        },
      ),
    [],
  )

  // Camera input only while exploring (not during loading, the intro, or a sheet).
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.phase,
        (phase) => {
          if (ref.current && mode.current === 'follow') ref.current.enabled = phase === 'explore'
        },
        { fireImmediately: true },
      ),
    [],
  )

  useFrame((state, delta) => {
    const cc = ref.current
    if (!cc) return
    const dt = Math.min(delta, 1 / 20)
    const c = runtime.character
    if (runtime.freeCamera) return

    if (mode.current === 'intro' && intro.current) {
      const it = intro.current
      it.t += dt
      const s = THREE.MathUtils.clamp((it.t - it.hold) / it.duration, 0, 1)
      // Ease in and out; the eye rises slightly mid-move for a crane-like arc, and the
      // gaze leads the move a little, so the tilt down reveals the island before the
      // camera settles in behind the character.
      const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
      const e = ease(s)
      const g = ease(Math.min(1, s * 1.12))
      _eye.lerpVectors(it.from.eye, it.to.eye, e)
      _eye.y += Math.sin(Math.PI * e) * 1.6
      const a = it.from.look
      const b = it.to.look
      // Shortest way round for the yaw; the look distance blends geometrically (350 m → 7 m).
      const yaw = a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * g
      const pitch = THREE.MathUtils.lerp(a.pitch, b.pitch, g)
      const dist = Math.exp(THREE.MathUtils.lerp(Math.log(a.dist), Math.log(b.dist), e))
      _target.set(
        _eye.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        _eye.y + Math.sin(pitch) * dist,
        _eye.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      )
      cc.setLookAt(_eye.x, _eye.y, _eye.z, _target.x, _target.y, _target.z, false)
      if (s >= 1) {
        it.cleanup?.()
        intro.current = null
        follow.current.copy(it.to.target)
        mode.current = 'follow'
        useStore.getState().setPhase('explore')
      }
      return
    }

    if (mode.current === 'follow') {
      const tx = c.position.x + c.velocity.x * LEAD_SECONDS
      const tz = c.position.z + c.velocity.z * LEAD_SECONDS
      follow.current.x = damp(follow.current.x, tx, FOLLOW_LAMBDA, dt)
      follow.current.y = damp(follow.current.y, c.position.y + TARGET_HEIGHT, FOLLOW_LAMBDA, dt)
      follow.current.z = damp(follow.current.z, tz, FOLLOW_LAMBDA, dt)
      // Overview blend (see OVERVIEW_DISTANCE), driven by how far out the camera is.
      const k = THREE.MathUtils.smoothstep(cc.distance, FOLLOW_RANGE, OVERVIEW_DISTANCE * 0.8)
      _target.lerpVectors(follow.current, OVERVIEW_TARGET, k)
      cc.maxPolarAngle = THREE.MathUtils.lerp(POLAR_MAX_NEAR, POLAR_MAX_FAR, k)
      cc.moveTo(_target.x, _target.y, _target.z, false)
      // Zooming out also tilts the view up toward the sky (and zooming back in tilts it
      // back down), in proportion to the zoom, so the scroll wheel alone frames the name
      // above the island. A drag in progress always wins.
      const dk = k - overview.current
      if (Math.abs(dk) > 1e-4 && cc.currentAction === ACTION.NONE) {
        const remaining = dk > 0 ? 1 - overview.current : overview.current
        const f = remaining > 1e-4 ? Math.min(1, Math.abs(dk) / remaining) : 1
        // (The polarAngle setter leaves the azimuth's own easing alone, unlike rotateTo.)
        const polar = cc.polarAngle
        cc.polarAngle = polar + ((dk > 0 ? OVERVIEW_POLAR : EXPLORE_POLAR) - polar) * f
      }
      overview.current = k
    }

    // Shift the projection so the focused landmark stays centred in the part of the
    // screen the open sheet leaves free (a lens shift — nothing in the scene moves).
    const open = useStore.getState().activeSection !== null
    const cover = sheetCoverage(width, height)
    const goalX = open && cover.side === 'right' ? cover.size / 2 : 0
    const goalY = open && cover.side === 'bottom' ? cover.size / 2 : 0
    const v = viewShift.current
    v.x = damp(v.x, goalX, 7, dt)
    v.y = damp(v.y, goalY, 7, dt)
    if (Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5) {
      state.camera.setViewOffset(width, height, v.x, v.y, width, height)
    } else if (state.camera.view?.enabled) {
      state.camera.clearViewOffset()
    }
  }, FRAME.follow)

  return <CameraControls ref={ref} makeDefault />
}
