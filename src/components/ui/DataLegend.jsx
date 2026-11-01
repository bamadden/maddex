import { useEffect, useState } from 'react'
import { DATA_CLASSES, CLASS_ORDER } from '../../utils/dataClass'

// The data key: what LIVE, DELAYED, DEMO and STALE mean. Opened by any
// DataBadge, the status bar's DATA KEY button, or Help.
export default function DataLegend() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setOpen(true)
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('maddex:data-legend', on)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('maddex:data-legend', on); window.removeEventListener('keydown', esc) }
  }, [])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 px-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="data-key-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-terminal-panel border border-terminal-border p-4 font-mono">
        <div className="flex items-center justify-between mb-3">
          <h2 id="data-key-title" className="text-terminal-gold tracking-widest" style={{ fontSize: 12 }}>DATA KEY</h2>
          <button onClick={() => setOpen(false)} className="text-terminal-text-dim hover:text-terminal-text-bright px-2" aria-label="Close data key" autoFocus>✕</button>
        </div>
        <p className="font-sans text-terminal-text-dim mb-3" style={{ fontSize: 12 }}>
          Panels are labelled with one of four classes, their source and when the data was fetched or published (Sydney time). Panels not yet carrying a badge state their source in their own caption.
        </p>
        <dl className="space-y-2.5">
          {CLASS_ORDER.map((c) => (
            <div key={c} className="flex gap-3">
              <dt className="flex-shrink-0 w-20 font-semibold tracking-wider" style={{ fontSize: 11, color: DATA_CLASSES[c].colour }}>● {c}</dt>
              <dd className="font-sans text-terminal-text" style={{ fontSize: 12 }}>{DATA_CLASSES[c].meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="font-sans text-terminal-text-dim mt-3" style={{ fontSize: 11 }}>
          Official statistics (RBA, ABS) are published figures and carry their release date. General information only, not financial advice.
        </p>
      </div>
    </div>
  )
}
