import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite is the dev server + build tool. The React plugin enables JSX transform
// and Fast Refresh (hot-reload that preserves component state on save).
export default defineConfig({
  plugins: [react()],
})
