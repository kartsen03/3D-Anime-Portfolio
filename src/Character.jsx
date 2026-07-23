import { useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { retargetMixamoAnimation } from './loadMixamoAnimation'

const MODEL_URL = '/models/avatar.vrm'
const IDLE_URL = '/animations/idle.fbx'

// Loads and renders the VRM avatar, playing a looping idle animation that was
// authored for a Mixamo rig and retargeted onto the VRM humanoid.
export default function Character() {
  // useLoader suspends this component until the file is parsed, then caches the
  // result by URL. The 3rd arg configures the GLTFLoader before it runs:
  // registering VRMLoaderPlugin makes GLTFLoader parse the VRM extensions and
  // attach the resulting avatar object to gltf.userData.vrm.
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })

  // Load the raw Mixamo FBX (skeleton + animation, no skin). useLoader suspends
  // for this too, so both assets are ready before we build the mixer below.
  const idleAsset = useLoader(FBXLoader, IDLE_URL)

  // Prepare the VRM exactly once PER LOADED FILE. These VRMUtils calls mutate
  // the model in place and are NOT idempotent — rotateVRM0 rotates 180° every
  // time it runs, so applying it an even number of times cancels out and the
  // avatar faces the wrong way. useLoader caches gltf and React StrictMode
  // (dev) mounts components twice, so without a guard this memo's body can run
  // more than once on the same cached object. The flag on scene.userData
  // persists with the cached gltf and makes prep strictly one-shot.
  const vrm = useMemo(() => {
    const vrm = gltf.userData.vrm

    if (!vrm.scene.userData.prepared) {
      // Perf: strip data the renderer never needs. combineSkeletons is the v3
      // replacement for the old removeUnnecessaryJoints.
      VRMUtils.removeUnnecessaryVertices(gltf.scene)
      VRMUtils.combineSkeletons(gltf.scene)

      // VRM 0.x avatars are authored facing +Z; rotateVRM0 spins 0.x models
      // 180° to the VRM 1.0 baseline (-Z). See the return statement for how the
      // avatar ends up facing the +Z camera once the idle animation is playing.
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

  // Build the animation mixer + idle action once both assets exist. This is
  // construction only. AnimationMixer is Three.js's playback engine: it samples
  // clips over time and writes the results onto the target object's properties
  // each frame. We target vrm.scene because the retargeted tracks address the
  // VRM's NORMALIZED humanoid bones, which live in that subtree.
  const { mixer, action } = useMemo(() => {
    const mixer = new THREE.AnimationMixer(vrm.scene)
    const clip = retargetMixamoAnimation(idleAsset, vrm)
    const action = mixer.clipAction(clip)
    return { mixer, action }
  }, [vrm, idleAsset])

  // Start playback here, NOT in the memo: .play() is a side effect, and React
  // StrictMode (dev) mounts components twice (setup → cleanup → setup). Keeping
  // start/stop symmetric in one effect means the simulated unmount's stop() is
  // always followed by a fresh reset().play(), so the idle survives the remount.
  // (Playing inside useMemo would get stopped by the cleanup and never restart.)
  // reset() rewinds to the start; AnimationActions loop (LoopRepeat) by default.
  useEffect(() => {
    action.reset().play()
    return () => action.stop()
  }, [action])

  // Order matters: the mixer poses the humanoid bones for THIS frame first,
  // then vrm.update propagates that pose to the render skeleton and advances
  // spring bones (hair/cloth) and expressions. delta = seconds since last frame.
  useFrame((_, delta) => {
    mixer.update(delta)
    vrm.update(delta)
  })

  // This group is the character's ROOT (facing now; movement later). rotateVRM0
  // puts the model on the VRM 1.0 baseline (-Z) and the retargeted Mixamo idle's
  // hips then orient it toward +Z, so at zero rotation the avatar already faces
  // the +Z camera — no extra spin needed here. <primitive> drops an existing
  // Three.js object into the R3F tree.
  return (
    <group>
      <primitive object={vrm.scene} />
    </group>
  )
}
