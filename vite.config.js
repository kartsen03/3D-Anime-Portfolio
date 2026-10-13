import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Development-only endpoint that lets in-browser tools (the animation baker, the
// share-image renderer) save their output into public/. It exists only on the dev
// server (apply: 'serve'), which listens on localhost, and accepts a short allowlist
// of file names — nothing else can be written.
function devAssetWriter() {
  const allowed = [/^animations\/clips\.v\d+\.json$/, /^og\.v\d+\.jpg$/, /^apple-touch-icon\.png$/]
  return {
    name: 'dev-asset-writer',
    apply: 'serve',
    configureServer(server) {
      // Look-dev captures of the WebGL canvas, saved to .shots/ (git-ignored).
      server.middlewares.use('/__dev/shot', (req, res) => {
        const name = new URL(req.url, 'http://localhost').searchParams.get('name') ?? ''
        if (req.method !== 'POST' || !/^[\w-]{1,64}$/.test(name)) {
          res.statusCode = 400
          res.end('refused')
          return
        }
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const target = resolve(server.config.root, '.shots', `${name}.jpg`)
          mkdirSync(dirname(target), { recursive: true })
          writeFileSync(target, Buffer.concat(chunks))
          res.end(`wrote .shots/${name}.jpg`)
        })
      })
      server.middlewares.use('/__dev/write', (req, res) => {
        const file = new URL(req.url, 'http://localhost').searchParams.get('file') ?? ''
        if (req.method !== 'POST' || !allowed.some((re) => re.test(file))) {
          res.statusCode = 400
          res.end('refused')
          return
        }
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const target = resolve(server.config.root, 'public', file)
          mkdirSync(dirname(target), { recursive: true })
          writeFileSync(target, Buffer.concat(chunks))
          res.end(`wrote public/${file}`)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devAssetWriter()],
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
