import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { THEMES } from './themes'
import { QUALITY } from './render/quality'
import { U } from './materials/globalUniforms'
import { runtime, FRAME } from './systems/runtime'
import { updateLanternUniforms } from './systems/lanterns'

// Lights + every theme-driven uniform, in one place.
//
// Switching art direction cross-fades instead of snapping: each frame, every colour,
// direction and intensity moves a little toward the active theme (exponential damping,
// ~1.5 s to settle). The sun visibly swings and dims into moonlight while lanterns warm
// up — a small "time of day" moment instead of a hard cut.
//
// The key light casts the only shadow map, fitted tightly around the island so its
// texels are spent where the camera can see them.

const SHADOW_EXTENT = 19
const SUN_DISTANCE = 45
const BLEND_LAMBDA = 2.2

const _c = new THREE.Color()

function targetsFor(theme) {
  return {
    skyZenith: new THREE.Color(theme.sky.zenith),
    skyUpper: new THREE.Color(theme.sky.upper),
    skyHorizon: new THREE.Color(theme.sky.horizon),
    skyBelow: new THREE.Color(theme.sky.below),
    sunColorSky: new THREE.Color(theme.sky.sunColor),
    cloudShadow: new THREE.Color(theme.sky.cloudShadow),
    cloudMid: new THREE.Color(theme.sky.cloudMid),
    cloudLit: new THREE.Color(theme.sky.cloudLit),
    sunDir: new THREE.Vector3(...theme.sun.direction).normalize(),
    sunLight: new THREE.Color(theme.sun.color),
    sunIntensity: theme.sun.intensity,
    hemiSky: new THREE.Color(theme.hemi.sky),
    hemiGround: new THREE.Color(theme.hemi.ground),
    hemiIntensity: theme.hemi.intensity,
    toonShadow: new THREE.Color(theme.toon.shadow),
    toonTerminator: new THREE.Color(theme.toon.terminator),
    toonLit: new THREE.Color(theme.toon.lit),
    rim: new THREE.Color(theme.toon.rim),
    numbers: {
      uSunSize: theme.sky.sunSize,
      uSunGlow: theme.sky.sunGlow,
      uStars: theme.sky.stars,
      uFogNear: theme.fog.near,
      uFogFar: theme.fog.far,
      uFogHeightFalloff: theme.fog.heightFalloff,
      uToonThreshold: theme.toon.threshold,
      uToonSoftness: theme.toon.softness,
      uToonTerminatorWidth: theme.toon.terminatorWidth,
      uRimStrength: theme.toon.rimStrength,
      uRimPower: theme.toon.rimPower,
      uLanterns: theme.lanterns,
    },
    background: new THREE.Color(theme.background),
  }
}

export default function WorldLighting() {
  const sun = useRef()
  const hemi = useRef()
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const themeId = useStore((s) => s.theme)
  const tier = useStore((s) => s.tier)
  const shadowSize = QUALITY[tier].shadowMapSize

  const target = useMemo(() => targetsFor(THEMES[themeId]), [themeId])
  const first = useRef(true)

  // Fog: the patched materials draw their fog colour from the sky gradient; scene.fog
  // enables the fog code path and gives unpatched materials (the MToon character) a
  // matching fallback colour.
  useEffect(() => {
    scene.fog = new THREE.Fog('#ffffff', 40, 260)
    return () => {
      scene.fog = null
    }
  }, [scene])

  // Turning shadows on/off changes the shader variant every material needs: flag a
  // recompile (tier changes are rare and never happen mid-interaction).
  useEffect(() => {
    gl.shadowMap.enabled = shadowSize > 0
    gl.shadowMap.type = THREE.PCFShadowMap
    scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
      for (const m of mats) m.needsUpdate = true
    })
    const light = sun.current
    const cam = light.shadow.camera
    cam.left = -SHADOW_EXTENT
    cam.right = SHADOW_EXTENT
    cam.top = SHADOW_EXTENT
    cam.bottom = -SHADOW_EXTENT
    cam.near = 5
    cam.far = SUN_DISTANCE * 2
    cam.updateProjectionMatrix()
    if (shadowSize > 0) {
      light.shadow.mapSize.set(shadowSize, shadowSize)
      light.shadow.map?.dispose()
      light.shadow.map = null // reallocated at the new size on the next render
    }
    // Bias trades shadow acne (stripes on lit faces) against peter-panning (shadows
    // detaching from their casters); normalBias handles most of it on curved surfaces.
    light.shadow.bias = -0.0004
    light.shadow.normalBias = 0.03
  }, [gl, scene, shadowSize])

  useFrame((state, delta) => {
    runtime.time += Math.min(delta, 0.1)
    const k = first.current ? 1 : 1 - Math.exp(-BLEND_LAMBDA * Math.min(delta, 0.1))
    first.current = false

    U.uSkyZenith.value.lerp(target.skyZenith, k)
    U.uSkyUpper.value.lerp(target.skyUpper, k)
    U.uSkyHorizon.value.lerp(target.skyHorizon, k)
    U.uSkyBelow.value.lerp(target.skyBelow, k)
    U.uSunColor.value.lerp(target.sunColorSky, k)
    U.uCloudShadow.value.lerp(target.cloudShadow, k)
    U.uCloudMid.value.lerp(target.cloudMid, k)
    U.uCloudLit.value.lerp(target.cloudLit, k)
    U.uSunDir.value.lerp(target.sunDir, k).normalize()
    U.uToonShadow.value.lerp(target.toonShadow, k)
    U.uToonTerminator.value.lerp(target.toonTerminator, k)
    U.uToonLit.value.lerp(target.toonLit, k)
    U.uRimColor.value.lerp(target.rim, k)
    for (const [name, value] of Object.entries(target.numbers)) U[name].value += (value - U[name].value) * k

    const light = sun.current
    light.color.lerp(target.sunLight, k)
    light.intensity += (target.sunIntensity - light.intensity) * k
    light.position.copy(U.uSunDir.value).multiplyScalar(SUN_DISTANCE)
    light.target.position.set(0, 0, 0)
    light.target.updateMatrixWorld()

    const h = hemi.current
    h.color.lerp(target.hemiSky, k)
    h.groundColor.lerp(target.hemiGround, k)
    h.intensity += (target.hemiIntensity - h.intensity) * k

    if (scene.fog) {
      scene.fog.color.copy(U.uSkyHorizon.value)
      scene.fog.near = U.uFogNear.value
      scene.fog.far = U.uFogFar.value
    }
    state.gl.setClearColor(_c.copy(U.uSkyHorizon.value))

    // Shared per-frame values.
    updateLanternUniforms(state.camera)
    U.uTime.value = runtime.time
    U.uCharacterPos.value.copy(runtime.character.position)
  }, FRAME.world)

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#ffffff', 1]} />
      <directionalLight ref={sun} castShadow={shadowSize > 0}>
        <object3D attach="target" />
      </directionalLight>
    </>
  )
}
