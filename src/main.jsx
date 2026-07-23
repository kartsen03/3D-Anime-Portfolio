import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// React 19's entry point: createRoot mounts the app into #root.
// StrictMode double-invokes some logic in dev to surface side-effect bugs;
// it has no effect in production builds.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
