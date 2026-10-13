import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useStore } from '../../state/store'
import { QUALITY } from '../render/quality'
import { U } from '../materials/globalUniforms'
import { createCloudMaterial, createPuffGeometry } from '../materials/cloudMaterial'
import { profile } from '../../content/profile'
import { SKY_NAME } from '../layout'
import { mulberry32 } from './noise'

// The name, written across the sky — the first thing the opening shot sees, and huge
// background lettering for the rest of the visit.
//
// The glyphs are rasterised from the same font as the splash (Shippori Mincho B1), then
// filled with circles: a distance transform tells how far each pixel is from the
// glyph's edge, and points are placed with radius proportional to that distance, so
// thick strokes get big puffs and thin serifs small ones. The same points become:
//  • golden hour — cel-shaded cloud puffs (the cloud material, lightly fogged);
//  • twilight — a constellation of warm lantern lights that flicker and drift.
// The two dissolve into each other with the theme (driven by the shared uLanterns).

const CANVAS_W = 1024
const CANVAS_H = 440

function rasterizeName(lines) {
  const c = document.createElement('canvas')
  c.width = CANVAS_W
  c.height = CANVAS_H
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, CANVAS_W, CANVAS_H)
  g.fillStyle = '#fff'
  g.textBaseline = 'alphabetic'
  // Fit the longest line to the canvas width, like the splash's two-line lockup.
  let size = 220
  const font = (s) => `800 ${s}px "Shippori Mincho B1", "Yu Mincho", serif`
  g.font = font(size)
  const widest = () => Math.max(...lines.map((l) => g.measureText(l).width))
  while (widest() > CANVAS_W * 0.94 && size > 60) {
    size -= 4
    g.font = font(size)
  }
  const lineHeight = size * 0.92
  const top = (CANVAS_H - lineHeight * lines.length) / 2 + size * 0.78
  // Mincho type has hairline horizontals (the bar of the "e"), which come out as a few
  // stray puffs. A round-joined stroke thickens every stroke by the same amount, evening
  // out the contrast so each letter keeps its shape in cloud.
  g.strokeStyle = '#fff'
  g.lineJoin = 'round'
  g.lineWidth = size * 0.032
  lines.forEach((line, i) => {
    // Second line indented, echoing the splash typography.
    const x = (CANVAS_W - widest()) / 2 + (i === 1 ? size * 0.35 : 0)
    g.fillText(line, x, top + i * lineHeight)
    g.strokeText(line, x, top + i * lineHeight)
  })
  const data = g.getImageData(0, 0, CANVAS_W, CANVAS_H).data
  const mask = new Uint8Array(CANVAS_W * CANVAS_H)
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4] > 127 ? 1 : 0
  return mask
}

/** Two-pass chamfer distance transform: distance (px) from each inside pixel to the edge. */
function distanceInside(mask) {
  const W = CANVAS_W
  const H = CANVAS_H
  const d = new Float32Array(W * H)
  const INF = 1e9
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0
  const pass = (x, y, dx, dy, cost) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return
    const v = d[ny * W + nx] + cost
    if (v < d[y * W + x]) d[y * W + x] = v
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (mask[y * W + x]) {
        pass(x, y, -1, 0, 1)
        pass(x, y, 0, -1, 1)
        pass(x, y, -1, -1, 1.414)
        pass(x, y, 1, -1, 1.414)
      }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--)
      if (mask[y * W + x]) {
        pass(x, y, 1, 0, 1)
        pass(x, y, 0, 1, 1)
        pass(x, y, 1, 1, 1.414)
        pass(x, y, -1, 1, 1.414)
      }
  return d
}

/** Points that pack the glyphs with circles sized to the local stroke thickness. */
function samplePoints(mask, dist, count, rand) {
  const points = []
  const W = CANVAS_W
  let tries = 0
  while (points.length < count && tries < count * 40) {
    tries++
    const x = Math.floor(rand() * W)
    const y = Math.floor(rand() * CANVAS_H)
    const i = y * W + x
    if (!mask[i]) continue
    const r = Math.min(dist[i], 22)
    if (r < 1.1) continue
    // Keep puffs from stacking exactly on top of each other.
    let ok = true
    for (let k = points.length - 1, seen = 0; k >= 0 && seen < 400; k--, seen++) {
      const p = points[k]
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < (Math.min(p.r, r) * 0.55) ** 2) {
        ok = false
        break
      }
    }
    if (ok) points.push({ x, y, r })
  }
  return points
}

const lightVertex = /* glsl */ `
attribute vec3 aCenter;
attribute float aRadius;
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying float vFlicker;
void main() {
  vec3 c = aCenter + vec3(sin(uTime * 0.3 + aSeed * 30.0), sin(uTime * 0.45 + aSeed * 17.0) * 1.4, 0.0) * 1.2;
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * (1.2 + aRadius * 0.42);
  vFlicker = 0.75 + 0.25 * sin(uTime * (2.5 + aSeed * 3.0) + aSeed * 40.0);
  vUv = position.xy;
  gl_Position = projectionMatrix * mv;
}
`

const lightFragment = /* glsl */ `
uniform float uLanterns;
uniform float uVisible;
uniform vec3 uColor;
varying vec2 vUv;
varying float vFlicker;
void main() {
  float d = length(vUv);
  float core = smoothstep(0.42, 0.18, d);
  float halo = pow(clamp(1.0 - d, 0.0, 1.0), 2.5) * 0.55;
  float a = (core + halo) * vFlicker * smoothstep(0.35, 0.95, uLanterns) * uVisible;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * a * 3.2, a);
}
`

export default function SkyName() {
  const tier = useStore((s) => s.tier)
  const intro = useStore((s) => s.intro)
  const { density } = QUALITY[tier]
  // The glyphs need the display font; it is preloaded by the splash, but wait for it so
  // the sky never spells the name in a fallback serif.
  const [fontReady, setFontReady] = useState(false)
  useEffect(() => {
    let alive = true
    document.fonts
      .load('800 200px "Shippori Mincho B1"')
      .catch(() => {})
      .then(() => alive && setFontReady(true))
    return () => {
      alive = false
    }
  }, [])

  const built = useMemo(() => {
    if (!fontReady) return null
    const rand = mulberry32(2026)
    const [first, ...rest] = profile.name.split(' ')
    const mask = rasterizeName([first, rest.join(' ')])
    const dist = distanceInside(mask)
    const points = samplePoints(mask, dist, Math.round(2600 * Math.max(density, 0.45)), rand)
    // Canvas pixels → metres on a vertical plane facing the island.
    const scale = SKY_NAME.width / CANVAS_W
    const puffs = points.map((p) => ({
      center: [(p.x - CANVAS_W / 2) * scale, (CANVAS_H / 2 - p.y) * scale, (rand() - 0.5) * 6],
      // Puffs stop near the glyph edge (a larger factor would fill the small counters,
      // turning "e" into "c").
      radius: p.r * scale * 1.06,
      seed: rand(),
    }))
    const puffGeo = createPuffGeometry(puffs)
    const puffMat = createCloudMaterial({ sphereDepth: false, fogScale: 9, drift: 1.5, bumpScale: 0.03 })
    // Dissolve the cloud letters away as twilight falls (and when the intro variant is
    // the typographic title card, which doesn't use the sky name).
    puffMat.uniforms.uLanterns = U.uLanterns
    puffMat.uniforms.uVisible = { value: 1 }
    puffMat.fragmentShader = puffMat.fragmentShader
      .replace('void main() {', 'uniform float uLanterns;\nuniform float uVisible;\nvoid main() {')
      .replace(
        'if (r2 > edge * edge) discard;',
        'if (r2 > edge * edge) discard;\n  if (fract(sin(vSeed * 91.7) * 4375.5) < smoothstep(0.35, 0.8, uLanterns) || uVisible < 0.5) discard;',
      )
    const lightMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uLanterns: U.uLanterns, uVisible: { value: 1 }, uColor: { value: new THREE.Color('#ffc477') } },
      vertexShader: lightVertex,
      fragmentShader: lightFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { puffGeo, puffMat, lightMat }
  }, [fontReady, density])

  useEffect(() => {
    if (!built) return
    const v = intro === 'sky' ? 1 : 0
    built.puffMat.uniforms.uVisible.value = v
    built.lightMat.uniforms.uVisible.value = v
  }, [built, intro])

  useEffect(
    () => () => {
      if (!built) return
      built.puffGeo.dispose()
      built.puffMat.dispose()
      built.lightMat.dispose()
    },
    [built],
  )

  if (!built) return null
  return (
    <group position={SKY_NAME.position} rotation={[0, SKY_NAME.yaw, 0]}>
      <mesh geometry={built.puffGeo} material={built.puffMat} frustumCulled={false} />
      <mesh geometry={built.puffGeo} material={built.lightMat} frustumCulled={false} renderOrder={3} />
    </group>
  )
}
