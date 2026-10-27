import { useMemo } from 'react'
import { getMockFMPHistory } from '../../services/mockData'
import { ASX_SECTOR_STOCKS } from '../../data/sectorTaxonomy'

// SECTOR ROTATION — four-week momentum by ASX sector.
//
// Computed from the demo daily closes of every name in the sector taxonomy:
// the 20-session return, equal-weighted across the sector's names, and
// whether the last two weeks ran ahead of or behind the two before
// (accelerating / decelerating). The demo series is simulated — only today's
// bar carries the scripted macro tilt — so this shows how the module will
// read once a live feed is connected, not where money is actually moving.
// The summary line is written from the numbers below, not by a model: a model
// asked to narrate demo data would narrate it as real.

const SHORT = {
  'Information Technology': 'Technology', 'Health Care': 'Healthcare', 'Real Estate': 'Property',
  'Consumer Discretionary': 'Cons Disc', 'Consumer Staples': 'Cons Staples', 'Communication Services': 'Comms',
}
const RISK_ON = new Set(['Materials', 'Energy', 'Technology'])
const RATE_SENSITIVE = new Set(['Property', 'Utilities', 'Financials', 'Cons Disc'])

const ret = (closes, from, to) => (closes[to] / closes[from] - 1) * 100

function sectorMomentum() {
  return Object.entries(ASX_SECTOR_STOCKS).map(([gics, rows]) => {
    const series = rows.map(([sym]) => getMockFMPHistory(sym, 21).map((b) => b.close)).filter((c) => c.length === 21)
    const avg = (f) => series.reduce((s, c) => s + f(c), 0) / series.length
    const fourWeek = avg((c) => ret(c, 0, 20))
    const recent = avg((c) => ret(c, 10, 20))
    const prior = avg((c) => ret(c, 0, 10))
    const diff = recent - prior
    return {
      sector: SHORT[gics] ?? gics,
      fourWeek,
      trend: diff > 0.75 ? 'accelerating' : diff < -0.75 ? 'decelerating' : 'stable',
      n: series.length,
    }
  }).filter((s) => s.n > 0).sort((a, b) => b.fourWeek - a.fourWeek)
}

function summary(rows) {
  const leaders = rows.slice(0, 2).map((r) => r.sector)
  const laggards = rows.slice(-2).map((r) => r.sector)
  const tone = leaders.every((s) => RISK_ON.has(s)) ? 'RISK-ON' : leaders.every((s) => !RISK_ON.has(s)) ? 'DEFENSIVE' : 'MIXED'
  const rateLag = laggards.filter((s) => RATE_SENSITIVE.has(s))
  return `Current rotation: ${tone} — ${leaders.join(' and ')} leading over four weeks; ${laggards.join(' and ')} lagging.`
    + (rateLag.length ? ` Rate-sensitive ${rateLag.join(' and ')} ${rateLag.length > 1 ? 'are' : 'is'} among the laggards.` : '')
}

const TREND = { accelerating: ['▲', '#2D8A50'], decelerating: ['▼', '#A83232'], stable: ['→', '#8BA3C4'] }

export default function SectorRotation() {
  const rows = useMemo(() => sectorMomentum(), [])
  if (!rows.length) return null
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.fourWeek)), 1)

  return (
    <div className="flex-shrink-0 border-b border-terminal-border px-3 py-2">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">SECTOR ROTATION — 4-WEEK MOMENTUM</span>
        <span className="text-[9px] font-bold px-1.5 border border-terminal-gold/50 text-terminal-gold">DEMO</span>
        <span className="text-2xs text-terminal-text-dim/60">equal-weighted, from simulated daily closes · trend = last 2 weeks vs prior 2</span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => {
          const [glyph, colour] = TREND[r.trend]
          const w = (Math.abs(r.fourWeek) / maxAbs) * 100
          return (
            <div key={r.sector} className="grid items-center gap-2 font-mono text-2xs" style={{ gridTemplateColumns: '96px 1fr 56px 110px' }}>
              <span className="text-terminal-text truncate">{r.sector}</span>
              <div className="h-2 bg-terminal-border/30 relative">
                <div className="absolute inset-y-0 left-0" style={{ width: `${w}%`, background: r.fourWeek >= 0 ? 'rgba(45,138,80,0.7)' : 'rgba(168,50,50,0.7)' }} />
              </div>
              <span className="text-right tabular-nums" style={{ color: r.fourWeek >= 0 ? '#2D8A50' : '#A83232' }}>
                {r.fourWeek >= 0 ? '+' : ''}{r.fourWeek.toFixed(1)}%
              </span>
              <span style={{ color: colour }}>{glyph} {r.trend}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-2xs text-terminal-text-dim">{summary(rows)} <span className="text-terminal-text-dim/50">Demo data — illustrates the read, not the market.</span></div>
    </div>
  )
}
