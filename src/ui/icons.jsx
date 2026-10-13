// Hand-drawn line icons on one 24px grid with a 1.5px stroke, so every icon in the
// interface shares a visual weight. All are decorative (aria-hidden); the buttons that
// hold them carry the accessible name.

const base = { viewBox: '0 0 24 24', className: 'icon', 'aria-hidden': true, focusable: false }

export const IconClose = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconText = () => (
  <svg {...base}>
    <path d="M5 5.5h14M5 10h14M5 14.5h9M5 19h11" />
  </svg>
)

export const IconWorld = () => (
  <svg {...base}>
    <path d="M3.5 15.5c2.2-1.6 4.7-1.6 7 0s4.8 1.6 7 0 2.6-1.2 3-1.6" />
    <path d="M6 15.2l2.6-6.4 2.4 3.6 2.2-5.4 3.8 8.1" />
    <path d="M12 3.8v1.6M17.8 6.2l-1.1 1.1M6.2 6.2l1.1 1.1" />
  </svg>
)

export const IconSun = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
  </svg>
)

export const IconLantern = () => (
  <svg {...base}>
    <path d="M12 2.5v2.2M9 4.7h6" />
    <path d="M8 7.5c0-1.6 1.8-2.8 4-2.8s4 1.2 4 2.8v7c0 1.6-1.8 2.8-4 2.8s-4-1.2-4-2.8z" />
    <path d="M8.2 10h7.6M8.2 13h7.6M10 17.4l-.4 2.6h4.8l-.4-2.6" />
  </svg>
)

export const IconSettings = () => (
  <svg {...base}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)

export const IconArrow = () => (
  <svg {...base}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const IconArrowLeft = () => (
  <svg {...base}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
)

export const IconExternal = () => (
  <svg {...base}>
    <path d="M14 5h5v5M19 5l-8 8M17 14v4.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H10" />
  </svg>
)

export const IconDownload = () => (
  <svg {...base}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
  </svg>
)

export const IconMail = () => (
  <svg {...base}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="M4 7l8 6 8-6" />
  </svg>
)

export const IconGithub = () => (
  <svg {...base}>
    <path d="M9 19c-4 1.3-4-2-5.5-2.5M14.5 21v-3.4c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6 2.9 4.9 3.2 4.9 3.2a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.5 9.6c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </svg>
)

export const IconLinkedin = () => (
  <svg {...base}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M8 10.5v6M8 7.5v.01M12 16.5v-6M12 13c0-1.5 1-2.6 2.4-2.6 1.4 0 2.1 1 2.1 2.6v3.5" />
  </svg>
)

export const IconCopy = () => (
  <svg {...base}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
    <path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
  </svg>
)

export const IconCheck = () => (
  <svg {...base}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const CONTACT_ICONS = { email: IconMail, github: IconGithub, linkedin: IconLinkedin }
