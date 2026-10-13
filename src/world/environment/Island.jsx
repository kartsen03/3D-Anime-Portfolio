import { useMemo } from 'react'
import * as THREE from 'three'
import { createToonMaterial } from '../materials/shaderLib'
import { coastRadius, groundColor, groundHeight } from './terrain'
import { fbm3, mulberry32 } from './noise'

// The floating island, generated in code (no model file):
//  • a polar-grid meadow whose outline follows an organic coastline and whose edge rolls
//    over into a soft lip, so the silhouette never reads as a cylinder;
//  • a cliff of layered rock strata that narrows into a long spire, its rings displaced
//    by noise and faceted with flat shading;
//  • a few smaller hanging spires to break up the underside silhouette.
// All of it uses the shared toon material, so it bands and shadows like everything else.

const SEGMENTS = 128
const RINGS = 34
const CLIFF_LEVELS = 26
const CLIFF_DEPTH = 26

const STRATA = ['#8f7a64', '#77665a', '#a08b72', '#6d5d52', '#8a7563'].map((c) => new THREE.Color(c))
const TOPSOIL = new THREE.Color('#6b5640')

function buildMeadow() {
  const positions = []
  const colors = []
  const indices = []
  const c = new THREE.Color()
  positions.push(0, 0, 0)
  groundColor(0, 0, c)
  colors.push(c.r, c.g, c.b)
  for (let i = 1; i <= RINGS; i++) {
    // Rings bunch up toward the edge, where the lip needs the detail.
    const t = Math.pow(i / RINGS, 0.72)
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2
      const r = coastRadius(a) * t
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      positions.push(x, groundHeight(x, z), z)
      groundColor(x, z, c)
      colors.push(c.r, c.g, c.b)
    }
  }
  for (let j = 0; j < SEGMENTS; j++) indices.push(0, 1 + ((j + 1) % SEGMENTS), 1 + j)
  for (let i = 1; i < RINGS; i++) {
    const a0 = 1 + (i - 1) * SEGMENTS
    const a1 = 1 + i * SEGMENTS
    for (let j = 0; j < SEGMENTS; j++) {
      const j1 = (j + 1) % SEGMENTS
      indices.push(a0 + j, a0 + j1, a1 + j)
      indices.push(a0 + j1, a1 + j1, a1 + j)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

function buildCliff() {
  const positions = []
  const colors = []
  const indices = []
  const lipY = groundHeight(coastRadius(0) + 0.001, 0) // edge height, same for every angle
  for (let k = 0; k <= CLIFF_LEVELS; k++) {
    const t = k / CLIFF_LEVELS
    const y = lipY - Math.pow(t, 1.08) * CLIFF_DEPTH
    // Narrow into a spire, with a slight belly near the top like eroded rock.
    const taper = (1 - 0.9 * Math.pow(t, 1.25)) * (1 + 0.05 * Math.sin(t * Math.PI))
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2
      const rough = k === 0 ? 0 : (fbm3(Math.cos(a) * 2.2, t * 5.0, Math.sin(a) * 2.2, 4, 3) - 0.5) * (0.3 + t * 0.4)
      const r = coastRadius(a) * taper * (1 + rough)
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r)
      // Strata bands follow height with a little noise so the layers wobble.
      const band = Math.floor((-y + fbm3(Math.cos(a) * 3, 0, Math.sin(a) * 3, 2, 9) * 2.5) / 2.1)
      const col = k === 0 || t < 0.03 ? TOPSOIL : STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length]
      colors.push(col.r, col.g, col.b)
    }
  }
  // Close the spire with a tip vertex, ending just above the cloud layer (y ≈ -32), which
  // doesn't write depth and so couldn't hide anything poking through it.
  const tip = positions.length / 3
  positions.push(0.6, lipY - CLIFF_DEPTH - 4, -0.4)
  colors.push(STRATA[1].r, STRATA[1].g, STRATA[1].b)
  // Winding: counter-clockwise seen from outside, so faces (and normals) point outward.
  for (let k = 0; k < CLIFF_LEVELS; k++) {
    const a0 = k * SEGMENTS
    const a1 = (k + 1) * SEGMENTS
    for (let j = 0; j < SEGMENTS; j++) {
      const j1 = (j + 1) % SEGMENTS
      indices.push(a0 + j, a0 + j1, a1 + j)
      indices.push(a0 + j1, a1 + j1, a1 + j)
    }
  }
  const last = CLIFF_LEVELS * SEGMENTS
  for (let j = 0; j < SEGMENTS; j++) indices.push(last + j, last + ((j + 1) % SEGMENTS), tip)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  // Smooth normals: the strata colours carry the rock's detail. (Flat-shaded facets this
  // small each picked up an ink crease line, which read as noise.)
  g.computeVertexNormals()
  return g
}

// Smaller spires hanging from the underside.
function buildHangingRocks() {
  const rand = mulberry32(31)
  const geos = []
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2
    const r = 3 + rand() * 7
    const len = 5 + rand() * 9
    const g = new THREE.ConeGeometry(1.2 + rand() * 1.6, len, 7, 3)
    g.rotateX(Math.PI) // point down
    const pos = g.attributes.position
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v)
      const y = pos.getY(v)
      const z = pos.getZ(v)
      const n = fbm3(x * 0.6 + i, y * 0.4, z * 0.6, 2, 5) - 0.5
      pos.setXYZ(v, x * (1 + n * 0.5), y, z * (1 + n * 0.5))
    }
    g.translate(Math.cos(a) * r, -4 - len / 2 - rand() * 5, Math.sin(a) * r)
    geos.push(g.toNonIndexed())
  }
  const merged = mergeNonIndexed(geos)
  merged.computeVertexNormals()
  return merged
}

function mergeNonIndexed(geos) {
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0)
  const pos = new Float32Array(total * 3)
  let o = 0
  for (const g of geos) {
    pos.set(g.attributes.position.array, o)
    o += g.attributes.position.array.length
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return out
}

export default function Island() {
  const { meadow, cliff, hanging, meadowMat, rockMat, hangingMat } = useMemo(
    () => ({
      meadow: buildMeadow(),
      cliff: buildCliff(),
      hanging: buildHangingRocks(),
      meadowMat: createToonMaterial({ vertexColors: true }, { key: 'meadow', rim: false }),
      rockMat: createToonMaterial({ vertexColors: true }, { key: 'cliff' }),
      hangingMat: createToonMaterial({ color: '#7d6b5c', flatShading: true }, { key: 'rock' }),
    }),
    [],
  )
  return (
    <group>
      <mesh geometry={meadow} material={meadowMat} receiveShadow />
      {/* No receiveShadow: steep cliff faces only showed shadow-map acne (moiré), not shapes. */}
      <mesh geometry={cliff} material={rockMat} castShadow />
      <mesh geometry={hanging} material={hangingMat} castShadow />
    </group>
  )
}
