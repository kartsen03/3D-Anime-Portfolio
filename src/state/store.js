import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { SECTION_IDS } from '../content/sections'

// One store shared by the HTML interface and the 3D world. The <Canvas> lives in a
// separately-loaded chunk, but both import this same module, so they see the same state.
//
// What belongs here: anything the interface renders or that changes a handful of
// times per session (which section is open, settings, load progress). What does NOT
// belong here: per-frame values like the character's position. Writing those into a
// React store 60 times a second would re-render subscribers every frame; the world
// keeps them in plain mutable objects instead (see world/systems/runtime.js).

const params = new URLSearchParams(window.location.search)

// localStorage can throw (private mode, blocked storage), so every access is guarded
// and the app works the same without it — it only remembers a visitor's settings.
const SETTINGS_KEY = 'ks-portfolio-settings-v1'
function readSettings() {
  try {
    return JSON.parse(window.localStorage.getItem(SETTINGS_KEY)) ?? {}
  } catch {
    return {}
  }
}
function writeSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable: settings still apply for this visit.
  }
}

function detectWebGL2() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    // Release the probe context right away so it doesn't count against the
    // browser's limit on live WebGL contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

const saved = readSettings()
const systemReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
const webgl = detectWebGL2()

// Deep links: /#projects opens that section once the world is ready; /#quick (or
// ?text) opens the text version straight away.
const hash = decodeURIComponent(window.location.hash.slice(1))
const deepLinkSection = SECTION_IDS.includes(hash) ? hash : null
const startInQuickView = hash === 'quick' || params.has('text') || !webgl

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

export const useStore = create(
  subscribeWithSelector((set, get) => ({
    // --- boot ---
    // 'loading' → assets streaming; 'ready' → everything compiled, waiting to begin;
    // 'intro' → opening camera move; 'explore' → free roam.
    phase: 'loading',
    progress: 0, // 0..1, bytes of the critical 3D assets
    loadError: null,
    webgl,

    // --- presentation ---
    mode: startInQuickView ? 'quick' : 'world', // 'world' | 'quick' (text version)
    theme: pick(params.get('theme') ?? saved.theme, ['golden', 'twilight'], 'golden'),
    intro: pick(params.get('intro') ?? saved.intro, ['sky', 'type'], 'sky'),
    // Explicit user choice wins over the OS setting; null means "follow the OS".
    reducedMotionOverride: typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : null,
    systemReducedMotion,
    quality: pick(params.get('quality') ?? saved.quality, ['auto', 'high', 'medium', 'low'], 'auto'),
    tier: 'medium', // the tier actually in use (auto mode moves this)

    // --- input ---
    inputMode: coarsePointer ? 'touch' : 'pointer', // drives the control hints

    // --- sections ---
    nearSection: null, // section whose landmark the character is standing at
    activeSection: null, // section whose sheet is open
    pendingSection: deepLinkSection, // opened automatically once the world is ready
    travelTarget: null, // section the character is auto-walking to

    // --- actions ---
    setPhase: (phase) => set({ phase }),
    setProgress: (progress) => set({ progress }),
    setLoadError: (loadError) => set({ loadError }),
    setTier: (tier) => set({ tier }),
    setInputMode: (inputMode) => {
      if (get().inputMode !== inputMode) set({ inputMode })
    },
    setNearSection: (nearSection) => {
      if (get().nearSection !== nearSection) set({ nearSection })
    },

    openSection: (id) => {
      if (!SECTION_IDS.includes(id)) return
      set({ activeSection: id, travelTarget: null, pendingSection: null })
      replaceHash(id)
    },
    closeSection: () => {
      if (get().activeSection === null) return
      set({ activeSection: null })
      replaceHash(get().mode === 'quick' ? 'quick' : '')
    },
    // Walk the character to a section's landmark; the world opens the sheet on arrival
    // (or immediately, under reduced motion).
    travelTo: (id) => {
      if (!SECTION_IDS.includes(id)) return
      set({ travelTarget: id, activeSection: null })
    },
    clearTravel: () => set({ travelTarget: null }),

    setMode: (mode) => {
      set({ mode, activeSection: null })
      replaceHash(mode === 'quick' ? 'quick' : '')
    },
    setTheme: (theme) => {
      set({ theme })
      persist(get)
    },
    setIntro: (intro) => {
      set({ intro })
      persist(get)
    },
    setQuality: (quality) => {
      set({ quality })
      persist(get)
    },
    setReducedMotion: (value) => {
      set({ reducedMotionOverride: value })
      persist(get)
    },
  })),
)

function persist(get) {
  const { theme, intro, quality, reducedMotionOverride } = get()
  writeSettings({ theme, intro, quality, reducedMotion: reducedMotionOverride ?? undefined })
}

// Keep the address bar in sync so a section can be shared as a link, without adding a
// history entry per click (Back should leave the site, not cycle through panels).
function replaceHash(id) {
  const url = window.location.pathname + window.location.search + (id ? `#${id}` : '')
  window.history.replaceState(null, '', url)
}

// Follow live changes to the OS reduced-motion setting (e.g. toggled mid-visit).
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => {
  useStore.setState({ systemReducedMotion: e.matches })
})

/** Effective reduced-motion flag: the visitor's explicit choice, else the OS setting. */
export const selectReducedMotion = (s) => s.reducedMotionOverride ?? s.systemReducedMotion
