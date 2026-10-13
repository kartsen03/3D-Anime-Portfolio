import { ISLAND, LANDMARKS } from '../layout'

// Minimal 2D collision for a walking character on a flat island: static circles on the
// XZ plane plus the island's walkable boundary. A physics engine would be overkill — the
// character only needs to slide around pillars and lanterns, never to stack or tumble.

const CHARACTER_RADIUS = 0.32

// World-space circles {x, z, r}. Built from the layout, plus anything a component
// registers at runtime (trees, lanterns) via addColliders().
const circles = []

function rebuildLandmarkColliders() {
  for (const lm of LANDMARKS) {
    const c = Math.cos(lm.yaw)
    const s = Math.sin(lm.yaw)
    for (const [lx, lz, r] of lm.colliders ?? []) {
      // Rotate the landmark-local offset by the landmark's yaw (rotation about +Y).
      circles.push({ x: lm.position[0] + lx * c + lz * s, z: lm.position[2] - lx * s + lz * c, r })
    }
  }
}
rebuildLandmarkColliders()

/** Register extra static circles; returns a function that removes them again. */
export function addColliders(list) {
  circles.push(...list)
  return () => {
    for (const item of list) {
      const i = circles.indexOf(item)
      if (i !== -1) circles.splice(i, 1)
    }
  }
}

/**
 * Push `pos` (a THREE.Vector3, mutated in place) out of every circle it overlaps and back
 * inside the walkable disc. Pushing out along the contact normal makes the character
 * slide along obstacles instead of stopping dead, which reads as smooth movement.
 */
export function resolveCollisions(pos) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of circles) {
      const dx = pos.x - c.x
      const dz = pos.z - c.z
      const minDist = c.r + CHARACTER_RADIUS
      const d2 = dx * dx + dz * dz
      if (d2 < minDist * minDist && d2 > 1e-8) {
        const d = Math.sqrt(d2)
        const push = (minDist - d) / d
        pos.x += dx * push
        pos.z += dz * push
      }
    }
  }
  const r2 = pos.x * pos.x + pos.z * pos.z
  const max = ISLAND.walkRadius
  if (r2 > max * max) {
    const s = max / Math.sqrt(r2)
    pos.x *= s
    pos.z *= s
  }
}

/** True when (x, z) is on the walkable part of the island (used to validate tap-to-move). */
export function isInsideWalkable(x, z) {
  return x * x + z * z <= ISLAND.walkRadius * ISLAND.walkRadius
}
