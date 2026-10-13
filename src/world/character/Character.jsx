import { use, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VRMUtils } from '@pixiv/three-vrm'
import { createLocomotionAnimator } from './locomotionAnimation'
import { stepLocomotion, beginTravel, beginBackgroundTravel, damp } from './locomotion'
import { avatarPromise, clipsPromise } from './avatarAssets'
import { toonifyVRM, syncToonMaterials } from './toonify'
import { lanternPositions } from '../systems/lanterns'
import { runtime, FRAME } from '../systems/runtime'
import { SPAWN } from '../layout'
import { useStore } from '../../state/store'

const LEAN_GAIN = 0.045 // how far the body leans into turns (radians per rad/s × m/s)
const MAX_LEAN = 0.16

// The player character: loads the VRM avatar and its clips, then each frame runs
// locomotion (input → movement) and animation (blend space → pose → VRM update).
export default function Character() {
  // Suspends until the downloads that began at import time have finished (avatarAssets.js).
  const gltf = use(avatarPromise)
  const clips = use(clipsPromise)

  // One-time, idempotent preparation. These VRMUtils calls mutate the cached model and
  // are NOT safe to repeat (rotateVRM0 spins the model 180° every call), and React
  // StrictMode mounts twice in development — hence the flag on the cached scene.
  const vrm = useMemo(() => {
    const vrm = gltf.userData.vrm
    if (!vrm.scene.userData.prepared) {
      VRMUtils.removeUnnecessaryVertices(gltf.scene)
      VRMUtils.combineSkeletons(gltf.scene)
      VRMUtils.rotateVRM0(vrm)
      vrm.scene.traverse((obj) => {
        // Skinned meshes report their bind-pose bounds, which can be wrong once the
        // animation moves them, so frustum culling would make limbs vanish at the edges.
        obj.frustumCulled = false
        if (obj.isMesh) obj.castShadow = true
      })
      vrm.scene.userData.toonMaterials = toonifyVRM(vrm)
      vrm.scene.userData.prepared = true
    }
    return vrm
  }, [gltf])
  const toonMaterials = vrm.scene.userData.toonMaterials

  const animator = useMemo(() => createLocomotionAnimator(vrm, clips), [vrm, clips])

  // Playback lives in an effect (not the memo) with a symmetric cleanup, so StrictMode's
  // mount → unmount → mount leaves exactly one set of playing actions.
  useEffect(() => {
    animator.start()
    return () => animator.stop()
  }, [animator])

  const rootRef = useRef()
  const leanRef = useRef()
  const lean = useRef(0)
  const lastHeading = useRef(SPAWN.heading)

  // Spawn + register the root for the camera and other systems.
  useEffect(() => {
    const c = runtime.character
    c.position.set(...SPAWN.position)
    c.heading = SPAWN.heading
    c.velocity.set(0, 0, 0)
    c.speed = 0
    c.root = rootRef.current
    c.ready = true
    return () => {
      c.ready = false
      c.root = null
    }
  }, [])

  // Section travel requested from the interface (chips, 1–5 keys, landmark clicks).
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.travelTarget,
        (id) => {
          if (id) beginTravel(id)
        },
      ),
    [],
  )

  // Next/previous inside an open sheet: run to the new landmark behind the sheet.
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.activeSection,
        (id, previous) => {
          if (id && previous && id !== previous) beginBackgroundTravel(id)
        },
      ),
    [],
  )

  useFrame((state, delta) => {
    // Clamp long frames (tab switch, debugger pause) so nothing teleports or explodes.
    const dt = Math.min(delta, 1 / 20)
    stepLocomotion(state.camera, dt)

    const c = runtime.character
    const root = rootRef.current
    root.position.copy(c.position)
    root.rotation.set(0, c.heading, 0)

    // Lean into turns: proportional to turn rate × speed, smoothed. Sells momentum.
    const dHeading = c.heading - lastHeading.current
    // Wrap to [-π, π] so crossing the ±π seam doesn't read as a full spin.
    const turnRate = Math.atan2(Math.sin(dHeading), Math.cos(dHeading)) / Math.max(dt, 1e-4)
    lastHeading.current = c.heading
    const targetLean = THREE.MathUtils.clamp(-turnRate * c.speed * LEAN_GAIN, -MAX_LEAN, MAX_LEAN)
    lean.current = damp(lean.current, targetLean, 6, dt)
    leanRef.current.rotation.z = lean.current

    // Order matters: the mixer poses the normalized humanoid bones, then vrm.update copies
    // that pose onto the real skeleton and advances spring bones and expressions.
    animator.update(c.speed, dt)
    vrm.update(dt)

    // How close is the nearest lantern? (drives the warm rim light at twilight)
    let nearest = Infinity
    for (const l of lanternPositions()) nearest = Math.min(nearest, l.position.distanceToSquared(c.position))
    const lanternNear = Math.max(0, 1 - Math.sqrt(nearest) / 4.5)
    syncToonMaterials(toonMaterials, dt, lanternNear * lanternNear)
  }, FRAME.locomotion)

  return (
    <group ref={rootRef}>
      <group ref={leanRef}>
        <primitive object={vrm.scene} />
      </group>
    </group>
  )
}
