// The five sections of the portfolio, in reading order. Everything that lists sections
// maps over this array: the HUD's section bar, the keyboard shortcuts (1–5), the
// landmarks in the world, the sheets, and the Quick view. Section *content* lives in
// the sibling files (profile.js, projects.js, experience.js).
//
// `kanji` is a small decorative label in the interface (aria-hidden; screen readers
// get `label`).

export const SECTIONS = [
  { id: 'about', number: '01', label: 'About', title: 'About me', kanji: '自己紹介', key: '1' },
  { id: 'projects', number: '02', label: 'Projects', title: 'Selected work', kanji: '作品', key: '2' },
  { id: 'experience', number: '03', label: 'Experience', title: 'Experience', kanji: '経歴', key: '3' },
  { id: 'resume', number: '04', label: 'Résumé', title: 'Résumé', kanji: '履歴書', key: '4' },
  { id: 'contact', number: '05', label: 'Contact', title: 'Get in touch', kanji: '連絡', key: '5' },
]

export const SECTION_IDS = SECTIONS.map((s) => s.id)

export const sectionById = (id) => SECTIONS.find((s) => s.id === id) ?? null
