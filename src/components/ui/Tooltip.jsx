import { useState, useRef, useCallback, useEffect } from 'react'

// Shared tooltip for the whole terminal — one look, one delay, one behaviour,
// replacing ad-hoc native title="" attributes wherever richer or more
// consistent content is wanted.
//
// Positioned `fixed` off the trigger's bounding rect rather than absolutely
// inside it: the terminal nests a lot of overflow-hidden panels, and an
// absolutely-positioned tooltip gets clipped by them.
//
// The 400ms open delay is deliberate. Instant tooltips fire constantly while
// the pointer crosses a dense board and read as flicker; a short dwell means
// only a deliberate hover surfaces one. Closing is immediate.
const OPEN_DELAY = 400

export default function Tooltip({ content, children, placement = 'top', maxWidth = 200, className = '' }) {
  const [pos, setPos] = useState(null)
  const timer = useRef(null)
  const ref = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const open = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Flip below when there isn't room above. Without this, anything near
      // the top of the window — the whole top bar — opens its tooltip off
      // the top of the viewport, i.e. invisibly.
      const ROOM_NEEDED = 60
      const openBelow = placement === 'bottom' || r.top < ROOM_NEEDED
      // Keep the body on screen horizontally too, so a control at either edge
      // doesn't push its tooltip out of view.
      const half = Math.min(maxWidth, 240) / 2
      const left = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8)
      setPos(
        openBelow
          ? { left, top: r.bottom + 6, flip: false }
          : { left, top: r.top - 6, flip: true },
      )
    }, OPEN_DELAY)
  }, [placement, maxWidth])

  const close = useCallback(() => {
    clearTimeout(timer.current)
    setPos(null)
  }, [])

  if (!content) return children

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        className={`inline-flex ${className}`}
      >
        {children}
      </span>
      {pos && (
        <div
          role="tooltip"
          className="tooltip-pop"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            transform: `translate(-50%, ${pos.flip ? '-100%' : '0'})`,
            maxWidth,
            zIndex: 200,
            background: 'rgba(6,13,26,0.95)',
            border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 3,
            padding: '6px 10px',
            fontFamily: '"IBM Plex Mono", Menlo, Monaco, Consolas, monospace',
            fontSize: 10,
            lineHeight: 1.5,
            color: '#E8EDF5',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
          }}
        >
          {content}
        </div>
      )}
    </>
  )
}
