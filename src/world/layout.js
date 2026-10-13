// Where things stand on the island. Shared by the landmarks (what to draw), the
// locomotion system (where to walk, what blocks), and the camera (how to frame each
// section). One source of truth, so the gate the camera frames is the gate you bump into.
//
// Coordinates are metres. The walkable top of the island is the plane y = 0.

export const ISLAND = {
  topRadius: 16, // visual radius of the grassy top
  walkRadius: 13, // the character can't go farther than this from the centre
}

// Spawn point and the direction the character initially faces (toward the island centre's
// "front", where the About gate stands).
export const SPAWN = { position: [0, 0, 2.5], heading: Math.PI * 0.18 }

// One landmark per section. `yaw` turns the landmark to face the island centre.
// `approach` is where the character stops when travelling there (in front of the
// landmark, toward the centre). `radius` is how close counts as "at" the landmark.
// `colliders` are circles (local x, local z, radius) the character can't walk through.
function ringPoint(angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180
  return [Math.cos(a) * r, 0, Math.sin(a) * r]
}

function landmark(id, angleDeg, r, extra = {}) {
  const position = ringPoint(angleDeg, r)
  // Face the centre: the landmark's local +Z points back toward (0, 0, 0).
  const yaw = Math.atan2(-position[0], -position[2])
  const approachDist = extra.approachDist ?? 2.4
  const approach = [
    position[0] + Math.sin(yaw) * approachDist,
    0,
    position[2] + Math.cos(yaw) * approachDist,
  ]
  return { id, position, yaw, approach, radius: 3.2, ...extra }
}

// Torii pillars (±1.38 m) and the pair of stone lanterns flanking each approach.
const GATE_COLLIDERS = [
  [-1.38, 0, 0.22],
  [1.38, 0, 0.22],
  [-2.4, 1.5, 0.38],
  [2.4, 1.5, 0.38],
]

export const LANDMARKS = [
  landmark('about', 40, 9.5, { colliders: GATE_COLLIDERS }),
  landmark('projects', 112, 9.5, { colliders: GATE_COLLIDERS }),
  landmark('experience', 184, 9.5, { colliders: GATE_COLLIDERS }),
  landmark('resume', 256, 9.5, { colliders: GATE_COLLIDERS }),
  landmark('contact', 328, 9.5, { colliders: GATE_COLLIDERS }),
]

export const landmarkById = (id) => LANDMARKS.find((l) => l.id === id) ?? null
