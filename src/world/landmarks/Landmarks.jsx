import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LANDMARKS } from '../layout'
import { useStore } from '../../state/store'
import { makeToonGradient } from '../legacy/toonGradient'

// Interim landmarks: the old torii gates, now positioned from layout.js and wired to the
// store (click → travel there). Phase 2 replaces each with its own landmark.

const ACCENTS = {
  about: '#7fe3ff',
  projects: '#ffd47f',
  experience: '#b69cff',
  resume: '#7dffc4',
  contact: '#ff9ec7',
}

const T = { pillarH: 3.5, pillarR: 0.12, halfSpan: 1.3, kasagiY: 3.6, nukiY: 2.6 }

function Torii({ landmark, gradientMap }) {
  const orbRef = useRef()
  const travelTo = useStore((s) => s.travelTo)
  const color = ACCENTS[landmark.id]

  useFrame((state) => {
    const t = state.clock.elapsedTime
    orbRef.current.rotation.y = t * 0.8
    orbRef.current.position.y = 1.5 + Math.sin(t * 1.6) * 0.12
  })

  const mat = useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap })
    m.flatShading = true // set as a property: the constructor doesn't accept it for toon
    return m
  }, [color, gradientMap])

  return (
    <group
      position={landmark.position}
      rotation={[0, landmark.yaw, 0]}
      onClick={(e) => {
        e.stopPropagation()
        travelTo(landmark.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      {[-T.halfSpan, T.halfSpan].map((x) => (
        <mesh key={x} position={[x, T.pillarH / 2, 0]} material={mat} castShadow>
          <cylinderGeometry args={[T.pillarR, T.pillarR * 1.3, T.pillarH, 12]} />
        </mesh>
      ))}
      <mesh position={[0, T.kasagiY, 0]} material={mat} castShadow>
        <boxGeometry args={[T.halfSpan * 2 + 1.0, 0.22, 0.34]} />
      </mesh>
      <mesh position={[0, T.kasagiY + 0.17, 0]} material={mat} castShadow>
        <boxGeometry args={[T.halfSpan * 2 + 1.3, 0.11, 0.28]} />
      </mesh>
      <mesh position={[0, T.nukiY, 0]} material={mat} castShadow>
        <boxGeometry args={[T.halfSpan * 2 + 0.25, 0.16, 0.26]} />
      </mesh>
      <mesh position={[0, (T.nukiY + T.kasagiY) / 2, 0]} material={mat}>
        <boxGeometry args={[0.13, T.kasagiY - T.nukiY, 0.2]} />
      </mesh>
      <mesh ref={orbRef} position={[0, 1.5, 0]}>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshToonMaterial color={color} emissive={color} emissiveIntensity={1.8} gradientMap={gradientMap} />
      </mesh>
    </group>
  )
}

export default function Landmarks() {
  const gradientMap = useMemo(() => makeToonGradient(4), [])
  return LANDMARKS.map((lm) => <Torii key={lm.id} landmark={lm} gradientMap={gradientMap} />)
}
