import * as THREE from 'three'

// Uniforms shared by every stylized material in the world. Each material's shader
// references these exact objects, so writing one `.value` restyles the whole scene in
// a single step — that's what lets the two art directions cross-fade at runtime
// (systems/WorldUniforms.jsx damps these toward the active theme each frame).
//
// Colours hold LINEAR values (three converts sRGB hex on .set()), because lighting maths
// happens in linear space; the post chain tone-maps and encodes to sRGB at the end.

export const U = {
  uTime: { value: 0 },

  // Wind, sampled by grass, trees, petals.
  uWindDir: { value: new THREE.Vector2(0.86, 0.5) },
  uWindStrength: { value: 1 },
  uNoise: { value: null }, // tiling noise texture (see makeNoiseTexture)

  // The player, for grass that bends out of the way.
  uCharacterPos: { value: new THREE.Vector3() },

  // Sky gradient (also used by fog, so distant geometry melts into the sky behind it).
  uSkyZenith: { value: new THREE.Color() },
  uSkyUpper: { value: new THREE.Color() },
  uSkyHorizon: { value: new THREE.Color() },
  uSkyBelow: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color() },
  uSunSize: { value: 0.03 },
  uSunGlow: { value: 0.5 },
  uStars: { value: 0 },
  uCloudShadow: { value: new THREE.Color() },
  uCloudMid: { value: new THREE.Color() },
  uCloudLit: { value: new THREE.Color() },

  // Fog.
  uFogNear: { value: 40 },
  uFogFar: { value: 260 },
  uFogHeightFalloff: { value: 0.03 },

  // Toon ramp: three tints across the light/shadow terminator.
  uToonShadow: { value: new THREE.Color() },
  uToonTerminator: { value: new THREE.Color() },
  uToonLit: { value: new THREE.Color() },
  uToonThreshold: { value: 0.5 },
  uToonSoftness: { value: 0.03 },
  uToonTerminatorWidth: { value: 0.07 },
  uRimColor: { value: new THREE.Color() },
  uRimStrength: { value: 0.5 },
  uRimPower: { value: 3 },

  // 0 = lanterns unlit (daylight) … 1 = full twilight glow.
  uLanterns: { value: 0 },
  // Lantern lights in view space (xyz) with their reach (w); see systems/lanterns.js.
  uLanternLights: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
  uLanternCount: { value: 0 },
  uLanternColor: { value: new THREE.Color('#ffb36b') },
}

/**
 * A 128×128 tiling noise texture: R and G are two independent octave sums of value
 * noise, B is a high-frequency detail layer. Generated once on the CPU (a few ms) so no
 * texture file is downloaded. Tiling matters: shaders scroll it endlessly for wind.
 */
export function makeNoiseTexture(size = 128) {
  const hash = (x, y, seed) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  // Periodic value noise: lattice coordinates wrap at `period` so the texture tiles.
  const noise = (x, y, period, seed) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const w = (v) => ((v % period) + period) % period
    const a = hash(w(xi), w(yi), seed)
    const b = hash(w(xi + 1), w(yi), seed)
    const c = hash(w(xi), w(yi + 1), seed)
    const d = hash(w(xi + 1), w(yi + 1), seed)
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x, y, seed, octaves, basePeriod) => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      const period = basePeriod << o
      const f = period / size
      sum += noise(x * f, y * f, period, seed + o * 13) * amp
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      data[i] = fbm(x, y, 1, 4, 4) * 255
      data[i + 1] = fbm(x, y, 7, 4, 4) * 255
      data[i + 2] = fbm(x, y, 3, 2, 16) * 255
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

U.uNoise.value = makeNoiseTexture()
