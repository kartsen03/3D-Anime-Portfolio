import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import { makeToonGradient } from './toonGradient'

// The scene contents: lights + a ground plane + a rotating placeholder object.
// Kept separate from App.jsx so rooms/characters can be dropped in here later
// without touching the <Canvas> shell.
export default function Scene() {
  // Build the cel-shading ramp once and share it between materials.
  // useMemo prevents recreating the GPU texture on every React render.
  const gradientMap = useMemo(() => makeToonGradient(4), [])

  return (
    <>
      {/* Soft ambient fill: lifts the shadow side so it isn't pure black.
          Kept fairly low so the toon bands stay distinct (too much fill
          flattens the cel steps into one tone). */}
      <ambientLight intensity={0.4} />
      {/* Directional key light: parallel rays from one direction. Its angle vs.
          the surface normal is what MeshToonMaterial quantizes into cel bands. */}
      <directionalLight position={[5, 8, 3]} intensity={1.4} />

      <SpinningShape gradientMap={gradientMap} />

      {/* Ground plane. planeGeometry faces +Z by default, so rotate it -90°
          about X to make it lie flat (horizontal). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshToonMaterial color="#bfe3cf" gradientMap={gradientMap} />
      </mesh>
    </>
  )
}

function SpinningShape({ gradientMap }) {
  // A ref gives us the underlying Three.js mesh so we can mutate its transform
  // directly in the render loop (see useFrame below).
  const meshRef = useRef()

  // useFrame runs once per rendered frame — R3F's animation loop. We rotate by
  // mutating the mesh directly (not React state) so we don't trigger a React
  // re-render 60×/second. `delta` is seconds since the last frame, which makes
  // the speed frame-rate independent.
  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.5
    meshRef.current.rotation.x += delta * 0.2
  })

  return (
    <mesh ref={meshRef} position={[0, 1.4, 0]}>
      {/* A torus knot shows the cel banding clearly across its curvature. */}
      <torusKnotGeometry args={[0.7, 0.26, 160, 32]} />
      <meshToonMaterial color="#ff8ab3" gradientMap={gradientMap} />

      {/* drei <Outlines> renders a back-facing copy of this mesh, pushed out
          along its normals in a solid colour — the classic "inverted hull" ink
          outline that gives the anime look. It's a child of the mesh so it
          inherits its geometry. In the default mode `thickness` is measured in
          SCREEN PIXELS (constant on-screen width at any zoom), so this is ~5px,
          not world units. */}
      <Outlines thickness={5} color="#221019" />
    </mesh>
  )
}
