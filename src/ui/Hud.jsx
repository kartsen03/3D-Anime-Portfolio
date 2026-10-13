import { useEffect, useRef, useState } from 'react'
import { useStore, selectReducedMotion } from '../state/store'
import { SECTIONS, sectionById } from '../content/sections'
import { profile } from '../content/profile'
import { IconLantern, IconSettings, IconSun, IconText } from './icons'

// The heads-up display over the 3D world. Deliberately minimal, in the spirit of
// game UIs like Ghost of Tsushima: identity top-left, a few tools top-right, the section
// bar along the bottom, and one contextual prompt that follows the landmark you're at.
// Every action here is a real button, so the world is fully usable by keyboard alone.
export default function Hud() {
  const phase = useStore((s) => s.phase)
  const mode = useStore((s) => s.mode)
  const active = useStore((s) => s.activeSection)
  const near = useStore((s) => s.nearSection)
  const travelTarget = useStore((s) => s.travelTarget)
  const inputMode = useStore((s) => s.inputMode)
  const theme = useStore((s) => s.theme)
  const travelTo = useStore((s) => s.travelTo)
  const openSection = useStore((s) => s.openSection)
  const setMode = useStore((s) => s.setMode)
  const setTheme = useStore((s) => s.setTheme)

  const visible = mode === 'world' && phase === 'explore'
  const nearSection = near ? sectionById(near) : null
  const touch = inputMode === 'touch'

  return (
    <div className="hud" data-visible={visible} inert={!visible || active !== null ? true : undefined}>
      <div className="hud__scrim hud__scrim--top" aria-hidden="true" />
      <div className="hud__scrim hud__scrim--bottom" aria-hidden="true" />

      <header className="hud__brand">
        <span className="seal" aria-hidden="true">
          KS
        </span>
        <div>
          <h1 className="hud__name">{profile.name}</h1>
          <p className="hud__role">{profile.role}</p>
        </div>
      </header>

      <div className="hud__tools">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setTheme(theme === 'golden' ? 'twilight' : 'golden')}
          aria-label={theme === 'golden' ? 'Switch to the twilight lanterns look' : 'Switch to the golden hour look'}
          title={theme === 'golden' ? 'Twilight lanterns' : 'Golden hour'}
        >
          {theme === 'golden' ? <IconLantern /> : <IconSun />}
        </button>
        <button type="button" className="pill-btn" onClick={() => setMode('quick')}>
          <IconText />
          <span>Text version</span>
        </button>
        <SettingsMenu />
      </div>

      <nav className="hud__nav" aria-label="Sections">
        <ol>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="chip"
                data-section-chip={s.id}
                data-state={travelTarget === s.id ? 'travelling' : near === s.id ? 'here' : undefined}
                aria-current={near === s.id ? 'location' : undefined}
                onClick={() => (near === s.id ? openSection(s.id) : travelTo(s.id))}
              >
                <span className="chip__num" aria-hidden="true">
                  {s.number}
                </span>
                <span className="chip__label">{s.label}</span>
                {!touch && (
                  <kbd className="chip__key" aria-hidden="true">
                    {s.key}
                  </kbd>
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <p className="hud__hint" aria-hidden="true">
        {touch ? (
          <>Tap the ground to walk · drag to look around · pick a section below</>
        ) : (
          <>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> walk · <kbd>Shift</kbd> run · drag to look · <kbd>1</kbd>–<kbd>5</kbd> travel
          </>
        )}
      </p>

      {/* Positioned every frame by the world (systems/PromptAnchor) above the landmark. */}
      <div id="world-prompt" className="prompt" data-visible={!!nearSection && !active}>
        {nearSection && (
          <button type="button" className="prompt__btn" onClick={() => openSection(nearSection.id)}>
            <span className="prompt__key" aria-hidden="true">
              {touch ? 'Tap' : 'E'}
            </span>
            <span className="prompt__text">
              <span className="prompt__kicker">{nearSection.number}</span>
              Open {nearSection.label}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const theme = useStore((s) => s.theme)
  const intro = useStore((s) => s.intro)
  const quality = useStore((s) => s.quality)
  const tier = useStore((s) => s.tier)
  const reduced = useStore(selectReducedMotion)
  const override = useStore((s) => s.reducedMotionOverride)
  const setTheme = useStore((s) => s.setTheme)
  const setIntro = useStore((s) => s.setIntro)
  const setQuality = useStore((s) => s.setQuality)
  const setReducedMotion = useStore((s) => s.setReducedMotion)

  // Close on outside click and on Escape (returning focus to the toggle).
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        wrap.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const tierLabel = { high: 'High', medium: 'Balanced', low: 'Light' }

  return (
    <div className="settings" ref={wrap}>
      <button
        type="button"
        className="icon-btn"
        aria-expanded={open}
        aria-controls="settings-panel"
        aria-label="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        <IconSettings />
      </button>
      {open && (
        <div className="settings__panel" id="settings-panel" role="group" aria-label="Settings">
          <Choice
            legend="Look"
            name="theme"
            value={theme}
            onChange={setTheme}
            options={[
              ['golden', 'Golden hour'],
              ['twilight', 'Twilight lanterns'],
            ]}
          />
          <Choice
            legend="Opening"
            name="intro"
            value={intro}
            onChange={setIntro}
            options={[
              ['sky', 'Name in the sky'],
              ['type', 'Title card'],
            ]}
          />
          <Choice
            legend="Motion"
            name="motion"
            value={reduced ? 'reduced' : 'full'}
            onChange={(v) => setReducedMotion(v === 'reduced')}
            options={[
              ['full', 'Full'],
              ['reduced', 'Reduced'],
            ]}
            note={override === null ? 'Following your system setting' : undefined}
          />
          <Choice
            legend="Graphics"
            name="quality"
            value={quality}
            onChange={setQuality}
            options={[
              ['auto', 'Auto'],
              ['high', 'High'],
              ['medium', 'Balanced'],
              ['low', 'Light'],
            ]}
            note={quality === 'auto' ? `Currently ${tierLabel[tier]}` : undefined}
          />
        </div>
      )}
    </div>
  )
}

function Choice({ legend, name, value, onChange, options, note }) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="choice__options">
        {options.map(([v, label]) => (
          <label key={v} className="choice__option">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {note && <p className="choice__note">{note}</p>}
    </fieldset>
  )
}
