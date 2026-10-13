import { useMemo } from 'react'
import * as THREE from 'three'
import { createToonMaterial } from '../materials/shaderLib'

// A myōjin-style torii, built from shaped primitives rather than boxes:
//  • kasagi + shimaki: the two top lintels, curving upward toward their ends (sori)
//  • hashira: pillars that taper slightly and lean inward, as real gates do
//  • nuki: the tie beam passing through the pillars; gakuzuka: the centre strut
//  • kamebara: stone footings; gaku: the lacquered name plaque
//  • shimenawa: a twisted straw rope with zigzag paper streamers (shide) that sway
// Dimensions are metres, scaled for a ~1.7 m character.

const W = {
  span: 1.38, // pillar x offset from centre
  pillarH: 3.95,
  pillarR: [0.145, 0.175], // top, bottom radius
  lean: 0.035, // inward lean (radians)
  nukiY: 2.95,
  shimakiY: 3.62,
  kasagiY: 3.88,
}

const VERMILION = '#c8442b'
const LACQUER = '#1d1718'

/** A beam whose ends sweep upward: a segmented box with each column of vertices lifted. */
function curvedBeam(length, height, depth, sori, segments = 28) {
  const g = new THREE.BoxGeometry(length, height, depth, segments, 1, 1)
  const pos = g.attributes.position
  const half = length / 2
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const t = Math.abs(x) / half
    // Taper the beam's own height slightly toward the tips, then sweep it upward,
    // rising faster at the very ends.
    pos.setY(i, pos.getY(i) * (1 - 0.18 * Math.pow(t, 3)) + sori * Math.pow(t, 2.4))
  }
  g.computeVertexNormals()
  return g
}

function footingGeometry() {
  // Lathe profile (radius, height) of a rounded stone base.
  const pts = [
    [0.0, 0],
    [0.34, 0],
    [0.34, 0.08],
    [0.3, 0.16],
    [0.23, 0.3],
    [0.2, 0.36],
    [0.0, 0.36],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(pts, 20)
}

function plaqueTexture(label) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#17110f'
  g.fillRect(0, 0, 512, 256)
  g.strokeStyle = '#c99a45'
  g.lineWidth = 10
  g.strokeRect(14, 14, 484, 228)
  g.lineWidth = 3
  g.strokeRect(30, 30, 452, 196)
  g.fillStyle = '#e2b866'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = 112
  g.font = `800 ${size}px "Shippori Mincho B1", "Yu Mincho", serif`
  while (g.measureText(label).width > 400 && size > 40) {
    size -= 4
    g.font = `800 ${size}px "Shippori Mincho B1", "Yu Mincho", serif`
  }
  g.fillText(label, 256, 136)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Shimenawa: two strands twisted around a sagging centre line. */
function ropeGeometry(span, sag) {
  const centre = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-span, 0, 0),
    new THREE.Vector3(-span * 0.5, -sag * 0.75, 0.02),
    new THREE.Vector3(0, -sag, 0.03),
    new THREE.Vector3(span * 0.5, -sag * 0.75, 0.02),
    new THREE.Vector3(span, 0, 0),
  ])
  const strands = []
  for (let s = 0; s < 2; s++) {
    const pts = []
    const N = 80
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = centre.getPoint(t)
      const twist = t * Math.PI * 2 * 7 + s * Math.PI
      // Thicker in the middle, like a real shimenawa.
      const r = 0.045 * (0.75 + Math.sin(t * Math.PI) * 0.6)
      pts.push(new THREE.Vector3(p.x, p.y + Math.cos(twist) * r, p.z + Math.sin(twist) * r))
    }
    strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.05 * 1.0, 6, false))
  }
  return { strands, centre }
}

/** Shide: a zigzag strip of paper, as a thin ribbon. */
function shideGeometry() {
  const shape = []
  const steps = 4
  const w = 0.075
  const h = 0.11
  for (let i = 0; i <= steps; i++) {
    const x = i % 2 === 0 ? 0 : w
    shape.push([x, -i * h], [x + w, -i * h])
  }
  const positions = []
  for (let i = 0; i < steps; i++) {
    const [a, b] = [shape[i * 2], shape[i * 2 + 1]]
    const [c, d] = [shape[i * 2 + 2], shape[i * 2 + 3]]
    positions.push(...a, 0, ...c, 0, ...b, 0, ...b, 0, ...c, 0, ...d, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

// Paper sways in the wind: the further down the strip, the more it moves.
const SHIDE_SWAY = /* glsl */ `
  float sway = sin(uTime * 2.3 + position.x * 9.0 + modelMatrix[3][0] * 0.7) * 0.5 + 0.5;
  float depth = clamp(-position.y / 0.44, 0.0, 1.0);
  transformed.z += (sway - 0.35) * depth * 0.09 * uWindStrength;
  transformed.x += sin(uTime * 1.7 + modelMatrix[3][2]) * depth * 0.02;
`

export default function Torii({ label }) {
  const parts = useMemo(() => {
    const vermilion = createToonMaterial({ color: VERMILION }, { key: 'torii' })
    const lacquer = createToonMaterial({ color: LACQUER }, { key: 'torii' })
    const stone = createToonMaterial({ color: '#8d877d', flatShading: true }, { key: 'stone' })
    const rope = createToonMaterial({ color: '#d9c38c' }, { key: 'rope' })
    const paper = createToonMaterial({ color: '#fbf6ec', side: THREE.DoubleSide }, { key: 'shide', vertex: SHIDE_SWAY })
    const plaque = createToonMaterial({ map: plaqueTexture(label) }, { key: 'plaque', rim: false })

    const pillar = new THREE.CylinderGeometry(W.pillarR[0], W.pillarR[1], W.pillarH, 18, 1)
    pillar.translate(0, W.pillarH / 2, 0)
    const { strands, centre } = ropeGeometry(W.span - 0.05, 0.28)
    return {
      vermilion,
      lacquer,
      stone,
      rope,
      paper,
      plaque,
      pillar,
      footing: footingGeometry(),
      kasagi: curvedBeam(W.span * 2 + 1.5, 0.22, 0.42, 0.26),
      kasagiCap: curvedBeam(W.span * 2 + 1.62, 0.07, 0.48, 0.28),
      shimaki: curvedBeam(W.span * 2 + 1.25, 0.2, 0.3, 0.2),
      nuki: new THREE.BoxGeometry(W.span * 2 + 0.7, 0.19, 0.15),
      gakuzuka: new THREE.BoxGeometry(0.16, W.shimakiY - W.nukiY - 0.1, 0.16),
      plaqueFrame: new THREE.BoxGeometry(0.78, 0.44, 0.07),
      plaqueFace: new THREE.PlaneGeometry(0.7, 0.36),
      strands,
      shide: shideGeometry(),
      shidePoints: [0.15, 0.38, 0.62, 0.85].map((t) => centre.getPoint(t)),
    }
  }, [label])

  const p = parts
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * W.span, 0, 0]}>
          <mesh geometry={p.footing} material={p.stone} castShadow receiveShadow />
          {/* Lean inward: rotate about z so the tops tip toward the centre. */}
          <mesh geometry={p.pillar} material={p.vermilion} rotation={[0, 0, side * W.lean]} castShadow receiveShadow />
        </group>
      ))}
      <mesh geometry={p.nuki} material={p.vermilion} position={[0, W.nukiY, 0]} castShadow receiveShadow />
      <mesh geometry={p.gakuzuka} material={p.vermilion} position={[0, (W.nukiY + W.shimakiY) / 2, 0]} castShadow />
      <mesh geometry={p.shimaki} material={p.vermilion} position={[0, W.shimakiY, 0]} castShadow receiveShadow />
      <mesh geometry={p.kasagi} material={p.lacquer} position={[0, W.kasagiY, 0]} castShadow receiveShadow />
      <mesh geometry={p.kasagiCap} material={p.lacquer} position={[0, W.kasagiY + 0.14, 0]} castShadow />

      {/* Name plaque on the centre strut, facing the approach (+z). */}
      <group position={[0, (W.nukiY + W.shimakiY) / 2, 0.1]}>
        <mesh geometry={p.plaqueFrame} material={p.lacquer} castShadow />
        <mesh geometry={p.plaqueFace} material={p.plaque} position={[0, 0, 0.037]} />
      </group>

      {/* Shimenawa hung just below the tie beam, with paper streamers. */}
      <group position={[0, W.nukiY - 0.18, 0.12]}>
        {p.strands.map((g, i) => (
          <mesh key={i} geometry={g} material={p.rope} castShadow />
        ))}
        {p.shidePoints.map((pt, i) => (
          <mesh key={i} geometry={p.shide} material={p.paper} position={[pt.x - 0.07, pt.y - 0.03, pt.z + 0.03]} />
        ))}
      </group>
    </group>
  )
}
