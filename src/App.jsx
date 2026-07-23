import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, KeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import Scene from './Scene'

const _delta = new THREE.Vector3()

// Third-person follow: each frame, shift BOTH the orbit target and the camera
// by how far the character moved since last frame. Translating them together
// keeps the character centered while preserving whatever orbit angle / zoom the
// user set (we never overwrite the camera's offset, only slide the whole rig).
function CameraRig({ characterRef }) {
  const prev = useRef(null)

  useFrame((state) => {
    const char = characterRef.current
    const controls = state.controls // OrbitControls, exposed via makeDefault
    if (!char || !controls) return

    // First valid frame: record the start position, nothing to follow yet.
    if (!prev.current) {
      prev.current = char.position.clone()
      return
    }

    _delta.subVectors(char.position, prev.current)
    controls.target.add(_delta)
    state.camera.position.add(_delta)
    prev.current.copy(char.position)
  })

  return null
}

// App is the WebGL "stage". <Canvas> creates the Three.js renderer, scene, and
// camera; every child is JSX that R3F reconciles into real Three.js objects.
export default function App() {
  // The character's root group lives in <Character>, but the follow camera also
  // needs it, so the ref is created here and shared with both.
  const characterRef = useRef()

  // KeyboardControls maps physical keys to named actions; useKeyboardControls
  // (in Character) reads this map. Memoized so the map identity is stable.
  const keyMap = useMemo(
    () => [
      { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
      { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
      { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
      { name: 'right', keys: ['ArrowRight', 'KeyD'] },
    ],
    [],
  )

  return (
    // KeyboardControls wraps the Canvas; R3F bridges its context so components
    // inside the Canvas can read key state.
    <KeyboardControls map={keyMap}>
      <Canvas camera={{ position: [0, 1.2, 3], fov: 35 }}>
        {/* attach="background" assigns this color to scene.background. */}
        <color attach="background" args={['#fdf6ee']} />

        <Scene characterRef={characterRef} />

        {/* OrbitControls kept for drag-orbit + zoom. makeDefault exposes it as
            state.controls so CameraRig can slide it. target starts at ~chest
            height; CameraRig then translates it with the character. */}
        <OrbitControls makeDefault enableDamping target={[0, 1, 0]} />
        <CameraRig characterRef={characterRef} />
      </Canvas>
    </KeyboardControls>
  )
}
