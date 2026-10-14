import { useState } from 'react'
import { profile } from '../../content/profile'
import { projects } from '../../content/projects'
import { experience } from '../../content/experience'
import { IconCheck, IconCopy, IconDownload, IconExternal, IconGithub, CONTACT_ICONS } from '../icons'
import github from '../../content/github.generated.json'

// The content of each section, shared by the sheets (3D mode) and the Quick view (text
// mode), so both always say exactly the same thing. Headings inside start at h3: the
// container (sheet or Quick view section) supplies the h2.

function TagList({ items, label }) {
  return (
    <ul className="tags" aria-label={label}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function AboutBody() {
  return (
    <div className="body body--about">
      {profile.about.map((p, i) => (
        <p key={i} className={i === 0 ? 'lede' : undefined}>
          {p}
        </p>
      ))}

      <h3 className="subhead">Education</h3>
      <ul className="plain-list">
        {profile.education.map((e) => (
          <li key={e.school} className="entry">
            <div className="entry__row">
              <span className="entry__title">{e.degree}</span>
              <span className="entry__meta">{e.dates}</span>
            </div>
            <div className="entry__org">{e.school}</div>
            <div className="entry__detail">{e.detail}</div>
          </li>
        ))}
      </ul>

      <h3 className="subhead">Publication</h3>
      <ul className="plain-list">
        {profile.publications.map((p) => (
          <li key={p.title} className="entry">
            <div className="entry__title">{p.title}</div>
            <div className="entry__org">{p.venue}</div>
            {p.detail && <div className="entry__detail">{p.detail}</div>}
          </li>
        ))}
      </ul>

      <h3 className="subhead">Skills</h3>
      <dl className="skills">
        {profile.skills.map((g) => (
          <div className="skills__group" key={g.category}>
            <dt>{g.category}</dt>
            <dd>
              <TagList items={g.items} label={g.category} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function lastUpdated(repoUrl) {
  if (!repoUrl) return null
  const slug = repoUrl.replace('https://github.com/', '').split('/tree/')[0]
  const pushed = github.repos?.[slug]?.pushedAt
  if (!pushed) return null
  return new Date(pushed).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function ProjectCard({ project: p, headingLevel = 3 }) {
  const H = `h${headingLevel}`
  const updated = lastUpdated(p.repo)
  return (
    <article className="project" id={`project-${p.id}`} aria-labelledby={`project-${p.id}-title`}>
      <header className="project__head">
        <div className="project__meta">
          {p.period && <span>{p.period}</span>}
          {p.note && <span className="badge">{p.note}</span>}
          {updated && <span className="project__updated">Updated {updated}</span>}
        </div>
        <H className="project__name" id={`project-${p.id}-title`}>
          {p.name}
        </H>
        <p className="project__tagline">{p.tagline}</p>
      </header>
      {p.description && <p className="project__desc">{p.description}</p>}
      {p.facts.length > 0 && (
        <ul className="project__facts">
          {p.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <TagList items={p.tech} label={`${p.name} technologies`} />
      {(p.live || p.repo) && (
        <div className="project__links">
          {p.live && (
            <a className="btn btn--primary btn--small" href={p.live} target="_blank" rel="noreferrer">
              Live demo <IconExternal />
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          )}
          {p.repo && (
            <a className="btn btn--ghost btn--small" href={p.repo} target="_blank" rel="noreferrer">
              <IconGithub /> {p.repoLabel ?? 'Code'}
              <span className="visually-hidden"> for {p.name} (opens in a new tab)</span>
            </a>
          )}
          {p.liveNote && <span className="project__note">{p.liveNote}</span>}
        </div>
      )}
    </article>
  )
}

export function ProjectsBody() {
  return (
    <div className="body body--projects">
      <p className="lede">Selected work, strongest first, then course projects.</p>
      <div className="projects">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  )
}

export function ExperienceBody() {
  return (
    <div className="body body--experience">
      <ol className="timeline">
        {experience.map((x) => (
          <li key={x.id} className="timeline__item">
            <div className="entry__row">
              <h3 className="entry__title">{x.role}</h3>
              <span className="entry__meta">{x.dates}</span>
            </div>
            <div className="entry__org">{x.org}</div>
            <ul className="bullets">
              {x.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
            {x.earlier && (
              <div className="timeline__earlier">
                <div className="entry__row">
                  <span className="entry__title entry__title--minor">{x.earlier.role}</span>
                  <span className="entry__meta">{x.earlier.dates}</span>
                </div>
                <ul className="bullets">
                  {x.earlier.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function ResumeBody() {
  return (
    <div className="body body--resume">
      <p className="lede">
        A one-page summary of education, experience, and projects. The Projects section here covers more work than the
        PDF has room for.
      </p>
      <div className="resume-card">
        <div>
          <div className="resume-card__title">Karthik Sengupta — Résumé</div>
          <div className="entry__meta">PDF · updated {profile.resume.updated}</div>
        </div>
        <div className="resume-card__actions">
          <a className="btn btn--primary" href={profile.resume.file} target="_blank" rel="noreferrer">
            View PDF <IconExternal />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          <a className="btn btn--ghost" href={profile.resume.file} download="Karthik_Sengupta_Resume.pdf">
            <IconDownload /> Download
          </a>
        </div>
      </div>
    </div>
  )
}

function CopyEmail() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard blocked (permissions, insecure context): the mailto link still works.
    }
  }
  return (
    <button type="button" className="btn btn--ghost btn--small" onClick={copy} aria-live="polite">
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? 'Copied' : 'Copy address'}
    </button>
  )
}

export function ContactBody() {
  return (
    <div className="body body--contact">
      <p className="lede">
        The quickest way to reach me is email. I’m based in {profile.location}.
      </p>
      <ul className="contacts">
        {profile.links.map((l) => {
          const Icon = CONTACT_ICONS[l.kind]
          const external = l.kind !== 'email'
          return (
            <li key={l.href} className="contact">
              <a
                className="contact__link"
                href={l.href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
              >
                <span className="contact__icon">{Icon && <Icon />}</span>
                <span className="contact__text">
                  <span className="contact__label">{l.label}</span>
                  <span className="contact__value">{l.display}</span>
                </span>
                {external && <span className="visually-hidden"> (opens in a new tab)</span>}
              </a>
              {l.kind === 'email' && <CopyEmail />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export const SECTION_BODIES = {
  about: AboutBody,
  projects: ProjectsBody,
  experience: ExperienceBody,
  resume: ResumeBody,
  contact: ContactBody,
}
