import * as THREE from 'three'

// Per-frame shared state for the 3D world.
//
// WHY a plain mutable object instead of React state or the zustand store: these values
// change every frame (60–144×/s). Putting them in React state would re-render
// components every frame; putting them in the store would notify every subscriber
// every frame. Systems simply read and write these fields inside useFrame, in a fixed
// order (see FRAME in this file), so whoever reads always sees this frame's values.

export const runtime = {
  // The character's root transform, written by the locomotion system.
  character: {
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(),
    heading: 0, // yaw in radians; 0 = facing +Z
    speed: 0, // m/s, smoothed
    root: null, // THREE.Group once mounted
    ready: false,
  },

  // Held movement keys (set by the keyboard system, read by locomotion).
  keys: { forward: false, backward: false, left: false, right: false, sprint: false },

  // Point the character should walk to (tap/click-to-move or section travel), or null.
  moveTarget: null,
  moveTargetSprint: false,
  // True while running to a new landmark behind an open sheet (see beginBackgroundTravel).
  backgroundTravel: false,

  // Seconds of world time; every animated shader reads this through globalUniforms.
  time: 0,
}

// useFrame priorities, in execution order (R3F runs lower numbers first). Fixing the
// order removes one-frame lag: input → movement → camera follow → camera-controls'
// own update (drei runs it at -1) → everything else → render (1).
export const FRAME = {
  input: -5,
  locomotion: -4,
  follow: -2,
  // -1 is drei's CameraControls.update()
  world: 0,
  render: 1, // a positive priority also tells R3F we render manually (the composer)
}
