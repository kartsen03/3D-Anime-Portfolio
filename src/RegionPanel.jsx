import { useEffect, useState } from 'react'

// The section panel: a plain DOM overlay (NOT drei <Html>) rendered OUTSIDE the
// Canvas, because it's a full-screen UI layer, not something anchored in 3D.
// Shown when a region is active; closes via the ✕ button, a backdrop click, or
// Escape (handled in App).
//
// The BODY is chosen by region.type via the PANELS map below — one small
// renderer per section, all reading region.content (data from regionsConfig.js).
// Adding a new section type = one more entry in PANELS; nothing else changes.
export default function RegionPanel({ region, onClose }) {
  if (!region) return null

  const Body = PANELS[region.type] ?? AboutPanel

  return (
    <div
      className="region-panel-backdrop"
      // Close when clicking the backdrop itself, but not when clicking inside
      // the card (clicks there have currentTarget !== target).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="region-panel"
        role="dialog"
        aria-modal="true"
        aria-label={region.title ?? region.label}
      >
        <button className="region-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{region.title ?? region.label}</h2>
        <Body content={region.content} />
      </div>
    </div>
  )
}

// --- Per-type panel bodies (each reads region.content) ---

function AboutPanel({ content }) {
  return (
    <>
      {content.paragraphs.map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </>
  )
}

function ProjectsPanel({ content }) {
  return (
    <div className="panel-cards">
      {content.projects.map((p, i) => (
        <div className="project-card" key={i}>
          <div className="project-card-head">
            <h3>{p.name}</h3>
            {p.link && (
              <a href={p.link} target="_blank" rel="noreferrer" className="project-link">
                Visit ↗
              </a>
            )}
          </div>
          <p>{p.description}</p>
          {p.tech?.length > 0 && (
            <ul className="tech-tags">
              {p.tech.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function ExperiencePanel({ content }) {
  return (
    <div className="panel-timeline">
      {content.items.map((item, i) => (
        <div className="xp-item" key={i}>
          <div className="xp-head">
            <span className="xp-role">{item.role}</span>
            <span className="xp-dates">{item.dates}</span>
          </div>
          <div className="xp-org">{item.org}</div>
          {item.points?.length > 0 && (
            <ul className="xp-points">
              {item.points.map((pt, j) => (
                <li key={j}>{pt}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function ResumePanel({ content }) {
  // The file may or may not be present. We HEAD-check it on open so the panel
  // gracefully degrades to "coming soon" if it's missing — and auto-upgrades to
  // the embedded viewer the moment a resume.pdf is dropped into public/.
  // status: 'checking' | 'present' | 'absent'
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let alive = true
    fetch(content.file, { method: 'HEAD' })
      .then((res) => {
        if (alive) setStatus(res.ok ? 'present' : 'absent')
      })
      .catch(() => {
        if (alive) setStatus('absent')
      })
    // Guard against setting state after the panel closes (avoids a warning).
    return () => {
      alive = false
    }
  }, [content.file])

  if (status === 'checking') return <p>Loading résumé…</p>
  if (status === 'absent') {
    return <p className="panel-muted">Résumé coming soon — check back shortly.</p>
  }
  return (
    <div className="resume-wrap">
      <iframe className="resume-frame" src={content.file} title="Résumé" />
      <a className="panel-button" href={content.file} download>
        Download PDF ↓
      </a>
    </div>
  )
}

function ContactPanel({ content }) {
  return (
    <ul className="contact-links">
      {content.links.map((l) => (
        <li key={l.href}>
          <a
            href={l.href}
            // Email uses mailto (same tab); external links open in a new tab.
            target={l.kind === 'email' ? undefined : '_blank'}
            rel={l.kind === 'email' ? undefined : 'noreferrer'}
          >
            <span className="contact-icon" aria-hidden="true">
              {CONTACT_ICON[l.kind] ?? '•'}
            </span>
            <span>{l.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

// Simple text glyphs keep this dependency-free; swap for real icons later.
const CONTACT_ICON = {
  email: '✉',
  linkedin: 'in',
  github: '⌂',
}

const PANELS = {
  about: AboutPanel,
  projects: ProjectsPanel,
  experience: ExperiencePanel,
  resume: ResumePanel,
  contact: ContactPanel,
}
