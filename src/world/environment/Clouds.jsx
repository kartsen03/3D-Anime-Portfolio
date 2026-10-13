import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../../state/store'
import { QUALITY } from '../render/quality'
import { createCloudMaterial, createPuffGeometry } from '../materials/cloudMaterial'
import { U } from '../materials/globalUniforms'
import { SKY_GLSL } from '../materials/shaderLib'
import { fbm3, mulberry32 } from './noise'

// The sea of clouds the island floats above, and towering cumulus on the horizon. Puffs
// are grouped into banks by a noise field, so there are gaps to look down through
// instead of a uniform carpet.
//
// Cost control (measured on an Iris Xe): the clouds were ~1.5 ms of a 6.8 ms frame. Most
// of that was far-away puffs packed into the thin band near the horizon. So the sea is
// split in two: NEAR banks get true per-pixel sphere depth (overlapping puffs merge
// organically — visible up close), FAR banks use fewer, larger puffs with flat depth,
// which keeps the GPU's early depth rejection working (writing gl_FragDepth disables it).

const SEA_LEVEL = -31 // the cloud sea's surface in its holes (the island top is y = 0)
// …and its flat base, just below: real cumulus sit on a level condensation line, so every
// puff is cut off there and the sea reads as rolling tops rather than stacked spheres.
const SEA_BASE = SEA_LEVEL - 0.6
const TOWER_BASE = -27
const NEAR_LIMIT = 150 // metres from the island centre

// The sea of clouds is a soft, low cloud layer (the floor, below) with cumulus heaps
// rising out of it. Evenly spread puffs of one size read as bubble wrap, so the heaps vary
// a lot in size and are built "lumps on lumps": a few big puffs for the body, mid-size ones
// piled over its upper surface, small ones on top. Each heap is lit as one mound (`bank`).
function heap(out, x, z, R, rand) {
  const H = R * (0.42 + rand() * 0.2) // heaps are wider than tall
  const stretch = 0.6 + rand() * 0.4 // …and elongated, turned at random
  const turn = rand() * Math.PI
  const bank = [x, SEA_LEVEL - R * 0.15, z, R]
  const put = (ux, uy, uz, radius) => {
    out.push({
      center: [x + ux * Math.cos(turn) - uz * Math.sin(turn), SEA_LEVEL + uy, z + ux * Math.sin(turn) + uz * Math.cos(turn)],
      radius,
      seed: rand(),
      bank,
    })
  }
  // A point on the heap's dome (azimuth a, elevation e), pulled in by `inset` metres.
  const onDome = (a, e, inset, radius) => {
    const c = Math.cos(e)
    put(Math.cos(a) * c * (R - inset), Math.sin(e) * (H - inset), Math.sin(a) * c * (R - inset) * stretch, radius)
  }
  const core = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < core; i++) {
    const a = rand() * Math.PI * 2
    const d = Math.sqrt(rand()) * 0.4
    put(Math.cos(a) * d * R, H * (0.05 + rand() * 0.15), Math.sin(a) * d * R * stretch, R * (0.38 + rand() * 0.12))
  }
  const mid = 9 + Math.round(R / 3)
  for (let i = 0; i < mid; i++) {
    const radius = R * (0.17 + rand() * 0.11)
    onDome(rand() * Math.PI * 2, 0.15 + rand() * 1.1, radius * 0.55, radius)
  }
  const small = 6 + Math.round(R / 3.5)
  for (let i = 0; i < small; i++) {
    const radius = R * (0.08 + rand() * 0.06)
    onDome(rand() * Math.PI * 2, 0.45 + rand() * 1.0, radius * 0.25, radius)
  }
}

function seaOfClouds(density, rand) {
  const near = []
  const far = []
  const placed = []
  const target = Math.round(110 * Math.max(density, 0.4))
  for (let tries = 0; placed.length < target && tries < target * 30; tries++) {
    // Over the ring area, keeping open air around the island (so its spire can be seen
    // fading into the haze). Heaps cluster where a noise field is high.
    const r = Math.sqrt(rand()) * 420 + 55
    const a = rand() * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (fbm3(x * 0.006, 0, z * 0.006, 3, 21) < 0.38) continue
    // Mostly modest heaps, a few big ones (log-uniform sizes); bigger allowed farther out.
    const R = Math.exp(Math.log(9) + rand() * Math.log((14 + r * 0.1) / 9))
    if (placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < ((p.R + R) * 0.85) ** 2)) continue
    placed.push({ x, z, R })
    heap(r < NEAR_LIMIT ? near : far, x, z, R, rand)
  }
  return { near, far }
}

function horizonTowers(density, rand) {
  const puffs = []
  const towers = Math.max(4, Math.round(8 * density))
  for (let t = 0; t < towers; t++) {
    const a = (t / towers) * Math.PI * 2 + rand() * 0.5
    const r = 500 + rand() * 160
    const height = 40 + rand() * 55
    const levels = 9
    // Lit as one tall column (see `bank`), centred a third of the way up.
    const bank = [Math.cos(a) * r, TOWER_BASE + height * 0.35, Math.sin(a) * r, 30]
    for (let l = 0; l < levels; l++) {
      const f = l / (levels - 1)
      // Wide base, billowing middle, narrower rounded crown.
      const ringRadius = 30 * (1 - f * 0.65) * (0.9 + Math.sin(f * Math.PI) * 0.3)
      const n = Math.round(9 * (1 - f * 0.55)) + 2
      for (let i = 0; i < n; i++) {
        const sa = rand() * Math.PI * 2
        const radius = (13 - f * 5) * (0.7 + rand() * 0.6)
        puffs.push({
          center: [
            Math.cos(a) * r + Math.cos(sa) * ringRadius * Math.sqrt(rand()),
            TOWER_BASE + 4 + f * height,
            Math.sin(a) * r + Math.sin(sa) * ringRadius * Math.sqrt(rand()),
          ],
          radius,
          seed: rand(),
          bank,
        })
      }
    }
  }
  return puffs
}

// The low cloud layer the heaps rise out of: one disc at the cloud base, with broad,
// slowly drifting billows of light and shade, fogged into the sky toward the horizon. It is
// shaded softly (no hard bands) so it reads as a lower, hazier layer under the heaps
// rather than a floor they stand on.
const floorVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const floorFragment = /* glsl */ `
${SKY_GLSL}
uniform sampler2D uNoise;
uniform vec3 uCloudShadow;
uniform vec3 uCloudMid;
uniform vec3 uCloudLit;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float billow = texture2D(uNoise, p * 0.0028 + uTime * 0.0012).r * 0.65
               + texture2D(uNoise, p * 0.0095 - uTime * 0.002).r * 0.35;
  vec3 col = mix(uCloudShadow, uCloudMid, 0.2 + smoothstep(0.3, 0.75, billow) * 0.65);
  col = mix(col, uCloudLit, smoothstep(0.6, 0.85, billow) * 0.25);
  vec3 ray = vWorld - cameraPosition;
  float dist = length(ray);
  // Same aerial perspective as the heaps (cloud material, fogScale 2.6), so their bases
  // and the layer match wherever they meet.
  col = mix(col, skyGradient(ray / dist), smoothstep(uFogNear, uFogFar * 2.6, dist) * 0.9);
  gl_FragColor = vec4(col, 0.5);
}
`

function floorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: U.uNoise,
      uCloudShadow: U.uCloudShadow,
      uCloudMid: U.uCloudMid,
      uCloudLit: U.uCloudLit,
      uFogNear: U.uFogNear,
      uFogFar: U.uFogFar,
      uTime: U.uTime,
      uSkyZenith: U.uSkyZenith,
      uSkyUpper: U.uSkyUpper,
      uSkyHorizon: U.uSkyHorizon,
      uSkyBelow: U.uSkyBelow,
      uSunDir: U.uSunDir,
      uSunColor: U.uSunColor,
      uSunSize: U.uSunSize,
      uSunGlow: U.uSunGlow,
    },
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    // Drawn right after the sky and without writing depth, so it never hides a puff: the far
    // puffs are flat camera-facing quads at their centre's depth, and a big one's lower
    // half would otherwise sink "behind" the layer in front of it and get cut off straight.
    depthWrite: false,
  })
}

export default function Clouds() {
  const tier = useStore((s) => s.tier)
  const { density } = QUALITY[tier]
  const sphereDepth = tier !== 'low'
  const floor = useMemo(() => ({ geo: new THREE.CircleGeometry(900, 64), mat: floorMaterial() }), [])
  useEffect(
    () => () => {
      floor.geo.dispose()
      floor.mat.dispose()
    },
    [floor],
  )

  // Puff layout depends only on density, so it's rebuilt only when the tier changes.
  const groups = useMemo(() => {
    const rand = mulberry32(99)
    const sea = seaOfClouds(density, rand)
    return [
      {
        geo: createPuffGeometry(sea.near),
        mat: createCloudMaterial({ sphereDepth, fogScale: 2.6, baseY: SEA_BASE, bumpScale: 0.05, bumpAmount: 0.6, bankWeight: 0.7, bankFlatten: 3 }),
      },
      {
        geo: createPuffGeometry(sea.far),
        mat: createCloudMaterial({ sphereDepth: false, fogScale: 2.6, baseY: SEA_BASE, bumpScale: 0.04, bumpAmount: 0.6, bankWeight: 0.75, bankFlatten: 3 }),
      },
      {
        geo: createPuffGeometry(horizonTowers(density, rand)),
        mat: createCloudMaterial({
          sphereDepth: false,
          fogScale: 3.4,
          drift: 2,
          baseY: TOWER_BASE,
          bumpScale: 0.022,
          bankWeight: 0.45,
          bankFlatten: 0.45,
        }),
      },
    ]
  }, [density, sphereDepth])

  useEffect(
    () => () => {
      for (const g of groups) {
        g.geo.dispose()
        g.mat.dispose()
      }
    },
    [groups],
  )

  return (
    <>
      <mesh
        geometry={floor.geo}
        material={floor.mat}
        rotation-x={-Math.PI / 2}
        position-y={SEA_BASE - 0.4}
        renderOrder={-50}
        frustumCulled={false}
      />
      {groups.map((g, i) => (
        <mesh key={i} geometry={g.geo} material={g.mat} frustumCulled={false} />
      ))}
    </>
  )
}
