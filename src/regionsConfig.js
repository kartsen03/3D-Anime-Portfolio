// Region config — the single source of truth for the portfolio's interactive
// spots. Adding a section later is ONE more entry here: the marker, proximity
// check, prompt, and panel all map over this array, so nothing else needs to
// change structurally.
//
// (Named regionsConfig.js, not regions.js, to avoid a case-only filename clash
// with Regions.jsx on case-insensitive filesystems like Windows/macOS.)
//
// `position` is on the flat walkable top (y = 0) and inside WALKABLE_RADIUS
// (see islandConfig.js), placed off to one side so you have to walk over.

export const REGIONS = [
  {
    id: 'about',
    label: 'About',
    position: [7, 0, 6], // ~9.2 m from centre, well inside the walkable disc
    activationRadius: 3.5, // how close (metres) the character must be to interact
    color: '#7fe3ff', // crystal tint (also its emissive glow colour)
    title: 'About Me',
    // Placeholder copy — real bio goes here later.
    body: [
      'Hi, I’m Kartik — a developer who likes building things that are equal parts rigorous and playful. This little world is my portfolio; walk around and explore.',
      'This panel is a placeholder. Real copy about my background, interests, and what I’m looking for will live here.',
    ],
  },
]
