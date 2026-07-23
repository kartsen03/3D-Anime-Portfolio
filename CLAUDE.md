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
- M4 — Keyboard movement + walk animation + camera follow. CURRENT
- M5 — Aesthetic pass: gradient-map tuning, outlines, first bloom (Leva tuning).
- M6 — First region + one interaction (approach object -> section opens).
- M7 — Remaining regions + real content.
- M8 — Full post-processing pass + art polish.
- M9 — Performance optimization + deploy.

## Status
M3 complete — idle animation playing, feet planted, character facing camera.
