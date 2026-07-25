import { Sparkles } from '@react-three/drei'
import { useControls } from 'leva'

// Atmospheric layer: subtle depth fog + drifting light motes. Rendered at the
// SCENE ROOT (from Scene.jsx) — important, because <fog attach="fog"> attaches
// to its parent Object3D, and we want that to be the root scene, not a group.
export default function Atmosphere() {
  const fog = useControls('Fog', {
    color: '#bcd8f0', // matched to the sky's horizon so distance melts into it
    near: { value: 24, min: 0, max: 100, step: 1 }, // fully clear nearer than this
    far: { value: 72, min: 10, max: 220, step: 1 }, // fully fogged past this
  })

  const sparkles = useControls('Sparkles', {
    count: { value: 90, min: 0, max: 400, step: 10 },
    scale: { value: 34, min: 5, max: 90, step: 1 }, // size of the distribution box
    size: { value: 3, min: 0.5, max: 12, step: 0.5 }, // pixel size of each mote
    speed: { value: 0.3, min: 0, max: 3, step: 0.05 },
    color: '#ffffff',
  })

  return (
    <>
      {/* Linear scene fog: distant props / island edges fade toward the horizon
          colour, a gentle depth cue (we're in open sky, so keep it subtle). The
          sky dome opts out via fog={false} so it stays clean. */}
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />

      {/* Ghibli-style floating motes, centred above the island. */}
      <Sparkles
        count={sparkles.count}
        scale={sparkles.scale}
        size={sparkles.size}
        speed={sparkles.speed}
        color={sparkles.color}
        position={[0, 6, 0]}
      />
    </>
  )
}
