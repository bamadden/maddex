import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASX_SECTOR_STOCKS } from '../../data/sectorTaxonomy'
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

const UNIVERSE = Object.values(ASX_SECTOR_STOCKS).flat().map(([sym]) => sym)

const sma = (xs, n) => (xs.length >= n ? xs.slice(-n).reduce((s, v) => s + v, 0) / n : null)

function internalsFrom(seriesBySymbol) {
  let adv = 0, dec = 0, flat = 0, highs = 0, lows = 0
  const above = { 20: [0, 0], 50: [0, 0], 200: [0, 0] }
  for (const closes of Object.values(seriesBySymbol)) {
    if (!closes || closes.length < 2) continue
    const last = closes[closes.length - 1], prev = closes[closes.length - 2]
    const chg = (last - prev) / prev
    if (Math.abs(chg) < 0.0005) flat++
    else if (chg > 0) adv++
    else dec++
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
  return { adv, dec, flat, highs, lows, above20: pct(above[20]), above50: pct(above[50]), above200: pct(above[200]) }
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

  const m = useMemo(() => (series ? internalsFrom(series) : null), [series])
  const vol = useMemo(() => realisedVol(axjo), [axjo])
  const band = vol != null ? VOL_BANDS.find((b) => vol < b.max) : null

  if (!m) {
    return <div className="px-3 py-3 text-2xs text-terminal-text-dim animate-pulse border-b border-terminal-border">COMPUTING MARKET INTERNALS…</div>
  }
  const total = m.adv + m.dec + m.flat || 1
  const ratio = m.dec ? m.adv / m.dec : null

  return (
    <div className="border-b border-terminal-border bg-terminal-panel">
      <div className="flex items-center gap-2 px-3 pt-2">
        <span className="font-mono text-[10px] font-bold tracking-widest text-terminal-gold">MARKET INTERNALS</span>
        <span className="font-mono text-[9px] text-terminal-text-dim">{UNIVERSE.length} ASX stocks · computed from daily closes</span>
        {USING_MOCK_DATA && <span className="ml-auto"><DemoBadge /></span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-terminal-border/60">
        <Stat label="ADVANCE / DECLINE" sub={ratio != null ? `A/D ratio ${ratio.toFixed(2)} — ${ratio >= 1 ? 'more rising than falling' : 'more falling than rising'}` : null}>
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
    </div>
  )
}
