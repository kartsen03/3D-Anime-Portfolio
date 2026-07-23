import { Suspense, useMemo } from 'react'
import { makeToonGradient } from './toonGradient'
import Character from './Character'

// The scene contents: lights + a ground plane + the VRM character.
// Kept separate from App.jsx so rooms and more objects can be dropped in here
// later without touching the <Canvas> shell.
export default function Scene({ characterRef }) {
  // Cel-shading ramp for the ENVIRONMENT (ground) only. The character's MToon
  // materials do their own cel shading, so they don't use this.
  const gradientMap = useMemo(() => makeToonGradient(4), [])

  return (
    <>
      {/* Soft ambient fill: lifts the shadow side so it isn't pure black.
          Kept fairly low so the toon bands stay distinct (too much fill
          flattens the cel steps into one tone). */}
      <ambientLight intensity={0.4} />
      {/* Directional key light: parallel rays from one direction. Its angle vs.
          the surface normal is what the toon shading quantizes into cel bands
          (both the ground's MeshToonMaterial and the character's MToon). */}
      <directionalLight position={[5, 8, 3]} intensity={1.4} />

      {/* Suspense catches the loader's "still loading" state, so the app renders
          the rest of the scene instead of erroring while the VRM downloads and
          parses. fallback is what shows meanwhile (nothing, for now). */}
      <Suspense fallback={null}>
        {/* rootRef is created in App so the follow camera (CameraRig) can read
            the character's position; we just forward it down. */}
        <Character rootRef={characterRef} />
      </Suspense>

      {/* Ground plane. planeGeometry faces +Z by default, so rotate it -90°
          about X to make it lie flat (horizontal). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshToonMaterial color="#bfe3cf" gradientMap={gradientMap} />
      </mesh>
    </>
  )
}
