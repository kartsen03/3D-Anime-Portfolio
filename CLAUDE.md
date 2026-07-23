# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## Project concept

A **3D anime-styled developer portfolio**: a navigable 3D world built with
React Three Fiber where a character explores rooms, each mapping to a portfolio
section — **About, Projects, Experience, Resume, Contact**.

Aesthetic: **anime / cel-shaded** — toon shading (flat color bands), ink
outlines (inverted-hull), and bloom. Think a stylized, hand-drawn look, not
photoreal.

## Tech stack (use current, non-deprecated APIs)

- **Vite** (build tool / dev server) — pinned to **v6** because the local Node
  is 18.16, and Vite 7 requires Node 20.19+.
- **React 19** + **react-dom 19**
- **three** (latest)
- **@react-three/fiber v9** (R3F; requires React 19)
- **@react-three/drei v10** (helpers; requires R3F v9)
- **Plain JavaScript** for now. May migrate to TypeScript later — keep code
  TS-friendly (clear prop shapes, avoid patterns that fight typing).

Do **not** use deprecated Three.js patterns (e.g. legacy color-management
flags, `outputEncoding`, `THREE.Geometry`). Prefer the modern equivalents.

## Working style (follow strictly)

- **Code-first.** Keep prose ≤ 3 sentences unless more is explicitly requested.
- **Plan before non-trivial or multi-file changes.** Propose a short plan and
  wait for approval before implementing.
- **Small, testable increments.** Commit after each working step.
- **Comment the WHY of web/3D-specific code.** The author is a strong
  programmer but new to web dev — explain browser/React/Three.js concepts and
  reasoning, not obvious syntax.

## Commands

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server (http://localhost:5173)
npm run build   # production build to dist/
npm run preview # preview the production build locally
```

## Conventions

- `src/App.jsx` owns the `<Canvas>` shell (renderer, camera, global controls).
- `src/Scene.jsx` owns scene contents (lights, world, objects). Rooms and the
  character will be composed in here as they're built.
- Reusable Three.js helpers (texture/material builders, math) live in small
  `src/*.js` modules, e.g. `src/toonGradient.js`.
- Animate by mutating refs inside `useFrame`, not via React state, to avoid
  re-rendering the React tree every frame.
- One cel-shading gradient map is built once (memoized) and shared across
  toon materials.

## Milestones

- **M1 (done): foundation** — Vite + R3F scaffold; a lit scene with a ground
  plane, a rotating toon-shaded object with an ink outline, and OrbitControls.
- **M2+ (planned):** character controller, rooms per portfolio section,
  navigation, bloom/post-processing, content.
