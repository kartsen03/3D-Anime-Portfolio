// The decision rules behind frame pacing and adaptive quality (see QualityManager.jsx),
// kept free of React and WebGL so they can be reasoned about — and tested — on their own.
//
// Three knobs, cheapest first:
//   divisor  draw on every Nth display refresh. On a 144 Hz panel a frame that takes 9 ms
//            can't hold 144 fps; the browser then shows some frames for one refresh and
//            some for two, and motion judders even though the average reads ~100 fps.
//            Drawing every other refresh gives an even 72 fps instead, which looks
//            smoother. Changing it is invisible, so it may change at any time.
//   scale    render resolution within the tier (fewer pixels). Visible, so rare.
//   tier     the quality tier (density, shadows, effects); Auto quality only. Rebuilding
//            it is a hitch, so it changes mostly behind the splash.

export const SCALES = [1, 0.85, 0.72]
const MIN_FPS = 55 // pacing never drops below this; quality is reduced instead
const LONGEST_FRAME = 1000 / MIN_FPS
const BUSY = 0.88 // over this share of the frame interval: overloaded
const ROOMY = 0.7 // under this share of the next faster interval: room to speed up

/** How long a drawn frame may take at this divisor (ms). */
export const frameBudget = (divisor, refreshMs) => Math.min(divisor * refreshMs, LONGEST_FRAME)

/** The most refreshes a frame may span while staying at or above MIN_FPS. */
export const maxDivisor = (refreshMs) => Math.max(1, Math.min(4, Math.floor(1000 / refreshMs / MIN_FPS)))

/**
 * One decision step (called a couple of times a second).
 *  s:  { divisor, scale, tierIndex, busyFor, roomyFor, lastScaleChange, tierChanges }
 *  m:  { refreshMs, gpuMs (or null when the browser has no GPU timer), frameMs }
 *  ctx: { phase, auto, tiers, now, step }  (step = seconds since the last decision)
 * Returns the changes to make, or null.
 */
export function decide(s, m, ctx) {
  const { refreshMs, gpuMs, frameMs } = m
  if (!refreshMs) return null
  const dMax = maxDivisor(refreshMs)
  const budget = frameBudget(s.divisor, refreshMs)
  // Without a GPU timer, judge by how long drawn frames actually take to come round.
  const busy = gpuMs != null ? gpuMs > BUSY * budget : frameMs > 1.35 * budget
  const faster = s.divisor > 1 ? frameBudget(s.divisor - 1, refreshMs) : refreshMs
  const roomy = gpuMs != null && gpuMs < ROOMY * faster

  s.busyFor = busy ? s.busyFor + ctx.step : 0
  s.roomyFor = roomy ? s.roomyFor + ctx.step : 0

  const behindSplash = ctx.phase === 'loading' || ctx.phase === 'ready'
  const exploring = ctx.phase === 'explore'
  const scaleCooldownOver = ctx.now - s.lastScaleChange > (behindSplash ? 0.6 : 3)

  if (s.divisor > dMax) return { divisor: dMax }

  if (s.busyFor >= (behindSplash ? 0.5 : 1)) {
    s.busyFor = 0
    if (s.divisor < dMax) return { divisor: s.divisor + 1 }
    if (!(behindSplash || exploring) || !scaleCooldownOver) return null
    if (ctx.auto && s.scale < SCALES.length - 1) return { scale: s.scale + 1 }
    if (ctx.auto && s.tierIndex > 0 && (behindSplash || s.tierChanges < 2)) return { tierIndex: s.tierIndex - 1, scale: 0 }
    return null
  }

  if (s.roomyFor >= (behindSplash ? 0.6 : 4)) {
    s.roomyFor = 0
    if (ctx.phase === 'intro') return null
    if (s.divisor > 1) return { divisor: s.divisor - 1 }
    if (!scaleCooldownOver) return null
    // At full rate with plenty to spare: sharpen first, then (behind the splash only,
    // where the rebuild can't be seen) try a richer tier.
    if (ctx.auto && s.scale > 0 && gpuMs < 0.5 * refreshMs) return { scale: s.scale - 1 }
    if (ctx.auto && behindSplash && s.scale === 0 && s.tierIndex < ctx.tiers - 1 && gpuMs < 0.35 * refreshMs) {
      return { tierIndex: s.tierIndex + 1 }
    }
  }
  return null
}
