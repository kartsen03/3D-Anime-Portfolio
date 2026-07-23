import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene from './Scene'

// App is just the WebGL "stage". <Canvas> creates the Three.js renderer, a
// default scene, and a camera, then runs the render loop. Every child element
// is JSX that R3F reconciles into real Three.js objects (e.g. <mesh> -> THREE.Mesh),
// so the React tree IS the Three.js scene graph.
export default function App() {
  return (
    <Canvas camera={{ position: [0, 1.2, 3], fov: 35 }}>
      {/* attach="background" assigns this color to scene.background — a
          soft warm off-white so the toon shapes read clearly. */}
      <color attach="background" args={['#fdf6ee']} />

      <Scene />

      {/* OrbitControls: drag to orbit, scroll to zoom, right-drag to pan.
          enableDamping adds smooth inertia. target is the point it orbits
          around — set to ~chest height so the camera frames the character
          rather than its feet. */}
      <OrbitControls enableDamping target={[0, 1, 0]} />
    </Canvas>
  )
}
