import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { THEMES } from './themes'
import { QUALITY } from './render/quality'

// Key light (sun by day, moon at twilight) plus a hemisphere fill.
//
// The hemisphere light is what makes outdoor toon shading read: shadowed sides pick up
// the sky's colour from above and warm bounce from the ground below, instead of one flat
// ambient grey. The key light casts the only shadow map, fitted tightly around the island
// so its texels are spent where the camera can see them.

const SHADOW_EXTENT = 19 // metres: half-size of the shadow camera's square
const SUN_DISTANCE = 45

export default function Lights() {
  const sun = useRef()
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const themeId = useStore((s) => s.theme)
  const tier = useStore((s) => s.tier)
  const theme = THEMES[themeId]
  const shadowSize = QUALITY[tier].shadowMapSize

  const dir = useMemo(() => new THREE.Vector3(...theme.sun.direction).normalize(), [theme])

  // Turning shadows on/off changes which shader variant every material needs, so flag
  // all materials for a recompile when the tier changes (rare; never mid-interaction).
  useEffect(() => {
    gl.shadowMap.enabled = shadowSize > 0
    gl.shadowMap.type = THREE.PCFShadowMap
    scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
      for (const m of mats) m.needsUpdate = true
    })
  }, [gl, scene, shadowSize])

  useEffect(() => {
    const light = sun.current
    light.position.copy(dir).multiplyScalar(SUN_DISTANCE)
    light.target.position.set(0, 0, 0)
    light.target.updateMatrixWorld()
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
      light.shadow.map = null // reallocate at the new size
    }
    // Bias trades shadow acne (stripes on lit faces) against peter-panning (shadows
    // detaching from their casters); normalBias handles most of it on curved surfaces.
    light.shadow.bias = -0.0004
    light.shadow.normalBias = 0.025
  }, [dir, shadowSize])

  return (
    <>
      <hemisphereLight args={[theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity]} />
      <directionalLight
        ref={sun}
        color={theme.sun.color}
        intensity={theme.sun.intensity}
        castShadow={shadowSize > 0}
      >
        <object3D attach="target" />
      </directionalLight>
    </>
  )
}
