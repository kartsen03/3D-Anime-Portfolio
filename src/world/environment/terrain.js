import * as THREE from 'three'
import { ISLAND, LANDMARKS } from '../layout'
import { fbm3, ringNoise } from './noise'

// The island's shape and ground colour as plain functions, shared by everything that
// sits on the island: the ground mesh, the grass (so blade roots match the ground under
// them), the paths, and the props (so nothing floats or sinks).

const SEED = 11

/** Distance from the centre to the island's edge at a given angle (an organic coastline). */
export function coastRadius(angle) {
  return ISLAND.topRadius + (ringNoise(angle, 1.5, SEED, 3) - 0.5) * 3.4 + (ringNoise(angle, 5.2, SEED + 5, 2) - 0.5) * 0.9
}

/** Ground height: flat where you walk, curving down into a soft lip at the edge. */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z)
  const R = coastRadius(Math.atan2(z, x))
  const lipStart = R - 2.6
  if (r <= lipStart) return 0
  const s = Math.min((r - lipStart) / (R - lipStart), 1)
  return -(s * s * 1.05 + s * 0.2)
}

// Albedo palette (sRGB): a sage meadow with warm sunlit patches and cooler hollows.
const GRASS = new THREE.Color('#79a35b')
const GRASS_WARM = new THREE.Color('#a9b75f')
const GRASS_COOL = new THREE.Color('#58875a')
const EARTH = new THREE.Color('#8f7b5b')
const PATH = new THREE.Color('#b9a37f')

// Stone path: a loop through all landmarks' approach points plus a spur from spawn.
const PATH_POINTS = LANDMARKS.map((l) => new THREE.Vector2(l.approach[0], l.approach[2]))

function distanceToSegment(px, pz, a, b) {
  const abx = b.x - a.x
  const abz = b.y - a.y
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (pz - a.y) * abz) / (abx * abx + abz * abz)))
  return Math.hypot(px - (a.x + abx * t), pz - (a.y + abz * t))
}

/** Distance from a point to the stone path (a closed loop through the landmarks). */
export function distanceToPath(x, z) {
  let d = Infinity
  for (let i = 0; i < PATH_POINTS.length; i++) {
    d = Math.min(d, distanceToSegment(x, z, PATH_POINTS[i], PATH_POINTS[(i + 1) % PATH_POINTS.length]))
  }
  return d
}

/** Ground albedo at (x, z), written into `out` (a THREE.Color). */
export function groundColor(x, z, out) {
  const n = fbm3(x * 0.09, 0, z * 0.09, 3, SEED + 2)
  const m = fbm3(x * 0.33, 1.7, z * 0.33, 2, SEED + 9)
  out.copy(GRASS)
  if (n > 0.5) out.lerp(GRASS_WARM, Math.min((n - 0.5) * 2.6, 1))
  else out.lerp(GRASS_COOL, Math.min((0.5 - n) * 2.2, 1))
  out.multiplyScalar(0.92 + m * 0.16)
  // Trodden earth along the path, then the earthen lip at the island's edge.
  const dp = distanceToPath(x, z)
  if (dp < 1.6) out.lerp(PATH, (1 - dp / 1.6) * 0.55)
  const r = Math.hypot(x, z)
  const R = coastRadius(Math.atan2(z, x))
  if (r > R - 0.9) out.lerp(EARTH, Math.min((r - (R - 0.9)) / 0.9, 1))
  return out
}
