import { useState, useRef, useLayoutEffect, useCallback } from 'react'

// Tab bar with a single sliding underline.
//
// One gold line that animates between tabs, rather than each tab owning its
// own bottom border. The moving line carries the eye from the old selection
// to the new one, so the change reads as navigation rather than as two
// separate things blinking.
//
// tabs: array of { key, label } or plain strings.
// Measured with useLayoutEffect so the indicator is correct on first paint
// (a useEffect would show it at 0,0 for a frame). Re-measures on container
// resize, since label widths shift with the panel.
export default function TabBar({ tabs, activeKey, onChange, className = '', size = 10 }) {
  const items = tabs.map((t) => (typeof t === 'string' ? { key: t, label: t } : t))
  const activeIndex = Math.max(0, items.findIndex((t) => t.key === activeKey))
  const [line, setLine] = useState({ left: 0, width: 0 })
  const refs = useRef([])
  const wrapRef = useRef(null)

  const measure = useCallback(() => {
    const el = refs.current[activeIndex]
    if (el) setLine({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeIndex])

  useLayoutEffect(() => {
    measure()
    if (typeof ResizeObserver === 'undefined' || !wrapRef.current) return
    const ro = new ResizeObserver(measure)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [measure, items.length])

  return (
    <div ref={wrapRef} className={`relative flex-shrink-0 ${className}`}>
      <div className="flex" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        {items.map((tab, i) => {
          const isActive = i === activeIndex
          return (
            <button
              key={tab.key}
              ref={(el) => { refs.current[i] = el }}
              onClick={() => onChange?.(tab.key)}
              aria-current={isActive ? 'true' : undefined}
              className="whitespace-nowrap"
              style={{
                padding: '8px 16px',
                fontFamily: '"IBM Plex Mono", Menlo, Monaco, Consolas, monospace',
                fontSize: size,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#C9A84C' : '#4A6080',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          height: 2,
          background: '#C9A84C',
          left: line.left,
          width: line.width,
          transition: 'left 0.2s ease, width 0.2s ease',
        }}
      />
    </div>
  )
}
