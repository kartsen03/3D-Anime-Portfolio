import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'
import { SECTIONS } from '../content/sections'
import { profile } from '../content/profile'
import { SECTION_BODIES } from './sections/SectionBodies'
import { IconWorld } from './icons'

// The text version: every section as one ordinary, semantic HTML page. It is the
// accessible equivalent of the 3D world (screen readers, keyboard, zoom up to 400%),
// the fast path for anyone who just wants the facts, and the automatic fallback when
// WebGL is unavailable or the world fails to start.
export default function QuickView() {
  const mode = useStore((s) => s.mode)
  const webgl = useStore((s) => s.webgl)
  const loadError = useStore((s) => s.loadError)
  const phase = useStore((s) => s.phase)
  const setMode = useStore((s) => s.setMode)
  const setPhase = useStore((s) => s.setPhase)
  const headingRef = useRef(null)

  useEffect(() => {
    if (mode !== 'quick') return
    headingRef.current?.focus({ preventScroll: true })
    document.title = `${profile.name} — text version`
  }, [mode])

  if (mode !== 'quick') return null

  const canReturn = webgl && !loadError
  const backToWorld = () => {
    setMode('world')
    // Arriving from the text version skips the opening sequence.
    if (phase === 'ready') setPhase('explore')
  }

  return (
    <div className="quick" id="quick">
      <div className="quick__page">
        <header className="quick__header">
          <div className="quick__brand">
            <span className="seal" aria-hidden="true">
              KS
            </span>
            <span className="quick__brand-text">Text version</span>
          </div>
          {canReturn && (
            <button type="button" className="btn btn--ghost" onClick={backToWorld} disabled={phase === 'loading'}>
              <IconWorld />
              {phase === 'loading' ? 'The 3D island is loading…' : 'Explore the 3D island'}
            </button>
          )}
        </header>

        {loadError && (
          <p className="quick__notice" role="status">
            The 3D world couldn’t start on this device, so here is the text version. Everything is the same.
          </p>
        )}
        {!webgl && (
          <p className="quick__notice" role="status">
            This browser can’t run the 3D world (WebGL 2 is unavailable), so here is the text version.
          </p>
        )}

        <div className="quick__intro">
          <h1 className="quick__name" ref={headingRef} tabIndex={-1}>
            {profile.name}
          </h1>
          <p className="quick__role">{profile.role}</p>
          <nav aria-label="On this page" className="quick__toc">
            <ol>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#quick-${s.id}`}>
                    <span aria-hidden="true">{s.number}</span> {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <main className="quick__main">
          {SECTIONS.map((s) => {
            const Body = SECTION_BODIES[s.id]
            return (
              <section key={s.id} id={`quick-${s.id}`} className="quick__section" aria-labelledby={`quick-${s.id}-title`}>
                <div className="quick__section-head">
                  <span className="sheet__num" aria-hidden="true">
                    {s.number}
                  </span>
                  <h2 id={`quick-${s.id}-title`}>{s.title}</h2>
                  <span className="sheet__kanji" aria-hidden="true">
                    {s.kanji}
                  </span>
                </div>
                <Body />
              </section>
            )
          })}
        </main>

        <footer className="quick__footer">
          <p>
            © 2026 {profile.name}. Built from scratch with React Three Fiber.{' '}
            <a href="https://github.com/kartsen03/3D-Anime-Portfolio">Source</a>.
          </p>
        </footer>
      </div>
    </div>
  )
}
