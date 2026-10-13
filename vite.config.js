import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite is the dev server + build tool. The React plugin enables JSX and Fast Refresh.
export default defineConfig({
  plugins: [react()],
  // Deployed to a root domain (Vercel), so the base is '/'. This keeps the absolute
  // /models, /animations and /fonts URLs valid.
  base: '/',
  build: {
    // The 3D world chunk (three.js, postprocessing, three-vrm) is ~1.4 MB minified on
    // purpose: it is lazy-loaded behind the splash, in parallel with the avatar, while the
    // interface chunk that paints first stays small. So don't warn about it.
    chunkSizeWarningLimit: 1600,
  },
})
