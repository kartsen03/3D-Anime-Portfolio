import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../../state/store'
import { QUALITY } from '../render/quality'
import { createToonMaterial } from '../materials/shaderLib'
import { LANDMARKS } from '../layout'
import { coastRadius, distanceToPath, groundColor, groundHeight } from './terrain'
import { mulberry32 } from './noise'

// A meadow of GPU-animated grass.
//
// Geometry: one "clump" of three tapered blades, drawn many times with instanced
// attributes (root position, yaw, height, width, colour) — no per-blade CPU work after
// start-up. All motion happens in the vertex shader:
//  • gusts: a tiling noise texture scrolled along the wind direction, so waves of wind
//    visibly roll across the field (the Ghost of Tsushima effect);
//  • flutter: a small per-blade sine on top;
//  • the character: blades within ~1 m bend away from the player's feet.
// Bending is weighted by height², so roots stay planted and tips swing.
//
// Normals point straight up, so the grass shades exactly like the ground beneath it and
// the meadow reads as one surface with texture, not thousands of separate lit cards.
// Colour runs from a darker, ambient-occluded root to a lighter tip, starting from the
// ground's own colour at that spot. The meadow is split into chunks for frustum culling.

const CHUNK = 8 // metres per chunk side

function clumpGeometry() {
  // Heights along one blade (0 = root, 1 = tip) and its half-width at each level.
  const levels = [0, 0.38, 0.72, 1]
  const widths = [0.5, 0.42, 0.24, 0]
  const positions = []
  const bladeT = []
  const indices = []
  const blades = [
    { angle: 0, dx: 0, dz: 0, lean: 0.12 },
    { angle: (Math.PI * 2) / 3, dx: 0.035, dz: 0.02, lean: 0.18 },
    { angle: (Math.PI * 4) / 3, dx: -0.03, dz: 0.03, lean: 0.15 },
  ]
  for (const b of blades) {
    const base = positions.length / 3
    const c = Math.cos(b.angle)
    const s = Math.sin(b.angle)
    levels.forEach((t, li) => {
      const w = widths[li] * 0.06
      // Lean the blade outward from the clump centre, more toward the tip.
      const leanX = -s * b.lean * t * t
      const leanZ = c * b.lean * t * t
      if (li < levels.length - 1) {
        positions.push(b.dx + c * -w + leanX, t, b.dz + s * -w + leanZ)
        positions.push(b.dx + c * w + leanX, t, b.dz + s * w + leanZ)
        bladeT.push(t, t)
      } else {
        positions.push(b.dx + leanX, t, b.dz + leanZ)
        bladeT.push(t)
      }
    })
    // Quads up the blade, then the tip triangle.
    for (let li = 0; li < levels.length - 2; li++) {
      const a = base + li * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const lastPair = base + (levels.length - 2) * 2
    indices.push(lastPair, lastPair + 1, lastPair + 2)
  }
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('aBladeT', new THREE.Float32BufferAttribute(bladeT, 1))
  // All normals up: the grass lights like the ground under it.
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(positions.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  g.setIndex(indices)
  return g
}

const GRASS_VERTEX_PARS = /* glsl */ `
attribute float aBladeT;
attribute vec4 aRoot;   // x, y, z of the root, yaw
attribute vec3 aShape;  // height, width scale, colour seed
attribute vec3 aColor;  // ground colour at the root (linear)
varying float vBladeT;
varying vec3 vGrassColor;
`

const GRASS_VERTEX = /* glsl */ `
{
  float h = aBladeT;
  float c = cos(aRoot.w);
  float s = sin(aRoot.w);
  vec3 local = vec3(transformed.x * aShape.y, transformed.y * aShape.x, transformed.z * aShape.y);
  local = vec3(c * local.x + s * local.z, local.y, -s * local.x + c * local.z);

  vec2 root = aRoot.xz;
  // Rolling gusts: noise scrolled downwind, sampled once per blade at its root.
  float gust = texture2D(uNoise, root * 0.022 - uWindDir * uTime * 0.055).r;
  float flutter = sin(uTime * 3.3 + root.x * 1.9 + root.y * 1.4 + aShape.z * 6.0) * 0.07;
  vec2 bend = uWindDir * ((gust - 0.32) * 1.25 + flutter) * uWindStrength;

  // Part around the character's feet.
  vec2 away = root - uCharacterPos.xz;
  float dist = length(away);
  float push = 1.0 - smoothstep(0.3, 1.2, dist);
  bend += away / max(dist, 1e-3) * push * 0.95;

  float k = h * h;
  local.xz += bend * k * aShape.x;
  local.y -= dot(bend, bend) * k * aShape.x * 0.3; // keep the blade's length roughly constant

  transformed = aRoot.xyz + local;
  vBladeT = h;
  vGrassColor = aColor;
}
`

const GRASS_FRAGMENT_PARS = /* glsl */ `
varying float vBladeT;
varying vec3 vGrassColor;
`

// Darker, ambient-occluded roots to sunlit tips, around the ground's own colour.
const GRASS_COLOR = /* glsl */ `
diffuseColor.rgb *= vGrassColor * mix(0.62, 1.22, smoothstep(0.0, 1.0, vBladeT));
`

function scatter(density, seed) {
  const rand = mulberry32(seed)
  const spacing = 0.2 / Math.sqrt(Math.max(density, 0.05))
  const maxR = 18
  const chunks = new Map()
  const c = new THREE.Color()
  const blockers = []
  for (const lm of LANDMARKS) {
    const cos = Math.cos(lm.yaw)
    const sin = Math.sin(lm.yaw)
    for (const [lx, lz, r] of lm.colliders) {
      blockers.push({ x: lm.position[0] + lx * cos + lz * sin, z: lm.position[2] - lx * sin + lz * cos, r: r + 0.25 })
    }
  }
  for (let gx = -maxR; gx <= maxR; gx += spacing) {
    for (let gz = -maxR; gz <= maxR; gz += spacing) {
      const x = gx + (rand() - 0.5) * spacing * 0.9
      const z = gz + (rand() - 0.5) * spacing * 0.9
      const r = Math.hypot(x, z)
      const R = coastRadius(Math.atan2(z, x))
      if (r > R - 0.5) continue
      const y = groundHeight(x, z)
      if (y < -0.75) continue
      if (blockers.some((b) => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r)) continue
      // Trodden path: bare in the middle, the meadow thinning and shortening toward it.
      // (Tiny tufts left on the path read as dark specks, so none are kept there.)
      const dp = distanceToPath(x, z)
      if (dp < 0.6) continue
      const edge = THREE.MathUtils.smoothstep(dp, 0.6, 1.3)
      if (rand() > 0.25 + edge * 0.75) continue
      const height = (0.26 + rand() * 0.22) * (0.45 + edge * 0.55) * (r > R - 2 ? 0.75 : 1)
      groundColor(x, z, c)
      c.multiplyScalar(0.94 + rand() * 0.12)
      const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`
      if (!chunks.has(key)) chunks.set(key, [])
      chunks.get(key).push({ x, y, z, yaw: rand() * Math.PI * 2, height, width: 0.85 + rand() * 0.5, seed: rand(), r: c.r, g: c.g, b: c.b })
    }
  }
  return [...chunks.values()]
}

export default function Grass() {
  const tier = useStore((s) => s.tier)
  const { density } = QUALITY[tier]

  const material = useMemo(
    () =>
      createToonMaterial(
        { side: THREE.DoubleSide },
        {
          key: 'grass',
          rim: false,
          outline: false,
          keepNormals: true,
          vertexPars: GRASS_VERTEX_PARS,
          vertex: GRASS_VERTEX,
          fragmentPars: GRASS_FRAGMENT_PARS,
          fragmentColor: GRASS_COLOR,
        },
      ),
    [],
  )

  const meshes = useMemo(() => {
    const base = clumpGeometry()
    return scatter(density, 4242).map((blades) => {
      const g = base.clone()
      const root = new Float32Array(blades.length * 4)
      const shape = new Float32Array(blades.length * 3)
      const color = new Float32Array(blades.length * 3)
      const box = new THREE.Box3()
      blades.forEach((b, i) => {
        root.set([b.x, b.y, b.z, b.yaw], i * 4)
        shape.set([b.height, b.width, b.seed], i * 3)
        color.set([b.r, b.g, b.b], i * 3)
        box.expandByPoint(new THREE.Vector3(b.x, b.y, b.z))
      })
      g.setAttribute('aRoot', new THREE.InstancedBufferAttribute(root, 4))
      g.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 3))
      g.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3))
      g.instanceCount = blades.length
      // Culling bounds for this chunk, padded for blade height and wind sway.
      box.expandByVector(new THREE.Vector3(0.8, 0.8, 0.8))
      g.boundingBox = box
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere())
      return g
    })
  }, [density])

  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes])

  return meshes.map((g, i) => <mesh key={i} geometry={g} material={material} receiveShadow />)
}
