import { useEffect } from 'react'
import { runtime } from './runtime'
import { useStore } from '../../state/store'
import { SECTIONS } from '../../content/sections'

// Keyboard input for the 3D world.
//
// Held keys (movement) are written into runtime.keys and read by locomotion each frame.
// One-shot keys (E, 1–5) act on the store. Rules that keep it from fighting the rest of
// the page:
//  • Never react while the visitor types in a field, or with Ctrl/Cmd/Alt held (so
//    browser shortcuts keep working).
//  • Ignore key auto-repeat for one-shot actions. Holding E used to toggle the panel open
//    and shut ~30 times a second.
//  • Release every held key when the window loses focus; otherwise alt-tabbing mid-step
//    leaves the character walking forever (the keyup goes to another app).

const MOVE_KEYS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function releaseAllKeys() {
  for (const k of Object.keys(runtime.keys)) runtime.keys[k] = false
}

export function useWorldInput() {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const store = useStore.getState()
      if (store.mode !== 'world') return
      const sheetOpen = store.activeSection !== null
      const exploring = store.phase === 'explore'

      const move = MOVE_KEYS[e.code]
      if (move) {
        // With a sheet open, arrows belong to the sheet (scrolling); the world stays put.
        if (sheetOpen || !exploring) return
        runtime.keys[move] = true
        if (move !== 'sprint') {
          runtime.moveTarget = null // the keyboard takes over from tap-to-move…
          if (store.travelTarget) store.clearTravel() // …and from section travel
        }
        store.setInputMode('pointer')
        if (e.code.startsWith('Arrow')) e.preventDefault()
        return
      }

      if (e.repeat) return

      if (e.code === 'KeyE') {
        if (sheetOpen) store.closeSection()
        else if (exploring && store.nearSection) store.openSection(store.nearSection)
        return
      }

      // 1–5 travel to a section (works from inside an open sheet too).
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)
      if (digit && exploring) {
        const section = SECTIONS[Number(digit[1]) - 1]
        if (section) store.travelTo(section.id)
      }
    }

    const onKeyUp = (e) => {
      const move = MOVE_KEYS[e.code]
      if (move) runtime.keys[move] = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAllKeys)
    // Opening a sheet stops the character where it stands.
    const unsubscribe = useStore.subscribe(
      (s) => s.activeSection,
      (active) => {
        if (active) releaseAllKeys()
      },
    )
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAllKeys)
      unsubscribe()
    }
  }, [])
}
