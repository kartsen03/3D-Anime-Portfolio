import { lazy, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useStore } from '../state/store'
import { THEMES } from './themes'
import { ASSETS } from './assets'
import { expectAssets } from './systems/progress'
import { useWorldInput } from './systems/useWorldInput'
import { placeAt } from './character/locomotion'
import Pipeline from './render/Pipeline'
import QualityManager from './render/QualityManager'
import CameraRig from './camera/CameraRig'
import Character from './character/Character'
import WorldLighting from './WorldLighting'
import Landmarks from './landmarks/Landmarks'
import GroundInput from './systems/GroundInput'
import PromptAnchor from './systems/PromptAnchor'
import WarmUp from './systems/WarmUp'
import Sky from './environment/Sky'
import Island from './environment/Island'
import Clouds from './environment/Clouds'
import Grass from './environment/Grass'

// Look-dev helpers exist only on the dev server with ?lookdev (stripped from production).
const LookDev =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('lookdev')
    ? lazy(() => import('./dev/LookDev'))
    : null

expectAssets(Object.values(ASSETS).map((a) => a.bytes))

// Everything that runs inside the WebGL canvas.
function WorldContents() {
  useWorldInput()

  // Deep link (/#projects): once the world is live, appear at that landmark, sheet open.
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.phase,
        (phase) => {
          const pending = useStore.getState().pendingSection
          if (phase === 'explore' && pending) placeAt(pending)
        },
      ),
    [],
  )

  return (
    <>
      <QualityManager />
      <WorldLighting />
      <Sky />
      <Island />
      <Clouds />
      <Grass />
      <Landmarks />
      <GroundInput />
      <Suspense fallback={null}>
        <Character />
        <WarmUp />
      </Suspense>
      <CameraRig />
      <PromptAnchor />
      <Pipeline />
      {LookDev && (
        <Suspense fallback={null}>
          <LookDev />
        </Suspense>
      )}
    </>
  )
}

// The 3D world, loaded as its own chunk (three.js and friends are most of the site's
// JavaScript). The interface renders first; this streams in behind the splash.
export default function World() {
  const mode = useStore((s) => s.mode)
  const theme = useStore((s) => s.theme)

  return (
    <div className="world" aria-hidden="true">
      <Canvas
        // The composer does anti-aliasing and owns the final image, so the canvas itself
        // needs no MSAA and no alpha channel (an opaque canvas is cheaper to composite).
        gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
        flat // tone mapping happens in the post chain, not in each material
        dpr={1}
        camera={{ fov: 40, near: 0.1, far: 1200, position: [0, 3, 10] }}
        // The text-only Quick view pauses the world entirely (no GPU, no battery drain).
        frameloop={mode === 'world' ? 'always' : 'never'}
        onCreated={({ gl }) => gl.setClearColor(THEMES[theme].background)}
      >
        <WorldContents />
      </Canvas>
    </div>
  )
}
