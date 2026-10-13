import { useEffect } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal focus handling for a dialog element:
 *  • on open, move focus into the dialog (to `initialFocus`, or the dialog itself);
 *  • keep Tab / Shift+Tab cycling inside it;
 *  • call `onEscape` on Escape;
 *  • on close, return focus to whatever had it before (or `fallbackFocus()`).
 * This is what makes a dialog usable from the keyboard and with a screen reader: the
 * old panel left focus on <body>, so keyboard users opened it and landed nowhere.
 */
export function useFocusTrap(ref, { active, initialFocus, onEscape, fallbackFocus }) {
  useEffect(() => {
    if (!active) return
    const dialog = ref.current
    if (!dialog) return
    const previouslyFocused = document.activeElement

    const focusTarget = initialFocus?.current ?? dialog
    focusTarget.focus({ preventScroll: true })

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscape?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', onKeyDown)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      const back =
        previouslyFocused && previouslyFocused.isConnected && previouslyFocused !== document.body
          ? previouslyFocused
          : fallbackFocus?.()
      back?.focus?.({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
