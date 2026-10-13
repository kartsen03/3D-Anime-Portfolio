import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ISLAND } from '../layout'
import { beginMoveTo } from '../character/locomotion'
import { isInsideWalkable } from './collision'
import { runtime } from './runtime'
import { useStore } from '../../state/store'

// Tap / click-to-move.
//
// An invisible disc over the walkable ground catches pointer presses. A press counts as
// a TAP only if the pointer barely moved and was released quickly; anything else was a
// camera drag (camera-controls handles those), so dragging to look around never also
// sends the character walking.
//
// This is what makes the site usable on phones: the old version had no touch movement,
// and gates only opened when you stood next to them, so on mobile no section could open.

const TAP_MAX_MOVE = 8 // px
const TAP_MAX_MS = 350

export default function GroundInput() {
  const press = useRef(null)
  const marker = useRef()
  const markerLife = useRef(0)

  const onPointerDown = (e) => {
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }
  }

  const onPointerUp = (e) => {
    const p = press.current
    press.current = null
    if (!p || p.id !== e.pointerId) return
    const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y)
    if (moved > TAP_MAX_MOVE || performance.now() - p.t > TAP_MAX_MS) return
    if (e.button !== undefined && e.button !== 0) return
    const store = useStore.getState()
    if (store.phase !== 'explore' || store.activeSection) return
    if (!isInsideWalkable(e.point.x, e.point.z)) return
    e.stopPropagation()
    store.setInputMode(e.pointerType === 'touch' ? 'touch' : 'pointer')
    beginMoveTo(e.point)
    // Show a brief ripple where the character is headed.
    marker.current.position.set(e.point.x, 0.03, e.point.z)
    markerLife.current = 1
  }

  useFrame((_, dt) => {
    const m = marker.current
    if (!m) return
    // Fade the ripple out, or as soon as the destination is cleared.
    if (runtime.moveTarget === null) markerLife.current = Math.min(markerLife.current, 0.3)
    markerLife.current = Math.max(markerLife.current - dt * 1.4, 0)
    const life = markerLife.current
    m.visible = life > 0
    if (life > 0) {
      const s = 0.35 + (1 - life) * 0.55
      m.scale.set(s, s, s)
      m.material.opacity = life * 0.85
    }
  })

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <circleGeometry args={[ISLAND.walkRadius + 0.5, 48]} />
        {/* visible={false} on the material: not drawn, but still hit by raycasts. */}
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh ref={marker} rotation-x={-Math.PI / 2} visible={false} renderOrder={2}>
        <ringGeometry args={[0.7, 0.86, 48]} />
        <meshBasicMaterial color="#fff6e6" transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}
