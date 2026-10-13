import { useStore } from '../../state/store'

// Byte-accurate loading progress for the critical 3D assets.
//
// WHY a manifest of expected sizes: three's FileLoader counts *decompressed* bytes as
// they arrive, but the server sends the files brotli-compressed with no Content-Length,
// so the event's `total` is usually 0. Dividing by the known file size from the
// manifest (src/world/assets.js) gives a progress bar that moves smoothly from 0 to 100%.

const received = new Map()
let expectedTotal = 0

export function expectAssets(sizes) {
  expectedTotal = sizes.reduce((a, b) => a + b, 0)
}

export function reportProgress(url, loadedBytes) {
  received.set(url, loadedBytes)
  if (!expectedTotal) return
  let sum = 0
  for (const v of received.values()) sum += v
  // Hold back the last few percent for shader warm-up, which happens after downloads.
  useStore.getState().setProgress(Math.min(sum / expectedTotal, 1) * 0.92)
}

/** Build an onProgress callback for useLoader / loader.load. */
export const progressFor = (url) => (event) => reportProgress(url, event.loaded)
