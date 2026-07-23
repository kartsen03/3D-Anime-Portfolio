import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { makeToonGradient } from './toonGradient'
import { REGIONS } from './regionsConfig'

// Renders every region's 3D marker + proximity prompt, and runs the
// proximity-detection loop. Lives inside the Canvas. Region STATE (which region
// is near / open) is owned by App and passed in; this component only detects
// and reports it.
export default function Regions({
  characterRef,
  nearId,
  activeId,
  onNearChange,
  onActivate,
}) {
  // Own cel-shading ramp so this interaction layer stays decoupled from Scene
  // (the texture is tiny; an identical 4-step ramp looks the same as the world's).
  const gradientMap = useMemo(() => makeToonGradient(4), [])
  const lastNear = useRef(null)

  // Proximity detection: each frame, find the nearest region within its
  // activation radius. We only push to React state when the result CHANGES —
  // calling setState 60×/second would thrash React for no reason.
  useFrame(() => {
    const char = characterRef.current
    if (!char) return

    let near = null
    let bestSq = Infinity
    for (const r of REGIONS) {
      const dx = char.position.x - r.position[0]
      const dz = char.position.z - r.position[2]
      const dSq = dx * dx + dz * dz // compare squared distances — no sqrt needed
      if (dSq <= r.activationRadius * r.activationRadius && dSq < bestSq) {
        bestSq = dSq
        near = r.id
      }
    }

    if (near !== lastNear.current) {
      lastNear.current = near
      onNearChange(near)
    }
  })

  return (
    <>
      {REGIONS.map((r) => (
        <Marker
          key={r.id}
          region={r}
          gradientMap={gradientMap}
          // Prompt shows only while near AND no panel is open.
          showPrompt={nearId === r.id && activeId === null}
          canActivate={nearId === r.id}
          onActivate={onActivate}
        />
      ))}
    </>
  )
}

function Marker({ region, gradientMap, showPrompt, canActivate, onActivate }) {
  const crystalRef = useRef()

  // A little life: the crystal slowly spins and bobs.
  useFrame((state) => {
    const c = crystalRef.current
    if (!c) return
    const t = state.clock.elapsedTime
    c.rotation.y = t * 0.8
    c.position.y = 1.5 + Math.sin(t * 1.6) * 0.12
  })

  // R3F pointer events bubble from child meshes up to this group. Clicking only
  // opens when the character is actually near (same gate as the E key).
  const handleClick = (e) => {
    e.stopPropagation()
    if (canActivate) onActivate(region.id)
  }
  const handleOver = (e) => {
    e.stopPropagation()
    if (canActivate) document.body.style.cursor = 'pointer'
  }
  const handleOut = () => {
    document.body.style.cursor = 'auto'
  }

  return (
    <group
      position={region.position}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      {/* Stone pedestal (6-sided for a low-poly look). */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.5, 6]} />
        <meshToonMaterial color="#8a8480" gradientMap={gradientMap} />
      </mesh>

      {/* Floating crystal. emissive × emissiveIntensity pushes its colour above
          luminance 1.0, so the existing Bloom pass catches it as a glow — which
          is what makes the interactable read at a glance. */}
      <mesh ref={crystalRef} position={[0, 1.5, 0]}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshToonMaterial
          color={region.color}
          emissive={region.color}
          emissiveIntensity={1.6}
          gradientMap={gradientMap}
        />
      </mesh>

      {/* drei <Html> bridges a DOM element onto this 3D point — it's rendered in
          a portal over the canvas and repositioned each frame. `center` anchors
          it by its middle; no distanceFactor = constant on-screen size (reads
          like UI, not a world object). pointer-events are off (see CSS) so it
          never blocks a click on the marker. */}
      {showPrompt && (
        <Html position={[0, 2.5, 0]} center zIndexRange={[100, 0]}>
          <div className="region-prompt">
            <strong>{region.label}</strong> · press <kbd>E</kbd> or click
          </div>
        </Html>
      )}
    </group>
  )
}
