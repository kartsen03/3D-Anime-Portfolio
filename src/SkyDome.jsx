import * as THREE from 'three'
import { GradientTexture } from '@react-three/drei'

// The sun direction, shared with the scene's key light (Scene.jsx) so the lit
// side of everything agrees with where the sun conceptually sits.
export const SUN_POSITION = [5, 8, 3]

// A clean anime-style GRADIENT sky (deeper blue at the zenith → pale near the
// horizon), painted onto the inside of a big sphere.
//
// Why a gradient instead of drei's physically-based <Sky>: <Sky> renders very
// bright and, under our HDR + ACES tone-mapping + Bloom pipeline, blows out to
// white and bleeds bloom haze at the island's edges. A gradient stays below the
// Bloom threshold, reads as a crisp stylized sky, and is fully controllable.
//
// TO SWAP IN A REAL SKY: drop an equirectangular image at
// public/textures/sky.jpg and replace this component's body with:
//   import { Environment } from '@react-three/drei'
//   return <Environment files="/textures/sky.jpg" background />
export default function SkyDome() {
  return (
    // scale 200 keeps the dome well inside the camera's far plane while still
    // enclosing the whole scene + orbit distance.
    <mesh scale={200}>
      <sphereGeometry args={[1, 32, 16]} />
      {/* BackSide = we see the sphere from the inside. depthWrite off so it never
          occludes the world (it's the farthest geometry, so it always renders
          behind). meshBasicMaterial ignores lights → a constant painted sky. */}
      <meshBasicMaterial side={THREE.BackSide} depthWrite={false}>
        {/* GradientTexture attaches as the material's `map`. On a sphere the UV
            runs bottom(v=0) → top(v=1), so this goes horizon-pale → zenith-blue. */}
        <GradientTexture
          attach="map"
          stops={[0, 0.5, 1]}
          colors={['#eaf4ff', '#9fcdf2', '#4a89d6']}
        />
      </meshBasicMaterial>
    </mesh>
  )
}
