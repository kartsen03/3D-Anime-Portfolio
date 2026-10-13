// The two art directions. Everything that differs between them lives here, so the
// world can switch look at runtime (one setting, no remount) and both prototypes stay in
// sync as the scene grows.
//
// Colours are sRGB hex (three converts them to linear for shading). Light intensities
// are physically based: with three's Lambert term (albedo / π), a directional light of
// intensity π lights a surface facing it at its full albedo.

export const THEMES = {
  golden: {
    id: 'golden',
    label: 'Golden hour',
    exposure: 1.0,
    background: '#f2d3a5',
    sky: {
      zenith: '#2f62b8',
      upper: '#79aee6',
      horizon: '#ffd7a3',
      below: '#f6c7a0', // under the horizon, toward the cloud sea
      sunColor: '#fff3d6',
      sunSize: 0.035,
      sunGlow: 0.55,
      stars: 0,
    },
    // Sun low in the west-south-west: long shadows, warm rim on everything.
    sun: { direction: [-0.62, 0.42, -0.66], color: '#ffd9a8', intensity: 3.4 },
    hemi: { sky: '#a9c8ff', ground: '#e0b48c', intensity: 0.95 },
    fog: { color: '#f0cfa8', near: 45, far: 260, heightFalloff: 0.035 },
    toon: {
      shadow: '#8a83c9', // lavender: the cool side of the light
      terminator: '#f39a7a', // warm band at the light/shadow edge (anime "blush")
      lit: '#ffffff',
      threshold: 0.48,
      softness: 0.035,
      terminatorWidth: 0.07,
      rim: '#ffe6bf',
      rimStrength: 0.55,
      rimPower: 3.2,
    },
    lanterns: 0.15, // emissive strength multiplier for lantern lights (barely lit by day)
    bloom: { threshold: 0.92, smoothing: 0.22, intensity: 0.7, radius: 0.72 },
    grade: {
      lift: [0.03, 0.02, 0.05],
      gamma: [1.0, 1.0, 1.02],
      gain: [1.03, 1.0, 0.96],
      saturation: 1.07,
      contrast: 1.05,
      shadowTint: [0.45, 0.46, 0.58],
      highlightTint: [0.57, 0.52, 0.44],
      split: 0.16,
      grain: 0.012,
    },
    vignette: { darkness: 0.38, offset: 0.34 },
    outline: { inkColor: '#2b1c2e', inkTint: 0.55, strength: 0.9 },
  },

  twilight: {
    id: 'twilight',
    label: 'Twilight lanterns',
    exposure: 1.0,
    background: '#141533',
    sky: {
      zenith: '#0b0f2e',
      upper: '#232a63',
      horizon: '#c86f7e', // last light on the horizon
      below: '#2c2552',
      sunColor: '#ffd9e8',
      sunSize: 0.018, // the moon
      sunGlow: 0.35,
      stars: 1,
    },
    // Moonlight from high in the east: cool key, deep shadows, lanterns carry the warmth.
    sun: { direction: [0.45, 0.62, 0.64], color: '#b9c6ff', intensity: 1.15 },
    hemi: { sky: '#3a4a9a', ground: '#3d2a4a', intensity: 0.7 },
    fog: { color: '#2a2a5c', near: 35, far: 220, heightFalloff: 0.03 },
    toon: {
      shadow: '#3a3f86',
      terminator: '#8a5ca8',
      lit: '#e9ecff',
      threshold: 0.5,
      softness: 0.04,
      terminatorWidth: 0.06,
      rim: '#ffc58a', // lantern-warm rim
      rimStrength: 0.7,
      rimPower: 2.8,
    },
    lanterns: 1.0,
    bloom: { threshold: 0.78, smoothing: 0.3, intensity: 1.15, radius: 0.78 },
    grade: {
      lift: [0.02, 0.02, 0.06],
      gamma: [0.98, 1.0, 1.04],
      gain: [1.04, 0.99, 0.97],
      saturation: 1.1,
      contrast: 1.08,
      shadowTint: [0.44, 0.45, 0.62],
      highlightTint: [0.6, 0.52, 0.42],
      split: 0.2,
      grain: 0.016,
    },
    vignette: { darkness: 0.55, offset: 0.3 },
    outline: { inkColor: '#0d0b1e', inkTint: 0.5, strength: 0.85 },
  },
}
