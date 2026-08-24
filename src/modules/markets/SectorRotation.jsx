import { useMemo } from 'react'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'

// Sector-level momentum, averaged from the tracked demo stock universe (the
// same dataset Screener uses) — a live per-sector index feed isn't wired
// into this app, so this reads as a snapshot of the current demo dataset
// rather than a real institutional-flow signal.
export default function SectorRotation() {
  const bySector = useMemo(() => {
    const all = [...Object.values(MOCK_ASX_STOCKS), ...Object.values(MOCK_US_STOCKS)]
    const totals = {}
    for (const s of all) {
      if (!s.sector) continue
      totals[s.sector] ??= { sum: 0, n: 0 }
      totals[s.sector].sum += s.changePct
      totals[s.sector].n += 1
    }
    return Object.entries(totals)
      .map(([sector, { sum, n }]) => ({ sector, avgPct: sum / n }))
      .sort((a, b) => b.avgPct - a.avgPct)
  }, [])

  if (!bySector.length) return null
  const gaining = bySector.filter((s) => s.avgPct > 0).slice(0, 4)
  const losing  = bySector.filter((s) => s.avgPct <= 0).slice(-4).reverse()

  return (
    <div className="flex-shrink-0 border-b border-terminal-border px-3 py-2">
      <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">
        SECTOR ROTATION — 1D MOMENTUM <span className="text-terminal-text-dim/50 font-normal normal-case ml-1">demo dataset snapshot</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-2xs text-terminal-green/80 mb-1">↑ GAINING MOMENTUM</div>
          <div className="flex flex-wrap gap-1.5">
            {gaining.length === 0 && <span className="text-2xs text-terminal-text-dim/50">None today</span>}
            {gaining.map((s) => (
              <span key={s.sector} className="text-2xs px-2 py-0.5 bg-terminal-green/10 border border-terminal-green/30 text-terminal-green">
                {s.sector} {s.avgPct >= 0 ? '+' : ''}{s.avgPct.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-2xs text-terminal-red/80 mb-1">↓ LOSING MOMENTUM</div>
          <div className="flex flex-wrap gap-1.5">
            {losing.length === 0 && <span className="text-2xs text-terminal-text-dim/50">None today</span>}
            {losing.map((s) => (
              <span key={s.sector} className="text-2xs px-2 py-0.5 bg-terminal-red/10 border border-terminal-red/30 text-terminal-red">
                {s.sector} {s.avgPct.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      </div>
      {gaining.length > 0 && losing.length > 0 && (
        <div className="mt-2 text-2xs text-terminal-text-dim/70">
          ↑ {gaining[0].sector} ← money flowing in from ← ↓ {losing[0].sector}
        </div>
      )}
    </div>
  )
}
