import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { SECTOR_ABBR } from '../../data/sectorTaxonomy'
import { ASX_UNIVERSE, SECTOR_OF, useAsxUniverseQuotes } from './useAsxUniverse'
import { getMockFMPHistory } from '../../services/mockData'
import { fetchYFHistory, USING_MOCK_DATA } from '../../services/api'
import { DemoBadge } from '../../components/ui/ModuleStates'

// ─── Market internals ───────────────────────────────────────────────────────
//
// Health of the market underneath the index level, computed across the 72
// ASX names in the sector taxonomy. Every figure is arithmetic on each
// stock's own daily closes — the same series its chart draws — so nothing
// here is a typed-in breadth number.
//
// Why closes rather than the quote's fields: the demo quote's 52-week high
// and low are fixed multiples of price (×1.22 / ×0.78), so "at a 52-week
// high" could never be true. Highs, lows and moving averages all come from
// the series instead.
//
// VOLATILITY IS REALISED, NOT IMPLIED. There is no S&P/ASX 200 VIX (A-VIX)
// feed connected, so the gauge shows the ASX 200's 20-day realised
// volatility, annualised, and says so. The bands use the conventional
// read of a volatility index.

const UNIVERSE = ASX_UNIVERSE

const sma = (xs, n) => (xs.length >= n ? xs.slice(-n).reduce((s, v) => s + v, 0) / n : null)

// Advance/decline comes from today's QUOTES — the same % change every tile
// and table shows — so the count matches what the reader sees. Highs, lows
// and moving averages come from the daily closes.
function breadthFrom(quotes) {
  let adv = 0, dec = 0, flat = 0
  const bySector = {}
  for (const [sym, q] of Object.entries(quotes ?? {})) {
    const chg = q?.dayChangePct
    if (!Number.isFinite(chg)) continue
    const sec = (bySector[SECTOR_OF[sym]] ??= { adv: 0, dec: 0 })
    if (Math.abs(chg) < 0.05) flat++
    else if (chg > 0) { adv++; sec.adv++ }
    else { dec++; sec.dec++ }
  }
  return { adv, dec, flat, bySector }
}

function internalsFrom(seriesBySymbol) {
  let highs = 0, lows = 0
  const above = { 20: [0, 0], 50: [0, 0], 200: [0, 0] }
  for (const closes of Object.values(seriesBySymbol)) {
    if (!closes || closes.length < 2) continue
    const last = closes[closes.length - 1]
    const year = closes.slice(-252)
    if (last >= Math.max(...year) * 0.995) highs++
    if (last <= Math.min(...year) * 1.005) lows++
    for (const n of [20, 50, 200]) {
      const m = sma(closes, n)
      if (m == null) continue
      above[n][1]++
      if (last > m) above[n][0]++
    }
  }
  const pct = ([a, t]) => (t ? (a / t) * 100 : null)
  return { highs, lows, above20: pct(above[20]), above50: pct(above[50]), above200: pct(above[200]) }
}

function realisedVol(closes, n = 20) {
  if (!closes || closes.length < n + 1) return null
  const r = closes.slice(-(n + 1)).map((c, i, a) => (i ? Math.log(c / a[i - 1]) : null)).slice(1)
  const mean = r.reduce((s, v) => s + v, 0) / r.length
  const sd = Math.sqrt(r.reduce((s, v) => s + (v - mean) ** 2, 0) / (r.length - 1))
  return sd * Math.sqrt(252) * 100
}

const VOL_BANDS = [
  { max: 20, label: 'LOW', note: 'Calm — complacency risk', colour: '#2D8A50' },
  { max: 30, label: 'NORMAL', note: 'Typical market conditions', colour: '#C9A84C' },
  { max: Infinity, label: 'ELEVATED', note: 'Fear in the market', colour: '#A83232' },
]

function Stat({ label, children, sub }) {
  return (
    <div className="px-3 py-2.5 min-w-0">
      <div className="font-mono text-[8px] tracking-[0.18em] text-terminal-text-dim mb-1.5">{label}</div>
      {children}
      {sub && <div className="font-mono text-[9px] text-terminal-text-dim/70 mt-1">{sub}</div>}
    </div>
  )
}

function MaRow({ n, pct }) {
  if (pct == null) return null
  const colour = pct >= 50 ? 'var(--color-gain)' : 'var(--color-loss)'
  return (
    <div className="flex items-center gap-2 font-mono text-[10px]">
      <span className="w-14 text-terminal-text-dim">{n}-DAY</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(100,130,160,0.2)' }}>
        <div className="h-full" style={{ width: `${pct}%`, background: colour }} />
      </div>
      <span className="w-10 text-right tabular-nums" style={{ color: colour }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

export default function MarketInternals() {
  // Demo mode: the seeded series every stock chart in the app already shows.
  // Live mode: daily history per symbol, fetched once and cached.
  const { data: series } = useQuery({
    queryKey: ['marketInternals', USING_MOCK_DATA],
    queryFn: async () => {
      const entries = await Promise.all(UNIVERSE.map(async (sym) => {
        const rows = USING_MOCK_DATA
          ? getMockFMPHistory(sym, 260)
          : await fetchYFHistory(sym, { range: '1y', interval: '1d' }).catch(() => [])
        const closes = (rows ?? []).map((r) => r.close ?? r.price).filter((v) => Number.isFinite(v))
        return [sym, closes]
      }))
      return Object.fromEntries(entries)
    },
    staleTime: 15 * 60_000,
  })
  const { data: axjo } = useQuery({
    queryKey: ['internalsAxjo', USING_MOCK_DATA],
    queryFn: async () => {
      const rows = USING_MOCK_DATA ? getMockFMPHistory('^AXJO', 40) : await fetchYFHistory('^AXJO', { range: '3mo', interval: '1d' })
      return (rows ?? []).map((r) => r.close ?? r.price).filter((v) => Number.isFinite(v))
    },
    staleTime: 15 * 60_000,
  })

  const { data: quotesResult } = useAsxUniverseQuotes()
  const [showSectors, setShowSectors] = useState(false)
  const b = useMemo(() => breadthFrom(quotesResult?.data), [quotesResult])
  const m = useMemo(() => (series ? { ...internalsFrom(series), ...b } : null), [series, b])
  const vol = useMemo(() => realisedVol(axjo), [axjo])
  const band = vol != null ? VOL_BANDS.find((b) => vol < b.max) : null

  if (!m) {
    return <div className="px-3 py-3 text-2xs text-terminal-text-dim animate-pulse border-b border-terminal-border">COMPUTING MARKET INTERNALS…</div>
  }
  const total = m.adv + m.dec + m.flat || 1
  const ratio = m.dec ? m.adv / m.dec : null

  return (
    <div className="border-b border-terminal-border bg-terminal-panel">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-2">
        <span className="font-mono text-[10px] font-bold tracking-widest text-terminal-gold whitespace-nowrap">MARKET INTERNALS</span>
        <span className="font-mono text-[9px] text-terminal-text-dim whitespace-nowrap">{UNIVERSE.length} ASX stocks · computed from daily closes</span>
        {USING_MOCK_DATA && <span className="ml-auto"><DemoBadge /></span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-terminal-border/60">
        <Stat label="ADVANCE / DECLINE" sub={ratio != null ? `A/D ratio ${ratio.toFixed(2)} — ${ratio >= 1 ? 'more rising than falling' : 'more falling than rising'}` : null}>
          <button onClick={() => setShowSectors((v) => !v)} className="float-right font-mono text-[8px] tracking-widest text-terminal-gold/70 hover:text-terminal-gold -mt-5">
            {showSectors ? 'HIDE SECTORS' : 'BY SECTOR ▸'}
          </button>
          <div className="flex items-baseline gap-2 font-mono text-[11px] tabular-nums">
            <span style={{ color: 'var(--color-gain)' }}>▲ {m.adv}</span>
            <span className="text-terminal-text-dim">— {m.flat}</span>
            <span style={{ color: 'var(--color-loss)' }}>▼ {m.dec}</span>
          </div>
          <div className="flex h-1.5 mt-1.5 rounded-full overflow-hidden">
            <div style={{ width: `${(m.adv / total) * 100}%`, background: 'var(--color-gain)' }} />
            <div style={{ width: `${(m.flat / total) * 100}%`, background: 'rgba(100,130,160,0.5)' }} />
            <div style={{ width: `${(m.dec / total) * 100}%`, background: 'var(--color-loss)' }} />
          </div>
        </Stat>
        <Stat label="52-WEEK HIGHS / LOWS" sub="Within 0.5% of the 52-week extreme">
          <div className="flex items-baseline gap-4 font-mono tabular-nums">
            <span><b className="text-lg" style={{ color: 'var(--color-gain)' }}>{m.highs}</b> <span className="text-[9px] text-terminal-text-dim">HIGHS</span></span>
            <span><b className="text-lg" style={{ color: 'var(--color-loss)' }}>{m.lows}</b> <span className="text-[9px] text-terminal-text-dim">LOWS</span></span>
          </div>
        </Stat>
        <Stat label="ABOVE MOVING AVERAGE">
          <div className="space-y-1">
            <MaRow n={200} pct={m.above200} />
            <MaRow n={50} pct={m.above50} />
            <MaRow n={20} pct={m.above20} />
          </div>
        </Stat>
        <Stat label="ASX 200 REALISED VOL (20D)" sub={band ? `${band.note} · 0–20 low · 20–30 normal · 30+ elevated` : 'Not enough history'}>
          <div className="flex items-baseline gap-2 font-mono">
            <b className="text-lg tabular-nums" style={{ color: band?.colour ?? '#8BA3C4' }}>{vol != null ? vol.toFixed(1) : '—'}</b>
            {band && <span className="text-[9px] font-bold tracking-widest" style={{ color: band.colour }}>{band.label}</span>}
          </div>
          <div className="font-mono text-[8px] text-terminal-text-dim/60 mt-0.5">Annualised · no implied-vol (A-VIX) feed connected</div>
        </Stat>
      </div>
      {showSectors && (
        <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          {Object.entries(m.bySector)
            .map(([sector, v]) => ({ sector, ...v, pct: v.adv + v.dec ? (v.adv / (v.adv + v.dec)) * 100 : 0 }))
            .sort((x, y) => y.pct - x.pct)
            .map((s) => (
              <div key={s.sector} className="flex items-center gap-2 font-mono text-[10px]">
                <span className="w-28 truncate text-terminal-text-dim">{SECTOR_ABBR[s.sector] ?? s.sector}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--color-loss)' }}>
                  <div style={{ width: `${s.pct}%`, background: 'var(--color-gain)' }} />
                </div>
                <span className="w-8 text-right tabular-nums" style={{ color: 'var(--color-gain)' }}>▲{s.adv}</span>
                <span className="w-8 text-right tabular-nums" style={{ color: 'var(--color-loss)' }}>▼{s.dec}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
