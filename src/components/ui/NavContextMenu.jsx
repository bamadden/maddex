import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Right-click menu for a sidebar nav item.
//
// Rendered through a portal rather than inside the nav row that opened it.
// The sidebar is a 64px rail that expands on hover and clips its overflow,
// so a menu parented to a row would be cut off at the rail's edge — and it
// would close the moment the pointer left the row and collapsed the rail.
//
// Positioned at the cursor, then corrected against the viewport once it has
// been measured: a right-click near the bottom of the sidebar would otherwise
// open a menu running off the bottom of the screen, which is exactly where
// the lower nav items live.

const ITEMS = [
  { key: 'open',   icon: '▶', label: (m) => `Open ${m}` },
  { key: 'popout', icon: '⊡', label: () => 'Open in popout window' },
  { key: 'split',  icon: '⊞', label: () => 'Open side by side (split)' },
]

export default function NavContextMenu({ x, y, moduleLabel, onSelect, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y, ready: false })

  // Measure before paint, so the menu never appears at the wrong place and
  // then jumps once corrected.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const M = 8
    const left = x + width + M > window.innerWidth ? Math.max(M, x - width) : x
    const top = y + height + M > window.innerHeight ? Math.max(M, y - height) : y
    setPos({ left, top, ready: true })
  }, [x, y])

  useEffect(() => {
    // `capture` on pointerdown, not click: a click listener fires after the
    // target has already acted, so a right-click landing on another nav row
    // would navigate before the menu closed.
    const onPointerDown = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`${moduleLabel} actions`}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 4000,
        minWidth: 210,
        // Hidden until measured — one frame, but a visible jump otherwise.
        visibility: pos.ready ? 'visible' : 'hidden',
        background: 'rgba(6,13,26,0.97)',
        border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: 3,
        boxShadow: '0 10px 30px rgba(0,0,0,0.65)',
        backdropFilter: 'blur(10px)',
        animation: 'tooltipPop .12s ease-out',
      }}
    >
      <div
        style={{
          padding: '7px 12px',
          borderBottom: '1px solid rgba(201,168,76,0.15)',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: '#C9A84C',
        }}
      >
        {moduleLabel}
      </div>

      {ITEMS.map((item) => (
        <button
          key={item.key}
          role="menuitem"
          onClick={() => { onSelect(item.key); onClose() }}
          className="nav-ctx-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            width: '100%',
            padding: '7px 12px',
            background: 'none',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11,
            color: '#8BA3C4',
          }}
        >
          <span style={{ width: 13, textAlign: 'center', flexShrink: 0, opacity: 0.75 }}>{item.icon}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{item.label(moduleLabel)}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
