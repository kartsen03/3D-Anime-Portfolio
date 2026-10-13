import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { createToonMaterial } from '../materials/shaderLib'
import { addColliders } from '../systems/collision'
import { groundHeight } from './terrain'
import { mulberry32 } from './noise'

// Painterly trees, generated in code: a hero cherry tree (sakura) and cloud-pruned
// Japanese black pines (niwaki), the two most iconic shrine-garden trees.
//
// The canopy technique ("fluffy" foliage) is what makes stylized trees look good:
//  • the canopy is a few blobs, each covered in alpha-cut cards painted with blossom or
//    needle clusters (procedural textures — no image files);
//  • every card's NORMAL points out from the canopy's centre (spherical normals), not
//    the card's own facing, so the whole crown shades like one soft mass with a clean
//    toon terminator instead of a jumble of flat cards;
//  • cards sway in the wind in the vertex shader, each blob on its own phase.
// Cards cast alpha-tested shadows, so the ground beneath gets dappled light.

// ---------- procedural card textures ----------
function blossomTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const rand = mulberry32(5)
  const petals = ['#ffd3df', '#ffc1d3', '#ffe4ec', '#f8aec4', '#fff0f4']
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * 98
    const x = 128 + Math.cos(a) * r
    const y = 128 + Math.sin(a) * r
    const s = 9 + rand() * 9
    const rot = rand() * Math.PI
    g.fillStyle = petals[Math.floor(rand() * petals.length)]
    for (let p = 0; p < 5; p++) {
      const pa = rot + (p / 5) * Math.PI * 2
      g.beginPath()
      g.ellipse(x + Math.cos(pa) * s * 0.55, y + Math.sin(pa) * s * 0.55, s * 0.55, s * 0.34, pa, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#e07a97'
    g.beginPath()
    g.arc(x, y, s * 0.18, 0, Math.PI * 2)
    g.fill()
  }
  return finishTexture(c)
}

function needleTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const rand = mulberry32(9)
  const greens = ['#4f7f45', '#3f6e3c', '#5e9050', '#6b9c58']
  g.lineCap = 'round'
  for (let k = 0; k < 9; k++) {
    const cx = 128 + (rand() - 0.5) * 120
    const cy = 128 + (rand() - 0.5) * 120
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2
      const len = 26 + rand() * 30
      g.strokeStyle = greens[Math.floor(rand() * greens.length)]
      g.lineWidth = 3 + rand() * 3
      g.beginPath()
      g.moveTo(cx, cy)
      g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
      g.stroke()
    }
  }
  return finishTexture(c)
}

function finishTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// ---------- geometry ----------
/** A tube along `curve` whose radius tapers from r0 to r1 (TubeGeometry can't taper). */
function taperedTube(curve, r0, r1, segments = 18, sides = 8) {
  const frames = curve.computeFrenetFrames(segments, false)
  const pos = []
  const idx = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p = curve.getPointAt(t)
    const r = r0 + (r1 - r0) * Math.pow(t, 0.8)
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)))
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r)
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j
      const b = a + sides + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function mergeGeometries(list) {
  let indexOffset = 0
  const pos = []
  const nrm = []
  const idx = []
  for (const g of list) {
    const p = g.attributes.position.array
    const n = g.attributes.normal.array
    for (let i = 0; i < p.length; i++) pos.push(p[i])
    for (let i = 0; i < n.length; i++) nrm.push(n[i])
    const index = g.index.array
    for (let i = 0; i < index.length; i++) idx.push(index[i] + indexOffset)
    indexOffset += g.attributes.position.count
  }
  const m = new THREE.BufferGeometry()
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  m.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  m.setIndex(idx)
  return m
}

/**
 * Canopy cards scattered over blobs. Each card is a quad tangent to its blob, facing
 * outward, with a spherical normal blended between the blob's and the crown's centre.
 */
function canopyGeometry(blobs, crownCentre, { cardSize, cardsPerUnit, rand }) {
  const pos = []
  const nrm = []
  const uv = []
  const phase = []
  const idx = []
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const bitangent = new THREE.Vector3()
  blobs.forEach((blob, bi) => {
    const count = Math.round(4 * Math.PI * blob.radius * blob.radius * cardsPerUnit)
    const blobPhase = rand() * Math.PI * 2
    for (let i = 0; i < count; i++) {
      // Uniform point on the sphere, squashed a little for flatter, pad-like blobs.
      const z = rand() * 2 - 1
      const a = rand() * Math.PI * 2
      const s = Math.sqrt(1 - z * z)
      n.set(Math.cos(a) * s, z * (blob.flat ?? 1), Math.sin(a) * s).normalize()
      const centre = new THREE.Vector3(...blob.center).addScaledVector(n, blob.radius * (0.7 + rand() * 0.3))
      // Card axes: tangent to the blob, randomly spun about the normal.
      tangent.crossVectors(Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up, n).normalize()
      bitangent.crossVectors(n, tangent).normalize()
      const spin = rand() * Math.PI * 2
      const tx = tangent.clone().multiplyScalar(Math.cos(spin)).addScaledVector(bitangent, Math.sin(spin))
      const ty = n.clone().cross(tx).normalize()
      const size = cardSize * (0.75 + rand() * 0.5)
      // Lighting normal: mostly the crown's sphere, partly the blob's, for soft masses.
      const crownN = centre.clone().sub(crownCentre).normalize()
      const shadeN = crownN.multiplyScalar(0.6).addScaledVector(n, 0.4).normalize()
      const base = pos.length / 3
      const corners = [
        [-1, -1, 0, 0],
        [1, -1, 1, 0],
        [1, 1, 1, 1],
        [-1, 1, 0, 1],
      ]
      for (const [cx, cy, u, v] of corners) {
        pos.push(
          centre.x + (tx.x * cx + ty.x * cy) * size * 0.5,
          centre.y + (tx.y * cx + ty.y * cy) * size * 0.5,
          centre.z + (tx.z * cx + ty.z * cy) * size * 0.5,
        )
        nrm.push(shadeN.x, shadeN.y, shadeN.z)
        uv.push(u, v)
        phase.push(blobPhase + bi * 0.37)
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1))
  g.setIndex(idx)
  return g
}

// ---------- tree designs ----------
function sakura(rand) {
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.15, 1.2, 0.05),
    new THREE.Vector3(-0.1, 2.3, 0.1),
    new THREE.Vector3(0.2, 3.1, -0.05),
  ])
  const parts = [taperedTube(trunkCurve, 0.42, 0.2, 16, 10)]
  const blobs = []
  const branchEnds = [
    [2.6, 4.3, 0.6],
    [-2.4, 4.6, 0.9],
    [0.5, 5.2, -2.2],
    [-0.6, 4.4, 2.4],
    [1.8, 5.4, -1.0],
    [-1.6, 5.6, -1.3],
  ]
  for (const [x, y, z] of branchEnds) {
    const start = trunkCurve.getPointAt(0.75 + rand() * 0.2)
    const mid = start.clone().lerp(new THREE.Vector3(x, y, z), 0.5).add(new THREE.Vector3(0, 0.5, 0))
    parts.push(taperedTube(new THREE.CatmullRomCurve3([start, mid, new THREE.Vector3(x, y, z)]), 0.15, 0.05, 10, 6))
    blobs.push({ center: [x, y + 0.3, z], radius: 1.35 + rand() * 0.45 })
  }
  blobs.push({ center: [0.1, 5.9, 0], radius: 1.9 })
  blobs.push({ center: [0.2, 4.4, 0.1], radius: 1.6 })
  return { trunk: mergeGeometries(parts), blobs, crown: new THREE.Vector3(0.1, 4.9, 0), kind: 'sakura' }
}

function pine(rand) {
  // A leaning, slightly twisting trunk with flat "cloud pads" of needles at branch ends.
  const lean = (rand() - 0.5) * 0.9
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.6, 1.4, 0.2),
    new THREE.Vector3(lean * 1.1 - 0.3, 2.8, -0.1),
    new THREE.Vector3(lean * 1.2, 4.0, 0.15),
  ])
  const parts = [taperedTube(trunkCurve, 0.3, 0.12, 16, 8)]
  const blobs = []
  const padCount = 4 + Math.floor(rand() * 2)
  for (let i = 0; i < padCount; i++) {
    const t = 0.45 + (i / padCount) * 0.55
    const start = trunkCurve.getPointAt(t)
    const a = rand() * Math.PI * 2
    const reach = 1.0 + rand() * 0.9 * (1 - t * 0.5)
    const end = start.clone().add(new THREE.Vector3(Math.cos(a) * reach, 0.25 + rand() * 0.35, Math.sin(a) * reach))
    parts.push(taperedTube(new THREE.CatmullRomCurve3([start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.2, 0)), end]), 0.09, 0.04, 8, 6))
    blobs.push({ center: [end.x, end.y + 0.15, end.z], radius: 0.85 + rand() * 0.35, flat: 0.45 })
  }
  const top = trunkCurve.getPointAt(1)
  blobs.push({ center: [top.x, top.y + 0.3, top.z], radius: 1.05, flat: 0.5 })
  return { trunk: mergeGeometries(parts), blobs, crown: top.clone().add(new THREE.Vector3(0, -0.4, 0)), kind: 'pine' }
}

const LEAF_SWAY = /* glsl */ `
  float sway = sin(uTime * 1.25 + aPhase) * 0.5 + sin(uTime * 2.1 + aPhase * 1.7) * 0.25;
  float gustLeaf = texture2D(uNoise, (modelMatrix[3].xz + transformed.xz) * 0.03 - uWindDir * uTime * 0.05).r;
  transformed.xz += uWindDir * (sway * 0.05 + (gustLeaf - 0.35) * 0.18) * uWindStrength * (0.3 + transformed.y * 0.12);
`

// Where the trees stand: pines on the rim, and the hero sakura out on the meadow ahead of
// the spawn, right of centre in the opening view (it balances the About gate on the
// left, and its crown rises into the bottom of the sky-name shot). It must stay clear
// of the space behind the spawn, where the follow camera starts.
const PLACEMENTS = [
  { kind: 'sakura', x: 1.9, z: 10.8, scale: 1.0, rot: 0.4 },
  { kind: 'pine', x: 12.2, z: 3.2, scale: 1.05, rot: 1.2 },
  { kind: 'pine', x: -12.6, z: 4.4, scale: 0.95, rot: 2.6 },
  { kind: 'pine', x: 4.2, z: -12.4, scale: 1.1, rot: 4.1 },
  { kind: 'pine', x: -6.8, z: -11.0, scale: 0.9, rot: 5.0 },
  { kind: 'pine', x: 7.8, z: 10.6, scale: 1.0, rot: 0.7 },
]

export default function Trees() {
  const built = useMemo(() => {
    const rand = mulberry32(77)
    const bark = createToonMaterial({ color: '#5a3d2e' }, { key: 'bark' })
    const leafOpts = { key: 'leaves', vertexPars: 'attribute float aPhase;', vertex: LEAF_SWAY, keepNormals: true, outline: false, rim: true }
    const blossom = createToonMaterial({ map: blossomTexture(), alphaTest: 0.5, side: THREE.DoubleSide }, leafOpts)
    const needles = createToonMaterial({ map: needleTexture(), alphaTest: 0.5, side: THREE.DoubleSide }, { ...leafOpts, key: 'needles' })
    return PLACEMENTS.map((p) => {
      const design = p.kind === 'sakura' ? sakura(rand) : pine(rand)
      const canopy = canopyGeometry(design.blobs, design.crown, {
        cardSize: p.kind === 'sakura' ? 1.05 : 0.8,
        cardsPerUnit: p.kind === 'sakura' ? 4.2 : 5.5,
        rand,
      })
      return { ...p, y: groundHeight(p.x, p.z), trunk: design.trunk, canopy, bark, leaves: p.kind === 'sakura' ? blossom : needles }
    })
  }, [])

  // Trunks block the character (the canopies are well above head height).
  useEffect(() => addColliders(PLACEMENTS.map((p) => ({ x: p.x, z: p.z, r: p.kind === 'sakura' ? 0.55 : 0.4 }))), [])

  return built.map((t, i) => (
    <group key={i} position={[t.x, t.y, t.z]} rotation={[0, t.rot, 0]} scale={t.scale}>
      <mesh geometry={t.trunk} material={t.bark} castShadow receiveShadow />
      <mesh geometry={t.canopy} material={t.leaves} castShadow receiveShadow />
    </group>
  ))
}
