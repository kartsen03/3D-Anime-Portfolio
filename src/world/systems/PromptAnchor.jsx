import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { landmarkById } from '../layout'
import { useStore } from '../../state/store'
import { FRAME } from './runtime'

// Pins the HUD's "interact" prompt (an HTML element owned by the interface) above the
// landmark the character is standing at.
//
// Projecting one point and writing a CSS transform is far cheaper than drei's <Html>,
// which re-renders a React portal; the prompt itself stays ordinary, accessible DOM.

const PROMPT_HEIGHT = 4.6 // metres above the landmark's base
const _p = new THREE.Vector3()

export default function PromptAnchor() {
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useFrame(({ camera }) => {
    const el = document.getElementById('world-prompt')
    if (!el) return
    const { nearSection, activeSection, phase } = useStore.getState()
    const lm = nearSection && !activeSection && phase === 'explore' ? landmarkById(nearSection) : null
    if (!lm) return
    _p.set(lm.position[0], PROMPT_HEIGHT, lm.position[2]).project(camera)
    // Behind the camera, the projection mirrors; keep the prompt off-screen instead.
    const behind = _p.z > 1
    const x = (_p.x * 0.5 + 0.5) * width
    const y = (-_p.y * 0.5 + 0.5) * height
    el.style.transform = behind ? 'translate3d(-9999px, 0, 0)' : `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
  }, FRAME.world)

  return null
}
