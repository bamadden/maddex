import { useRef, useState } from 'react'

const SNAP_MARGIN = 40
const TOP_OFFSET = 0 // snap zones fill the viewport; the window's own z-index already sits above TopBar/TickerTape

// Given a pointer position, returns the snap zone rect it's hovering (or
// null) — Windows-style: corners for quadrants, edges for halves, top edge
// for maximise.
function resolveSnapZone(x, y) {
  const w = window.innerWidth
  const h = window.innerHeight
  const nearLeft = x < SNAP_MARGIN
  const nearRight = x > w - SNAP_MARGIN
  const nearTop = y < SNAP_MARGIN
  const nearBottom = y > h - SNAP_MARGIN

  if (nearLeft && nearTop) return { x: 0, y: TOP_OFFSET, w: w / 2, h: (h - TOP_OFFSET) / 2 }
  if (nearRight && nearTop) return { x: w / 2, y: TOP_OFFSET, w: w / 2, h: (h - TOP_OFFSET) / 2 }
  if (nearLeft && nearBottom) return { x: 0, y: TOP_OFFSET + (h - TOP_OFFSET) / 2, w: w / 2, h: (h - TOP_OFFSET) / 2 }
  if (nearRight && nearBottom) return { x: w / 2, y: TOP_OFFSET + (h - TOP_OFFSET) / 2, w: w / 2, h: (h - TOP_OFFSET) / 2 }
  if (nearLeft) return { x: 0, y: TOP_OFFSET, w: w / 2, h: h - TOP_OFFSET }
  if (nearRight) return { x: w / 2, y: TOP_OFFSET, w: w / 2, h: h - TOP_OFFSET }
  if (nearTop) return { x: 0, y: TOP_OFFSET, w, h: h - TOP_OFFSET } // maximise
  return null
}

const RESIZE_HANDLES = [
  { edges: ['n'],      style: { top: 0, left: 8, right: 8, height: 6, cursor: 'ns-resize' } },
  { edges: ['s'],      style: { bottom: 0, left: 8, right: 8, height: 6, cursor: 'ns-resize' } },
  { edges: ['w'],      style: { left: 0, top: 8, bottom: 8, width: 6, cursor: 'ew-resize' } },
  { edges: ['e'],      style: { right: 0, top: 8, bottom: 8, width: 6, cursor: 'ew-resize' } },
  { edges: ['n', 'w'], style: { top: 0, left: 0, width: 10, height: 10, cursor: 'nwse-resize' } },
  { edges: ['n', 'e'], style: { top: 0, right: 0, width: 10, height: 10, cursor: 'nesw-resize' } },
  { edges: ['s', 'w'], style: { bottom: 0, left: 0, width: 10, height: 10, cursor: 'nesw-resize' } },
  { edges: ['s', 'e'], style: { bottom: 0, right: 0, width: 10, height: 10, cursor: 'nwse-resize' } },
]

// Draggable/resizable floating panel used by the multi-window mode — any
// module can be popped out into one of these via its ModuleHeader button.
// Position/size are local to the window instance (not persisted); closing
// and re-opening starts fresh, same as most terminal/IDE "detach" patterns.
//
// Supports Windows-style edge/corner snapping while dragging (drag near a
// screen edge to see the target zone highlighted; release to snap) and
// resize handles on all 4 edges + 4 corners, plus a maximise toggle that
// remembers the pre-maximise geometry to restore.
export function FloatingWindow({ title, children, onClose, defaultPos, zIndex = 1000, onFocus }) {
  const [pos, setPos] = useState(defaultPos || { x: 100, y: 100 })
  const [size, setSize] = useState({ w: 600, h: 420 })
  const [minimised, setMinimised] = useState(false)
  const [maximised, setMaximised] = useState(false)
  const [snapPreview, setSnapPreview] = useState(null)
  const preMaximise = useRef(null)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const resizeStartRef = useRef(null)

  const toggleMaximise = () => {
    onFocus?.()
    if (maximised) {
      if (preMaximise.current) {
        setPos(preMaximise.current.pos)
        setSize(preMaximise.current.size)
      }
      setMaximised(false)
    } else {
      preMaximise.current = { pos, size }
      setPos({ x: 0, y: TOP_OFFSET })
      setSize({ w: window.innerWidth, h: window.innerHeight - TOP_OFFSET })
      setMaximised(true)
    }
  }

  const onDragMouseDown = (e) => {
    onFocus?.()
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    const onMove = (ev) => {
      if (!dragging.current) return
      if (maximised) setMaximised(false)
      setPos({
        x: Math.max(0, ev.clientX - offset.current.x),
        y: Math.max(0, ev.clientY - offset.current.y),
      })
      setSnapPreview(resolveSnapZone(ev.clientX, ev.clientY))
    }
    const onUp = (ev) => {
      dragging.current = false
      const zone = resolveSnapZone(ev.clientX, ev.clientY)
      if (zone) {
        preMaximise.current = { pos, size }
        setPos({ x: zone.x, y: zone.y })
        setSize({ w: zone.w, h: zone.h })
        setMaximised(zone.w === window.innerWidth)
      }
      setSnapPreview(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const onResizeMouseDown = (edges) => (e) => {
    e.stopPropagation()
    onFocus?.()
    if (maximised) setMaximised(false)
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, posX: pos.x, posY: pos.y }
    const onMove = (ev) => {
      const s = resizeStartRef.current
      if (!s) return
      const dx = ev.clientX - s.x
      const dy = ev.clientY - s.y
      let w = s.w, h = s.h, posX = s.posX, posY = s.posY
      if (edges.includes('e')) w = Math.max(320, s.w + dx)
      if (edges.includes('s')) h = Math.max(220, s.h + dy)
      if (edges.includes('w')) { w = Math.max(320, s.w - dx); posX = s.posX + (s.w - w) }
      if (edges.includes('n')) { h = Math.max(220, s.h - dy); posY = s.posY + (s.h - h) }
      setSize({ w, h })
      if (edges.includes('w') || edges.includes('n')) setPos({ x: posX, y: posY })
    }
    const onUp = () => {
      resizeStartRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <>
      {snapPreview && (
        <div
          style={{
            position: 'fixed', left: snapPreview.x, top: snapPreview.y,
            width: snapPreview.w, height: snapPreview.h,
            background: 'rgba(201,168,76,0.18)', border: '2px solid rgba(201,168,76,0.6)',
            zIndex: 9998, pointerEvents: 'none',
          }}
        />
      )}
      <div
        onMouseDown={onFocus}
        style={{
          position: 'fixed', left: pos.x, top: pos.y,
          width: size.w, height: minimised ? 36 : size.h,
          background: '#0B1628', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: maximised ? 0 : '4px', zIndex,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div
          onMouseDown={onDragMouseDown}
          onDoubleClick={toggleMaximise}
          style={{
            height: 36, background: '#060D1A',
            borderBottom: '1px solid rgba(201,168,76,0.15)',
            display: 'flex', alignItems: 'center',
            padding: '0 12px', cursor: 'grab', flexShrink: 0,
            userSelect: 'none',
          }}
        >
          <span style={{ color: '#4A6080', marginRight: 8, fontSize: 11, letterSpacing: 2 }}>⋮⋮</span>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#C9A84C', flex: 1, letterSpacing: '0.15em' }}>
            {title}
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setMinimised((m) => !m)}
            style={{ background: 'none', border: 'none', color: '#637899', cursor: 'pointer', marginRight: 8, fontSize: 12 }}
            title={minimised ? 'Restore' : 'Minimise'}
          >
            {minimised ? '□' : '─'}
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMaximise}
            style={{ background: 'none', border: 'none', color: maximised ? '#C9A84C' : '#637899', cursor: 'pointer', marginRight: 8, fontSize: 12 }}
            title={maximised ? 'Restore' : 'Maximise'}
          >
            {maximised ? '❐' : '□'}
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#637899', cursor: 'pointer', fontSize: 12 }}
            title="Close"
          >
            ✕
          </button>
        </div>
        {!minimised && (
          <>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {children}
            </div>
            {!maximised && RESIZE_HANDLES.map((h, i) => (
              <div
                key={i}
                onMouseDown={onResizeMouseDown(h.edges)}
                title="Resize"
                style={{ position: 'absolute', ...h.style }}
              />
            ))}
          </>
        )}
      </div>
    </>
  )
}
