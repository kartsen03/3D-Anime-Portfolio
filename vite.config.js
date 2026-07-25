import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite is the dev server + build tool. The React plugin enables JSX transform
// and Fast Refresh (hot-reload that preserves component state on save).
export default defineConfig({
  plugins: [react()],
  // Deployed to a ROOT domain (Vercel), so the base is '/' (Vite's default).
  // This keeps the absolute /models, /animations, /textures asset paths valid.
  // Do NOT set a subpath base (e.g. '/3D-Anime-Portfolio/') — that would break
  // those absolute asset URLs on a root-domain host.
  base: '/',
})
