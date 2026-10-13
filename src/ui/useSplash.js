import { useEffect } from 'react'
import { useStore } from '../state/store'

// The splash screen is plain HTML in index.html, so it paints instantly — before any
// JavaScript has downloaded. This hook takes it over once React runs: it drives the
// progress bar, enables "Enter" when the world is compiled and ready, and fades the
// splash away. Screen readers hear only the milestones (loading, ready), not every
// percentage tick.
export function useSplash() {
  useEffect(() => {
    const splash = document.getElementById('splash')
    if (!splash) return
    const bar = splash.querySelector('.splash__bar i')
    const status = document.getElementById('splash-status')
    const pct = document.getElementById('splash-pct')
    const enter = document.getElementById('splash-enter')
    const quick = document.getElementById('splash-quick')

    let dismissed = false
    const dismiss = () => {
      if (dismissed) return
      dismissed = true
      splash.dataset.state = 'leaving'
      setTimeout(() => splash.remove(), 950)
    }

    const begin = () => {
      const store = useStore.getState()
      if (store.phase !== 'ready') return
      // Phase 2 adds the opening camera move ('intro') between ready and explore.
      store.setPhase('explore')
      dismiss()
    }
    const toQuick = (e) => {
      e.preventDefault()
      useStore.getState().setMode('quick')
      dismiss()
    }

    enter.addEventListener('click', begin)
    quick.addEventListener('click', toQuick)

    const unsubProgress = useStore.subscribe(
      (s) => s.progress,
      (p) => {
        bar?.style.setProperty('--progress', String(p))
        if (pct && useStore.getState().phase === 'loading') pct.textContent = `${Math.round(p * 100)}%`
      },
      { fireImmediately: true },
    )

    const unsubPhase = useStore.subscribe(
      (s) => s.phase,
      (phase) => {
        if (phase !== 'ready') return
        enter.disabled = false
        status.textContent = 'The island is ready.'
        if (pct) pct.textContent = ''
        // A deep link (/#projects) goes straight in.
        if (useStore.getState().pendingSection) begin()
      },
      { fireImmediately: true },
    )

    const unsubError = useStore.subscribe(
      (s) => s.loadError,
      (err) => {
        if (err) dismiss()
      },
    )

    // Starting in the text version (no WebGL, or /#quick): no splash needed.
    if (useStore.getState().mode === 'quick') dismiss()

    return () => {
      enter.removeEventListener('click', begin)
      quick.removeEventListener('click', toQuick)
      unsubProgress()
      unsubPhase()
      unsubError()
    }
  }, [])
}
