// Region config — the SINGLE source of truth for every interactive spot in the
// world. Everything downstream maps over this array: the 3D markers, the
// proximity check, the prompts, and the section panels. Adding/removing a
// section is a config edit here; no component code changes.
//
// (Named regionsConfig.js, not regions.js, to avoid a case-only filename clash
// with Regions.jsx on case-insensitive filesystems like Windows/macOS.)
//
// Shape per region:
//   {
//     id, label,            // id = stable key; label = short name (prompt + heading fallback)
//     title,                // panel heading
//     markerColor,          // crystal tint + emissive glow (also wayfinding colour)
//     position: [x, 0, z],  // on the flat walkable top (y = 0), inside WALKABLE_RADIUS
//     activationRadius,      // metres — how close to interact
//     type,                 // selects the panel layout: about|projects|experience|resume|contact
//     content,              // section-appropriate DATA (edit copy here, never in components)
//   }
//
// Markers are spaced ~72° apart on a ~9.5 m circle so each one is a short walk
// from spawn (centre) and from the others, and clear of the rim props (r > 13).
//
// NOTE: content below is realistic PLACEHOLDER — swap in real copy anytime.

export const REGIONS = [
  {
    id: 'about',
    label: 'About',
    title: 'About Me',
    markerColor: '#7fe3ff', // cyan
    position: [7.3, 0, 6.1],
    activationRadius: 3.5,
    type: 'about',
    content: {
      paragraphs: [
        'Hi, I’m Kartik — a developer who likes building things that are equal parts rigorous and playful. This little world is my portfolio; walk around and explore each region.',
        'Placeholder bio: a sentence or two about my background, what I care about in software, and what I’m currently looking for. Real copy goes here.',
      ],
    },
  },
  {
    id: 'projects',
    label: 'Projects',
    title: 'Projects',
    markerColor: '#ffd47f', // gold
    position: [-3.6, 0, 8.8],
    activationRadius: 3.5,
    type: 'projects',
    content: {
      projects: [
        {
          name: 'Placeholder Project One',
          description:
            'One-line description of what it does and why it’s interesting. Replace with a real project.',
          tech: ['React', 'Three.js', 'WebGL'],
          link: 'https://example.com',
        },
        {
          name: 'Placeholder Project Two',
          description:
            'A short summary of the problem solved and your role. Replace with a real project.',
          tech: ['Python', 'PyTorch'],
          link: 'https://example.com',
        },
        {
          name: 'Placeholder Project Three',
          description:
            'Another example card with no link, to test the optional-link layout.',
          tech: ['Rust', 'WASM'],
          // link intentionally omitted
        },
      ],
    },
  },
  {
    id: 'experience',
    label: 'Experience',
    title: 'Experience',
    markerColor: '#b69cff', // violet
    position: [-9.5, 0, -0.7],
    activationRadius: 3.5,
    type: 'experience',
    content: {
      items: [
        {
          role: 'Software Engineer Intern (placeholder)',
          org: 'Company A',
          dates: 'Summer 2025',
          points: [
            'Placeholder bullet describing an impactful thing you built or improved.',
            'Placeholder bullet with a metric or outcome where possible.',
          ],
        },
        {
          role: 'Research Assistant (placeholder)',
          org: 'University Lab',
          dates: '2024 – 2025',
          points: [
            'Placeholder bullet about the research area and your contribution.',
          ],
        },
      ],
    },
  },
  {
    id: 'resume',
    label: 'Resume',
    title: 'Résumé',
    markerColor: '#7dffc4', // mint
    position: [-2.3, 0, -9.2],
    activationRadius: 3.5,
    type: 'resume',
    content: {
      // Served from public/. If this file is absent the panel shows a graceful
      // "coming soon" state (see RegionPanel — it HEAD-checks the file on open).
      file: '/resume.pdf',
    },
  },
  {
    id: 'contact',
    label: 'Contact',
    title: 'Get in Touch',
    markerColor: '#ff9ec7', // pink
    position: [8.1, 0, -5.0],
    activationRadius: 3.5,
    type: 'contact',
    content: {
      links: [
        { kind: 'email', label: 'sengupta.k@northeastern.edu', href: 'mailto:sengupta.k@northeastern.edu' },
        { kind: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com/in/your-handle' },
        { kind: 'github', label: 'GitHub', href: 'https://github.com/your-handle' },
      ],
    },
  },
]
