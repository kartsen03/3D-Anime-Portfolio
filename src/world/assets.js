// Critical 3D assets with their decompressed sizes in bytes (for the progress bar; see
// systems/progress.js). File names carry a version so they can be cached forever: when a
// file changes, bump its name here and in index.html's preload links.
//
// avatar.v2.vrm comes from scripts/optimize-avatar.mjs (8.1 MB original → 2.9 MB);
// clips.v1.json from the in-browser baker (src/world/dev/bakeClips.js, ?bake=clips).

export const ASSETS = {
  avatar: { url: '/models/avatar.v2.vrm', bytes: 2898236 },
  clips: { url: '/animations/clips.v1.json', bytes: 336860 },
}
