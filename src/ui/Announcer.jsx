import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { sectionById } from '../content/sections'

// Screen-reader announcements for things that only happen in the 3D world: arriving at
// a landmark, starting a walk. A polite live region queues behind whatever the reader is
// already saying instead of interrupting it.
export default function Announcer() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    const unsubNear = useStore.subscribe(
      (s) => s.nearSection,
      (id) => {
        const { activeSection, inputMode } = useStore.getState()
        if (!id || activeSection) return
        const s = sectionById(id)
        setMessage(`At the ${s.label} landmark. ${inputMode === 'touch' ? 'Tap Open to read it.' : 'Press E to open it.'}`)
      },
    )
    const unsubTravel = useStore.subscribe(
      (s) => s.travelTarget,
      (id) => {
        if (id) setMessage(`Travelling to ${sectionById(id).label}.`)
      },
    )
    return () => {
      unsubNear()
      unsubTravel()
    }
  }, [])

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
