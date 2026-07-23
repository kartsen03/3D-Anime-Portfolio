import * as THREE from 'three'

// MeshToonMaterial turns smooth lighting into a few flat "cels" by sampling a
// 1-D gradient ramp (the gradientMap) with the surface's light intensity.
// This builds that ramp as a tiny width×1 DataTexture of evenly spaced grey
// stops. NearestFilter is the key: it snaps each sample to the closest stop
// with NO blending, which is what produces hard cel-shaded banding instead of
// a smooth gradient. (This is the current, non-deprecated three.js approach —
// the same one used in three's official toon-material example.)
export function makeToonGradient(steps = 4) {
  const data = new Uint8Array(steps)
  for (let i = 0; i < steps; i++) {
    // Spread stops from dark (0) to light (255) across the ramp.
    data[i] = Math.round((i / (steps - 1)) * 255)
  }

  // RedFormat: one 8-bit channel per texel — the toon shader only reads .r.
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true // DataTextures must be flagged after their data is set.
  return texture
}
