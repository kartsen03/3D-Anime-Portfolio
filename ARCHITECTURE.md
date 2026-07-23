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

## Milestone 2 — VRM character

Loads the anime avatar (`public/models/avatar.vrm`) into the scene, standing on
the ground and facing the camera. No animation or movement yet.

- **VRM = glTF + extensions, read via a loader plugin.** A `.vrm` is a glTF
  binary with extra extensions (humanoid rig, MToon materials, spring bones,
  expressions). `Character.jsx` loads it with `useLoader(GLTFLoader, url, …)`
  and, in that setup callback, calls `loader.register(p => new
  VRMLoaderPlugin(p))`. The plugin hooks into GLTFLoader's parse step and, when
  done, attaches the fully built avatar to **`gltf.userData.vrm`** (a `VRM`
  object exposing `.scene`, `.humanoid`, `.expressionManager`, `.springBoneManager`).
- **MToon is the character's built-in cel shading.** The avatar's materials are
  MToon (the VRM toon material), which does its own flat cel banding — and, if
  the model author enabled it, its own outline. So the character does **not**
  use the environment's gradient map and gets **no** drei `<Outlines>`; those
  are for the ground/props only. (We use the standard WebGL MToon, not the
  WebGPU node-material path.)
- **Facing & orientation.** VRM 0.x avatars face +Z, VRM 1.0 face -Z.
  `VRMUtils.rotateVRM0(vrm)` normalizes 0.x models to the -Z baseline. (Once the
  M3 idle animation drives the hips, it reorients the avatar toward the +Z
  camera on its own — see M3 "Facing".)
- **Per-frame update is required.** `vrm.update(delta)` must run every frame
  (via `useFrame`) or spring bones and expressions never advance/initialize.
- **Async loading.** `useLoader` suspends the component while the ~8 MB file
  downloads/parses, so `<Character>` sits inside a `<Suspense>` boundary; the
  rest of the scene renders immediately and the fallback shows until it's ready.
- **One-shot, idempotent prep.** The `VRMUtils` calls
  (`removeUnnecessaryVertices`, `combineSkeletons` — the v3 successor to
  `removeUnnecessaryJoints`) and `rotateVRM0` **mutate the model in place and
  are not idempotent** (rotateVRM0 spins 180° *every* call, so an even number of
  runs cancels out and the avatar faces backwards). `useLoader` caches the model
  and React StrictMode mounts twice in dev, so prep is guarded by a
  `scene.userData.prepared` flag to run exactly once. Per-object
  `frustumCulled = false` also avoids VRM meshes wrongly disappearing at some
  camera angles.

## Milestone 3 — looping idle animation

Replaces the T-pose with a looping idle, retargeting a Mixamo clip onto the VRM
humanoid (the officially demonstrated three-vrm path). No movement yet.

- **Why retargeting is needed.** Mixamo clips are authored for Mixamo's own
  skeleton (`mixamorigHips`, …); the VRM uses standardized humanoid bone names.
  `loadMixamoAnimation.js` remaps the bone names (`mixamoVRMRigMap`) and, per
  keyframe, reconciles the two rigs' rest poses:
  `newRotation = parentRestWorld · mixamoRotation · restWorldⁿ¹`. VRM 0.x also
  needs its mirrored axes flipped.
- **Hips-height scaling (the #1 retargeting bug).** Only the hips carry a
  position track, authored at the source rig's scale. It's multiplied by
  `vrmHipsHeight / motionHipsHeight` so the feet stay planted instead of the
  character sinking into or floating above the ground.
- **Loaded via useLoader, retargeted purely.** The FBX is loaded with
  `useLoader(FBXLoader, …)` (async + Suspense + caching, same as the VRM);
  `retargetMixamoAnimation(asset, vrm)` is a pure sync transform on the loaded
  asset that **builds fresh keyframe arrays** rather than mutating the cached
  source (StrictMode renders twice — in-place mutation would double-apply).
- **Playback via AnimationMixer.** A `THREE.AnimationMixer(vrm.scene)` plays the
  retargeted clip (loops by default). It targets `vrm.scene` because the tracks
  address the VRM's *normalized* humanoid bones, which live in that subtree.
  `.play()` runs in a `useEffect` (not the memo) with a symmetric
  `.stop()` cleanup, so it survives StrictMode's mount→unmount→mount.
- **Update order matters.** Each frame runs `mixer.update(delta)` **then**
  `vrm.update(delta)`: the mixer poses the normalized humanoid bones, then
  `vrm.update` propagates that pose to the render skeleton and advances spring
  bones/expressions.
- **Facing.** With `rotateVRM0` applied once and the retargeted idle driving the
  hips, the avatar faces +Z (the camera) at zero root rotation, so the wrapper
  `<group>` needs no extra spin. (This depends on the clip's baked forward; M4's
  movement code owns character orientation — see below.)

## Milestone 4 — keyboard walking + follow camera

Keyboard-driven, camera-relative walking with an idle↔walk crossfade, explicit
facing, and a third-person camera that follows while staying orbit/zoomable. No
collision/physics yet.

- **Input → movement → facing (all in `Character`'s `useFrame`).**
  - *Input:* drei `<KeyboardControls>` (wrapping the Canvas in `App`) maps
    WASD + arrows to named actions; `useKeyboardControls`'s `get()` reads the
    live state inside the frame loop (no React re-render per keypress).
  - *Camera-relative movement:* the camera's look direction is flattened to the
    XZ plane for "forward", and "right" is `forward × up`. Pressed keys sum into
    a direction that's normalized and applied at a constant `WALK_SPEED · delta`,
    so "forward" always moves the character away from wherever the camera looks.
    Position is soft-clamped to the ground's half-size (temporary bound).
  - *Explicit facing:* the movement code **owns** orientation. Each moving frame
    it builds a target yaw `atan2(dir.x, dir.z)` (maps the avatar's +Z forward
    onto the move direction) and `quaternion.rotateTowards` turns the root toward
    it at a fixed angular speed — never relying on a clip's baked forward. A
    single `FACING_OFFSET` constant (currently `0`) is the one place to correct a
    clip whose forward differs.
- **Idle↔walk crossfade.** `walk.fbx` is loaded + retargeted into a second
  action on the same mixer. Both actions play continuously; on the moving/stopped
  transition we `fadeOut` one and `fadeIn` the other over ~0.25 s.
  Gotcha baked into the code: `fadeIn` ramps *effectiveWeight = baseWeight ×
  interpolant(0→1)*, so the incoming action's **base weight must be restored to
  1** first (the inactive clip is parked at base weight 0) or the ramp stays
  multiplied by zero and nothing shows.
- **Follow camera (`CameraRig` in `App`).** OrbitControls is kept
  (`makeDefault`, so it's exposed as `state.controls`) for drag-orbit + zoom.
  Each frame `CameraRig` adds the character's *per-frame position delta* to both
  `controls.target` and `camera.position`. Translating the whole rig by the same
  vector keeps the character centered at a constant distance (same on-screen
  size) while preserving whatever orbit angle / zoom the user set. The character
  root's ref is created in `App` and shared with both `Character` and
  `CameraRig`.

## File structure

```
portfolio/
├─ index.html               # HTML entry; mounts React into #root
├─ vite.config.js           # Vite + React plugin config
├─ package.json
├─ public/
│  ├─ models/avatar.vrm      # the VRM character (served at /models/…)
│  └─ animations/
│     ├─ idle.fbx            # Mixamo idle clip, "Without Skin"
│     └─ walk.fbx            # Mixamo walk clip, "In Place", "Without Skin"
├─ src/
│  ├─ main.jsx              # React entry: createRoot -> <App/>
│  ├─ App.jsx               # Canvas shell + KeyboardControls + OrbitControls + CameraRig
│  ├─ Scene.jsx             # scene contents: lights, ground, <Character/>
│  ├─ Character.jsx         # loads VRM + idle/walk FBX; movement, facing, crossfade
│  ├─ loadMixamoAnimation.js # Mixamo→VRM bone map + retargeting utility
│  ├─ toonGradient.js       # builds the cel-shading gradient ramp texture (env)
│  └─ index.css             # full-height layout so the canvas fills the screen
└─ CLAUDE.md / ARCHITECTURE.md
```

## Scene graph (current)

```
<KeyboardControls map>              // key→action map; context bridged into Canvas
└─ <Canvas>                        // WebGL renderer + camera + THREE.Scene
   ├─ <color attach="background">  // scene.background = warm off-white
   ├─ <Scene characterRef>
   │  ├─ <ambientLight>            // soft fill
   │  ├─ <directionalLight>        // key light (drives the cel bands)
   │  ├─ <Suspense fallback={null}>  // waits while the VRM + FBX load
   │  │  └─ <Character rootRef>    // reads keys; drives movement/facing/crossfade
   │  │     └─ <group ref>         // character ROOT — position + yaw written each frame
   │  │        └─ <primitive vrm.scene>  // MToon; per frame: mixer.update() then vrm.update()
   │  └─ <mesh> (ground)
   │     ├─ <planeGeometry> (rotated flat)
   │     └─ <meshToonMaterial gradientMap>
   ├─ <OrbitControls makeDefault target=[0,1,0]>  // drag/zoom; exposed as state.controls
   └─ <CameraRig characterRef>     // slides target + camera by the root's per-frame delta
```

## Rendering & style pipeline

- **Environment cel shading:** `MeshToonMaterial` + 4-step `NearestFilter`
  gradient map; drei `<Outlines>` (inverted hull, pixel-space thickness) for
  props. Currently only the ground uses this.
- **Character cel shading:** MToon (built into the VRM) — its own banding and
  outline; no gradient map, no drei `<Outlines>`.
- **Animation:** Mixamo clips retargeted onto the VRM humanoid, played with
  `THREE.AnimationMixer`; idle + walk with a weight crossfade.
- **Movement/camera:** keyboard, camera-relative, constant speed; explicit
  yaw-toward-heading; OrbitControls that translate to follow the character.
- **Lighting:** directional key + low ambient fill; no shadow maps yet.
- **Planned:** aesthetic pass (gradient tuning, bloom via Leva), regions +
  interactions, real content, full post-processing, per-room lighting.
