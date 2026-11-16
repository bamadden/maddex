import { useEffect, useRef } from 'react'
import { datasetById } from '../../data/registry'
import { STATE_TEXT } from '../../utils/dataHealth'
import { formatDate } from '../../utils/dateUtils'
import { PAL } from '../../styles/palette.js'

const CLASS_LABEL = { official: 'OFFICIAL', market: 'MARKET', derived: 'DERIVED', editorial: 'EDITORIAL', demo: 'DEMO' }
const ORDER = { past: 0, undated: 1, current: 2, demo: 3 }

// Every dataset a module shows, from the registry: what it is, its class and
// source, its as-of date against its maximum age, and what a reader sees when
// it cannot be shown fresh.
export default function DataHealthPanel({ rows, summary, onClose }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  const sorted = [...rows].sort((a, b) => ORDER[a.state] - ORDER[b.state])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Data health"
      tabIndex={-1}
      className="absolute right-0 top-8 z-50 w-[min(420px,calc(100vw-32px))] max-h-[70vh] overflow-y-auto font-sans outline-none"
      style={{ background: PAL.panel, border: '1px solid rgba(201,168,76,0.3)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
      data-health-panel
    >
      <div className="flex items-center px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="font-mono font-bold tracking-widest" style={{ fontSize: 11, color: PAL.gold }}>DATA HEALTH</span>
        <span className="ml-2 truncate" style={{ fontSize: 11, color: PAL.muted }}>{summary}</span>
        <button type="button" onClick={onClose} aria-label="Close data health" className="ml-auto px-2 min-h-[24px]" style={{ color: PAL.muted, fontSize: 14 }}>×</button>
      </div>
      <ul>
        {sorted.map((r) => {
          const d = datasetById[r.id]
          const flagged = r.state === 'past' || r.state === 'undated'
          return (
            <li key={r.id} className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} data-dataset={r.id} data-state={r.state}>
              <div className="flex items-baseline gap-2">
                <span className="text-terminal-text" style={{ fontSize: 12 }}>{d?.what ?? r.id}</span>
                <span className="ml-auto font-mono flex-shrink-0" style={{ fontSize: 11, letterSpacing: '0.08em', color: PAL.muted }}>{CLASS_LABEL[r.cls]}</span>
              </div>
              <div style={{ fontSize: 11, color: PAL.muted }}>
                {d?.source?.url ? <a href={d.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-terminal-text">{d.source.name}</a> : d?.source?.name}
              </div>
              <div style={{ fontSize: 11, color: flagged ? PAL.amber : PAL.muted }}>
                {r.asOf ? `As of ${formatDate(r.asOf)} · ${r.age} of ${r.maxAgeDays} days · ` : ''}{STATE_TEXT[r.state]}
              </div>
              {flagged && d?.fallback && <div style={{ fontSize: 11, color: PAL.muted }}>{d.fallback}</div>}
            </li>
          )
        })}
      </ul>
      <div className="px-3 py-2" style={{ fontSize: 11, color: PAL.muted }}>
        Every figure in Maddex belongs to one of these datasets, with its source, licence and maximum age.
      </div>
    </div>
  )
}
