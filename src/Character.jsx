import { useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

const MODEL_URL = '/models/avatar.vrm'

// Loads and renders the VRM avatar. VRM is a glTF file with extra extensions
// (humanoid rig, MToon materials, spring bones, expressions); @pixiv/three-vrm
// teaches GLTFLoader how to read those extensions via a loader plugin.
export default function Character() {
  // useLoader suspends this component until the file is parsed, then caches the
  // result by URL. The 3rd arg configures the GLTFLoader before it runs:
  // registering VRMLoaderPlugin makes GLTFLoader parse the VRM extensions and
  // attach the resulting avatar object to gltf.userData.vrm.
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })

  // Prepare the VRM exactly once. useLoader caches gltf, so this memo won't
  // re-run on re-renders; we mutate the loaded scene in place here.
  const vrm = useMemo(() => {
    const vrm = gltf.userData.vrm

    // Perf: strip data the renderer never needs. combineSkeletons is the v3
    // replacement for the old removeUnnecessaryJoints.
    VRMUtils.removeUnnecessaryVertices(gltf.scene)
    VRMUtils.combineSkeletons(gltf.scene)

    // VRM 0.x avatars face +Z; VRM 1.0 face -Z. rotateVRM0 rotates 0.x models
    // 180° so BOTH versions end up facing -Z — a single consistent baseline.
    // The wrapper group (below) then turns that to face the +Z camera.
    VRMUtils.rotateVRM0(vrm)

    // VRM meshes sometimes report a bad bounding volume and get frustum-culled
    // (vanish) at certain camera angles. Disabling per-object culling avoids it.
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false
    })

    return vrm
  }, [gltf])

  // Spring bones (hair/cloth physics) and expressions only advance when we call
  // vrm.update(delta) each frame. delta = seconds since the previous frame.
  useFrame((_, delta) => {
    vrm.update(delta)
  })

  // The wrapper group turns the normalized (-Z-facing) avatar 180° to face the
  // +Z camera. <primitive> drops an existing Three.js object into the R3F tree.
  return (
    <group rotation={[0, Math.PI, 0]}>
      <primitive object={vrm.scene} />
    </group>
  )
}
