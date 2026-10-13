// Shared island dimensions. Kept in one place so the island GEOMETRY (Island.jsx)
// and the character's movement CLAMP (Character.jsx) can never drift apart.
//
// All heights are in metres, matching the rest of the scene. The walkable top is
// kept FLAT at y = TOP_Y so every M4 movement/facing/camera assumption (feet at
// y = 0) still holds — the island's shape is purely visual below that plane.

export const TOP_Y = 0 // height of the flat, walkable grass surface

export const ISLAND_TOP_RADIUS = 16 // visual radius of the grassy disc
export const WALKABLE_RADIUS = 13 // character can't move past this from centre

// The ring between WALKABLE_RADIUS and ISLAND_TOP_RADIUS is a decorative rim:
// props (trees/rocks) live here, which keeps them off the walkable path.
