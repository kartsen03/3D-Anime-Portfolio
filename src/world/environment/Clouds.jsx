import { useEffect, useMemo } from 'react'
import { useStore } from '../../state/store'
import { QUALITY } from '../render/quality'
import { createCloudMaterial, createPuffGeometry } from '../materials/cloudMaterial'
import { fbm3, mulberry32 } from './noise'

// The sea of clouds the island floats above, and towering cumulus on the horizon. Puffs are grouped into banks by a noise
// field, so there are gaps to look down through instead of a uniform carpet.

const SEA_LEVEL = -31 // cloud-sea puff centres sit around here (the island top is y = 0)
const SEA_BASE = -34 // …and are cut flat at this height
const TOWER_BASE = -27

function seaOfClouds(density, rand) {
  const puffs = []
  const banks = Math.round(560 * density)
  for (let b = 0; b < banks; b++) {
    // Uniform over the ring area, from just outside the island to the horizon.
    const r = Math.sqrt(rand()) * 440 + 16
    const a = rand() * Math.PI * 2
    const bx = Math.cos(a) * r
    const bz = Math.sin(a) * r
    // The noise field decides where banks may form, leaving open gaps between them.
    if (fbm3(bx * 0.006, 0, bz * 0.006, 3, 21) < 0.37) continue
    // Distant banks use somewhat bigger puffs (they'd vanish otherwise) but many more
    // of them, so they stay lumpy instead of turning into giant balloons.
    const scale = Math.min(0.75 + r * 0.012, 3)
    const count = Math.round((6 + rand() * 6) * (1 + r / 220))
    for (let i = 0; i < count; i++) {
      const radius = (2.2 + rand() * 2.4) * scale
      const spread = radius * 2.6
      puffs.push({
        center: [bx + (rand() - 0.5) * spread, SEA_LEVEL + rand() * radius * 0.6, bz + (rand() - 0.5) * spread],
        radius,
        seed: rand(),
      })
    }
  }
  return puffs
}

function horizonTowers(density, rand) {
  const puffs = []
  const towers = Math.max(4, Math.round(8 * density))
  for (let t = 0; t < towers; t++) {
    const a = (t / towers) * Math.PI * 2 + rand() * 0.5
    const r = 500 + rand() * 160
    const height = 40 + rand() * 55
    const levels = 9
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
        })
      }
    }
  }
  return puffs
}

export default function Clouds() {
  const tier = useStore((s) => s.tier)
  const { density } = QUALITY[tier]
  const sphereDepth = tier !== 'low'

  // Puff layout depends only on density, so it's rebuilt only when the tier changes.
  const groups = useMemo(() => {
    const rand = mulberry32(99)
    return [
      {
        geo: createPuffGeometry(seaOfClouds(density, rand)),
        mat: createCloudMaterial({ sphereDepth, fogScale: 2.6, baseY: SEA_BASE, bumpScale: 0.05 }),
      },
      {
        geo: createPuffGeometry(horizonTowers(density, rand)),
        mat: createCloudMaterial({ sphereDepth, fogScale: 3.4, drift: 2, baseY: TOWER_BASE, bumpScale: 0.022 }),
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

  return groups.map((g, i) => (
    <mesh key={i} geometry={g.geo} material={g.mat} frustumCulled={false} />
  ))
}
