import { useRef, useState } from 'react'

// Draggable/resizable floating panel used by the multi-window mode — any
// module can be popped out into one of these via its ModuleHeader button.
// Position/size are local to the window instance (not persisted); closing
// and re-opening starts fresh, same as most terminal/IDE "detach" patterns.
export function FloatingWindow({ title, children, onClose, defaultPos, zIndex = 1000, onFocus }) {
  const [pos, setPos] = useState(defaultPos || { x: 100, y: 100 })
  const [size, setSize] = useState({ w: 600, h: 420 })
  const [minimised, setMinimised] = useState(false)
  const dragging = useRef(false)
  const resizing = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const onDragMouseDown = (e) => {
    onFocus?.()
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    const onMove = (ev) => {
      if (!dragging.current) return
      setPos({
        x: Math.max(0, ev.clientX - offset.current.x),
        y: Math.max(0, ev.clientY - offset.current.y),
      })
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const onResizeMouseDown = (e) => {
    e.stopPropagation()
    onFocus?.()
    resizing.current = true
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    const onMove = (ev) => {
      if (!resizing.current) return
      setSize({
        w: Math.max(320, resizeStart.current.w + (ev.clientX - resizeStart.current.x)),
        h: Math.max(220, resizeStart.current.h + (ev.clientY - resizeStart.current.y)),
      })
    }
    const onUp = () => {
      resizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={onFocus}
      style={{
        position: 'fixed', left: pos.x, top: pos.y,
        width: size.w, height: minimised ? 36 : size.h,
        background: '#0B1628', border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: '4px', zIndex,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        onMouseDown={onDragMouseDown}
        style={{
          height: 36, background: '#060D1A',
          borderBottom: '1px solid rgba(201,168,76,0.15)',
          display: 'flex', alignItems: 'center',
          padding: '0 12px', cursor: 'grab', flexShrink: 0,
          userSelect: 'none',
        }}
      >
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
          <div
            onMouseDown={onResizeMouseDown}
            title="Resize"
            style={{
              position: 'absolute', right: 0, bottom: 0, width: 16, height: 16,
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 50%, rgba(201,168,76,0.35) 50%)',
            }}
          />
        </>
      )}
    </div>
  )
}
