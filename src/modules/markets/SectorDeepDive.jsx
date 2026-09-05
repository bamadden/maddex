import { useState, useMemo, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ASX_SECTOR_STOCKS, INDEX_SECTORS, INDEX_LABELS } from './SectorHeatmap'
import { getMockFMPRow, getMockFMPHistory } from '../../services/mockData'
import { fmt } from '../../utils/format'
import { askClaudeJSON } from '../../services/api'
import { dispatchAskAI } from '../../utils/askAI'
import TabBar from '../../components/ui/TabBar'

const TABS = [
  { key: 'OVERVIEW', label: 'OVERVIEW' },
  { key: 'STOCKS', label: 'STOCKS' },
  { key: 'DRIVERS', label: 'DRIVERS' },
  { key: 'ROTATION', label: 'ROTATION' },
]

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

function StockMiniCard({ row, tint }) {
  return (
    <div className={`border p-2 ${tint === 'red' ? 'border-terminal-red/30' : 'border-terminal-green/30'}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-bold text-terminal-text-bright">{row.symbol.replace('.AX', '')}</span>
        <ChangeText v={row.d1} className="text-2xs font-bold" />
      </div>
      <div className="text-2xs text-terminal-text-dim truncate">{row.name}</div>
      <div className="text-2xs text-terminal-text-dim mt-0.5">{fmt.aud(row.price, { clarify: true })} · {fmt.large(row.mcap)}</div>
    </div>
  )
}

function DriversTab({ sectorName, avgD1, advances, declines, total }) {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [drivers, setDrivers] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const cacheKey = `maddex_sector_drivers_${sectorName}_${new Date().toISOString().slice(0, 10)}`
    const t = setTimeout(async () => {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { setDrivers(JSON.parse(cached)); setStatus('ready'); return } catch { /* fall through to regenerate */ }
      }
      setStatus('loading')
      setError(null)
      try {
        const prompt = `You are MaddenAI. Explain what's driving the ${sectorName} sector today for an Australian investor.

Sector snapshot: average move today ${avgD1 != null ? `${avgD1 >= 0 ? '+' : ''}${avgD1.toFixed(2)}%` : 'flat'}, ${advances} advancing / ${declines} declining out of ${total} tracked stocks.

Return JSON only:
{
  "summary": "2-3 sentences on what's specifically driving ${sectorName} today",
  "macroDrivers": ["macro driver 1 (e.g. commodity price, rates, FX)", "macro driver 2", "macro driver 3"],
  "newsStories": [
    {"headline": "recent, plausible headline affecting this sector", "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE"}
  ]
}
newsStories should have exactly 5 items. Be specific and Australian-focused. Return ONLY valid JSON.`
        const data = await askClaudeJSON(prompt, { maxTokens: 900 })
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* best-effort */ }
        setDrivers(data)
        setStatus('ready')
      } catch (e) {
        setError(e.message)
        setStatus('error')
      }
    }, 0)
    return () => clearTimeout(t)
  }, [sectorName, avgD1, advances, declines, total])

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <div className="text-terminal-gold text-2xs tracking-widest animate-pulse">MADDENAI · ANALYSING {sectorName.toUpperCase()}...</div>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
        <span className="text-terminal-red text-lg">⚠</span>
        <div className="text-2xs text-terminal-red">{error}</div>
      </div>
    )
  }
  return (
    <div className="space-y-4 p-4">
      <div className="border border-terminal-border p-3">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">WHAT'S DRIVING {sectorName.toUpperCase()} TODAY</div>
        <div className="text-2xs text-terminal-text leading-relaxed">{drivers.summary}</div>
      </div>
      <div className="border border-terminal-border p-3">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">KEY MACRO DRIVERS</div>
        <ul className="space-y-1">
          {(drivers.macroDrivers ?? []).map((d, i) => (
            <li key={i} className="text-2xs text-terminal-text flex gap-2"><span className="text-terminal-gold">{i + 1}.</span>{d}</li>
          ))}
        </ul>
      </div>
      <div className="border border-terminal-border p-3">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">RECENT NEWS</div>
        <div className="space-y-1.5">
          {(drivers.newsStories ?? []).map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-2xs">
              <span className={
                n.sentiment === 'POSITIVE' ? 'text-terminal-green' : n.sentiment === 'NEGATIVE' ? 'text-terminal-red' : 'text-terminal-text-dim'
              }>●</span>
              <span className="text-terminal-text flex-1">{n.headline}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SectorDeepDive({ sectorName, indexId, openModal, onClose }) {
  const [tab, setTab] = useState('OVERVIEW')
  const [sortCol, setSortCol] = useState('mcap')
  const [sortDir, setSortDir] = useState('desc')

  const universe = useSectorUniverse(sectorName, indexId)

  const rows = useMemo(() => (
    universe.map(([sym, name]) => {
      const q = getMockFMPRow(sym)
      if (!q) return null
      const hist = getMockFMPHistory(sym, 260)
      const closes = hist.map((h) => h.close)
      return {
        symbol: sym,
        name,
        price: q.regularMarketPrice,
        d1: q.regularMarketChangePercent,
        w1: pctChange(closes, 5),
        m1: pctChange(closes, 21),
        m3: pctChange(closes, 63),
        m6: pctChange(closes, 126),
        y1: pctChange(closes, 252),
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

  const sortedRows = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [rows, sortCol, sortDir])

  const topFive = useMemo(() => [...rows].sort((a, b) => (b.d1 ?? -999) - (a.d1 ?? -999)).slice(0, 5), [rows])
  const bottomFive = useMemo(() => [...rows].sort((a, b) => (a.d1 ?? 999) - (b.d1 ?? 999)).slice(0, 5), [rows])

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
        </div>
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-lg leading-none">✕</button>
      </div>

      {/* Tabs — shared sliding-underline bar */}
      <TabBar tabs={TABS} activeKey={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto">
        {tab === 'OVERVIEW' && (
          <div className="p-4 space-y-4">
            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">30D · {sectorName.toUpperCase()} VS {indexLabel.toUpperCase()}</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" />
                    <YAxis tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip contentStyle={{ background: 'var(--t-panel)', border: '1px solid var(--t-border)', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="sector" name={sectorName} stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="index" name={indexLabel} stroke="#5b7fa6" fill="#5b7fa6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-2xs text-terminal-green font-bold tracking-widest mb-1.5">TOP 5</div>
                <div className="space-y-1.5">
                  {topFive.map((r) => <StockMiniCard key={r.symbol} row={r} tint="green" />)}
                </div>
              </div>
              <div>
                <div className="text-2xs text-terminal-red font-bold tracking-widest mb-1.5">BOTTOM 5</div>
                <div className="space-y-1.5">
                  {bottomFive.map((r) => <StockMiniCard key={r.symbol} row={r} tint="red" />)}
                </div>
              </div>
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
                    ['price', 'Price'], ['d1', '1D'], ['w1', '1W'], ['m1', '1M'], ['y1', 'YTD/1Y'],
                    ['mcap', 'MCap'], ['pe', 'PE'], ['yield', 'Yield'], ['volume', 'Volume'],
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
                    <td className="py-1.5 pr-2 text-right"><ChangeText v={r.y1} /></td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{fmt.large(r.mcap)}</td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{r.pe != null ? r.pe.toFixed(1) : '—'}</td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{r.yield != null ? `${r.yield.toFixed(1)}%` : '—'}</td>
                    <td className="py-1.5 pr-2 text-right text-terminal-text">{fmt.large(r.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'DRIVERS' && (
          <DriversTab sectorName={sectorName} avgD1={avgD1} advances={advances} declines={declines} total={rows.length} />
        )}

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
