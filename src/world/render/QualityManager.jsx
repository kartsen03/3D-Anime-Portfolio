import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useStore } from '../../state/store'
import { TIERS, guessInitialTier, tierDpr } from './quality'

// Picks the quality tier and keeps the frame rate smooth.
//
// "Auto" starts from a hardware guess, then drei's PerformanceMonitor watches real frame
// rates: if most recent samples fall under the lower bound it steps the tier down, if
// they sit above the upper bound it steps up. `flipflops` caps the back-and-forth, after
// which it settles — a visitor should never see quality pumping up and down.
export default function QualityManager() {
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)
  const quality = useStore((s) => s.quality)
  const tier = useStore((s) => s.tier)
  const setTier = useStore((s) => s.setTier)
  const settled = useRef(false)

  // Initial tier: the visitor's explicit choice, or a guess from the hardware.
  useEffect(() => {
    setTier(quality === 'auto' ? guessInitialTier(gl) : quality)
    settled.current = quality !== 'auto'
  }, [gl, quality, setTier])

  // Tier → pixel ratio. The composer listens for this and resizes its buffers.
  useEffect(() => {
    setDpr(tierDpr(tier))
  }, [tier, setDpr])

  const step = (dir) => {
    if (useStore.getState().quality !== 'auto' || settled.current) return
    const i = TIERS.indexOf(useStore.getState().tier)
    const next = TIERS[Math.min(Math.max(i + dir, 0), TIERS.length - 1)]
    if (next !== TIERS[i]) setTier(next)
  }

  return (
    <PerformanceMonitor
      // Samples every 250 ms, decides on the last 10 (2.5 s of evidence).
      ms={250}
      iterations={10}
      threshold={0.8}
      // 60 Hz screens: below 50 fps is a decline, above 59 lets us try more.
      // High-refresh screens: below 75 declines, above 110 inclines.
      bounds={(refreshrate) => (refreshrate > 90 ? [75, 110] : [50, 59])}
      flipflops={2}
      onDecline={() => step(-1)}
      onIncline={() => step(+1)}
      onFallback={() => {
        settled.current = true
      }}
    />
  )
}
