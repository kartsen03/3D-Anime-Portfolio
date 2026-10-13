import { lazy, Suspense, useEffect } from 'react'
import { useStore, selectReducedMotion } from './state/store'
import { THEMES_UI } from './ui/themeMeta'
import { useSplash } from './ui/useSplash'
import WorldBoundary from './ui/WorldBoundary'
import Hud from './ui/Hud'
import SectionSheet from './ui/SectionSheet'
import QuickView from './ui/QuickView'
import Announcer from './ui/Announcer'

// The 3D world is its own chunk: three.js and friends are most of the site's JavaScript,
// so the interface and the splash never wait for them.
const World = lazy(() => import('./world/World'))

export default function App() {
  useSplash()
  const webgl = useStore((s) => s.webgl)
  const theme = useStore((s) => s.theme)
  const reduced = useStore(selectReducedMotion)
  const setMode = useStore((s) => s.setMode)
  const setInputMode = useStore((s) => s.setInputMode)

  // Theme and motion preferences drive CSS through attributes on <html>.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES_UI[theme].themeColor)
  }, [theme])
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
  }, [reduced])

  // Control hints follow the device actually in use (a touch laptop can be both).
  useEffect(() => {
    const onPointer = (e) => setInputMode(e.pointerType === 'touch' ? 'touch' : 'pointer')
    window.addEventListener('pointerdown', onPointer, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [setInputMode])

  return (
    <>
      <a
        className="skip-link"
        href="#quick"
        onClick={(e) => {
          e.preventDefault()
          setMode('quick')
        }}
      >
        Skip to the text version
      </a>
      {webgl && (
        <WorldBoundary>
          <Suspense fallback={null}>
            <World />
          </Suspense>
        </WorldBoundary>
      )}
      <Hud />
      <SectionSheet />
      <QuickView />
      <Announcer />
    </>
  )
}
