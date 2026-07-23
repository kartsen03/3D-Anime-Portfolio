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
  - *No baked root motion:* because the controller owns horizontal position, the
    retargeting (`loadMixamoAnimation.js`) keeps only the **vertical (Y)**
    component of the hips position track and zeros X/Z. Mixamo "in place" clips
    can still bake forward translation into the hips — this walk drifted the hips
    ~1.7 m per cycle and snapped back at the loop, which read as the *body*
    popping every ~2 steps (the camera, following the root, was fine). Stripping
    X/Z leaves the hips centered over the root; `WALK_SPEED` (~1.7 m/s) is tuned
    to the clip's own stride so the feet don't slide.
- **Idle↔walk crossfade.** `walk.fbx` is loaded + retargeted into a second
  action on the same mixer. Both actions play continuously; on the moving/stopped
  transition we `fadeOut` one and `fadeIn` the other over ~0.25 s. Two gotchas the
  code guards against (both bit us during M4):
  - `fadeIn` ramps *effectiveWeight = baseWeight × interpolant(0→1)*, so the
    incoming action's **base weight must be restored to 1** first (the inactive
    clip is parked at base weight 0) or the ramp stays multiplied by zero.
  - A *completed* `fadeOut` sets the action's `enabled = false`, and `fadeIn`
    does **not** re-enable it — so the incoming action must be explicitly
    `enabled = true` again, or after the first stop the avatar sticks in its bind
    (T-)pose forever. So each transition does `to.enabled = true;
    to.setEffectiveWeight(1); to.fadeIn(…)`.
- **Follow camera (`CameraRig` in `App`).** OrbitControls is kept
  (`makeDefault`, so it's exposed as `state.controls`) for drag-orbit + zoom.
  Each frame `CameraRig` sets the desired orbit target to a point ~chest height
  above the character and slides **both** `controls.target` and `camera.position`
  by the same delta. Moving them together keeps the character centered at a
  constant distance (same on-screen size) while preserving the user's orbit
  angle / zoom. Two robustness details: the target is recomputed from the
  character's *absolute* position each frame (self-correcting, no drift, survives
  a ref remount); and because drei's OrbitControls runs its own `update()` at
  **priority −1** (before this rig, so it `lookAt`s the stale pre-shift target),
  `CameraRig` calls `controls.update()` again after shifting so the camera
  actually looks at the character that same frame. The character root's ref is
  created in `App` and shared with both `Character` and `CameraRig`.

## Milestone 5 — character post-processing + rim light (Leva-tunable)

A post-processing pass that gives the CHARACTER a Genshin-ish look, every knob
wired to live Leva sliders. The environment/island is deliberately NOT tuned yet
(it doesn't exist).

- **Post stack (`PostFX.jsx`).** `<EffectComposer frameBufferType={HalfFloatType}>`
  wraps the render, in order: `<Bloom>` → `<Vignette>` → `<ToneMapping>`.
  - **HDR buffer + tone-mapping rule (get this right).** The renderer's own tone
    mapping is set to `THREE.NoToneMapping` (in `App`'s `gl` prop) so the
    `<ToneMapping mode={ACES_FILMIC}>` effect — which MUST be the **last** effect
    — owns it. If the renderer also tone-mapped, it would squeeze HDR into [0,1]
    *before* the composer, so Bloom would have nothing bright to grab and colours
    would shift. `frameBufferType = HalfFloatType` gives the composer a float
    (HDR) buffer so values > 1 survive for Bloom. `outputColorSpace` stays SRGB
    (R3F default); the composer encodes to sRGB on output.
  - **Selective bloom.** A high `luminanceThreshold` (~1.0) + `mipmapBlur` means
    only pixels brighter than ~1.0 glow — the flat shading stays crisp and only
    the HDR rim blooms. It's luminance-selective, not the per-object
    `SelectiveBloom` component.
  - **No normal pass:** in @react-three/postprocessing v3 the normal pass is
    opt-in (`enableNormalPass`), off by default — nothing here needs it.
- **Character rim light (`Character.jsx`).** IMPORTANT: this VRM was exported
  with **`MeshStandardMaterial`, not MToon**, so there are no MToon parametric-rim
  uniforms (and the character isn't truly cel-shaded — the look comes from
  lighting). Instead we inject a **view-space Fresnel rim** into each material's
  compiled shader via `onBeforeCompile`: `rim = pow(1 - dot(normal, viewDir),
  fresnelPower)`, added just before `<tonemapping_fragment>` so it's in linear
  HDR for Bloom to catch. The rim colour is pushed into HDR (colour × `intensity`
  > 1.0) so Bloom sees it. All materials share the same injected uniform objects,
  so the Leva sliders update every material at once (uniform values upload each
  frame — no recompile). Leva **Rim** folder: `color`, `intensity`,
  `fresnelPower`, `mix` (0 = glow all around; 1 = glow only where already lit).
- **Leva.** Panel is a DOM overlay outside the Canvas; `useControls` in `PostFX`
  (Bloom/Vignette folders) and `Character` (Rim folder) feed one panel via Leva's
  global store — no context wiring across the Canvas boundary.
- **Version note.** `postprocessing@6.37` peer-requires `three < 0.181` but we
  run three r185; installed with `--legacy-peer-deps`. Verified working at
  runtime — revisit if postprocessing widens its range or issues appear.
- **Character outline is intentionally deferred**, not dropped. It will come from
  a later **global screen-space edge-detection** post pass, not a per-character
  inverted-hull outline. An inverted hull is awkward on an animated *skinned*
  character (the outline shell has to follow the skinning), whereas a screen-space
  edge pass outlines the character cleanly AND unifies it with the cel-shaded
  world once the island exists.

## Milestone 6 — floating island world

Replaces the flat test ground with a stylized floating island the character
lives on. No interactions/section UI yet (that's M7).

- **Built in code, not imported.** `Island.jsx` builds the island from
  primitives so we fully control the cel material (and dodge the standard-vs-MToon
  material mismatch that bit the character): a wide, shallow `cylinderGeometry`
  grass top + a downward `coneGeometry` rock spire, both `MeshToonMaterial` using
  the shared gradient map (rock uses `flatShading` for low-poly facets).
- **Flat walkable top (scope decision).** The grass top's face sits at `y = 0`,
  and the whole top is FLAT. This is deliberate: every M4 assumption (feet at
  `y = 0`, no terrain-height sampling, no slope walking) still holds, so movement
  / facing / camera code is unchanged. The island's *shape* is purely visual
  below the walkable plane.
- **Shared dimensions (`islandConfig.js`).** `TOP_Y`, `ISLAND_TOP_RADIUS`,
  `WALKABLE_RADIUS` live in one module so the geometry (Island) and the movement
  clamp (Character) can't drift. `WALKABLE_RADIUS` (13) < `ISLAND_TOP_RADIUS`
  (16) leaves a decorative rim ring.
- **Bounds clamp.** M4's square ground-edge clamp is replaced by a **circular**
  clamp in `Character`: if a step takes the root past `WALKABLE_RADIUS` from
  centre, it's pulled straight back onto the circle — so you can't walk off.
- **Sky (`SkyDome.jsx`).** No `sky.jpg` asset exists, so we render a **gradient**
  sky (deep-blue zenith → pale horizon) on a big BackSide sphere. We chose a
  gradient over drei's physically-based `<Sky>` because `<Sky>` renders very
  bright and blows out to white (and bleeds bloom haze) under our HDR + ACES +
  Bloom pipeline; a gradient stays below the bloom threshold and reads as a crisp
  stylized sky. **Swap point:** drop `public/textures/sky.jpg` and replace the
  body with `<Environment files="/textures/sky.jpg" background />`.
- **Props (`Props.jsx`).** A few low-poly cel-shaded pines (trunk + stacked
  cones) and an **instanced** rock cluster (drei `<Instances>` — one geometry +
  material, many transforms). They're placed on the RIM ring (between
  `WALKABLE_RADIUS` and `ISLAND_TOP_RADIUS`) at fixed positions, so they're
  inherently off the walkable path (no collision needed) and stable across
  reloads.
- **Lighting.** A strong directional key (`intensity 1.8`) from the sun
  direction (shared `SUN_POSITION`) so the cel bands read clearly, plus a modest
  ambient fill (`0.5`).

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
│  ├─ App.jsx               # Canvas shell + KeyboardControls + OrbitControls + CameraRig + PostFX
│  ├─ Scene.jsx             # sky + lighting + island + props + <Character/>
│  ├─ Character.jsx         # loads VRM + idle/walk FBX; movement, facing, crossfade, rim
│  ├─ Island.jsx            # code-built floating island (grass top + rock spire)
│  ├─ Props.jsx             # decorative cel-shaded trees + instanced rocks on the rim
│  ├─ SkyDome.jsx           # gradient sky dome (swap point for an equirect sky.jpg)
│  ├─ islandConfig.js       # shared island dimensions (geometry ↔ movement clamp)
│  ├─ PostFX.jsx            # EffectComposer: Bloom + Vignette + ToneMapping (Leva)
│  ├─ loadMixamoAnimation.js # Mixamo→VRM bone map + retargeting utility
│  ├─ toonGradient.js       # builds the cel-shading gradient ramp texture (env)
│  └─ index.css             # full-height layout so the canvas fills the screen
└─ CLAUDE.md / ARCHITECTURE.md
```

## Scene graph (current)

```
<Leva>                               // control panel — DOM overlay, OUTSIDE the Canvas
<KeyboardControls map>              // key→action map; context bridged into Canvas
└─ <Canvas gl={{ toneMapping: NoToneMapping }}>  // renderer tone mapping OFF (composer owns it)
   ├─ <Scene characterRef>          // (no <color> bg — SkyDome fills the backdrop)
   │  ├─ <SkyDome>                 // gradient sky on a big BackSide sphere
   │  ├─ <ambientLight> + <directionalLight>  // outdoor key+fill (sun direction)
   │  ├─ <Suspense fallback={null}>  // waits while the VRM + FBX load
   │  │  └─ <Character rootRef>    // keys→movement/facing/crossfade + Fresnel rim (Leva)
   │  │     └─ <group ref>         // character ROOT — position + yaw written each frame
   │  │        └─ <primitive vrm.scene>  // MeshStandardMaterial; per frame: mixer.update() then vrm.update()
   │  ├─ <Island gradientMap>      // flat grass top @ y=0 + rock spire (cel)
   │  └─ <Props gradientMap>       // rim trees + instanced rocks (cel)
   ├─ <OrbitControls makeDefault target=[0,1,0]>  // drag/zoom; exposed as state.controls
   ├─ <CameraRig characterRef>     // slides target + camera by the root's per-frame delta
   └─ <PostFX>                     // EffectComposer: Bloom → Vignette → ToneMapping (last)
```

## Rendering & style pipeline

- **Environment cel shading:** `MeshToonMaterial` + 4-step `NearestFilter`
  gradient map (shared) on the island + props; `flatShading` on rock/foliage for
  low-poly facets.
- **Character shading:** the VRM is `MeshStandardMaterial` (PBR), **not** MToon —
  so it is not truly cel-shaded yet; the stylized look comes from lighting. A
  custom view-space **Fresnel rim** is injected via `onBeforeCompile` for the
  edge glow. (Swapping to an MToon VRM later would give real cel bands + a
  built-in outline.)
- **Post-processing:** `EffectComposer` (HDR HalfFloat buffer) → selective Bloom
  (luminance ~1.0 + mipmapBlur) → Vignette → ACES ToneMapping (last). Renderer
  tone mapping is `NoToneMapping` so the effect owns it. All Leva-tunable.
- **Animation:** Mixamo clips retargeted onto the VRM humanoid, played with
  `THREE.AnimationMixer`; idle + walk with a weight crossfade.
- **Movement/camera:** keyboard, camera-relative, constant speed; explicit
  yaw-toward-heading; OrbitControls that translate to follow the character.
  Character is clamped to the island's circular walkable disc.
- **World:** code-built floating island (flat walkable top at y=0 + rock spire),
  gradient sky, cel-shaded rim props.
- **Lighting:** directional key + low ambient fill; no shadow maps yet.
- **Planned:** regions + interactions/section UI (M7), a **global edge-detection
  outline** pass (also outlines the character — see M5), real content,
  uneven-terrain walking, depth-of-field, mobile performance gating.
