import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { retargetMixamoAnimation } from './loadMixamoAnimation'

const MODEL_URL = '/models/avatar.vrm'
const IDLE_URL = '/animations/idle.fbx'
const WALK_URL = '/animations/walk.fbx'

// --- Movement tuning ---
const WALK_SPEED = 1.8 // metres/second across the ground
const TURN_RATE = 10 // radians/second the character rotates toward its heading
const CROSSFADE = 0.25 // seconds to blend idle <-> walk
const GROUND_HALF = 14 // soft bound (ground plane is 30×30) — temporary until the island exists

// Constant yaw correction applied to the movement heading. rotateVRM0 + the
// retargeted clips make the avatar face +Z at zero root rotation, and both
// Mixamo clips share that baked forward, so no correction is needed (0). If a
// future clip faced a different way, this is the single place to fix it.
const FACING_OFFSET = 0

// Reused scratch objects so the per-frame loop allocates nothing (allocations
// in the render loop cause GC hitches).
const UP = new THREE.Vector3(0, 1, 0)
const _camDir = new THREE.Vector3()
const _camRight = new THREE.Vector3()
const _move = new THREE.Vector3()
const _targetQuat = new THREE.Quaternion()

// Loads and renders the VRM avatar, and drives keyboard walking: camera-relative
// movement, explicit facing, and an idle<->walk crossfade. The root <group> ref
// is owned by the parent (App) so the follow camera can read the character's
// position.
export default function Character({ rootRef }) {
  // useLoader suspends until each file is parsed, then caches it by URL. The VRM
  // loader gets VRMLoaderPlugin registered so it parses the VRM extensions and
  // attaches the avatar to gltf.userData.vrm.
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })
  // Raw Mixamo FBX clips (skeleton + animation, no skin). Both suspend, so all
  // assets are ready before we build the mixer.
  const idleAsset = useLoader(FBXLoader, IDLE_URL)
  const walkAsset = useLoader(FBXLoader, WALK_URL)

  // [subscribe, get] — we use get() to read the live key state inside useFrame
  // without subscribing (subscribing would re-render React on every keypress).
  const [, getKeys] = useKeyboardControls()

  // Prepare the VRM exactly once per loaded file. These VRMUtils calls mutate
  // the model in place and are NOT idempotent (rotateVRM0 spins 180° every
  // call). useLoader caches the model and StrictMode mounts twice in dev, so a
  // flag on scene.userData keeps prep strictly one-shot.
  const vrm = useMemo(() => {
    const vrm = gltf.userData.vrm

    if (!vrm.scene.userData.prepared) {
      VRMUtils.removeUnnecessaryVertices(gltf.scene)
      VRMUtils.combineSkeletons(gltf.scene)
      // VRM 0.x avatars are authored facing +Z; rotateVRM0 spins 0.x models
      // 180° to the VRM 1.0 baseline. Combined with the clips' baked forward the
      // avatar faces the +Z camera at zero root rotation.
      VRMUtils.rotateVRM0(vrm)
      // VRM meshes sometimes report a bad bounding volume and get frustum-culled
      // (vanish) at some camera angles. Disabling per-object culling avoids it.
      vrm.scene.traverse((obj) => {
        obj.frustumCulled = false
      })
      vrm.scene.userData.prepared = true
    }

    return vrm
  }, [gltf])

  // Build the mixer + both actions once. Construction only — playback starts in
  // the effect below. We target vrm.scene because the retargeted tracks address
  // the VRM's NORMALIZED humanoid bones, which live in that subtree.
  const { mixer, idleAction, walkAction } = useMemo(() => {
    const mixer = new THREE.AnimationMixer(vrm.scene)
    const idleAction = mixer.clipAction(retargetMixamoAnimation(idleAsset, vrm))
    const walkAction = mixer.clipAction(retargetMixamoAnimation(walkAsset, vrm))
    return { mixer, idleAction, walkAction }
  }, [vrm, idleAsset, walkAsset])

  // Tracks whether the character was moving last frame, so we only trigger a
  // crossfade on the transition (not every frame).
  const movingRef = useRef(false)

  // Start both actions playing; walk begins invisible (weight 0). Keeping both
  // "playing" the whole time means a crossfade is just a weight ramp — the walk
  // cycle keeps its phase. Symmetric stop() on cleanup so it survives StrictMode.
  useEffect(() => {
    idleAction.reset().play()
    walkAction.reset().play()
    walkAction.setEffectiveWeight(0)
    idleAction.setEffectiveWeight(1)
    movingRef.current = false
    return () => {
      idleAction.stop()
      walkAction.stop()
    }
  }, [idleAction, walkAction])

  useFrame((state, delta) => {
    const root = rootRef.current
    if (!root) return

    const { forward, backward, left, right } = getKeys()

    // Camera-relative basis on the ground plane: the camera's look direction
    // flattened to XZ is "forward", and its right is forward × up. This makes
    // "forward" always move the character away from the camera along wherever
    // it's currently looking, which feels natural as you orbit.
    state.camera.getWorldDirection(_camDir)
    _camDir.y = 0
    _camDir.normalize()
    _camRight.crossVectors(_camDir, UP).normalize()

    _move.set(0, 0, 0)
    if (forward) _move.add(_camDir)
    if (backward) _move.sub(_camDir)
    if (right) _move.add(_camRight)
    if (left) _move.sub(_camRight)

    const moving = _move.lengthSq() > 0

    if (moving) {
      _move.normalize()

      // Translate the root at a constant speed; delta keeps it frame-rate
      // independent. Then soft-clamp so we don't walk off the finite ground.
      root.position.addScaledVector(_move, WALK_SPEED * delta)
      root.position.x = THREE.MathUtils.clamp(root.position.x, -GROUND_HALF, GROUND_HALF)
      root.position.z = THREE.MathUtils.clamp(root.position.z, -GROUND_HALF, GROUND_HALF)

      // Explicit facing: rotate the root so its +Z (the avatar's forward) aligns
      // with the movement direction. atan2(x, z) is the yaw that maps +Z onto
      // (x, z). rotateTowards turns at a fixed angular speed (no snapping).
      const targetYaw = Math.atan2(_move.x, _move.z) + FACING_OFFSET
      _targetQuat.setFromAxisAngle(UP, targetYaw)
      root.quaternion.rotateTowards(_targetQuat, TURN_RATE * delta)
    }

    // Crossfade only on the moving/stopped transition. Both actions stay
    // playing so it's a smooth weight blend, not a hard cut.
    if (moving !== movingRef.current) {
      movingRef.current = moving
      const to = moving ? walkAction : idleAction
      const from = moving ? idleAction : walkAction
      from.fadeOut(CROSSFADE)
      // A completed fadeOut leaves an action DISABLED at effective weight 0, and
      // fadeIn neither re-enables it nor touches its base weight. So before
      // fading the incoming clip back in we must (1) re-enable it and (2) restore
      // its base weight to 1 — fadeIn ramps EFFECTIVE weight = baseWeight ×
      // interpolant(0→1), so if either is left at 0 nothing shows and the avatar
      // snaps to its bind (T-)pose. This is what makes repeated start/stop work.
      to.enabled = true
      to.setEffectiveWeight(1)
      to.fadeIn(CROSSFADE)
    }

    // Order matters: the mixer poses the humanoid bones for this frame, then
    // vrm.update propagates that pose and advances spring bones/expressions.
    mixer.update(delta)
    vrm.update(delta)
  })

  // The root group is the character: movement writes its position, steering
  // writes its rotation, and the follow camera reads its position. Its ref is
  // owned by App so CameraRig can share it.
  return (
    <group ref={rootRef}>
      <primitive object={vrm.scene} />
    </group>
  )
}
