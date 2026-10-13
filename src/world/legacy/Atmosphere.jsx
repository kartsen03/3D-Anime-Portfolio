import { Sparkles } from '@react-three/drei'

// Atmospheric layer: subtle depth fog + drifting light motes. Rendered at the
// SCENE ROOT (from Scene.jsx) — important, because <fog attach="fog"> attaches
// to its parent Object3D, and we want that to be the root scene, not a group.
export default function Atmosphere() {
  const fog = { color: '#bcd8f0', near: 24, far: 72 }

  const sparkles = { count: 90, scale: 34, size: 3, speed: 0.3, color: '#ffffff' }

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
