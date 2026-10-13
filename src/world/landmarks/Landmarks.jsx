import { useMemo } from 'react'
import * as THREE from 'three'
import { LANDMARKS } from '../layout'
import { useStore } from '../../state/store'
import { sectionById } from '../../content/sections'
import Torii from './Torii'
import StoneLantern from './StoneLantern'

// One landmark per section: a vermilion torii with the section's name plaque, flanked by
// a pair of stone lanterns. Clicking or tapping a landmark walks the character there and
// opens the section. (Phase 2b gives each section its own centrepiece behind the gate.)

// Invisible click target: a simple box is far cheaper to raycast than every beam and
// rope of the gate, and gives a generous, forgiving hit area on touch screens.
const hitGeometry = new THREE.BoxGeometry(3.6, 4.4, 1.6)
const hitMaterial = new THREE.MeshBasicMaterial({ visible: false })

function Landmark({ landmark }) {
  const travelTo = useStore((s) => s.travelTo)
  const openSection = useStore((s) => s.openSection)
  const section = useMemo(() => sectionById(landmark.id), [landmark.id])

  const onClick = (e) => {
    e.stopPropagation()
    const { nearSection } = useStore.getState()
    if (nearSection === landmark.id) openSection(landmark.id)
    else travelTo(landmark.id)
  }

  return (
    <group position={landmark.position} rotation={[0, landmark.yaw, 0]}>
      <Torii label={section.label} />
      <StoneLantern position={[-2.4, 0, 1.5]} />
      <StoneLantern position={[2.4, 0, 1.5]} />
      <mesh
        geometry={hitGeometry}
        material={hitMaterial}
        position={[0, 2.2, 0]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      />
    </group>
  )
}

export default function Landmarks() {
  return LANDMARKS.map((lm) => <Landmark key={lm.id} landmark={lm} />)
}
