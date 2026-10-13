// Critical 3D assets with their decompressed sizes in bytes (for the progress bar; see
// systems/progress.js). File names carry a version so they can be cached forever: when a
// file changes, bump its name here and in index.html's preload links.

export const ASSETS = {
  avatar: { url: '/models/avatar.vrm', bytes: 8135284 },
  idle: { url: '/animations/idle.fbx', bytes: 1873776 },
  walk: { url: '/animations/walk.fbx', bytes: 492320 },
  run: { url: '/animations/run.fbx', bytes: 406048 },
}
