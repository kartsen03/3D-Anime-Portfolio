// The section panel: a plain DOM overlay (NOT drei <Html>) rendered OUTSIDE the
// Canvas, because it's a full-screen UI layer, not something anchored in 3D.
// Shown when a region is active; closes via the ✕ button, a click on the dim
// backdrop, or Escape (handled in App).
export default function RegionPanel({ region, onClose }) {
  if (!region) return null

  return (
    <div
      className="region-panel-backdrop"
      // Close when clicking the backdrop itself, but not when clicking inside
      // the card (clicks there have currentTarget !== target).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="region-panel"
        role="dialog"
        aria-modal="true"
        aria-label={region.title}
      >
        <button
          className="region-panel-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2>{region.title}</h2>
        {region.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </div>
  )
}
