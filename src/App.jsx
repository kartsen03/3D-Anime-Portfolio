import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, KeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import Scene from './Scene'

const TARGET_HEIGHT = 1 // orbit around ~chest height above the character
const _desired = new THREE.Vector3()
const _delta = new THREE.Vector3()

// Third-person follow. Each frame we set the orbit target to a point at chest
// height above the character, and slide the CAMERA by the same delta. Moving
// target and camera together keeps the character centered while preserving the
// user's orbit angle / zoom (the camera's offset from the target is untouched).
// We compute from the absolute desired target every frame (rather than
// accumulating deltas), so it's self-correcting — no drift, and it can't be
// thrown off if the character ref remounts.
function CameraRig({ characterRef }) {
  useFrame((state) => {
    const char = characterRef.current
    const controls = state.controls // OrbitControls, exposed via makeDefault
    if (!char || !controls) return

    _desired.set(char.position.x, char.position.y + TARGET_HEIGHT, char.position.z)
    _delta.subVectors(_desired, controls.target)
    controls.target.add(_delta)
    state.camera.position.add(_delta)

    // drei's OrbitControls runs its own update() at priority -1, i.e. BEFORE
    // this rig, so it already did camera.lookAt() using the STALE (pre-shift)
    // target this frame. Re-run update() now that the target is correct, so the
    // camera actually looks at the character this frame instead of lagging one.
    controls.update()
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
