import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, KeyboardControls } from '@react-three/drei'
import { Leva } from 'leva'
import * as THREE from 'three'
import Scene from './Scene'
import PostFX from './PostFX'
import Regions from './Regions'
import RegionPanel from './RegionPanel'
import { REGIONS } from './regionsConfig'

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

  // Region interaction state (App owns it because it's shared across the
  // Canvas/DOM boundary — the 3D markers read it, and the DOM panel renders it):
  //  - nearId:   region the character is currently within range of (or null)
  //  - activeId: region whose panel is open (or null)
  const [nearId, setNearId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const activeRegion = REGIONS.find((r) => r.id === activeId) ?? null
  // While a panel is open we pause movement input so the character doesn't
  // wander off while you read (idle animation keeps playing — see Character).
  const paused = activeId !== null

  // Refs mirror the latest state so the keydown handler can read current values
  // without being re-subscribed on every change.
  const nearIdRef = useRef(null)
  const activeIdRef = useRef(null)
  nearIdRef.current = nearId
  activeIdRef.current = activeId

  // Global keyboard: E toggles the nearby region's panel (open if closed, close
  // if open), Escape closes. We use a window listener rather than KeyboardControls
  // because these are one-shot edge actions (and KeyboardControls doesn't cover
  // Escape).
  useEffect(() => {
    const onKey = (e) => {
      // Ignore keys typed into form fields (e.g. Leva's number inputs).
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return
      }
      if (e.code === 'Escape' && activeIdRef.current) {
        setActiveId(null)
      } else if (e.code === 'KeyE') {
        // E toggles: close the open panel, or open the nearby region's.
        if (activeIdRef.current) setActiveId(null)
        else if (nearIdRef.current) setActiveId(nearIdRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // KeyboardControls maps physical keys to named actions; useKeyboardControls
  // (in Character) reads this map. Memoized so the map identity is stable.
  const keyMap = useMemo(
    () => [
      { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
      { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
      { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
      { name: 'right', keys: ['ArrowRight', 'KeyD'] },
      { name: 'sprint', keys: ['ShiftLeft', 'ShiftRight'] },
    ],
    [],
  )

  // Leva is a DEV tuning panel — hide it in the production build so visitors
  // don't see it. Escape hatches: ?debug shows it on the live site (for tuning),
  // ?clean always hides it (used for clean screenshots).
  const params = new URLSearchParams(window.location.search)
  const hideLeva = params.has('clean') || (import.meta.env.PROD && !params.has('debug'))

  return (
    <>
      {/* Leva's control panel is a DOM overlay, so it lives OUTSIDE the Canvas.
          useControls() calls (in PostFX and Character) feed this one panel via
          Leva's global store — no context wiring needed across the Canvas. */}
      <Leva collapsed={false} hidden={hideLeva} />

      {/* KeyboardControls wraps the Canvas; R3F bridges its context so components
          inside the Canvas can read key state. */}
      <KeyboardControls map={keyMap}>
        <Canvas
          camera={{ position: [0, 1.2, 3], fov: 35 }}
          // Disable the renderer's built-in tone mapping: the <ToneMapping>
          // effect at the end of the composer now owns it. If BOTH ran, the
          // renderer would squeeze HDR into [0,1] before the composer, so Bloom
          // would have nothing bright to pick up and colours would shift.
          // outputColorSpace stays SRGB (R3F default) — the composer encodes to
          // sRGB on output.
          gl={{ toneMapping: THREE.NoToneMapping }}
        >
          {/* No <color> background: the procedural <Sky> (in Scene) fills the
              view in every direction, so it owns the backdrop now. */}
          <Scene characterRef={characterRef} paused={paused} />

          {/* Interactive region markers + proximity prompts. App owns the state;
              Regions detects proximity and reports it back via the callbacks. */}
          <Regions
            characterRef={characterRef}
            nearId={nearId}
            activeId={activeId}
            onNearChange={setNearId}
            onActivate={setActiveId}
          />

          {/* OrbitControls kept for drag-orbit + zoom. makeDefault exposes it as
              state.controls so CameraRig can slide it. target starts at ~chest
              height; CameraRig then translates it with the character. */}
          <OrbitControls makeDefault enableDamping target={[0, 1, 0]} />
          <CameraRig characterRef={characterRef} />

          <PostFX />
        </Canvas>
      </KeyboardControls>

      {/* Section panel — a DOM overlay outside the Canvas. Renders when a region
          is active; Escape is handled above, ✕/backdrop clicks call onClose. */}
      <RegionPanel region={activeRegion} onClose={() => setActiveId(null)} />
    </>
  )
}
