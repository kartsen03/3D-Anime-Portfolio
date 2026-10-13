import { Component } from 'react'
import { profile } from '../content/profile'

// Last line of defence for the whole interface: if rendering ever throws, show the
// essentials (who, how to reach them) instead of a blank page.
export default class AppBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Interface error:', error)
    document.getElementById('splash')?.remove()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="quick" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="quick__page" style={{ textAlign: 'center' }}>
          <h1 className="quick__name">{profile.name}</h1>
          <p className="quick__role">{profile.role}</p>
          <p>Something went wrong loading this page. Reloading usually fixes it.</p>
          <p>
            {profile.links.map((l, i) => (
              <span key={l.href}>
                {i > 0 && ' · '}
                <a href={l.href}>{l.label}</a>
              </span>
            ))}
            {' · '}
            <a href={profile.resume.file}>Résumé (PDF)</a>
          </p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </main>
    )
  }
}
