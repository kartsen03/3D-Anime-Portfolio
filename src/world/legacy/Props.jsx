import { Instances, Instance } from '@react-three/drei'
import { TOP_Y, WALKABLE_RADIUS, ISLAND_TOP_RADIUS } from './islandConfig'

// A few decorative low-poly props for life. They live on the island's RIM — the
// ring between WALKABLE_RADIUS and the visual edge — so they're inherently off
// the path the character can reach (no collision needed this milestone).
// Placement is FIXED (not random) so the layout is stable across reloads.

const RIM = (WALKABLE_RADIUS + ISLAND_TOP_RADIUS) / 2 // ~14.5

// A point on the rim: angle in degrees, radius in world units.
function rimPos(angleDeg, r = RIM) {
  const a = (angleDeg * Math.PI) / 180
  return [Math.cos(a) * r, TOP_Y, Math.sin(a) * r]
}

const TREES = [
  { pos: rimPos(35), scale: 1.1 },
  { pos: rimPos(150, RIM + 0.5), scale: 0.9 },
  { pos: rimPos(250), scale: 1.25 },
  { pos: rimPos(325, RIM - 0.5), scale: 1.0 },
]

// Round-canopy trees for silhouette variety alongside the pines.
const ROUND_TREES = [
  { pos: rimPos(70, RIM + 0.5), scale: 1.15 },
  { pos: rimPos(190, RIM - 0.5), scale: 0.95 },
  { pos: rimPos(290), scale: 1.05 },
]

const ROCKS = [
  { pos: rimPos(80), scale: 0.8, rot: 0.5 },
  { pos: rimPos(110, RIM + 1), scale: 0.5, rot: 1.2 },
  { pos: rimPos(200), scale: 0.95, rot: 2.0 },
  { pos: rimPos(300, RIM + 0.8), scale: 0.6, rot: 0.9 },
  { pos: rimPos(10, RIM - 1), scale: 0.55, rot: 2.7 },
]

// A stylized pine: a trunk plus two stacked cones. `position` places its base on
// the surface (trunk raised by half its height so it stands on y = 0).
function Tree({ pos, scale, gradientMap }) {
  return (
    <group position={pos} scale={scale}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 1.2, 6]} />
        <meshToonMaterial color="#6b4a2f" gradientMap={gradientMap} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.9, 1.6, 8]} />
        <meshToonMaterial color="#3f8f4f" gradientMap={gradientMap} flatShading />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <coneGeometry args={[0.65, 1.2, 8]} />
        <meshToonMaterial color="#489a58" gradientMap={gradientMap} flatShading />
      </mesh>
    </group>
  )
}

// A rounded deciduous tree: trunk + a couple of overlapping icosphere blobs for
// a fuller, softer canopy than the conical pines.
function RoundTree({ pos, scale, gradientMap }) {
  return (
    <group position={pos} scale={scale}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 1.4, 6]} />
        <meshToonMaterial color="#6b4a2f" gradientMap={gradientMap} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshToonMaterial color="#4f9e57" gradientMap={gradientMap} flatShading />
      </mesh>
      <mesh position={[0.55, 1.6, 0.15]}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshToonMaterial color="#58a862" gradientMap={gradientMap} flatShading />
      </mesh>
    </group>
  )
}

export default function Props({ gradientMap }) {
  return (
    <group>
      {TREES.map((t, i) => (
        <Tree key={i} pos={t.pos} scale={t.scale} gradientMap={gradientMap} />
      ))}
      {ROUND_TREES.map((t, i) => (
        <RoundTree key={i} pos={t.pos} scale={t.scale} gradientMap={gradientMap} />
      ))}

      {/* Rocks via instancing: ONE geometry + material drawn many times with
          different transforms — cheaper than a separate mesh per rock. The
          geometry and material are declared once as children of <Instances>. */}
      <Instances limit={ROCKS.length}>
        <icosahedronGeometry args={[1, 0]} />
        <meshToonMaterial color="#8a7a66" gradientMap={gradientMap} flatShading />
        {ROCKS.map((r, i) => (
          <Instance
            key={i}
            position={[r.pos[0], 0.3, r.pos[2]]}
            scale={r.scale}
            rotation={[r.rot, r.rot * 1.3, 0]}
          />
        ))}
      </Instances>
    </group>
  )
}
