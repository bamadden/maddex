import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { dashboardService } from '../../services/dashboardService'

const CATEGORY_COLOUR = {
  Markets: '#4A9EDB', Portfolio: '#2D8A50', AI: '#8C8CFF', Global: '#C9A84C',
  Calendar: '#C87832', News: '#A8A8B8', Tools: '#4ADBD0', Crypto: '#D9A441', Macro: '#7BE495',
}

export default function WidgetPicker({ at, onClose, onAdded }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const catalogue = dashboardService.getCatalogue()

  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(catalogue.map((w) => w.category)))],
    [catalogue],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalogue.filter((w) => {
      if (category !== 'ALL' && w.category !== category) return false
      if (!q) return true
      return w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)
    })
  }, [catalogue, category, query])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = (id) => {
    dashboardService.addWidget(id, at?.col, at?.row)
    onAdded?.()
    onClose()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add widget"
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 3000, background: 'rgba(2,6,12,0.72)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '92vw', maxHeight: '70vh',
          background: '#0B1628',
          border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 4,
          display: 'flex', flexDirection: 'column',
          animation: 'modalPanelIn .18s ease-out',
        }}
      >
        <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '12px 16px', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: '#C9A84C' }}>ADD WIDGET</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#637899', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div className="flex-shrink-0" style={{ padding: '12px 16px 8px' }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search widgets…"
            className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 font-mono text-[11px] text-terminal-text-bright outline-none focus:border-terminal-gold"
          />
          <div className="flex gap-1 mt-2 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`font-mono text-[8px] tracking-widest px-2 py-1 rounded-sm transition-colors ${
                  category === c ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
                }`}
                style={category === c ? undefined : { border: '1px solid rgba(201,168,76,0.15)' }}
              >{c.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div className="thin-scrollbar" style={{ overflowY: 'auto', padding: '4px 16px 16px', minHeight: 0 }}>
          {results.length === 0 ? (
            <div className="font-sans text-[11px] py-6 text-center" style={{ color: '#4A6080' }}>
              No widgets match “{query}”
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {results.map((w) => (
                <button
                  key={w.id}
                  onClick={() => add(w.id)}
                  className="dash-widget-card text-left"
                  style={{
                    background: 'rgba(201,168,76,0.04)',
                    border: '1px solid rgba(201,168,76,0.1)',
                    borderRadius: 3,
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="inline-block font-mono mb-1.5"
                    style={{
                      fontSize: 8, letterSpacing: '0.12em', padding: '1px 5px', borderRadius: 2,
                      color: CATEGORY_COLOUR[w.category] ?? '#8BA3C4',
                      background: `${CATEGORY_COLOUR[w.category] ?? '#8BA3C4'}1A`,
                    }}
                  >{w.category.toUpperCase()}</span>
                  <div className="font-mono font-bold mb-0.5" style={{ fontSize: 12, color: '#E8EDF5' }}>{w.name}</div>
                  <div className="font-sans leading-snug" style={{ fontSize: 11, color: '#637899' }}>{w.description}</div>
                  <div className="font-mono mt-1.5" style={{ fontSize: 9, color: '#4A6080' }}>{w.minW}×{w.minH}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
