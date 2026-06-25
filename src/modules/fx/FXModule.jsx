import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchFxRates, transformFxRates, fetchMetalsRates, extractMetals, fetchFxHistory,
} from '../../services/api'
import { CENTRAL_BANK_RATES } from '../../data/placeholders'
import { useStore } from '../../store/useStore'
import { fmt, colorClass } from '../../utils/format'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

// ─── 5-Country Yield Curve Data — June 2026 ──────────────────────────────────

const YIELD_CURVES = {
  AU: {
    label: 'AU GOV BONDS', color: '#c8a84b', src: 'AOFM / RBA · Jun 2026',
    points: [
      { m:'3M', y:4.35 }, { m:'6M', y:4.30 }, { m:'1Y', y:4.20 },
      { m:'2Y', y:4.10 }, { m:'3Y', y:4.05 }, { m:'5Y', y:4.08 },
      { m:'10Y',y:4.35 }, { m:'30Y',y:4.60 },
    ],
    prev: { '3M':4.40,'6M':4.35,'1Y':4.25,'2Y':4.15,'3Y':4.10,'5Y':4.12,'10Y':4.38,'30Y':4.62 },
  },
  US: {
    label: 'US TREASURIES', color: '#3b82f6', src: 'US Treasury · Jun 2026',
    points: [
      { m:'3M', y:4.32 }, { m:'6M', y:4.28 }, { m:'1Y', y:4.15 },
      { m:'2Y', y:4.05 }, { m:'5Y', y:4.12 }, { m:'10Y',y:4.38 },
      { m:'30Y',y:4.62 },
    ],
    prev: { '3M':4.35,'6M':4.30,'1Y':4.18,'2Y':4.08,'5Y':4.15,'10Y':4.42,'30Y':4.65 },
  },
  UK: {
    label: 'UK GILTS', color: '#a855f7', src: 'UK DMO · Jun 2026',
    points: [
      { m:'3M', y:4.45 }, { m:'6M', y:4.38 }, { m:'1Y', y:4.20 },
      { m:'2Y', y:4.10 }, { m:'5Y', y:4.18 }, { m:'10Y',y:4.42 },
      { m:'30Y',y:4.85 },
    ],
    prev: { '3M':4.50,'6M':4.42,'1Y':4.25,'2Y':4.15,'5Y':4.22,'10Y':4.48,'30Y':4.90 },
  },
  JP: {
    label: 'JP BONDS (JGBs)', color: '#14b8a6', src: 'MOF Japan · Jun 2026',
    points: [
      { m:'3M', y:0.35 }, { m:'6M', y:0.42 }, { m:'1Y', y:0.55 },
      { m:'2Y', y:0.72 }, { m:'5Y', y:1.05 }, { m:'10Y',y:1.42 },
      { m:'30Y',y:2.18 },
    ],
    prev: { '3M':0.30,'6M':0.38,'1Y':0.50,'2Y':0.68,'5Y':1.00,'10Y':1.38,'30Y':2.12 },
  },
  DE: {
    label: 'DE BUNDS', color: '#22c55e', src: 'Bundesbank · Jun 2026',
    points: [
      { m:'3M', y:2.18 }, { m:'6M', y:2.12 }, { m:'1Y', y:2.05 },
      { m:'2Y', y:2.02 }, { m:'5Y', y:2.15 }, { m:'10Y',y:2.48 },
      { m:'30Y',y:2.82 },
    ],
    prev: { '3M':2.25,'6M':2.18,'1Y':2.10,'2Y':2.08,'5Y':2.20,'10Y':2.52,'30Y':2.88 },
  },
}

const CURVE_KEYS = Object.keys(YIELD_CURVES)

function getCurveStats(key) {
  const curve = YIELD_CURVES[key]
  const y2  = curve.points.find(p => p.m === '2Y')?.y
  const y10 = curve.points.find(p => p.m === '10Y')?.y
  const spread = y2 != null && y10 != null ? y10 - y2 : null
  const shape = spread == null ? '—'
    : spread > 0.3 ? 'NORMAL'
    : spread > 0   ? 'FLAT'
    : 'INVERTED'
  return { spread, shape }
}

// ─── FX Retry Countdown — shown when proxy + direct Frankfurter calls both fail ──

function FxRetryCountdown({ onRetry, seconds = 15 }) {
  const [secs, setSecs] = useState(seconds)
  useEffect(() => {
    if (secs <= 0) { onRetry(); return }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secs]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="my-6 text-center">
      <div className="text-2xs text-terminal-red font-bold tracking-widest">FX RATES UNAVAILABLE — RETRYING...</div>
      <div className="text-2xs text-terminal-text-dim mt-1">Next attempt in {secs}s</div>
      <button
        onClick={onRetry}
        className="mt-2 text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
      >
        RETRY NOW
      </button>
    </div>
  )
}

const directionIcon = (dir) => {
  if (dir === 'hike') return <span className="text-terminal-red">↑ HIKE</span>
  if (dir === 'cut')  return <span className="text-terminal-green">↓ CUT</span>
  return <span className="text-terminal-text-dim">— HOLD</span>
}

const rateDecimals = (pair) => (pair.includes('JPY') || pair.includes('CNY') ? 2 : 4)

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'NZD', 'CAD', 'CHF']

function CurrencyConverter({ rates }) {
  const [amount, setAmount]   = useState('1000')
  const [fromCcy, setFromCcy] = useState('AUD')
  const [toCcy, setToCcy]     = useState('USD')

  const convert = () => {
    const n = parseFloat(amount)
    if (isNaN(n) || !rates) return '—'
    const audAmount = fromCcy === 'AUD' ? n : n / rates[fromCcy]
    const result    = toCcy  === 'AUD' ? audAmount : audAmount * rates[toCcy]
    return result.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="border-t border-terminal-border p-2 flex-shrink-0">
      <div className="text-2xs text-terminal-gold font-bold mb-2 tracking-widest">CURRENCY CONVERTER</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-20 bg-terminal-bg border border-terminal-border px-1.5 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold"
        />
        <select value={fromCcy} onChange={(e) => setFromCcy(e.target.value)}
          className="bg-terminal-bg border border-terminal-border px-1 py-1 text-2xs text-terminal-gold outline-none focus:border-terminal-gold">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-terminal-text-dim text-xs">→</span>
        <select value={toCcy} onChange={(e) => setToCcy(e.target.value)}
          className="bg-terminal-bg border border-terminal-border px-1 py-1 text-2xs text-terminal-gold outline-none focus:border-terminal-gold">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xs text-terminal-text-dim">{amount} {fromCcy} =</span>
        <span className="text-sm font-bold text-terminal-text-bright">
          {rates ? convert() : '—'} {toCcy}
        </span>
      </div>
      {!rates && (
        <div className="text-2xs text-terminal-text-dim mt-0.5">Connecting to Frankfurter.app...</div>
      )}
    </div>
  )
}

// ─── 30-Day FX History Modal ──────────────────────────────────────────────────

function FxHistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <span className="text-terminal-text-dim">{label}: </span>
      <span className="text-terminal-gold font-semibold">{payload[0].value?.toFixed(4)}</span>
    </div>
  )
}

function FxHistoryModal({ pair, onClose }) {
  const overlayRef = useRef(null)
  // pair is like 'AUD/USD' — split into from/to for Frankfurter
  const [from, to] = pair.split('/')

  const { data, isFetching, isError } = useQuery({
    queryKey: ['fxHistory', from, to],
    queryFn: () => fetchFxHistory(from, to, 30),
    staleTime: 10 * 60_000,
    retry: 1,
  })

  const chartData = useMemo(() => {
    if (!data?.rates) return []
    return Object.entries(data.rates)
      .map(([date, rates]) => ({
        date: date.slice(5).replace('-', '/'), // MM/DD
        rate: rates[to] ?? null,
      }))
      .filter(d => d.rate != null)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data, to])

  const minRate = chartData.length ? Math.min(...chartData.map(d => d.rate)) : 0
  const maxRate = chartData.length ? Math.max(...chartData.map(d => d.rate)) : 1
  const rateRange = maxRate - minRate
  const yMin = parseFloat((minRate - rateRange * 0.05).toFixed(4))
  const yMax = parseFloat((maxRate + rateRange * 0.05).toFixed(4))

  const first = chartData[0]?.rate
  const last  = chartData[chartData.length - 1]?.rate
  const change = first && last ? ((last - first) / first) * 100 : null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="bg-terminal-panel border border-terminal-border flex flex-col overflow-hidden"
        style={{ width: '75vw', maxWidth: 860, height: '65vh', maxHeight: 540 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-sm font-bold text-terminal-gold tracking-wider">{pair}</span>
          <span className="text-2xs text-terminal-text-dim">30-DAY HISTORY</span>
          {last != null && (
            <span className="text-xs font-bold text-terminal-text-bright">{last.toFixed(4)}</span>
          )}
          {change != null && (
            <span className={`text-xs font-bold ${change >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}% (30d)
            </span>
          )}
          {isFetching && <span className="text-2xs text-terminal-text-dim animate-pulse">LOADING...</span>}
          <button onClick={onClose} className="ml-auto text-terminal-text-dim hover:text-terminal-text text-lg">✕</button>
        </div>
        <div className="flex-1 p-4">
          {isError ? (
            <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
              Failed to load history — Frankfurter API may be unavailable
            </div>
          ) : isFetching && !chartData.length ? (
            <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim animate-pulse">
              LOADING RATE HISTORY...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="fxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c8a84b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c8a84b" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#0d2244" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={4} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickFormatter={v => v.toFixed(4)}
                  domain={[yMin, yMax]}
                  width={55}
                />
                <Tooltip content={<FxHistoryTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#c8a84b"
                  strokeWidth={2}
                  fill="url(#fxGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#c8a84b' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="border-t border-terminal-border px-4 py-1.5 text-2xs text-terminal-text-dim/60 flex items-center gap-4 flex-shrink-0">
          <span>SOURCE: Frankfurter.app (ECB rates)</span>
          {first && last && (
            <>
              <span>30D HIGH: <span className="text-terminal-green">{maxRate.toFixed(4)}</span></span>
              <span>30D LOW: <span className="text-terminal-red">{minRate.toFixed(4)}</span></span>
            </>
          )}
          <span className="ml-auto">Click outside to close</span>
        </div>
      </div>
    </div>
  )
}

// ─── Yield Curve Tooltip ──────────────────────────────────────────────────────

function YieldTooltip({ active, payload, label, compareKey }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1.5 text-2xs space-y-0.5">
      <div className="text-terminal-text-dim font-bold">{label}</div>
      {payload.map(p => {
        const key = p.dataKey
        const curve = YIELD_CURVES[key]
        if (!curve) return null
        const prev = curve.prev[label]
        const chg = prev != null ? p.value - prev : null
        return (
          <div key={key} className="flex items-center gap-2">
            <span style={{ color: curve.color }} className="font-bold">{curve.label.split(' ')[0]}</span>
            <span className="text-terminal-text-bright font-semibold">{p.value.toFixed(2)}%</span>
            {chg != null && (
              <span className={chg >= 0 ? 'text-terminal-red' : 'text-terminal-green'}>
                {chg >= 0 ? '+' : ''}{chg.toFixed(2)}% vs prev mo
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function FXModule() {
  const { openModal } = useStore()
  const [historyPair, setHistoryPair] = useState(null)
  const [selectedCurve, setSelectedCurve] = useState('AU')
  const [compareMode, setCompareMode]     = useState(false)
  const [compareCurve2, setCompareCurve2] = useState('US')
  const [showYieldInfo, setShowYieldInfo] = useState(false)
  const [fxAttemptKey, setFxAttemptKey]   = useState(0)

  // Frankfurter — no key needed. fetchFxRates already retries 3x + tries a
  // direct (non-proxied) call internally, so no extra react-query retry layer.
  const { data: rawRates, isError, isFetching, refetch } = useQuery({
    queryKey: ['fxRates'],
    queryFn:  () => fetchFxRates('AUD'),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleFxRetry = () => { setFxAttemptKey((k) => k + 1); refetch() }

  // Metals: tries Frankfurter (ECB XAU) then ExchangeRate-API
  const { data: metalsRates } = useQuery({
    queryKey: ['metalsRates'],
    queryFn:  fetchMetalsRates,
    staleTime: 10 * 60_000,
    retry: 1,
  })

  const pairs      = rawRates ? transformFxRates(rawRates) : []
  const audPairs   = pairs.slice(0, 8)
  const crossRates = pairs.slice(8)
  const isLive     = !!rawRates && !isError
  const audUsd     = rawRates?.USD ?? null
  const metals     = metalsRates ? extractMetals(metalsRates) : []

  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  const dateStr     = new Date().toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()

  // Build chart data — all tenors across selected curve(s)
  const allTenors = useMemo(() => {
    const keys = compareMode
      ? [selectedCurve, compareCurve2].filter(Boolean)
      : [selectedCurve]
    const tenorSet = new Set()
    keys.forEach(k => YIELD_CURVES[k].points.forEach(p => tenorSet.add(p.m)))
    const ORDER = ['3M','6M','1Y','2Y','3Y','5Y','10Y','30Y']
    return ORDER.filter(t => tenorSet.has(t))
  }, [selectedCurve, compareCurve2, compareMode])

  const chartData = useMemo(() => {
    const keys = compareMode
      ? [selectedCurve, compareCurve2].filter(Boolean)
      : [selectedCurve]
    return allTenors.map(tenor => {
      const row = { tenor }
      keys.forEach(k => {
        const pt = YIELD_CURVES[k].points.find(p => p.m === tenor)
        row[k] = pt?.y ?? null
      })
      return row
    })
  }, [selectedCurve, compareCurve2, compareMode, allTenors])

  const allYieldValues = chartData.flatMap(r => Object.values(r).filter(v => typeof v === 'number'))
  const yMin = allYieldValues.length ? Math.floor((Math.min(...allYieldValues) - 0.2) * 10) / 10 : 0
  const yMax = allYieldValues.length ? Math.ceil( (Math.max(...allYieldValues) + 0.2) * 10) / 10 : 6

  const activeCurve1Stats = getCurveStats(selectedCurve)
  const activeCurve2Stats = compareMode ? getCurveStats(compareCurve2) : null

  return (
    <>
    <div className="h-full grid grid-cols-[280px_1fr_260px] overflow-hidden">

      {/* FX Pairs + Converter */}
      <div className="flex flex-col border-r border-terminal-border overflow-hidden">
        <div className="panel-header flex items-center gap-2">
          FX RATES
          {isFetching && <span className="text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>}
          {isLive     && <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE</span>}
          {isError    && <span className="text-terminal-red text-2xs font-normal">⚠ ERROR</span>}
          {isLive     && <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case">{updatedTime}</span>}
        </div>
        <div className="flex-1 overflow-auto">
          {isFetching ? (
            <div className="p-4 text-2xs text-terminal-text-dim animate-pulse text-center">LOADING FX RATES...</div>
          ) : !isLive ? (
            <FxRetryCountdown key={fxAttemptKey} onRetry={handleFxRetry} />
          ) : (
            <>
              <div className="px-2 py-1 text-2xs text-terminal-text-dim border-b border-terminal-border/50">
                AUD PAIRS · MID RATE · LIVE · {updatedTime} AEST
              </div>
              <table className="terminal-table w-full">
                <thead>
                  <tr>
                    <th className="px-2 text-left">PAIR</th>
                    <th className="px-1 text-right">RATE</th>
                    <th className="px-1 text-right">30D</th>
                  </tr>
                </thead>
                <tbody>
                  {audPairs.map((p) => {
                    const dec      = rateDecimals(p.pair)
                    const isAudUsd = p.pair === 'AUD/USD'
                    return (
                      <tr
                        key={p.pair}
                        className={`hover:bg-terminal-accent/30 cursor-pointer ${isAudUsd ? 'bg-terminal-accent/10' : ''}`}
                        onClick={() => setHistoryPair(p.pair)}
                      >
                        <td className={`px-2 py-0.5 text-xs font-bold ${isAudUsd ? 'text-terminal-gold' : 'text-terminal-text-bright'}`}>
                          {p.pair}
                          {isAudUsd && <span className="text-2xs text-terminal-green ml-1">●</span>}
                        </td>
                        <td className="px-1 py-0.5 text-2xs text-right font-semibold">{p.mid?.toFixed(dec)}</td>
                        <td className="px-1 py-0.5 text-2xs text-right text-terminal-gold hover:underline">CHART</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-2 py-1 text-2xs text-terminal-text-dim border-b border-terminal-border/50 border-t border-terminal-border mt-1">
                CROSS RATES
              </div>
              <table className="terminal-table w-full">
                <tbody>
                  {crossRates.map((p) => (
                    <tr key={p.pair} className="hover:bg-terminal-accent/30 cursor-pointer"
                      onClick={() => setHistoryPair(p.pair)}
                      title="Click for 30d history"
                    ><td className="px-2 py-0.5 text-xs font-bold text-terminal-text-bright">{p.pair}</td>
                      <td className="px-1 py-0.5 text-2xs text-right">{p.mid?.toFixed(rateDecimals(p.pair))}</td>
                      <td className="px-1 py-0.5 text-2xs text-right text-terminal-gold">CHART</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {audUsd && (
                <div className="border-t border-terminal-border mt-2 p-2">
                  <div className="text-2xs text-terminal-gold font-bold mb-1">AUD/USD · LIVE</div>
                  <div className="text-2xl font-bold text-terminal-text-bright">{audUsd.toFixed(4)}</div>
                  <div className="text-2xs text-terminal-text-dim mt-0.5">1 AUD = {audUsd.toFixed(4)} USD</div>
                  <div className="text-2xs text-terminal-text-dim">1 USD = {(1 / audUsd).toFixed(4)} AUD</div>
                  <div className="text-2xs text-terminal-text-dim mt-0.5">{updatedTime} AEST · Frankfurter</div>
                </div>
              )}
            </>
          )}
        </div>
        <CurrencyConverter rates={rawRates} />
      </div>

      {/* Bond Yield Curve — interactive 5-country selector */}
      <div className="flex flex-col border-r border-terminal-border overflow-hidden">
        <div className="panel-header flex items-center gap-2 flex-shrink-0">
          SOVEREIGN YIELD CURVES
          <button
            onClick={() => setShowYieldInfo((v) => !v)}
            title="About this data"
            className="w-3.5 h-3.5 rounded-full border border-terminal-text-dim/50 text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold text-2xs leading-none flex items-center justify-center flex-shrink-0"
          >
            i
          </button>
          <span className="text-2xs text-terminal-text-dim font-normal normal-case ml-auto">
            Jun 2026 · hardcoded
          </span>
        </div>
        {showYieldInfo && (
          <div className="px-2 py-1.5 text-2xs text-terminal-text-dim bg-terminal-accent/10 border-b border-terminal-border flex-shrink-0">
            Yield curve data is updated quarterly. Last updated June 2026.
          </div>
        )}

        {/* Country toggle buttons */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-terminal-border flex-shrink-0 flex-wrap">
          {CURVE_KEYS.map(k => {
            const curve = YIELD_CURVES[k]
            const isP   = selectedCurve === k
            const isC   = compareMode && compareCurve2 === k
            return (
              <button
                key={k}
                onClick={() => {
                  if (compareMode && k !== selectedCurve) {
                    setCompareCurve2(k)
                  } else {
                    setSelectedCurve(k)
                    if (compareMode && k === compareCurve2) {
                      setCompareCurve2(CURVE_KEYS.find(x => x !== k) ?? 'US')
                    }
                  }
                }}
                className={`text-2xs px-2 py-0.5 border font-bold transition-colors ${
                  isP || isC
                    ? 'border-current'
                    : 'border-terminal-border text-terminal-text-dim hover:text-terminal-text'
                }`}
                style={(isP || isC) ? { color: curve.color, borderColor: curve.color, background: curve.color + '18' } : {}}
              >
                {k}{isC ? ' ②' : ''}
              </button>
            )
          })}
          <button
            onClick={() => setCompareMode(m => !m)}
            className={`text-2xs px-2 py-0.5 border ml-1 transition-colors ${
              compareMode
                ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10'
                : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold'
            }`}
          >
            {compareMode ? '● COMPARE' : '○ COMPARE'}
          </button>
        </div>

        {/* Chart */}
        <div className="flex-1 p-2 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#0d2244" vertical={false} />
              <XAxis dataKey="tenor" tick={{ fontSize: 9 }} />
              <YAxis
                tick={{ fontSize: 9 }}
                tickFormatter={v => `${v.toFixed(2)}%`}
                domain={[yMin, yMax]}
                width={46}
              />
              <Tooltip content={<YieldTooltip compareKey={compareCurve2} />} />
              {/* Primary curve */}
              <Line
                key={`line-${selectedCurve}`}
                type="monotone"
                dataKey={selectedCurve}
                stroke={YIELD_CURVES[selectedCurve].color}
                strokeWidth={2.5}
                dot={{ fill: YIELD_CURVES[selectedCurve].color, r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
                animationDuration={300}
                isAnimationActive={true}
              />
              {/* Compare curve */}
              {compareMode && compareCurve2 && compareCurve2 !== selectedCurve && (
                <Line
                  key={`line-${compareCurve2}`}
                  type="monotone"
                  dataKey={compareCurve2}
                  stroke={YIELD_CURVES[compareCurve2].color}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ fill: YIELD_CURVES[compareCurve2].color, r: 2.5 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  animationDuration={300}
                  isAnimationActive={true}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary stats */}
        <div className="border-t border-terminal-border px-2 py-1.5 flex-shrink-0 space-y-1">
          {/* Primary */}
          {(() => {
            const { spread, shape } = activeCurve1Stats
            const curve = YIELD_CURVES[selectedCurve]
            const spreadFmt = spread != null
              ? `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`
              : '—'
            return (
              <div className="flex items-center gap-3 text-2xs">
                <span className="font-bold" style={{ color: curve.color }}>{selectedCurve}</span>
                <span className="text-terminal-text-dim">2Y-10Y</span>
                <span className={`font-semibold ${spread != null && spread >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {spreadFmt}
                </span>
                <span className={`px-1 border text-2xs ${
                  shape === 'INVERTED' ? 'border-terminal-red/40 text-terminal-red' :
                  shape === 'FLAT'     ? 'border-terminal-gold/40 text-terminal-gold' :
                                         'border-terminal-green/40 text-terminal-green'
                }`}>{shape}</span>
                <span className="text-terminal-text-dim/60 ml-auto">{curve.src}</span>
              </div>
            )
          })()}
          {/* Compare */}
          {compareMode && activeCurve2Stats && compareCurve2 !== selectedCurve && (() => {
            const { spread, shape } = activeCurve2Stats
            const curve = YIELD_CURVES[compareCurve2]
            const spreadFmt = spread != null
              ? `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`
              : '—'
            return (
              <div className="flex items-center gap-3 text-2xs">
                <span className="font-bold" style={{ color: curve.color }}>{compareCurve2}</span>
                <span className="text-terminal-text-dim">2Y-10Y</span>
                <span className={`font-semibold ${spread != null && spread >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {spreadFmt}
                </span>
                <span className={`px-1 border text-2xs ${
                  shape === 'INVERTED' ? 'border-terminal-red/40 text-terminal-red' :
                  shape === 'FLAT'     ? 'border-terminal-gold/40 text-terminal-gold' :
                                         'border-terminal-green/40 text-terminal-green'
                }`}>{shape}</span>
                <span className="text-terminal-text-dim/60 ml-auto">{curve.src}</span>
              </div>
            )
          })()}
        </div>

        {/* Data freshness footer */}
        <div className="border-t border-terminal-border px-2 py-1 flex items-center justify-between flex-shrink-0">
          <span className="text-2xs text-terminal-text-dim">
            AS AT JUNE 2026 — Source: {YIELD_CURVES[selectedCurve].src.split('·')[0].trim()}
          </span>
          <span className="text-2xs text-terminal-gold/70 font-semibold">UPDATE DUE: SEPTEMBER 2026</span>
        </div>
      </div>

      {/* Central Bank Rates + Metals */}
      <div className="flex flex-col overflow-hidden">
        <div className="panel-header flex items-center gap-2">
          CENTRAL BANK POLICY RATES
          <span className="text-2xs text-terminal-text-dim font-normal normal-case ml-auto">OFFICIAL RELEASES</span>
        </div>
        <div className="flex-1 overflow-auto">
          {CENTRAL_BANK_RATES.map((cb) => (
            <div key={cb.bank}
              className={`border-b border-terminal-border/50 p-2 hover:bg-terminal-accent/20 ${cb.country === 'AUD' ? 'border-l-2 border-l-terminal-gold' : ''}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-2xs font-bold ${cb.country === 'AUD' ? 'text-terminal-gold' : 'text-terminal-text-bright'}`}>
                  {cb.country}
                </span>
                <span className="text-xs font-bold text-terminal-gold">{cb.rate.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xs text-terminal-text-dim">{cb.bank}</span>
                <span className="text-2xs">{directionIcon(cb.direction)}</span>
              </div>
              <div className="text-2xs text-terminal-text-dim mt-0.5">Last change: {cb.lastChange}</div>
            </div>
          ))}
          <div className="px-2 py-1 text-2xs text-terminal-text-dim/60 border-t border-terminal-border">
            Rates as at official central bank releases (source per institution)
          </div>
        </div>
        <div className="border-t border-terminal-border p-2 flex-shrink-0">
          <div className="panel-header -mx-2 -mt-2 mb-2">
            PRECIOUS METALS (AUD)
            {metals.length > 0 && <span className="ml-2 text-terminal-green text-2xs font-normal normal-case">● LIVE</span>}
          </div>
          {metals.length > 0 ? metals.map((m) => (
            <div key={m.name}
              className="flex items-center justify-between py-0.5 hover:bg-terminal-accent/20 cursor-pointer px-1"
              onClick={() => openModal?.({
                symbol: m.name.includes('GOLD') ? 'XAU' : 'XAG', name: m.name,
                price: parseFloat(String(m.price).replace(/,/g, '')), pct: null, change: null, type: 'commodity',
              })}>
              <span className="text-2xs text-terminal-text-dim">{m.name}</span>
              <span className="text-2xs font-semibold text-terminal-text-bright">
                A${parseFloat(m.price).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )) : (
            <div className="text-2xs text-terminal-text-dim/60 px-1 py-1 leading-relaxed">
              Metal rates unavailable — Frankfurter and ExchangeRate-API did not return XAU/XAG.
            </div>
          )}
          {metals.length > 0 && (
            <div className="text-2xs text-terminal-text-dim/60 mt-1 px-1">{updatedTime} AEST · ExchangeRate-API</div>
          )}
        </div>
      </div>
    </div>
    {historyPair && <FxHistoryModal pair={historyPair} onClose={() => setHistoryPair(null)} />}
    </>
  )
}
