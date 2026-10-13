import { useMemo } from 'react'
import * as THREE from 'three'
import { ISLAND_TOP_RADIUS } from './islandConfig'

// The floating island, built in CODE so we fully control the cel material
// (rather than importing a model with baked/standard materials). The grassy TOP
// face sits at y = 0 — the flat walkable plane — and everything below is a
// decorative rocky spire. Cel-shaded with the shared toon gradient map.
export default function Island({ gradientMap }) {
  // One material per surface, memoized (they never change). Reusing instances is
  // cheaper than letting each <mesh> make its own via JSX.
  const grassMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: '#77c257', gradientMap }),
    [gradientMap],
  )
  // flatShading gives the rock crisp low-poly facets (the stylized look).
  const rockMat = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: '#7c6b57',
        gradientMap,
        flatShading: true,
      }),
    [gradientMap],
  )

  return (
    <group>
      {/* Grassy top: a wide, shallow cylinder. Its height is 2.5 and it's centred
          at y = -1.25, so the TOP face lands exactly at y = 0 (the walkable
          plane). radiusTop (full) > radiusBottom gives a slight grassy overhang
          over the rock below. */}
      <mesh material={grassMat} position={[0, -1.25, 0]}>
        <cylinderGeometry args={[ISLAND_TOP_RADIUS, ISLAND_TOP_RADIUS - 2, 2.5, 24]} />
      </mesh>

      {/* Rocky spire: a cone rotated π about X so its apex points DOWN. The base
          (widest part) tucks just under the grass and it tapers to a point far
          below, for the classic floating-island silhouette. */}
      <mesh material={rockMat} position={[0, -11.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[ISLAND_TOP_RADIUS - 2.5, 18, 16]} />
      </mesh>
    </group>
  )
}
