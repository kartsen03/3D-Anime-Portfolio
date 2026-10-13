import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/hud.css'
import './styles/sheet.css'
import './styles/content.css'
import './styles/quick.css'
import App from './App.jsx'
import AppBoundary from './ui/AppBoundary.jsx'

// React 19 entry. StrictMode double-invokes effects in development to surface
// non-idempotent setup; it does nothing in production builds.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </StrictMode>,
)
