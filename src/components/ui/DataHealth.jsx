import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { moduleHealth } from '../../utils/dataHealth'
import { PAL } from '../../styles/palette.js'

// The panel loads the full registry (sources, licences, fallbacks) only when
// opened; the button needs just the generated dates.
const DataHealthPanel = lazy(() => import('./DataHealthPanel'))

// "DATA" in a module header: how many of the module's datasets are within
// their maximum age, and a list of each with its source and as-of date.
export default function DataHealth({ moduleId }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  const { rows, attention, total } = moduleHealth(moduleId)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [open])

  if (!total) return null
  const colour = attention ? PAL.amber : PAL.dim
  const summary = attention
    ? `${attention} of ${total} datasets need attention`
    : `All ${total} datasets within their maximum age`
  return (
    <div ref={wrap} className="relative flex-shrink-0 ml-3" data-health={attention ? 'attention' : 'ok'}>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Data health: ${summary}`}
        title={summary}
        className="flex items-center gap-1.5 h-6 px-2 font-mono font-bold whitespace-nowrap transition-colors hover:bg-white/5"
        style={{ fontSize: 11, letterSpacing: '0.1em', color: colour, border: `1px solid ${colour}55` }}
      >
        <span aria-hidden="true">●</span>DATA{attention ? ` ${attention}` : ''}
      </button>
      {open && (
        <Suspense fallback={<div className="absolute right-0 top-8 z-50 px-3 py-2 text-2xs" style={{ background: PAL.panel, color: PAL.muted }}>Loading…</div>}>
          <DataHealthPanel moduleId={moduleId} rows={rows} summary={summary} onClose={() => { setOpen(false); btn.current?.focus() }} />
        </Suspense>
      )}
    </div>
  )
}
