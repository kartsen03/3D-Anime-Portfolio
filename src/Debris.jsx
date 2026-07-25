import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { ISLAND_TOP_RADIUS } from './islandConfig'

// Deterministic PRNG so the debris layout is identical every reload.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Reused scratch objects (no per-frame allocation).
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()

// Small cel-shaded rock chunks slowly drifting/bobbing AROUND and BELOW the
// island for "sky island" flavour. One InstancedMesh (cheap) animated per frame.
// Kept outside the walkable radius and mostly below the top, so they never clip
// the character or the follow camera.
export default function Debris({ gradientMap }) {
  const { count, speed } = useControls('Debris', {
    count: { value: 40, min: 0, max: 160, step: 5 },
    speed: { value: 0.5, min: 0, max: 3, step: 0.05 },
  })

  const meshRef = useRef()
  const timeRef = useRef(0) // accumulated (speed-scaled) time, so speed changes don't jump

  // Per-instance base data — rebuilt only when count changes.
  const chunks = useMemo(() => {
    const rand = mulberry32(1337)
    const arr = []
    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2
      const rad = ISLAND_TOP_RADIUS + 4 + rand() * 16 // ~20–36 m from centre
      arr.push({
        x: Math.cos(ang) * rad,
        z: Math.sin(ang) * rad,
        yBase: -7 + rand() * 8, // mostly below / around the island
        scale: 0.25 + rand() * 0.7,
        phase: rand() * Math.PI * 2,
        bob: 0.3 + rand() * 0.7,
        axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        spin: rand() * Math.PI * 2,
        spinRate: (rand() - 0.5) * 0.8,
      })
    }
    return arr
  }, [count])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    timeRef.current += delta * speed
    const t = timeRef.current
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      _p.set(c.x, c.yBase + Math.sin(t + c.phase) * c.bob, c.z)
      _q.setFromAxisAngle(c.axis, c.spin + t * c.spinRate)
      _s.setScalar(c.scale)
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (count === 0) return null
  return (
    // key={count} forces a fresh InstancedMesh (its instance buffer is sized at
    // construction) whenever the Leva count changes.
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshToonMaterial color="#7c6f5d" gradientMap={gradientMap} flatShading />
    </instancedMesh>
  )
}
