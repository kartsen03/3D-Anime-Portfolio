import * as THREE from 'three'
import { U } from '../materials/globalUniforms'

// Every glowing lantern registers here. Each frame their positions are transformed into
// view space for the toon shader, which adds their warm light to nearby surfaces (see
// LANTERN_GLSL in shaderLib). This fakes up to MAX point lights without making every
// material loop over real three.js lights — and without any shadow cost.

export const MAX_LANTERNS = 16

const lanterns = [] // { position: Vector3 (world), radius }

export function registerLantern(position, radius = 5.5) {
  const entry = { position: position.clone(), radius }
  lanterns.push(entry)
  return () => {
    const i = lanterns.indexOf(entry)
    if (i !== -1) lanterns.splice(i, 1)
  }
}

export function lanternPositions() {
  return lanterns
}

const _v = new THREE.Vector3()

/** Called once per frame after the camera has moved. */
export function updateLanternUniforms(camera) {
  const count = Math.min(lanterns.length, MAX_LANTERNS)
  const out = U.uLanternLights.value
  for (let i = 0; i < count; i++) {
    _v.copy(lanterns[i].position).applyMatrix4(camera.matrixWorldInverse)
    out[i].set(_v.x, _v.y, _v.z, lanterns[i].radius)
  }
  U.uLanternCount.value = count
}
