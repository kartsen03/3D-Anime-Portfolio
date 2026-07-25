import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WALKABLE_RADIUS } from './islandConfig'

// Deterministic PRNG so foliage placement is identical every reload.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GRASS_COUNT = 460
const FLOWER_COUNT = 70
const FLOWER_COLORS = ['#ff8ec2', '#ffd166', '#f5f5f5', '#c58cff', '#ff7b7b']

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const IDENT_Q = new THREE.Quaternion()

// Dense ground detail on the walkable top: instanced grass tufts + flower dots.
// Both are SHORT and decorative (non-colliding) — fine to sit on the walkable
// area. Tall items (trees) stay on the rim (see Props.jsx). Instanced so the
// hundreds of items are a couple of draw calls, not hundreds.
export default function Foliage({ gradientMap }) {
  const grassRef = useRef()
  const flowerRef = useRef()

  // Grass cone with its BASE at y=0 (pre-translated), so per-instance vertical
  // scaling keeps the tuft planted on the ground.
  const grassGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.06, 0.25, 4, 1)
    g.translate(0, 0.125, 0)
    return g
  }, [])

  // Seeded scatter (uniform over the disc via sqrt-radius).
  const { grass, flowers } = useMemo(() => {
    const rand = mulberry32(2024)
    const grass = []
    for (let i = 0; i < GRASS_COUNT; i++) {
      const r = Math.sqrt(rand()) * (WALKABLE_RADIUS + 1.5)
      const a = rand() * Math.PI * 2
      grass.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        rotY: rand() * Math.PI * 2,
        w: 0.6 + rand() * 0.6,
        h: 0.5 + rand() * 0.7, // short: reads as ground grass, not a cone forest
        tint: 0.8 + rand() * 0.4, // subtle green variation
      })
    }
    const flowers = []
    for (let i = 0; i < FLOWER_COUNT; i++) {
      const r = Math.sqrt(rand()) * (WALKABLE_RADIUS + 0.5)
      const a = rand() * Math.PI * 2
      flowers.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s: 0.7 + rand() * 0.6,
        color: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)],
      })
    }
    return { grass, flowers }
  }, [])

  // Write the instance matrices + per-instance colours once.
  useLayoutEffect(() => {
    const gm = grassRef.current
    grass.forEach((g, i) => {
      _p.set(g.x, 0, g.z)
      _q.setFromEuler(_e.set(0, g.rotY, 0))
      _s.set(g.w, g.h, g.w)
      gm.setMatrixAt(i, _m.compose(_p, _q, _s))
      gm.setColorAt(i, _c.set('#4faa54').multiplyScalar(g.tint))
    })
    gm.instanceMatrix.needsUpdate = true
    if (gm.instanceColor) gm.instanceColor.needsUpdate = true

    const fm = flowerRef.current
    flowers.forEach((f, i) => {
      _p.set(f.x, 0.16 * f.s, f.z)
      _s.setScalar(f.s)
      fm.setMatrixAt(i, _m.compose(_p, IDENT_Q, _s))
      fm.setColorAt(i, _c.set(f.color))
    })
    fm.instanceMatrix.needsUpdate = true
    if (fm.instanceColor) fm.instanceColor.needsUpdate = true
  }, [grass, flowers])

  return (
    <group>
      {/* Grass tufts. Material colour left white so per-instance colours show. */}
      <instancedMesh
        ref={grassRef}
        args={[grassGeo, undefined, GRASS_COUNT]}
        frustumCulled={false}
      >
        <meshToonMaterial gradientMap={gradientMap} flatShading />
      </instancedMesh>

      {/* Flower dots among the grass. */}
      <instancedMesh
        ref={flowerRef}
        args={[undefined, undefined, FLOWER_COUNT]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[0.09, 0]} />
        <meshToonMaterial gradientMap={gradientMap} flatShading />
      </instancedMesh>
    </group>
  )
}
