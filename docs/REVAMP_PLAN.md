# Portfolio revamp plan

Approved 2026-10-13, with these changes to the defaults:

- **Content refresh:** in, and kept current.
- **Two prototypes:** both art directions (Shrine in the sky and Twilight lanterns), switchable,
  so the look can be chosen side by side.
- **Name intro:** the name shown huge first, with the camera then panning down to the shrine.
- **Quality bar:** AAA-level visuals and motion, with no loss of smoothness or deployability, and
  a professional UI on laptops and phones alike.

Checkpoint 1 combines Phases 0–1 with both prototypes and the intro, so the art direction is
picked in one review. Every later phase still ends with a checkpoint on a Vercel preview.

---

## 1. What I found

### Measured baseline

Measured on this laptop's Intel Iris Xe (the GPU class most laptop visitors have) with a
1280×720 window at 1.25× pixel ratio, using WebGL GPU timer queries.

| Metric | Today | What it means |
|---|---|---|
| GPU time per frame | 12–18 ms median, p90 up to 24 ms | 60 fps needs under 16.7 ms, so it drops frames |
| ↳ the 3D scene itself | 0.6 ms | the geometry isn't the problem |
| ↳ post-processing | most of the rest | both composer buffers are 8× MSAA half-float, so every effect pass writes and resolves 8 samples per pixel; bloom is a 16-pass chain |
| Freeze when the scene first draws | ~0.8 s | shaders compile and textures upload on the first visible frame |
| `idle.fbx` parse | 350 ms main-thread block | 10 s of 60 fps keyframes in a 1.9 MB FBX |
| Download before the character shows | 7.2 MB (5.9 MB is the avatar) | no loading screen; the avatar request can't start until the 492 KB JS bundle has downloaded and run |
| `avatar.vrm` (8.1 MB raw) | 4.8 MB morph targets (60 face shapes, 11 unused), 3.7 MB PNGs (one is 3 MB) | most of it can go without visible change |
| Caching on Vercel | everything, including hashed JS, served `max-age=0` | every repeat visit revalidates every file |
| Lighthouse, live site | Performance: can't be scored (no LCP, the page is only a canvas). Accessibility: 100, but only because there's almost no HTML to audit. SEO: 90 (no meta description). Console: favicon 404. | the automated scores hide the real problems |

### Bugs

Verified in the browser unless marked *(code)*.

1. **On phones, no section can be opened.** There's no touch movement, and clicking a gate only
   works when the character stands next to it. At 375×812 the character fills the whole screen.
2. **The camera has no limits.** You can zoom inside the character, orbit under the island, or
   zoom out until the island is a speck.
3. **Bad framing at spawn.** On desktop the character fills the frame and is cut off at the knees.
4. **Holding E flickers the panel** open and shut on every key auto-repeat.
5. **Opening a panel leaves focus on `<body>`.** There's no focus move, trap or restore, so
   keyboard and screen-reader users land nowhere.
6. **The character walks through torii pillars** *(code)*: there's no collision, and the gates
   stand inside the walkable radius.
7. **The rock spire's `flatShading` is silently dropped.** The console warns that it isn't a
   MeshToonMaterial property when passed to the constructor.
8. **Orbit damping runs twice per frame** *(code)*. `CameraRig` calls `controls.update()` after
   drei already did, so the camera feels different at 60, 120 and 144 Hz.
9. **Every proximity change re-renders the whole React tree** *(code)*, because the state lives in `App`.
10. **Runtime resolution changes don't resize the post-processing buffers.** I found this while
    measuring. It must be fixed before adaptive quality can work.
11. **Leva and all its tuning hooks ship to production** *(code)*, hidden but still bundled and running.
12. **A white Fresnel halo surrounds the whole character** (rim light × bloom), and the black
    outline floats outside it.
13. **No loading state** (`Suspense fallback={null}`). The island renders empty until the 8 MB avatar arrives.
14. **`backdrop-filter: blur` runs over the live canvas while a panel is open** *(code; known
    integrated-GPU cost, not measured)*. It re-blurs every frame.
15. **Poor link previews.** The title is "3D Anime Portfolio", with no meta description, OG image or
    favicon, so links shared on LinkedIn or Slack preview poorly.
16. **The canvas has no accessible name**, and none of the portfolio text is in the page until a
    panel opens.
17. **10 VRM loader warnings** ("expression preset unknown has duplicated entries"), because the
    VIVERSE export duplicates its ARKit groups.

### Why it reads as childish

- **Primitive shapes:** cone grass, gem-like flowers, a 24-sided cylinder island, and box torii.
- **Candy palette:** lime ground, baby-blue sky, and five different pastel gates.
- **No lighting story:** flat light, no shadows (the character looks pasted on), and little depth.
- **Generic UI:** a white system-font modal and a "press E" pill.
- **The avatar isn't cel-shaded at all.** It uses PBR materials with 50% self-illumination baked in
  by the exporter, so it doesn't match the world.

---

## 2. Direction

**Recommended: "Shrine in the sky".** A golden-hour floating shrine island above a sea of clouds,
inspired by Ghibli and Makoto Shinkai.

- **Palette:** a restrained one, with vermilion, warm cream, sage, indigo shadows and gold
  light. Section identity comes from distinct landmarks, not five candy colors.
- **What makes it professional:** one cohesive art direction, editorial typography, calm and
  purposeful motion, and fast, stable frame times.
- **What keeps it imaginative:** the world itself. Water pours off the island edge into the clouds,
  petals drift, projects hang as wooden ema plaques, and lanterns wake as you walk past.

Alternatives:

- **B. Twilight lanterns:** dusk or night, with lantern light, fireflies and stars. Moodier.
- **C. Spring morning:** brighter and sakura-heavy.

A day↔dusk toggle is a stretch goal for any of them.

Kept from today: the stack (React, R3F v9, three r185, three-vrm v3 WebGL MToon, Vite 6, plain JS),
the Mixamo→VRM retargeting, and the data-driven `regionsConfig.js`.

Not doing:

- **WebGPU:** CLAUDE.md pins the WebGL MToon path, the post-processing library is WebGL-only, and
  WebGL2 runs everywhere.
- **Physics engine:** simple collision circles are enough.
- **Vite or Node upgrade:** not needed for these goals.

---

## 3. Phases

Sizes are relative (S, M, L). Every step is a small commit with the WHY comments CLAUDE.md asks for.
`ARCHITECTURE.md` is updated at each checkpoint.

### Phase 0: Groundwork (S)

- **Branch:** create a `revamp` branch and push it, so Vercel builds a preview URL for every push.
  `main` and production stay untouched until you say merge.
- **Dependency bumps (same major versions):**
  - postprocessing 6.37 → 6.39.5. It officially supports three r185, so the `legacy-peer-deps`
    workaround goes away.
  - @react-three/postprocessing 3.0.4 → 3.2.0
  - R3F 9.6.1 → 9.8.1
  - drei 10.7.7 → 10.7.9
- **Perf probe:** a dev-only perf HUD plus a repeatable `?perf` probe (fixed camera path, GPU timer
  queries), so every checkpoint reports the same numbers.
- **Leva:** loads only with `?debug`, so it leaves the production bundle.

### Phase 1: Smooth, fast, fixed (M)

**Rendering**

- **Anti-aliasing:** turn composer MSAA off and use SMAA instead (FXAA on the low tier). Set
  `antialias: false` on the canvas.
- **Bloom:** half resolution, 5 levels.
- **Final pass:** vignette, color grade and tone map merged into one pass, with dithering so the
  sky gradient doesn't band.
- **Tone mapping:** A/B Neutral and AgX against today's ACES. ACES shifts hues, which fights an
  anime palette.
- **Quality tiers:** low, medium and high, adjusted by drei `PerformanceMonitor` with hysteresis.
  Includes the fix for bug 10, and a manual override in settings.
- **Target:** at most 8 ms GPU median at the same resolution on this laptop, against 12–18 ms today.

**Loading**

- **Instant splash:** your name and title, written into `index.html`, so it paints before any JS.
- **Parallel downloads:** `<link rel="preload">` starts the avatar download alongside the JS.
- **Code splitting:** the 3D code goes in its own chunk. A progress bar tracks bytes, and an
  "Enter" button appears when ready.
- **Warm-up:** shaders compile and textures upload behind the splash, removing the ~0.8 s freeze.
- **Avatar slimming script:**
  - Drop the morph targets nothing uses (about 20 are kept, for blink, mouth shapes and emotions).
  - Sparse-encode what's left.
  - Re-encode the 3 MB PNG.
  - Remove the duplicate expression groups.
  - The original stays outside `public/`.
  - Target: under 2 MB transferred, from 5.9 MB.
- **Animation clips:** retargeted once and baked to compact JSON. This drops FBXLoader and the
  350 ms parse.
- **Caching:** `vercel.json` headers make hashed `/assets` immutable and long-cache versioned
  models and clips.
- **Target:** at most 3 MB on first visit, against 7.2 MB.

**Camera and controls**

- **Follow camera:** a drei `CameraControls` camera replaces OrbitControls and CameraRig.
  - Time-based smoothing makes it feel the same at 60, 120 and 144 Hz.
  - Distance and pitch are limited.
  - Explicit frame order: input → movement → camera → render, so there's no one-frame lag.
- **Spawn framing:** composed for every aspect ratio, phones included.

**Input and bugs**

- **Bug list:** fix bugs 1–17.
- **Collision:** circles around gates and props.
- **State:** interaction state moves to a small zustand store.
- **Tap or click to move:** the character walks to where you tap, with a ripple marker.
- **Section chips:** chips (and keys 1–5) walk you to a section and open it. Every section becomes
  reachable on a phone or with a keyboard alone.

**Checkpoint 1:** a preview link and a before/after table.

### Phase 2: The new world (L)

**Shading and light**

- **One toon lighting model** for the whole world: a colored ramp (warm light, cool lavender
  shadow) and crisp cel shadows from a single sun shadow map. The low tier gets a blob shadow.
- **Character:** converted at load time to three-vrm's MToon material. This gives real cel bands,
  shadow tones taken from its own texture, and a subtle warm rim in place of the white halo. The
  face gets softer settings so it doesn't look harsh.
- **Outline v2:** the depth edge is relative to distance, so lines look consistent near and far.
  Line width stays constant on screen at any resolution, and sky and foliage are skipped.

**Sky and atmosphere**

- A golden-hour sky shader with a gently blooming sun.
- 3D cel-shaded clouds on the horizon, plus a sea of clouds below the island.
- Distant floating islands.
- Light shafts made of meshes (cheaper than a post-processing pass).

**Island**

- An organic, noise-shaped coastline, layered cliff strata and hanging rock spires.
- A stone path linking the sections.
- The walkable top stays flat, so movement code stays simple.

**Living details**

All of these are tiered, and each one is measured against the 8 ms budget before it stays.

- GPU grass, 15–30k blades depending on tier, with wind. It bends around the character.
- Fluffy stylized trees: a hero sakura plus pines, with leaf cards and spherical normals.
- A waterfall off the island edge, with mist falling into the clouds.
- Drifting petals and fireflies.
- Anime wind streaks.
- A distant bird flock.

**Section landmarks.** All five share the same vermilion torii style, and each gets its own centerpiece:

| Section | Landmark |
|---|---|
| About | Main torii and the hero sakura, at spawn |
| Projects | Ema wall: one wooden plaque per project; click a plaque to open that project |
| Experience | Stone-lantern path: one lantern per role, lit as you pass |
| Résumé | Scroll pavilion: the hanging scroll unrolls |
| Contact | Shrine bell, with paper cranes that fly off when you open it |

**Checkpoint 2:** a preview with screenshots, then a palette and tuning pass with you.

### Phase 3: Interface and accessibility (M)

- **Design system:** self-hosted type (Fraunces for headings, Inter for text), paper, ink and
  vermilion color tokens, visible focus rings, and touch targets of at least 44 px.
- **HUD:**
  - Your name as the wordmark.
  - Section chips with key numbers.
  - Control hints that match the device (keyboard or touch).
  - Settings for graphics, reduced motion, and sound if you choose it.
- **Panels:**
  - Desktop: a side sheet, so the world stays visible and the camera frames the landmark.
  - Phones: a bottom sheet.
  - No blur over the live canvas.
- **Dialogs done right:**
  - Focus moves into the panel and is trapped there.
  - Esc closes it, and focus returns to whatever opened it.
  - The background becomes inert.
  - The page title changes per section.
  - Screen readers announce when you're near a section.
- **Quick view (text version):** every section as semantic HTML, reached from a skip link. It's
  also the automatic fallback when WebGL is missing or crashes (an error boundary plus
  context-loss handling).
- **Deep links:** `karthik-sengupta.vercel.app/#projects` opens Projects directly, so links can be shared.
- **Reduced motion:** `prefers-reduced-motion` turns off camera flights and calms particles. There's
  also an in-app toggle.
- **Sharing and SEO:** a real title and description, an OG image rendered from the new scene, a
  favicon set, and JSON-LD Person data.
- **Audit:**
  - axe-core, aiming for zero violations.
  - A keyboard-only walkthrough.
  - Lighthouse on the preview.

**Checkpoint 3.**

### Phase 4: Motion and delight (M)

- **Intro:** a title card, then a camera swoop from the clouds to behind the character. It can be
  skipped, and it's a simple cut under reduced motion.
- **Section shots:** the camera eases to a composed view of the landmark as the sheet slides in,
  and eases back on close.
- **Character life:**
  - Blinking.
  - Head and eyes look toward the nearest landmark or the camera.
  - Acceleration and a lean into turns.
  - Smoother crossfades.
  - Dust puffs when running.
- **Landmark awakenings:** lanterns ignite, plaques sway, shide paper streamers flutter, and petals swirl.
- **UI motion:** GSAP timelines for staggered reveals and small interactions, all respecting reduced motion.
- **Optional sound:** wind and chimes synthesized in WebAudio, so there are no audio files. Off by default.

**Checkpoint 4.**

### Phase 5: Ship (S)

- **Docs:** README with new screenshots and a short GIF, `ARCHITECTURE.md`, and CLAUDE.md status
  and roadmap.
- **Final report:** before/after performance and accessibility numbers from the probe, measured,
  not estimated.
- **Release:** merge `revamp` → `main` on your OK, and Vercel deploys production.

---

## 4. Decisions for you (defaults in bold)

1. **Art direction:** **A. Shrine in the sky** / B. Twilight lanterns / C. Spring morning.
2. **Avatar:** **keep your current avatar, converted to cel shading** / you make an anime-style
   avatar in VRoid Studio (free) and I swap it in. Any VRM works.
3. **Landmarks:** **a distinct landmark per section** / five upgraded torii only (smaller scope).
4. **Sound:** **skip** / include procedural ambience, off by default.
5. **Workflow:** **a `revamp` branch with Vercel previews, merged only on your OK.**
6. **Dependencies:**
   - **Add GSAP (animation timelines) and @fontsource fonts.**
   - **Add sharp as a dev-only tool for the avatar script.**
   - **zustand and camera-controls are already installed through R3F and drei.**
7. **Content refresh: approved.** Draft cards use only claims from each repo's README or
   results files, with a sync script that keeps repo metadata current.

---

## 5. Risks and notes

- **No phone here.** I'll test touch flows in mobile emulation and rely on the adaptive tiers.
  Please open each preview on your phone.
- **Code-built art can still look cheap if rushed.** It comes in visual iterations with
  screenshots at each checkpoint, not one big drop.
- **Cel shading on a semi-realistic face can look harsh.** The face gets its own, softer settings.
- **Avatar license:** the VRM's embedded metadata (VIVERSE export) says `Redistribution_Prohibited`,
  and the file sits in a public GitHub repo. Any site has to serve the file to show it, so the
  question is the repo copy. Worth checking VIVERSE's terms.
- **Measurement noise:** GPU numbers on this laptop drift with clocks and heat (12–18 ms at
  identical settings). I'll report medians from interleaved runs.

## 6. How each phase is verified

- **Perf probe:** GPU ms (median and p90), fps, draw calls, triangles and transfer size. Same
  camera path and resolution, before and after.
- **Browser checks:**
  - Console stays clean.
  - All five sections open by keyboard, mouse, touch emulation and Quick view.
  - Screenshots at desktop size and 375×812.
- **Audits:** axe-core and Lighthouse on the preview URL.
