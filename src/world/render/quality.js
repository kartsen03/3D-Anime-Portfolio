// Quality tiers. Every expensive feature reads its budget from here, so "make it run
// on a phone" is one table instead of scattered if-statements.
//
// How the numbers were chosen (measured on an Intel Iris Xe, the integrated GPU class
// most laptop visitors have): the old pipeline spent ~12–18 ms per frame, almost all of
// it in post-processing because both composer buffers were 8× MSAA half-float. The scene
// itself cost 0.6 ms. So the tiers spend on what you can see (pixels, shadows, grass)
// and keep the post chain lean: no MSAA, one merged final pass, a short bloom chain.

export const TIERS = ['low', 'medium', 'high']

export const QUALITY = {
  low: {
    dprMax: 1, // render at CSS pixel resolution at most
    msaa: 0,
    aa: 'fxaa', // single cheap pass
    bloomLevels: 4,
    shadowMapSize: 0, // blob shadow under the character instead of a shadow map
    density: 0.35, // scales grass, petals, clouds…
  },
  medium: {
    dprMax: 1.5,
    msaa: 0,
    // SMAA measured 2.2 ms of a 9.7 ms frame at 1600×900 on Iris Xe (more than all the
    // grass); FXAA is a fraction of that, and the ink outlines already keep silhouettes clean.
    aa: 'fxaa',
    bloomLevels: 5,
    shadowMapSize: 1024,
    density: 0.7,
  },
  high: {
    dprMax: 2,
    msaa: 0,
    aa: 'smaa',
    bloomLevels: 6,
    shadowMapSize: 2048,
    density: 1,
  },
}

/** The device-pixel-ratio a tier renders at on this screen. */
export function tierDpr(tier) {
  return Math.min(window.devicePixelRatio || 1, QUALITY[tier].dprMax)
}

/**
 * First guess at a tier before any frame has been measured. The PerformanceMonitor then
 * corrects it within the first seconds (during the intro, where a change isn't noticed).
 */
export function guessInitialTier(gl) {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const shortSide = Math.min(window.screen?.width ?? 1280, window.screen?.height ?? 800)
  if (coarse && shortSide < 820) return 'low' // phones

  let gpu = ''
  try {
    const ctx = gl.getContext()
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    gpu = ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)
  } catch {
    // Some browsers hide the GPU string; fall through to the default.
  }
  if (/apple m\d|rtx|geforce (gtx|rtx)|radeon (rx|pro)|arc\(tm\) a|arc a\d/i.test(gpu)) return 'high'
  if (/swiftshader|llvmpipe|software/i.test(gpu)) return 'low'
  return 'medium'
}
