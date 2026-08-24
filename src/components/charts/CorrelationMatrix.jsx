import { useMemo, useState } from 'react'

// Top 10 ASX stocks with a rough GICS sector tag, used to derive plausible
// mock correlations: same-sector pairs run 0.6-0.9, cross-sector -0.3 to
// 0.4, with a couple of hand-picked real-world pairs (BHP/RIO, BHP/CBA)
// pinned to specific values as sanity anchors.
const STOCKS = [
  { sym: 'BHP', sector: 'Materials' },
  { sym: 'RIO', sector: 'Materials' },
  { sym: 'FMG', sector: 'Materials' },
  { sym: 'CBA', sector: 'Financials' },
  { sym: 'NAB', sector: 'Financials' },
  { sym: 'WBC', sector: 'Financials' },
  { sym: 'CSL', sector: 'Health Care' },
  { sym: 'WES', sector: 'Cons Disc' },
  { sym: 'WOW', sector: 'Cons Staples' },
  { sym: 'TLS', sector: 'Comms' },
]

const PINNED = {
  'BHP|RIO': 0.84,
  'BHP|CBA': 0.21,
}

function hashPair(a, b) {
  let h = 0
  const s = a < b ? a + b : b + a
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h % 1000) / 1000 // 0..1 deterministic pseudo-random
}

function correlationFor(a, b) {
  if (a.sym === b.sym) return 1
  const key1 = `${a.sym}|${b.sym}`, key2 = `${b.sym}|${a.sym}`
  if (PINNED[key1] != null) return PINNED[key1]
  if (PINNED[key2] != null) return PINNED[key2]
  const rnd = hashPair(a.sym, b.sym)
  if (a.sector === b.sector) return 0.6 + rnd * 0.3          // 0.6 .. 0.9
  return -0.3 + rnd * 0.7                                     // -0.3 .. 0.4
}

function strengthLabel(r) {
  const abs = Math.abs(r)
  const dir = r >= 0 ? 'positive' : 'negative'
  if (abs >= 0.7) return `Strong ${dir}`
  if (abs >= 0.4) return `Moderate ${dir}`
  if (abs >= 0.15) return `Weak ${dir}`
  return 'No correlation'
}

// Deep blue (r=+1) -> white (r=0) -> deep red (r=-1)
function cellColor(r) {
  const t = Math.max(-1, Math.min(1, r))
  if (t >= 0) {
    const c = Math.round(255 - t * (255 - 30))
    return `rgb(${c}, ${Math.round(255 - t * (255 - 90))}, 255)`
  }
  const c = Math.round(255 - (-t) * (255 - 30))
  return `rgb(255, ${Math.round(255 - (-t) * (255 - 60))}, ${c})`
}

export default function CorrelationMatrix() {
  const [hovered, setHovered] = useState(null) // { a, b, r }

  const matrix = useMemo(() => {
    return STOCKS.map((a) => STOCKS.map((b) => ({ a, b, r: correlationFor(a, b) })))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        <span>ASX CORRELATION MATRIX · 30D</span>
        <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case">DEMO — synthetic, sector-weighted</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div className="inline-block">
          <div className="flex">
            <div style={{ width: 44 }} />
            {STOCKS.map((s) => (
              <div key={s.sym} style={{ width: 40 }} className="text-2xs text-terminal-text-dim text-center font-bold">{s.sym}</div>
            ))}
          </div>
          {matrix.map((row, i) => (
            <div key={STOCKS[i].sym} className="flex items-center">
              <div style={{ width: 44 }} className="text-2xs text-terminal-text-dim font-bold text-right pr-2">{STOCKS[i].sym}</div>
              {row.map((cell) => (
                <div
                  key={cell.b.sym}
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ width: 40, height: 32, background: cellColor(cell.r) }}
                  className="flex items-center justify-center text-2xs font-mono font-bold cursor-pointer border border-terminal-bg/40 hover:outline hover:outline-1 hover:outline-terminal-gold"
                >
                  <span style={{ color: Math.abs(cell.r) > 0.55 ? '#fff' : '#0a1220' }}>{cell.r.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-terminal-border flex-shrink-0 text-2xs" style={{ minHeight: 34 }}>
        {hovered ? (
          <span className="text-terminal-text-bright">
            {hovered.a.sym} and {hovered.b.sym}: r={hovered.r.toFixed(2)} ({strengthLabel(hovered.r)})
          </span>
        ) : (
          <span className="text-terminal-text-dim">Hover a cell for the exact coefficient and interpretation.</span>
        )}
      </div>
    </div>
  )
}
