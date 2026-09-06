import { useState, useMemo, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ASX_SECTOR_STOCKS, INDEX_SECTORS, INDEX_LABELS } from './SectorHeatmap'
import { getMockFMPRow, getMockFMPHistory } from '../../services/mockData'
import { fmt } from '../../utils/format'
import { dispatchAskAI } from '../../utils/askAI'
import { liveDataService } from '../../services/liveDataService'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { sectorDrivers } from './sectorDrivers'
import TabBar from '../../components/ui/TabBar'
import SafeChart from '../../components/ui/SafeChart'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { DemoBadge } from '../../components/ui/ModuleStates'
import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../../services/api'

const TABS = [
  { key: 'OVERVIEW', label: 'OVERVIEW' },
  { key: 'STOCKS', label: 'CONSTITUENTS' },
  { key: 'PERF', label: 'PERFORMANCE' },
  { key: 'DRIVERS', label: 'MACRO DRIVERS' },
  { key: 'ROTATION', label: 'ROTATION' },
]

// Keywords that identify a story as belonging to a sector. Word-boundary
// anchored: a bare substring match put "Port Moresby" in the shipping feed
// earlier in this project, and the same trap applies here — 'CBA' inside
// another word, or 'oil' inside 'spoiled'.
const SECTOR_NEWS_TERMS = {
  Materials: /\b(iron ore|mining|miner|BHP|Rio Tinto|Fortescue|copper|lithium|nickel|gold miner|commodit\w*)\b/i,
  Financials: /\b(bank|banks|banking|CBA|Westpac|NAB|ANZ|Macquarie|APRA|mortgage|lending|credit growth|insurer)\b/i,
  'Information Technology': /\b(tech|software|WiseTech|Xero|Altium|NextDC|data cent\w+|AI|cloud|semiconductor)\b/i,
  Energy: /\b(oil|crude|Brent|LNG|gas|Woodside|Santos|coal|OPEC|petroleum|energy)\b/i,
  'Health Care': /\b(health|CSL|pharma\w*|biotech|hospital|medical|vaccine|plasma|PBS)\b/i,
  'Consumer Discretionary': /\b(retail|retailer|consumer|Wesfarmers|Harvey Norman|JB Hi-Fi|spending|discretionary)\b/i,
  'Consumer Staples': /\b(Woolworths|Coles|grocer\w*|supermarket|staples|food price\w*)\b/i,
  'Real Estate': /\b(property|real estate|REIT|housing|Goodman|office|construction)\b/i,
  Utilities: /\b(utilit\w+|electricity|power price\w*|AGL|Origin|grid|renewab\w+)\b/i,
  Industrials: /\b(industrial|Transurban|Qantas|airline|freight|logistics|infrastructure)\b/i,
  'Communication Services': /\b(Telstra|telecom|media|REA Group|Seek|broadband|NBN)\b/i,
}

const PERF_PERIODS = [
  { key: 'w1', label: '1W', days: 5 },
  { key: 'm1', label: '1M', days: 21 },
  { key: 'm3', label: '3M', days: 63 },
  { key: 'm6', label: '6M', days: 126 },
  { key: 'y1', label: '1Y', days: 252 },
  { key: 'ytd', label: 'YTD', days: null },
]

// Trading days elapsed since 1 January, for the YTD column. Approximated at
// five weekdays a week rather than counting an exchange holiday calendar we
// do not have — and capped at the series length so a short history cannot
// silently return a change measured over the wrong window.
function ytdTradingDays(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 1)
  const weeks = (now - start) / (7 * 86400000)
  return Math.max(1, Math.round(weeks * 5))
}

// Momentum periods in trading days (roughly — 21/mo, 252/yr).
const MOMENTUM_PERIODS = [
  { key: 'w1', label: '1W', days: 5 },
  { key: 'm1', label: '1M', days: 21 },
  { key: 'm3', label: '3M', days: 63 },
  { key: 'm6', label: '6M', days: 126 },
  { key: 'y1', label: '1Y', days: 252 },
]

function pctChange(closes, daysBack) {
  if (closes.length < daysBack + 1) return null
  const cur = closes[closes.length - 1]
  const ref = closes[closes.length - 1 - daysBack]
  if (!ref) return null
  return (cur - ref) / ref * 100
}

// ASX-listed indices carry a full constituent-per-sector list; every other
// index only has a single proxy stock per sector (INDEX_SECTORS), so the
// STOCKS/ROTATION tabs there fall back to that one row — same "ASX only"
// convention SectorHeatmap.jsx uses for its own constituent chips.
function useSectorUniverse(sectorName, indexId) {
  return useMemo(() => {
    const isASX = indexId === '^AXJO' || indexId === '^AORD'
    if (isASX) return ASX_SECTOR_STOCKS[sectorName] ?? []
    const proxy = INDEX_SECTORS[indexId]?.[sectorName]
    return proxy ? [[proxy.sym, proxy.sym.replace(/\.(AX|L|DE|T|HK|NZ|SS)$/i, '')]] : []
  }, [sectorName, indexId])
}

function ChangeText({ v, className = '' }) {
  if (v == null) return <span className={`text-terminal-text-dim ${className}`}>—</span>
  const color = v >= 0 ? 'text-terminal-green' : 'text-terminal-red'
  return <span className={`${color} ${className}`}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="text-terminal-border ml-0.5">↕</span>
  return <span className="text-terminal-gold ml-0.5">{dir === 'asc' ? '↑' : '↓'}</span>
}

// ─── Macro drivers ────────────────────────────────────────────────────────────
//
// This tab used to be generated by Claude on every open, including five
// "recent, plausible" headlines per sector rendered under a RECENT NEWS
// heading. They were invented, indistinguishable from the real feed, and
// cached for a day so they looked stable enough to trust. The mechanism a
// driver describes is structural and now lives in sectorDrivers.js; the
// reading attached to it comes from a verified constant or a live feed, and
// says "not connected" when neither exists.

const TREND_GLYPH = { up: '▲', down: '▼', flat: '▬' }

function DriverRow({ driver }) {
  const r = driver.reading
  const trend = r?.trend ? TREND_GLYPH[r.trend] : null
  const trendCls = r?.trend === 'up' ? 'text-terminal-green'
    : r?.trend === 'down' ? 'text-terminal-red' : 'text-terminal-text-dim'

  return (
    <div className="border-b border-terminal-border/40 last:border-b-0 py-2.5 grid grid-cols-12 gap-3 items-start">
      <div className="col-span-12 sm:col-span-3">
        <div className="text-2xs font-bold text-terminal-text-bright">{driver.name}</div>
        {r?.source && (
          <div className="text-2xs text-terminal-text-dim/50 truncate">{r.source}</div>
        )}
      </div>

      <div className="col-span-5 sm:col-span-2">
        {r ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-terminal-gold tabular-nums">{r.value}</span>
              {trend && <span className={`text-2xs ${trendCls}`}>{trend}</span>}
            </div>
            <div className="text-2xs text-terminal-text-dim/50">
              {r.asOf === 'live' ? 'live' : `as at ${r.asOf}`}
            </div>
          </>
        ) : (
          <span className="text-2xs text-terminal-text-dim/40">no reading</span>
        )}
      </div>

      <div className="col-span-7 sm:col-span-7">
        <div className="text-2xs text-terminal-text leading-relaxed">{driver.impact}</div>
        {driver.note && (
          <div className="text-2xs text-terminal-text-dim/50 mt-0.5">{driver.note}</div>
        )}
      </div>
    </div>
  )
}

function DriversTab({ sectorName, fx }) {
  const drivers = useMemo(() => sectorDrivers(sectorName, { fx }), [sectorName, fx])
  const sourced = drivers.filter((d) => d.reading).length

  return (
    <div className="p-4 space-y-3">
      <div className="border border-terminal-border p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">
            WHAT DRIVES {sectorName.toUpperCase()}
          </span>
          <VerifiedBadge dataKey="rba" alwaysShow />
        </div>
        <div className="text-2xs text-terminal-text-dim leading-relaxed">
          The mechanisms below are structural and do not change day to day. Readings come
          from verified constants or live feeds — {sourced} of {drivers.length} carry one.
          A driver with no connected source shows no number rather than an estimate.
        </div>
      </div>

      <div className="border border-terminal-border px-3">
        {drivers.map((d) => <DriverRow key={d.name} driver={d} />)}
      </div>
    </div>
  )
}

// A stat with a comparison beneath it. The comparison is the point: a sector
// PE of 19 means nothing until you know the market trades at 19.2.
function StatCard({ label, value, compare, tone }) {
  return (
    <div className="border border-terminal-border p-2.5 min-w-0">
      <div className="text-2xs text-terminal-text-dim tracking-widest truncate">{label}</div>
      <div className={`text-base font-bold tabular-nums mt-0.5 ${tone ?? 'text-terminal-text-bright'}`}>{value}</div>
      {compare && <div className="text-2xs text-terminal-text-dim/60 truncate">{compare}</div>}
    </div>
  )
}

// Where the price sits in its 52-week range. Same primitive as the screener's,
// drawn small enough to sit inside a table row.
function Range52({ pos }) {
  if (pos == null) return <span className="text-terminal-text-dim/40">—</span>
  const p = Math.max(0, Math.min(100, pos))
  return (
    <div className="flex items-center gap-1.5" title={`${p.toFixed(0)}% of the 52-week range`}>
      <div className="relative w-12 h-1 bg-terminal-border/50 rounded-sm">
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-terminal-gold rounded-sm" style={{ left: `${p}%` }} />
      </div>
      <span className="text-terminal-text-dim tabular-nums w-6 text-right">{p.toFixed(0)}%</span>
    </div>
  )
}

export default function SectorDeepDive({ sectorName, indexId, openModal, onClose }) {
  const [tab, setTab] = useState('OVERVIEW')
  const [sortCol, setSortCol] = useState('mcap')
  const [sortDir, setSortDir] = useState('desc')
  const [perfPeriod, setPerfPeriod] = useState('m3')

  const universe = useSectorUniverse(sectorName, indexId)

  const rows = useMemo(() => (
    universe.map(([sym, name]) => {
      const q = getMockFMPRow(sym)
      if (!q) return null
      const hist = getMockFMPHistory(sym, 260)
      const closes = hist.map((h) => h.close)
      // 52-week position from the series actually held, rather than from a
      // high/low field the mock rows do not carry.
      const win = closes.slice(-252)
      const hi = win.length ? Math.max(...win) : null
      const lo = win.length ? Math.min(...win) : null
      const price = q.regularMarketPrice
      return {
        symbol: sym,
        name,
        price,
        d1: q.regularMarketChangePercent,
        w1: pctChange(closes, 5),
        m1: pctChange(closes, 21),
        m3: pctChange(closes, 63),
        m6: pctChange(closes, 126),
        y1: pctChange(closes, 252),
        ytd: pctChange(closes, ytdTradingDays()),
        pos52: hi != null && lo != null && hi > lo ? ((price - lo) / (hi - lo)) * 100 : null,
        mcap: q.marketCap,
        pe: q.trailingPE,
        yield: q.dividendYield,
        volume: q.regularMarketVolume,
      }
    }).filter(Boolean)
  ), [universe])

  const advances = rows.filter((r) => r.d1 > 0).length
  const declines = rows.filter((r) => r.d1 < 0).length
  const totalMcap = rows.reduce((s, r) => s + (r.mcap ?? 0), 0)
  const avgD1 = rows.length ? rows.reduce((s, r) => s + (r.d1 ?? 0), 0) / rows.length : null
  const indexLabel = INDEX_LABELS[indexId] ?? indexId

  // Sector weight, computed from each stock's share of sector market cap
  // rather than typed in. BHP lands high in Materials and CBA high in
  // Financials because that is what the caps say, not because a table said so
  // — and it cannot drift out of step with the rows above it.
  const weighted = useMemo(
    () => rows.map((r) => ({ ...r, weight: totalMcap > 0 ? ((r.mcap ?? 0) / totalMcap) * 100 : null })),
    [rows, totalMcap],
  )

  // Cap-weighted PE and yield — a simple mean would let a tiny high-PE stock
  // drag the sector figure around, which is the opposite of what a sector
  // aggregate is for. Only stocks with the field contribute, to both the
  // numerator and the weight base.
  const sectorPE = useMemo(() => {
    const valid = weighted.filter((r) => r.pe > 0 && r.mcap > 0)
    const base = valid.reduce((s, r) => s + r.mcap, 0)
    return base ? valid.reduce((s, r) => s + r.pe * r.mcap, 0) / base : null
  }, [weighted])

  const sectorYield = useMemo(() => {
    const valid = weighted.filter((r) => r.yield != null && r.mcap > 0)
    const base = valid.reduce((s, r) => s + r.mcap, 0)
    return base ? valid.reduce((s, r) => s + r.yield * r.mcap, 0) / base : null
  }, [weighted])

  // Live FX, for the drivers tab. One fetch shared by the whole overlay.
  const [fx, setFx] = useState(null)
  useEffect(() => {
    let alive = true
    liveDataService.getFXRates()
      .then((res) => { if (alive && res?.data) setFx(res.data) })
      .catch(() => { /* drivers degrade to "no reading" */ })
    return () => { alive = false }
  }, [])

  // Shares the ['news'] cache the rest of the app already populates, so this
  // adds no request.
  const { data: newsData } = useQuery({ queryKey: ['news'], queryFn: fetchNews, staleTime: 3 * 60_000 })
  const sectorNews = useMemo(() => {
    const re = SECTOR_NEWS_TERMS[sectorName]
    if (!re) return []
    return (newsData?.articles ?? [])
      .filter((a) => re.test(`${a.headline} ${a.summary ?? ''}`))
      .slice(0, 3)
  }, [newsData, sectorName])

  const sortedRows = useMemo(() => {
    const arr = [...weighted]
    arr.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [weighted, sortCol, sortDir])

  const topByWeight = useMemo(
    () => [...weighted].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 5),
    [weighted],
  )

  // Market comparators come from verifiedConstants, which is where every
  // hardcoded figure in this app lives — not typed in here where they could
  // drift away from the Macro module's copy of the same numbers.
  const mktPE = VERIFIED_CONSTANTS.au.asx200PE
  const mktYield = VERIFIED_CONSTANTS.au.asx200DivYield

  // 30D equal-weighted sector composite vs the index itself.
  const chartData = useMemo(() => {
    const histories = universe.map(([sym]) => getMockFMPHistory(sym, 30))
    const indexHist = getMockFMPHistory(indexId, 30)
    return indexHist.map((d, i) => {
      const sectorPcts = histories
        .map((h) => (h[0]?.close ? (h[i]?.close - h[0].close) / h[0].close * 100 : null))
        .filter((v) => v != null)
      const sectorPct = sectorPcts.length ? sectorPcts.reduce((a, b) => a + b, 0) / sectorPcts.length : null
      const indexPct = indexHist[0]?.close ? (d.close - indexHist[0].close) / indexHist[0].close * 100 : null
      return { date: d.date.slice(5), sector: sectorPct, index: indexPct }
    })
  }, [universe, indexId])

  // Sector vs index momentum across the same periods, for relative strength.
  const indexCloses = useMemo(() => getMockFMPHistory(indexId, 260).map((h) => h.close), [indexId])

  const sectorYtd = useMemo(() => {
    const vals = rows.map((r) => r.ytd).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }, [rows])
  const indexYtd = useMemo(() => pctChange(indexCloses, ytdTradingDays()), [indexCloses])
  const ytdRel = sectorYtd != null && indexYtd != null ? sectorYtd - indexYtd : null

  const activePeriod = PERF_PERIODS.find((p) => p.key === perfPeriod) ?? PERF_PERIODS[2]
  const perfDays = activePeriod.days ?? ytdTradingDays()

  const perf = useMemo(() => {
    const vals = rows
      .map((r) => (activePeriod.key === 'ytd' ? r.ytd : r[activePeriod.key]))
      .filter((v) => v != null)
    const sector = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const index = pctChange(indexCloses, perfDays)
    return { sector, index, rel: sector != null && index != null ? sector - index : null }
  }, [rows, activePeriod, indexCloses, perfDays])

  // Equal-weighted sector composite against the index, both rebased to zero at
  // the start of the selected window so the two lines are comparable.
  const perfSeries = useMemo(() => {
    const span = perfDays + 1
    const histories = universe.map(([sym]) => getMockFMPHistory(sym, span))
    const indexHist = getMockFMPHistory(indexId, span)
    if (!indexHist.length) return []
    return indexHist.map((d, i) => {
      const pcts = histories
        .map((h) => (h[0]?.close ? ((h[i]?.close - h[0].close) / h[0].close) * 100 : null))
        .filter((v) => v != null && Number.isFinite(v))
      return {
        date: d.date.slice(5),
        sector: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
        index: indexHist[0]?.close ? ((d.close - indexHist[0].close) / indexHist[0].close) * 100 : null,
      }
    })
  }, [universe, indexId, perfDays])
  const momentum = useMemo(() => MOMENTUM_PERIODS.map(({ key, label, days }) => {
    const vals = rows.map((r) => r[key]).filter((v) => v != null)
    const sectorAvg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const indexChg = pctChange(indexCloses, days)
    const relStrength = sectorAvg != null && indexChg != null ? sectorAvg - indexChg : null
    return { label, sectorAvg, indexChg, relStrength }
  }), [rows, indexCloses])

  const handleSort = (col) => {
    if (col === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-terminal-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-xl font-bold text-terminal-gold">{sectorName}</span>
          <span className="text-2xs text-terminal-text-dim">{indexLabel} sector deep dive</span>
          <span className={`text-2xs font-bold px-1.5 py-0.5 border ${avgD1 >= 0 ? 'border-terminal-green text-terminal-green' : 'border-terminal-red text-terminal-red'}`}>
            {avgD1 != null ? `${avgD1 >= 0 ? '+' : ''}${avgD1.toFixed(2)}% TODAY` : '— TODAY'}
          </span>
          <span className="text-2xs text-terminal-text-dim">MCAP {fmt.large(totalMcap)}</span>
          <span className="text-2xs text-terminal-text-dim">A/D {advances}:{declines}</span>
          <DemoBadge />
        </div>
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-lg leading-none">✕</button>
      </div>

      {/* Tabs — shared sliding-underline bar */}
      <TabBar tabs={TABS} activeKey={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto">
        {tab === 'OVERVIEW' && (
          <div className="p-4 space-y-4">
            {/* Four aggregates, each stated against the thing that gives it
                meaning. A sector PE alone is a number; a sector PE beside the
                market's is a judgement. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <StatCard
                label="SECTOR P/E"
                value={sectorPE != null ? sectorPE.toFixed(1) : '—'}
                compare={sectorPE != null ? `ASX 200 ${mktPE} · ${sectorPE > mktPE ? 'premium' : 'discount'}` : 'no coverage'}
                tone={sectorPE == null ? undefined : sectorPE > mktPE ? 'text-terminal-red' : 'text-terminal-green'}
              />
              <StatCard
                label="DIV YIELD"
                value={sectorYield != null ? `${sectorYield.toFixed(2)}%` : '—'}
                compare={sectorYield != null ? `ASX 200 ${mktYield}%` : 'no coverage'}
                tone={sectorYield == null ? undefined : sectorYield >= mktYield ? 'text-terminal-green' : 'text-terminal-text-bright'}
              />
              <StatCard
                label="YTD"
                value={sectorYtd != null ? `${sectorYtd >= 0 ? '+' : ''}${sectorYtd.toFixed(1)}%` : '—'}
                compare={ytdRel != null ? `${ytdRel >= 0 ? '+' : ''}${ytdRel.toFixed(1)}pp vs ${indexLabel}` : `vs ${indexLabel}`}
                tone={sectorYtd == null ? undefined : sectorYtd >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
              />
              <StatCard
                label="ADVANCING"
                value={`${advances}/${rows.length}`}
                compare={`${declines} declining today`}
                tone={advances >= declines ? 'text-terminal-green' : 'text-terminal-red'}
              />
            </div>

            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">30D · {sectorName.toUpperCase()} VS {indexLabel.toUpperCase()}</div>
              <div style={{ height: 220 }}>
                <SafeChart width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" />
                    <YAxis tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--t-panel)', border: '1px solid var(--t-border)', fontSize: 11 }}
                      formatter={(v) => (typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—')}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="sector" name={sectorName} stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="index" name={indexLabel} stroke="#5b7fa6" fill="#5b7fa6" fillOpacity={0.1} />
                  </AreaChart>
                </SafeChart>
              </div>
            </div>

            <div className="border border-terminal-border p-3">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="text-2xs text-terminal-gold font-bold tracking-widest">TOP 5 BY SECTOR WEIGHT</span>
                {/* Weight is each stock's share of the market cap of the
                    constituents shown, computed rather than typed. It is only
                    as good as those caps, and several tracked names fall back
                    to a synthesised cap while equity data is DEMO — so this
                    reads as a real claim about index concentration and should
                    not be taken as one yet. */}
                <span className="text-2xs text-terminal-text-dim/50">share of tracked sector cap · DEMO</span>
              </div>
              <table className="w-full text-2xs">
                <thead>
                  <tr className="text-terminal-text-dim border-b border-terminal-border/60">
                    <th className="text-left font-normal pb-1 w-6">#</th>
                    <th className="text-left font-normal pb-1">Ticker</th>
                    <th className="text-left font-normal pb-1">Name</th>
                    <th className="text-right font-normal pb-1">Price</th>
                    <th className="text-right font-normal pb-1">Change</th>
                    <th className="text-right font-normal pb-1">Weight</th>
                    <th className="text-right font-normal pb-1 whitespace-nowrap">52W range</th>
                  </tr>
                </thead>
                <tbody>
                  {topByWeight.map((r, i) => (
                    <tr
                      key={r.symbol}
                      className="border-b border-terminal-border/30 last:border-b-0 hover:bg-terminal-accent/10 cursor-pointer"
                      onClick={() => openModal?.({
                        symbol: r.symbol, name: r.name, price: r.price, pct: r.d1,
                        type: r.symbol.endsWith('.AX') ? 'asx' : 'us',
                      })}
                    >
                      <td className="py-1.5 text-terminal-text-dim tabular-nums">{i + 1}</td>
                      <td className="py-1.5 font-bold text-terminal-gold">{r.symbol.replace('.AX', '')}</td>
                      <td className="py-1.5 text-terminal-text truncate max-w-[180px]">{r.name}</td>
                      <td className="py-1.5 text-right text-terminal-text tabular-nums">{fmt.aud(r.price, { clarify: true })}</td>
                      <td className="py-1.5 text-right"><ChangeText v={r.d1} /></td>
                      <td className="py-1.5 text-right text-terminal-text-bright tabular-nums">
                        {r.weight != null ? `${r.weight.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-1.5">
                        <div className="flex justify-end"><Range52 pos={r.pos52} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Real stories from the live feed, matched on sector terms. When
                nothing in the feed matches, this says so — it does not fall
                back to unrelated headlines to fill the space, and it never
                generates any. */}
            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">
                {sectorName.toUpperCase()} IN THE NEWS
              </div>
              {sectorNews.length === 0 ? (
                <div className="text-2xs text-terminal-text-dim/60">
                  Nothing matching {sectorName} in the current feed.
                </div>
              ) : (
                <div className="space-y-2">
                  {sectorNews.map((a) => (
                    <a
                      key={a.link ?? a.headline}
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="text-2xs text-terminal-text group-hover:text-terminal-gold transition-colors leading-snug">
                        {a.headline}
                      </div>
                      <div className="text-2xs text-terminal-text-dim/50 mt-0.5">
                        {a.source}{a.pubDate ? ` · ${new Date(a.pubDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">SECTOR BREADTH</div>
              <div className="flex h-3 w-full overflow-hidden border border-terminal-border">
                <div className="bg-terminal-green" style={{ width: `${rows.length ? (advances / rows.length) * 100 : 0}%` }} />
                <div className="bg-terminal-red" style={{ width: `${rows.length ? (declines / rows.length) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-2xs text-terminal-text-dim mt-1">
                <span className="text-terminal-green">{advances} advancing</span>
                <span className="text-terminal-red">{declines} declining</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'STOCKS' && (
          <div className="p-4">
            <table className="w-full text-2xs">
              <thead>
                <tr className="border-b border-terminal-border text-left text-terminal-text-dim">
                  <th className="py-1.5 pr-2 font-normal">Ticker</th>
                  <th className="py-1.5 pr-2 font-normal">Name</th>
                  {[
                    ['price', 'Price'], ['d1', '1D'], ['w1', '1W'], ['m1', '1M'], ['ytd', 'YTD'],
                    ['mcap', 'MCap'], ['weight', 'Weight'], ['pe', 'PE'], ['yield', 'Yield'], ['volume', 'Volume'],
                  ].map(([col, label]) => (
                    <th key={col} className="py-1.5 pr-2 font-normal text-right cursor-pointer select-none hover:text-terminal-gold" onClick={() => handleSort(col)}>
                      {label}<SortIcon active={sortCol === col} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr
                    key={r.symbol}
                    className="border-b border-terminal-border/40 hover:bg-terminal-accent/10 cursor-pointer"
                    onClick={() => openModal?.({
                      symbol: r.symbol,
                      name: r.name,
                      price: r.price,
                      pct: r.d1,
                      type: r.symbol.endsWith('.AX') ? 'asx' : 'us',
                    })}
                  >
                    <td className="py-1.5 pr-2 text-terminal-text-bright font-bold">{r.symbol.replace('.AX', '')}</td>
                    <td className="py-1.5 pr-2 text-terminal-text truncate max-w-[160px]">{r.name}</td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{fmt.aud(r.price, { clarify: true })}</td>
                    <td className="py-1.5 pr-2 text-right"><ChangeText v={r.d1} /></td>
                    <td className="py-1.5 pr-2 text-right"><ChangeText v={r.w1} /></td>
                    <td className="py-1.5 pr-2 text-right"><ChangeText v={r.m1} /></td>
                    <td className="py-1.5 pr-2 text-right"><ChangeText v={r.ytd} /></td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{fmt.large(r.mcap)}</td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text-bright tabular-nums">
                      {r.weight != null ? `${r.weight.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{r.pe != null ? r.pe.toFixed(1) : '—'}</td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{r.yield != null ? `${r.yield.toFixed(1)}%` : '—'}</td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{fmt.large(r.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'PERF' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              {PERF_PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPerfPeriod(p.key)}
                  className={`text-2xs px-3 py-1 border transition-colors font-bold ${
                    perfPeriod === p.key
                      ? 'bg-terminal-gold text-terminal-bg border-terminal-gold'
                      : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                  }`}
                >{p.label}</button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <StatCard
                label={`${sectorName.toUpperCase()} · ${activePeriod.label}`}
                value={perf.sector != null ? `${perf.sector >= 0 ? '+' : ''}${perf.sector.toFixed(2)}%` : '—'}
                tone={perf.sector == null ? undefined : perf.sector >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
              />
              <StatCard
                label={`${indexLabel.toUpperCase()} · ${activePeriod.label}`}
                value={perf.index != null ? `${perf.index >= 0 ? '+' : ''}${perf.index.toFixed(2)}%` : '—'}
                tone={perf.index == null ? undefined : perf.index >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
              />
              <div className="border border-terminal-border p-2.5 flex flex-col justify-center">
                {perf.rel == null ? (
                  <span className="text-2xs text-terminal-text-dim">Not enough history</span>
                ) : (
                  <>
                    <span className={`text-2xs font-bold tracking-widest ${perf.rel >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                      {perf.rel >= 0 ? '▲ OUTPERFORMING' : '▼ UNDERPERFORMING'}
                    </span>
                    <span className="text-base font-bold tabular-nums mt-0.5 text-terminal-text-bright">
                      {perf.rel >= 0 ? '+' : ''}{perf.rel.toFixed(2)}pp
                    </span>
                    <span className="text-2xs text-terminal-text-dim/60">vs {indexLabel} over {activePeriod.label}</span>
                  </>
                )}
              </div>
            </div>

            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">
                {activePeriod.label} · REBASED TO 0% AT PERIOD START
              </div>
              <div style={{ height: 260 }}>
                <SafeChart width="100%" height="100%">
                  <AreaChart data={perfSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" minTickGap={24} />
                    <YAxis tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--t-panel)', border: '1px solid var(--t-border)', fontSize: 11 }}
                      formatter={(v) => (typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—')}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="sector" name={sectorName} stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="index" name={indexLabel} stroke="#5b7fa6" fill="#5b7fa6" fillOpacity={0.1} />
                  </AreaChart>
                </SafeChart>
              </div>
            </div>
          </div>
        )}

        {tab === 'DRIVERS' && <DriversTab sectorName={sectorName} fx={fx} />}

        {tab === 'ROTATION' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">MOMENTUM · SECTOR AVG % CHANGE</div>
              <table className="w-full text-2xs">
                <thead>
                  <tr className="border-b border-terminal-border text-left text-terminal-text-dim">
                    <th className="py-1.5 font-normal">Period</th>
                    <th className="py-1.5 font-normal text-right">{sectorName}</th>
                    <th className="py-1.5 font-normal text-right">{indexLabel}</th>
                    <th className="py-1.5 font-normal text-right">Relative Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {momentum.map((m) => (
                    <tr key={m.label} className="border-b border-terminal-border/40">
                      <td className="py-1.5 text-terminal-text-bright font-bold">{m.label}</td>
                      <td className="py-1.5 text-right"><ChangeText v={m.sectorAvg} /></td>
                      <td className="py-1.5 text-right"><ChangeText v={m.indexChg} /></td>
                      <td className="py-1.5 text-right">
                        {m.relStrength != null && (
                          <span className={m.relStrength >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
                            {m.relStrength >= 0 ? 'Money flowing IN' : 'Money flowing OUT'} ({m.relStrength >= 0 ? '+' : ''}{m.relStrength.toFixed(2)}pp)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-terminal-border px-5 py-3 flex-shrink-0 flex justify-center">
        <button
          onClick={() => dispatchAskAI(
            { sector: sectorName, instruction: `Give me a deep analysis of the ${sectorName} sector right now — what's driving it, key stocks to watch, and the outlook for the next few weeks.` },
            { rawPrompt: true, fullscreen: true },
          )}
          className="text-2xs text-terminal-gold border border-terminal-gold px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-widest"
        >ANALYSE {sectorName.toUpperCase()} WITH MADDENAI</button>
      </div>
    </div>
  )
}
