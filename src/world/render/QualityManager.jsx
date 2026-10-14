import { useEffect } from 'react'
import { advance, useThree } from '@react-three/fiber'
import { useStore } from '../../state/store'
import { runtime } from '../systems/runtime'
import { TIERS, guessInitialTier, tierDpr } from './quality'
import { decide, maxDivisor, SCALES } from './pacing'

// Frame pacing and adaptive quality.
//
// The canvas never renders on its own (frameloop="never" in World.jsx). This loop runs on
// every display refresh and decides whether to draw a frame now, at what resolution and —
// in Auto quality — at which tier. The rules live in pacing.js; this file measures and
// applies them. It measures:
//  • the display's refresh interval, from requestAnimationFrame timestamps: specifically
//    the gap from each drawn frame to the next callback, which is paced by the display.
//    (Callbacks after a skipped frame can come early — headless Chrome runs them ~6 ms
//    apart regardless of the display — so those don't count.);
//  • how long the GPU spends on each frame, from EXT_disjoint_timer_query where the
//    browser offers it (it runs asynchronously: results arrive a few frames later);
//  • how long drawn frames take to come round (the fallback when there is no GPU timer).
// Most decisions happen behind the splash while the island loads, so the opening shot
// plays at a settled quality; afterwards they are rare and cautious, because changing the
// resolution or tier is itself a visible hitch.

const DECIDE_EVERY = 500 // ms

const quantile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}
const keep = (list, value, n) => {
  list.push(value)
  if (list.length > n) list.shift()
}

function createReadout() {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'fixed',
    left: '12px',
    bottom: '12px',
    zIndex: '50',
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgba(10, 12, 24, 0.72)',
    color: '#f3f0ea',
    font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    pointerEvents: 'none',
  })
  el.textContent = 'measuring…'
  document.body.appendChild(el)
  return el
}

export default function QualityManager() {
  const get = useThree((s) => s.get)
  const setDpr = useThree((s) => s.setDpr)
  const quality = useStore((s) => s.quality)
  const setTier = useStore((s) => s.setTier)

  // Initial tier: the visitor's explicit choice, or a guess from the hardware.
  useEffect(() => {
    setTier(quality === 'auto' ? guessInitialTier(get().gl) : quality)
  }, [get, quality, setTier])

  useEffect(() => {
    const ctx = get().gl.getContext()
    const timer = ctx.getExtension('EXT_disjoint_timer_query_webgl2')
    const pacer = {
      divisor: 1,
      scale: 0,
      busyFor: 0,
      roomyFor: 0,
      lastScaleChange: -Infinity,
      tierChanges: 0,
      refreshMs: 0,
      gpuMs: null,
      frameMs: 0,
    }
    if (import.meta.env.DEV) window.__pacer = pacer
    // ?pacerlog (dev only): log each decision, for automated runs in a real browser.
    const debugLog = import.meta.env.DEV && new URLSearchParams(window.location.search).has('pacerlog')
    // ?perf (any build): a small readout of what the pacer measured and chose, so a
    // visitor's machine can be diagnosed without dev tools.
    const readout = new URLSearchParams(window.location.search).has('perf') ? createReadout() : null
    const cpuTimes = []
    let lastCalls = 0
    let lastTris = 0

    const refreshGaps = [] // gap from a drawn frame to the next callback (ms)
    const gpuTimes = [] // GPU time per drawn frame (ms)
    const drawGaps = [] // intervals between drawn frames (ms)
    const pending = [] // timer queries in flight, oldest first
    const spare = []
    let raf = 0
    let lastRefresh = 0
    let lastDraw = 0
    let drewLast = false // was a frame drawn in the previous callback?
    let nextDecision = 0
    let clock = get().clock.elapsedTime

    const applyDpr = () => setDpr(tierDpr(useStore.getState().tier) * SCALES[pacer.scale])
    applyDpr()
    const resetSamples = () => {
      gpuTimes.length = 0
      drawGaps.length = 0
    }
    // Tier changes (Auto, or the visitor's own choice) re-derive the pixel ratio; an
    // explicit quality choice also drops any resolution scaling.
    const unsubTier = useStore.subscribe((s) => s.tier, () => {
      applyDpr()
      resetSamples()
    })
    const unsubQuality = useStore.subscribe((s) => s.quality, () => {
      pacer.scale = 0
      applyDpr()
    })

    const readTimers = () => {
      if (!timer) return
      // A "disjoint" event (GPU clock or power change) invalidates the queries in flight.
      if (ctx.getParameter(timer.GPU_DISJOINT_EXT)) {
        spare.push(...pending.splice(0))
        return
      }
      while (pending.length && ctx.getQueryParameter(pending[0], ctx.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift()
        keep(gpuTimes, ctx.getQueryParameter(q, ctx.QUERY_RESULT) / 1e6, 30)
        spare.push(q)
      }
    }

    const applyChange = (change, nowSec, phase) => {
      if (change.divisor != null) {
        pacer.divisor = change.divisor
        drawGaps.length = 0
      }
      if (change.scale != null) {
        pacer.scale = change.scale
        pacer.lastScaleChange = nowSec
      }
      if (change.tierIndex != null) {
        if (phase === 'explore') pacer.tierChanges++
        useStore.getState().setTier(TIERS[change.tierIndex]) // re-applies the pixel ratio
      } else if (change.scale != null) {
        applyDpr()
        resetSamples()
      }
    }

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const gap = lastRefresh ? now - lastRefresh : 0
      lastRefresh = now
      // Look-dev drives frames itself, with simulated time (dev only).
      if (runtime.manualFrames) return
      if (drewLast && gap > 0 && gap < 100) keep(refreshGaps, gap, 90)
      drewLast = false
      // The 10th percentile: most frames come round on time, late ones only run long.
      // (Until the first frames are drawn, assume 60 Hz.)
      const refreshMs = refreshGaps.length >= 8 ? quantile(refreshGaps, 0.1) : 1000 / 60
      pacer.refreshMs = refreshMs
      if (pacer.divisor > maxDivisor(refreshMs)) pacer.divisor = maxDivisor(refreshMs)
      readTimers()

      const store = useStore.getState()
      if (store.mode !== 'world') {
        // Text version: the world sleeps (no GPU work, no battery drain).
        lastDraw = 0
        return
      }
      // Draw on every `divisor`-th refresh (with half a refresh of slack for jitter).
      if (lastDraw && now - lastDraw < (pacer.divisor - 0.5) * refreshMs) return

      if (lastDraw) keep(drawGaps, now - lastDraw, 30)
      // World time advances by real elapsed time, capped so a stall doesn't teleport anything.
      clock = Math.max(clock, get().clock.elapsedTime) + Math.min(lastDraw ? now - lastDraw : refreshMs, 100) / 1000
      lastDraw = now
      drewLast = true
      let query = null
      if (timer && pending.length < 8) {
        query = spare.pop() ?? ctx.createQuery()
        ctx.beginQuery(timer.TIME_ELAPSED_EXT, query)
      }
      const cpuStart = debugLog ? performance.now() : 0
      if (debugLog) {
        get().gl.info.autoReset = false
        get().gl.info.reset()
      }
      advance(clock, true)
      if (debugLog) {
        keep(cpuTimes, performance.now() - cpuStart, 30)
        lastCalls = get().gl.info.render.calls
        lastTris = get().gl.info.render.triangles
      }
      if (query) {
        ctx.endQuery(timer.TIME_ELAPSED_EXT)
        pending.push(query)
      }

      if (now < nextDecision) return
      nextDecision = now + DECIDE_EVERY
      pacer.gpuMs = timer && gpuTimes.length >= 10 ? quantile(gpuTimes, 0.5) : null
      pacer.frameMs = drawGaps.length >= 10 ? quantile(drawGaps, 0.5) : pacer.divisor * refreshMs
      pacer.tierIndex = TIERS.indexOf(store.tier)
      const change = decide(
        pacer,
        { refreshMs, gpuMs: pacer.gpuMs, frameMs: pacer.frameMs },
        { phase: store.phase, auto: store.quality === 'auto', tiers: TIERS.length, now: now / 1000, step: DECIDE_EVERY / 1000 },
      )
      if (change) applyChange(change, now / 1000, store.phase)
      if (readout) {
        const fps = Math.round(1000 / pacer.frameMs)
        const gpu = pacer.gpuMs == null ? 'n/a' : `${pacer.gpuMs.toFixed(1)} ms`
        const hz = Math.round(1000 / refreshMs)
        readout.textContent = `${fps} fps (${hz} Hz display, every ${['', '', '2nd ', '3rd ', '4th '][pacer.divisor]}refresh) · GPU ${gpu} · ${store.tier} at ${Math.round(SCALES[pacer.scale] * 100)}% resolution`
      }
      if (debugLog) {
        console.log(
          `[pacer] ${JSON.stringify({ t: +(now / 1000).toFixed(1), phase: store.phase, tier: store.tier, divisor: pacer.divisor, scale: SCALES[pacer.scale], refreshMs: +refreshMs.toFixed(2), gpuMs: pacer.gpuMs && +pacer.gpuMs.toFixed(2), frameMs: +pacer.frameMs.toFixed(2), cpuMs: cpuTimes.length ? +quantile(cpuTimes, 0.5).toFixed(2) : null, calls: lastCalls, tris: lastTris, change })}`,
        )
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      unsubTier()
      unsubQuality()
      for (const q of [...pending, ...spare]) ctx.deleteQuery(q)
      readout?.remove()
    }
  }, [get, setDpr])

  return null
}
