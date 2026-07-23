import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { retargetMixamoAnimation } from './loadMixamoAnimation'
import { WALKABLE_RADIUS } from './islandConfig'

const MODEL_URL = '/models/avatar.vrm'
const IDLE_URL = '/animations/idle.fbx'
const WALK_URL = '/animations/walk.fbx'

// --- Movement tuning ---
// metres/second across the ground. Tuned to roughly match the walk clip's own
// stride pace (~1.7 m per ~1.03s cycle) so the feet don't visibly slide now
// that the clip's baked forward motion is stripped (see loadMixamoAnimation).
const WALK_SPEED = 1.7
const TURN_RATE = 10 // radians/second the character rotates toward its heading
const CROSSFADE = 0.25 // seconds to blend idle <-> walk

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
export default function Character({ rootRef, paused = false }) {
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

  // Collect the character's materials once (deduped). This VRM was exported with
  // MeshStandardMaterial rather than MToon, so there are no built-in MToon rim
  // uniforms — instead we inject our own view-space Fresnel rim into each
  // material's shader (below). The rim applies to all materials for a
  // whole-silhouette edge glow.
  const rimMaterials = useMemo(() => {
    const set = new Set()
    vrm.scene.traverse((obj) => {
      if (!obj.material) return
      const list = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of list) set.add(m)
    })
    return [...set]
  }, [vrm])

  // Shared uniform objects injected into every character material. Because all
  // the materials reference the SAME uniform objects, updating a .value here
  // updates the rim on all of them at once.
  const rimUniforms = useMemo(
    () => ({
      uRimColor: { value: new THREE.Color() }, // HDR (colour × intensity)
      uRimPower: { value: 4 }, // fresnel exponent: higher = tighter edge
      uRimMix: { value: 0.2 }, // 0 = rim always on; 1 = rim only where lit
    }),
    [],
  )

  // Inject a Fresnel rim term into each material's compiled shader ONCE. We
  // don't have MToon's parametric rim on this model, so we add our own via
  // onBeforeCompile (which lets you edit three's built-in shader source):
  //  - Fresnel = grazing-angle term, bright along the silhouette where the
  //    surface normal turns away from the view direction.
  //  - We add it just before <tonemapping_fragment>, so the rim is in LINEAR
  //    HDR (renderer tone mapping is off) and the Bloom pass can catch it.
  //  - `mix` gates the rim by how lit the fragment already is (approximated by
  //    its luminance), mirroring MToon's rimLightingMix: 0 = glow everywhere,
  //    1 = glow only on already-lit areas.
  useEffect(() => {
    for (const m of rimMaterials) {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uRimColor = rimUniforms.uRimColor
        shader.uniforms.uRimPower = rimUniforms.uRimPower
        shader.uniforms.uRimMix = rimUniforms.uRimMix
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimMix;',
          )
          .replace(
            '#include <tonemapping_fragment>',
            [
              'float rimFresnel = pow( clamp( 1.0 - dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 ), uRimPower );',
              'float rimLum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );',
              'float rimGate = mix( 1.0, rimLum, uRimMix );',
              'gl_FragColor.rgb += uRimColor * rimFresnel * rimGate;',
              '#include <tonemapping_fragment>',
            ].join('\n'),
          )
      }
      m.needsUpdate = true // force a recompile so the injection takes effect
    }
  }, [rimMaterials, rimUniforms])

  // Leva-tunable rim. `intensity` multiplies the colour into HDR (> 1.0) so the
  // Bloom pass (threshold ~1.0) catches the silhouette as a glow.
  const rim = useControls('Rim', {
    color: '#bfe9ff',
    intensity: { value: 2.5, min: 0, max: 8, step: 0.1 },
    fresnelPower: { value: 4.0, min: 0, max: 16, step: 0.1 },
    mix: { value: 0.2, min: 0, max: 1, step: 0.01 },
  })

  // Push slider values into the shared uniforms. Uniform values upload every
  // frame, so this updates the rim live with no shader recompile.
  useEffect(() => {
    rimUniforms.uRimColor.value.set(rim.color).multiplyScalar(rim.intensity)
    rimUniforms.uRimPower.value = rim.fresnelPower
    rimUniforms.uRimMix.value = rim.mix
  }, [rimUniforms, rim.color, rim.intensity, rim.fresnelPower, rim.mix])

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

    _move.set(0, 0, 0)

    // Skip movement input while a region panel is open (paused). _move stays
    // zero, so below the character crossfades back to idle and holds position —
    // but the animation updates at the bottom still run, so idle keeps playing.
    if (!paused) {
      const { forward, backward, left, right } = getKeys()

      // Camera-relative basis on the ground plane: the camera's look direction
      // flattened to XZ is "forward", and its right is forward × up. This makes
      // "forward" always move the character away from the camera along wherever
      // it's currently looking, which feels natural as you orbit.
      state.camera.getWorldDirection(_camDir)
      _camDir.y = 0
      _camDir.normalize()
      _camRight.crossVectors(_camDir, UP).normalize()

      if (forward) _move.add(_camDir)
      if (backward) _move.sub(_camDir)
      if (right) _move.add(_camRight)
      if (left) _move.sub(_camRight)
    }

    const moving = _move.lengthSq() > 0

    if (moving) {
      _move.normalize()

      // Translate the root at a constant speed; delta keeps it frame-rate
      // independent. Then clamp to the island's walkable disc: if we stepped
      // past WALKABLE_RADIUS from centre, pull straight back onto the circle.
      root.position.addScaledVector(_move, WALK_SPEED * delta)
      const distSq =
        root.position.x * root.position.x + root.position.z * root.position.z
      if (distSq > WALKABLE_RADIUS * WALKABLE_RADIUS) {
        const s = WALKABLE_RADIUS / Math.sqrt(distSq)
        root.position.x *= s
        root.position.z *= s
      }

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
