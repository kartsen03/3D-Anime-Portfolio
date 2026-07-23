import { Suspense, useMemo } from 'react'
import { makeToonGradient } from './toonGradient'
import Character from './Character'
import Island from './Island'
import Props from './Props'
import SkyDome, { SUN_POSITION } from './SkyDome'

// The scene contents: sky + outdoor lighting + the floating island world + the
// VRM character. Kept separate from App.jsx (which owns the <Canvas> shell and
// post-processing).
export default function Scene({ characterRef }) {
  // Cel-shading ramp shared by the ENVIRONMENT (island + props). The character
  // uses its own shading, so it doesn't use this.
  const gradientMap = useMemo(() => makeToonGradient(4), [])

  return (
    <>
      {/* Procedural sky (swap to an equirect image later — see SkyDome.jsx). */}
      <SkyDome />

      {/* Outdoor lighting. The directional KEY comes from the sun's direction and
          is strong so the toon bands read clearly; a modest ambient lifts the
          shadow side without flattening the cel steps. */}
      <ambientLight intensity={0.5} />
      <directionalLight position={SUN_POSITION} intensity={1.8} />

      {/* Suspense catches the loaders' "still loading" state while the VRM + FBX
          download, so the rest of the scene renders immediately. */}
      <Suspense fallback={null}>
        <Character rootRef={characterRef} />
      </Suspense>

      {/* The world: a cel-shaded floating island with a flat walkable top, plus a
          few decorative props on its rim. Both share the environment gradient
          map for consistent banding. */}
      <Island gradientMap={gradientMap} />
      <Props gradientMap={gradientMap} />
    </>
  )
}
