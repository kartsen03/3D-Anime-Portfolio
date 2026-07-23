# ARCHITECTURE.md

A living document. Grows as the project does.

## Overview

The app is a single-page React app. React renders one dominant component — an
R3F `<Canvas>` — that hosts a live Three.js/WebGL scene. From here on, "the UI"
is mostly 3D: React components describe Three.js objects declaratively, and R3F
keeps the real scene graph in sync with the React tree.

## Milestone 1 — foundation

A lit, cel-shaded scene you can orbit around:

- **The React tree is the Three.js scene graph.** `main.jsx` mounts `<App>`.
  `App.jsx` renders `<Canvas>`, which creates the WebGL renderer, a default
  camera (positioned via the `camera` prop), and an empty `THREE.Scene`. Every
  JSX element inside — `<mesh>`, `<ambientLight>`, `<meshToonMaterial>` — is
  reconciled by R3F into the matching Three.js object and attached to that
  scene. So nesting JSX = parenting Three.js objects.
- **Toon material + gradient map = cel shading.** `toonGradient.js` builds a
  tiny 4-step greyscale `DataTexture` with `NearestFilter`. `MeshToonMaterial`
  samples this ramp by light intensity; the nearest-filtering snaps each pixel
  to one of the 4 stops, producing hard flat colour bands instead of a smooth
  gradient. One ramp is memoized and shared by the object and the ground.
- **Lighting drives the bands.** A `directionalLight` (key) provides the
  angle-dependent intensity the toon ramp quantizes; a low-intensity
  `ambientLight` (fill) keeps shadow areas from going pure black without washing
  the bands out. No shadow maps yet.
- **Outline = inverted hull.** drei's `<Outlines>`, a child of the mesh, adds a
  back-facing duplicate of the geometry pushed outward along its normals in near
  black. Only the parts sticking out past the real mesh show, reading as an ink
  line. Its `thickness` is in **screen pixels** by default, giving a constant
  on-screen line width at any zoom.
- **Camera control.** drei's `<OrbitControls>` wraps Three's OrbitControls addon
  so you can drag to orbit, scroll to zoom, and right-drag to pan.
- **Animation.** The object spins via `useFrame` (R3F's per-frame loop),
  mutating the mesh's rotation through a ref rather than React state — so it
  never triggers a React re-render.

## File structure

```
portfolio/
├─ index.html          # HTML entry; mounts React into #root
├─ vite.config.js      # Vite + React plugin config
├─ package.json
├─ src/
│  ├─ main.jsx         # React entry: createRoot -> <App/>
│  ├─ App.jsx          # <Canvas> shell: renderer, camera, OrbitControls
│  ├─ Scene.jsx        # scene contents: lights, ground, placeholder object
│  ├─ toonGradient.js  # builds the cel-shading gradient ramp texture
│  └─ index.css        # full-height layout so the canvas fills the screen
└─ CLAUDE.md / ARCHITECTURE.md
```

## Scene graph (M1)

```
<Canvas>                       // WebGL renderer + camera + THREE.Scene
├─ <color attach="background"> // scene.background = warm off-white
├─ <Scene>
│  ├─ <ambientLight>           // soft fill
│  ├─ <directionalLight>       // key light (drives the cel bands)
│  ├─ <mesh> (SpinningShape)   // rotates via useFrame
│  │  ├─ <torusKnotGeometry>
│  │  ├─ <meshToonMaterial gradientMap>
│  │  └─ <Outlines>            // inverted-hull ink outline (child of the mesh)
│  └─ <mesh> (ground)
│     ├─ <planeGeometry> (rotated flat)
│     └─ <meshToonMaterial gradientMap>
└─ <OrbitControls>             // camera drag/zoom/pan
```

## Rendering & style pipeline

- **Cel shading:** `MeshToonMaterial` + 4-step `NearestFilter` gradient map.
- **Ink outline:** drei `<Outlines>` (inverted hull), pixel-space thickness.
- **Lighting:** directional key + low ambient fill; no shadow maps yet.
- **Planned:** bloom / post-processing (`@react-three/postprocessing`),
  per-room lighting, character.
