import * as THREE from 'three'

const BASE_FOV = 40 // vertical, degrees, on landscape screens
const MIN_HORIZONTAL_FOV = 56 // try to keep at least this much width visible on portrait screens
const MAX_FOV = 66 // …but never wider than this vertically (distortion)

/**
 * Responsive lens: on tall, narrow screens widen the vertical FOV so the world doesn't
 * shrink to a sliver around the character. Returns { fov, hFov } in degrees.
 */
export function lensFor(width, height) {
  const aspect = width / Math.max(height, 1)
  const vForMinH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(MIN_HORIZONTAL_FOV / 2)) / aspect))
  const fov = THREE.MathUtils.clamp(Math.max(BASE_FOV, vForMinH), BASE_FOV, MAX_FOV)
  const hFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect))
  return { fov, hFov }
}
