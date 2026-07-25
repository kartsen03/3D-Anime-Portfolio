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

// --- Torii-gate marker dimensions (metres) ---
// Tuned tall + slim for a more elegant silhouette.
const T = {
  pillarH: 3.5, // pillar height above ground
  pillarR: 0.12, // pillar radius (top; bottom slightly wider for a taper)
  halfSpan: 1.3, // half the distance between the two pillars
  kasagiY: 3.6, // height of the top beam
  nukiY: 2.6, // height of the second (lower) beam
}

function Marker({ region, gradientMap, showPrompt, canActivate, onActivate }) {
  const orbRef = useRef()

  // A little life: the focal orb slowly spins and bobs in the gate opening.
  useFrame((state) => {
    const o = orbRef.current
    if (!o) return
    const t = state.clock.elapsedTime
    o.rotation.y = t * 0.8
    o.position.y = 1.5 + Math.sin(t * 1.6) * 0.12
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

  // Torii painted in the region's accent colour (wayfinding); flatShading keeps
  // it crisply low-poly like the island. Same material for every gate part.
  const gateMat = (
    <meshToonMaterial color={region.markerColor} gradientMap={gradientMap} flatShading />
  )

  return (
    <group
      position={region.position}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      {/* Two pillars (slightly wider at the base for a subtle taper). */}
      {[-T.halfSpan, T.halfSpan].map((x) => (
        <mesh key={x} position={[x, T.pillarH / 2, 0]}>
          <cylinderGeometry args={[T.pillarR, T.pillarR * 1.3, T.pillarH, 12]} />
          {gateMat}
        </mesh>
      ))}

      {/* Kasagi — the top beam. Wider than the span and overhanging; a thin
          slab above it reads as the classic slight upward curve without needing
          curved geometry. */}
      <mesh position={[0, T.kasagiY, 0]}>
        <boxGeometry args={[T.halfSpan * 2 + 1.0, 0.22, 0.34]} />
        {gateMat}
      </mesh>
      <mesh position={[0, T.kasagiY + 0.17, 0]}>
        <boxGeometry args={[T.halfSpan * 2 + 1.3, 0.11, 0.28]} />
        {gateMat}
      </mesh>

      {/* Nuki — the lower cross beam between the pillars. */}
      <mesh position={[0, T.nukiY, 0]}>
        <boxGeometry args={[T.halfSpan * 2 + 0.25, 0.16, 0.26]} />
        {gateMat}
      </mesh>

      {/* Gakuzuka — the little centre post between nuki and kasagi. */}
      <mesh position={[0, (T.nukiY + T.kasagiY) / 2, 0]}>
        <boxGeometry args={[0.13, T.kasagiY - T.nukiY, 0.2]} />
        {gateMat}
      </mesh>

      {/* Floating focal orb in the gate opening. emissive × emissiveIntensity
          pushes its colour above luminance 1.0, so the existing Bloom pass
          catches it as a glow — the wayfinding cue that reads at a glance. */}
      <mesh ref={orbRef} position={[0, 1.5, 0]}>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshToonMaterial
          color={region.markerColor}
          emissive={region.markerColor}
          emissiveIntensity={1.8}
          gradientMap={gradientMap}
        />
      </mesh>

      {/* drei <Html> bridges a DOM element onto this 3D point — it's rendered in
          a portal over the canvas and repositioned each frame. `center` anchors
          it by its middle; no distanceFactor = constant on-screen size (reads
          like UI, not a world object). pointer-events are off (see CSS) so it
          never blocks a click on the marker. */}
      {showPrompt && (
        <Html position={[0, T.kasagiY + 0.7, 0]} center zIndexRange={[100, 0]}>
          <div className="region-prompt">
            <strong>{region.label}</strong> · press <kbd>E</kbd> or click
          </div>
        </Html>
      )}
    </group>
  )
}
