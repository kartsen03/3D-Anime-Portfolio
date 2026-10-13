import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { SECTIONS, sectionById } from '../content/sections'
import { SECTION_BODIES } from './sections/SectionBodies'
import { useFocusTrap } from './useFocusTrap'
import { IconArrow, IconArrowLeft, IconClose } from './icons'
import { profile } from '../content/profile'

const EXIT_MS = 420

// The panel a section opens into: a side sheet on wide screens (the world stays visible
// beside it, and the camera frames the landmark in the free space), a bottom sheet on
// phones. It is a real modal dialog: focus moves in and is trapped, Escape closes, focus
// returns to whatever opened it, and the rest of the interface is inert meanwhile.
export default function SectionSheet() {
  const active = useStore((s) => s.activeSection)
  const mode = useStore((s) => s.mode)
  const closeSection = useStore((s) => s.closeSection)
  const openSection = useStore((s) => s.openSection)

  // Keep the last section on screen during the exit transition. `shown` is derived during
  // render (not in an effect) so the dialog exists in the same commit that opens it —
  // otherwise the focus handling below would run before there is anything to focus.
  const [shown, setShown] = useState(active)
  if (active && active !== shown) setShown(active)
  const leaving = !active && shown !== null
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => setShown(null), EXIT_MS)
    return () => clearTimeout(t)
  }, [leaving])

  const dialogRef = useRef(null)
  const headingRef = useRef(null)
  const scrollRef = useRef(null)
  const open = mode === 'world' && active !== null

  useFocusTrap(dialogRef, {
    active: open,
    initialFocus: headingRef,
    onEscape: closeSection,
    fallbackFocus: () => document.querySelector(`[data-section-chip="${shown}"]`),
  })

  // Switching sections inside the sheet: start at the top and announce the new heading.
  useEffect(() => {
    if (!active) return
    scrollRef.current?.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
    const section = sectionById(active)
    document.title = `${section.label} — ${profile.name}`
    return () => {
      document.title = `${profile.name} — ML, GPU systems & real-time graphics`
    }
  }, [active])

  if (mode !== 'world' || !shown) return null
  const section = sectionById(shown)
  const Body = SECTION_BODIES[shown]
  const index = SECTIONS.findIndex((s) => s.id === shown)
  const prev = SECTIONS[(index - 1 + SECTIONS.length) % SECTIONS.length]
  const next = SECTIONS[(index + 1) % SECTIONS.length]

  return (
    <div className="sheet-layer" data-state={leaving ? 'leaving' : 'open'}>
      {/* Clicking the world beside the sheet closes it, like a dialog backdrop. */}
      <div className="sheet-backdrop" onClick={closeSection} aria-hidden="true" />
      <section
        ref={dialogRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <div className="sheet__kicker">
            <span className="sheet__num">{section.number}</span>
            <span className="sheet__label">{section.label}</span>
            <span className="sheet__kanji" aria-hidden="true">
              {section.kanji}
            </span>
          </div>
          <h2 id="sheet-title" className="sheet__title" ref={headingRef} tabIndex={-1}>
            {section.title}
          </h2>
          <button type="button" className="icon-btn sheet__close" onClick={closeSection} aria-label="Close section">
            <IconClose />
          </button>
        </header>

        <div className="sheet__scroll" ref={scrollRef}>
          <div className="sheet__content" key={shown}>
            <Body />
          </div>
        </div>

        <footer className="sheet__foot">
          <button type="button" className="sheet__nav" onClick={() => openSection(prev.id)}>
            <IconArrowLeft />
            <span>
              <span className="sheet__nav-kicker">Previous</span>
              {prev.label}
            </span>
          </button>
          <button type="button" className="sheet__nav sheet__nav--next" onClick={() => openSection(next.id)}>
            <span>
              <span className="sheet__nav-kicker">Next</span>
              {next.label}
            </span>
            <IconArrow />
          </button>
        </footer>
      </section>
    </div>
  )
}
