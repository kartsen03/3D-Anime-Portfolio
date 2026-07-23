# Portfolio — 3D Anime Gamified Developer Portfolio

## Project
A gamified developer portfolio: a navigable 3D world (floating island,
Genshin-style cel shading) where a VRM character explores regions that map to
portfolio sections (About, Projects, Experience, Resume, Contact). Owner is a
strong programmer but new to web development.

## Working style
- Code-first. Keep prose to <=3 sentences unless asked for more.
- Before any non-trivial or multi-file change, propose a short plan and wait
  for my OK.
- Work in small, testable increments; commit after each working step.
- Comment the WHY of any 3D / graphics / animation code (I'm learning web dev).

## Stack & pinned versions
- React + React Three Fiber v9
- three r185
- @react-three/drei
- @pixiv/three-vrm v3 — use the standard WebGL MToon path. Do NOT use the
  WebGPU MToonNodeMaterial / node-material path.
- Vite 6 (Node is 18.x; don't require Node >= 20 features)
- Plain JavaScript (not TypeScript)

## Animation pipeline
- Character animations come from Mixamo (FBX), retargeted onto the VRM
  humanoid: remap mixamorig bone names -> VRM humanoid bones, reconcile the
  T-pose/rotation, and scale the hips-position track to this model's hip height
  (feet must stay planted).
- Playback via THREE.AnimationMixer.
- Update order every frame: mixer.update(delta) BEFORE vrm.update(delta).

## Assets
- VRM model: public/models/avatar.vrm
- Mixamo clips: public/animations/*.fbx

## Dev notes
- Dev runs under React StrictMode, which double-invokes mount/unmount to
  surface bugs: make effect setup idempotent and cleanup symmetric (put side
  effects like animation .play()/.stop() in useEffect, not useMemo).

## Architecture
See ARCHITECTURE.md for current file structure and how the pieces fit. Keep it
updated at the end of each milestone.

## Roadmap
- M1 — Scene scaffold: cel-shaded toon object + outline, lights, controls. DONE
- M2 — Load the VRM avatar. DONE
- M3 — Looping idle animation. DONE
- M4 — Keyboard movement + walk animation + camera follow. DONE
- M5 — Character post-processing (bloom/vignette/ACES) + Fresnel rim, Leva-tuned. DONE
- M6 — Floating island world (flat walkable top, bounds, gradient sky, props). DONE
- M7 — First region + one interaction (approach object -> section opens). CURRENT
- M8 — Remaining regions + real content.
- M9 — Full post-processing pass + art polish (incl. global edge-detection outline).
- M10 — Performance optimization + deploy.

## Status
M6 complete — the character now lives on a code-built floating ISLAND: flat
walkable grass top (y=0, so all M4 movement is unchanged), tapering rock spire,
circular walkable-bounds clamp, gradient sky (swap point for an equirect
sky.jpg), and a few cel-shaded rim props. M5's post/rim + M1–M4 all intact.

Asset note: the current avatar.vrm uses MeshStandardMaterial, NOT MToon — so the
character isn't truly cel-shaded and has no MToon rim; the rim is a custom
Fresnel term injected via onBeforeCompile. For the real Genshin look later, swap
in an MToon-based VRM (e.g. VRoid Studio export). Character outline is deferred
to a future global screen-space edge-detection pass (better than inverted-hull
on a skinned character).
