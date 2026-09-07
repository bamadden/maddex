import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react'
import RbaHeroCard from './RbaHeroCard'
import { useQuery } from '@tanstack/react-query'
import {
  transformFxRates, fetchMetalsRates, extractMetals, fetchFxHistory,
} from '../../services/api'
import { fetchFxRatesUnified } from '../../services/dataService'
import { RBA_RATE_HISTORY } from '../../data/placeholders'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
// The full ten-bank schedule now lives in UpcomingDecisions, which owns the
// 90-day calendar. This module only needs the RBA's own dates, for the hero
// countdown and the compact dashboard's next-meeting label.
import { RBA_MEETINGS_2026, getNextMeeting } from '../../services/centralBankSchedule'
import { useStore } from '../../store/useStore'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import { ModuleLoader, Viz3DLoader } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts'
import YieldCurveAnimator from '../../components/charts/YieldCurveAnimator'
import CentralBankTracker from './CentralBankTracker'
import CentralBankCards from './CentralBankCards'
import UpcomingDecisions from './UpcomingDecisions'
import AudTwiCard from './AudTwiCard'
import { useAudStrength, meanMove } from './useAudStrength'
import SafeChart from '../../components/ui/SafeChart'

// Code-split — three.js/@react-three pull in a large bundle only needed once
// the user actually switches to the 3D surface view.
const YieldCurve3D = lazy(() => import('../../components/visualisations/YieldCurve3D'))

// ─── 5-Country Yield Curve Data — July 2026 ──────────────────────────────────

const YIELD_CURVES = {
  AU: {
    label: 'AU GOV BONDS', color: '#C9A84C', src: 'AOFM / RBA · Aug 2026',
    points: [
      { m:'3M', y:3.88 }, { m:'6M', y:3.80 }, { m:'1Y', y:3.72 },
      { m:'2Y', y:3.65 }, { m:'3Y', y:3.75 }, { m:'5Y', y:3.90 },
      { m:'10Y',y:4.20 }, { m:'30Y',y:4.55 },
    ],
    prev: { '3M':4.10,'6M':4.05,'1Y':3.98,'2Y':3.90,'3Y':3.95,'5Y':4.08,'10Y':4.25,'30Y':4.40 },
  },
  US: {
    label: 'US TREASURIES', color: '#2D7DD2', src: 'US Treasury · Aug 2026',
    points: [
      { m:'3M', y:4.30 }, { m:'6M', y:4.22 }, { m:'1Y', y:4.15 },
      { m:'2Y', y:4.10 }, { m:'5Y', y:4.25 }, { m:'10Y',y:4.45 },
      { m:'30Y',y:4.85 },
    ],
    prev: { '3M':4.32,'6M':4.28,'1Y':4.15,'2Y':4.05,'5Y':4.12,'10Y':4.38,'30Y':4.62 },
  },
  UK: {
    label: 'UK GILTS', color: '#a855f7', src: 'UK DMO · Jul 2026',
    points: [
      { m:'3M', y:4.45 }, { m:'6M', y:4.38 }, { m:'1Y', y:4.20 },
      { m:'2Y', y:4.10 }, { m:'5Y', y:4.18 }, { m:'10Y',y:4.42 },
      { m:'30Y',y:4.85 },
    ],
    prev: { '3M':4.50,'6M':4.42,'1Y':4.25,'2Y':4.15,'5Y':4.22,'10Y':4.48,'30Y':4.90 },
  },
  JP: {
    label: 'JP BONDS (JGBs)', color: '#14b8a6', src: 'MOF Japan · Jul 2026',
    points: [
      { m:'3M', y:0.35 }, { m:'6M', y:0.42 }, { m:'1Y', y:0.55 },
      { m:'2Y', y:0.72 }, { m:'5Y', y:1.05 }, { m:'10Y',y:1.42 },
      { m:'30Y',y:2.18 },
    ],
    prev: { '3M':0.30,'6M':0.38,'1Y':0.50,'2Y':0.68,'5Y':1.00,'10Y':1.38,'30Y':2.12 },
  },
  DE: {
    label: 'DE BUNDS', color: '#2D8A50', src: 'Bundesbank · Jul 2026',
    points: [
      { m:'3M', y:2.18 }, { m:'6M', y:2.12 }, { m:'1Y', y:2.05 },
      { m:'2Y', y:2.02 }, { m:'5Y', y:2.15 }, { m:'10Y',y:2.48 },
      { m:'30Y',y:2.82 },
    ],
    prev: { '3M':2.25,'6M':2.18,'1Y':2.10,'2Y':2.08,'5Y':2.20,'10Y':2.52,'30Y':2.88 },
  },
}


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
      <div className="text-2xs text-terminal-red font-bold tracking-widest">RATES UNAVAILABLE — RETRYING...</div>
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

const FLAG_BY_CCY = {
  AUD: '🇦🇺', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CNY: '🇨🇳', NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭', SEK: '🇸🇪', SGD: '🇸🇬',
}

function RateBadge({ dir }) {
  const cls = dir === 'hike' ? 'border-terminal-red/40 text-terminal-red'
    : dir === 'cut' ? 'border-terminal-green/40 text-terminal-green'
    : 'border-terminal-gold/40 text-terminal-gold'
  return <span className={`px-1.5 py-0.5 border text-2xs font-bold uppercase ${cls}`}>{dir ?? 'hold'}</span>
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
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
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
            <SafeChart width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="fxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#0F1E35" vertical={false} />
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
                  stroke="#C9A84C"
                  strokeWidth={2}
                  fill="url(#fxGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#C9A84C' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </SafeChart>
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

function YieldTooltip({ active, payload, label }) {
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

// ─── RBA section: real-rate comparison bar + last-10-decisions table ───────

function RbaRateComparisonBar() {
  // Reuses the same figures already surfaced elsewhere (CPI YoY 3.8%, RBA
  // cash rate 4.35%, AU 10Y 4.20%) rather than re-deriving them, so the bar
  // stays consistent with the CPI and yield-curve panels if those change.
  const rows = [
    { label: 'RBA CASH RATE', value: 4.35, color: '#C9A84C' },
    { label: 'AU CPI YoY',    value: 3.8,  color: '#2D7DD2' },
    { label: 'AU 10Y YIELD',  value: YIELD_CURVES.AU.points.find(p => p.m === '10Y')?.y ?? 4.20, color: '#2D8A50' },
  ]
  const max = Math.max(...rows.map(r => r.value)) * 1.15
  const realRate = (4.35 - 3.8).toFixed(2)
  return (
    <div className="p-2 border-b border-terminal-border">
      <div className="text-2xs text-terminal-gold font-bold mb-1.5 tracking-widest">REAL RATES CHECK</div>
      <div className="flex flex-col gap-1.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-2xs mb-0.5">
              <span className="text-terminal-text-dim">{r.label}</span>
              <span className="font-bold text-terminal-text-bright">{r.value.toFixed(2)}%</span>
            </div>
            <div className="w-full h-1.5 bg-terminal-surface2 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-2xs text-terminal-text-dim">
        Real cash rate (RBA − CPI): <span className={realRate >= 0 ? 'text-terminal-green font-bold' : 'text-terminal-red font-bold'}>
          {realRate >= 0 ? '+' : ''}{realRate}%
        </span> — {realRate >= 0 ? 'positive, policy is restrictive' : 'negative, policy is still accommodative'}
      </div>
    </div>
  )
}

function RbaDecisionHistory() {
  const last10 = useMemo(() => {
    const rows = RBA_RATE_HISTORY.slice(-10)
    return rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1].rate : rows[0].rate
      const decision = r.rate > prev ? 'hike' : r.rate < prev ? 'cut' : 'hold'
      return { ...r, decision }
    }).reverse()
  }, [])
  return (
    <div className="p-2">
      <div className="text-2xs text-terminal-gold font-bold mb-1.5 tracking-widest">LAST 10 RBA DECISIONS</div>
      <table className="terminal-table w-full">
        <thead>
          <tr>
            <th className="px-1 text-left">DATE</th>
            <th className="px-1 text-right">RATE</th>
            <th className="px-1 text-center">DECISION</th>
          </tr>
        </thead>
        <tbody>
          {last10.map(r => (
            <tr key={r.date}>
              <td className="px-1 py-0.5 text-2xs text-terminal-text-dim">{r.date}</td>
              <td className="px-1 py-0.5 text-2xs text-right font-semibold text-terminal-text-bright">{r.rate.toFixed(2)}%</td>
              <td className="px-1 py-0.5 text-center"><RateBadge dir={r.decision} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Compact RBA dashboard — 2-line header + step chart + period pills,
// left column of the SECTION 2 comparison. ─────────────────────────────────

const RBA_PERIODS = [['2Y', 2], ['5Y', 5], ['10Y', 10], ['ALL', Infinity]]

function RbaStepTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const prevRate = payload[0]?.payload?.__prev
  const rate = payload[0].value
  const decision = prevRate == null ? null : rate > prevRate ? 'HIKE' : rate < prevRate ? 'CUT' : 'HOLD'
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1.5 text-2xs">
      <div className="text-terminal-text-dim">{new Date(label + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      <div className="text-terminal-gold font-semibold">{rate.toFixed(2)}%{decision ? ` · ${decision}` : ''}</div>
    </div>
  )
}

function CompactRbaDashboard({ askAI }) {
  const [period, setPeriod] = useState('5Y')
  const nextRbaDate = useMemo(() => getNextMeeting(RBA_MEETINGS_2026), [])
  const nextRbaLabel = nextRbaDate ? nextRbaDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'

  const chartData = useMemo(() => {
    const years = RBA_PERIODS.find(([k]) => k === period)?.[1] ?? Infinity
    // Cutoff is relative to the data's own latest point, not the wall clock —
    // this is a fixed historical series, so "5Y" means 5 years of history,
    // not 5 years before whenever the page happens to render.
    const latest = new Date(RBA_RATE_HISTORY[RBA_RATE_HISTORY.length - 1].date + 'T00:00:00')
    const cutoff = years === Infinity ? null : new Date(latest.getTime() - years * 365 * 86400000)
    const rows = cutoff ? RBA_RATE_HISTORY.filter(r => new Date(r.date + 'T00:00:00') >= cutoff) : RBA_RATE_HISTORY
    return rows.map((r, i) => ({ ...r, __prev: i > 0 ? rows[i - 1].rate : null }))
  }, [period])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RbaHeroCard
        onAskAI={() => askAI({
          name: 'RBA Cash Rate', price: '4.35% p.a.', sector: 'Interest Rates', date: todayAEST(),
          instruction: `What is the RBA likely to do at the next meeting on ${nextRbaLabel} and why? Current cash rate 4.35%.`,
        })}
      />

      <div className="flex items-center gap-1 px-2 py-1 border-b border-terminal-border flex-shrink-0">
        {RBA_PERIODS.map(([k]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`text-2xs px-2 py-0.5 rounded-full border transition-colors ${
              period === k ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold'
            }`}
          >{k}</button>
        ))}
      </div>

      <div className="flex-shrink-0 px-2 py-2" style={{ height: 220 }}>
        <SafeChart width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="rbaCompactGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#0F1E35" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 8 }} interval="preserveStartEnd"
              tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })} />
            <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${v}%`} domain={[0, 5]} width={30} />
            <Tooltip content={<RbaStepTooltip />} />
            <Area type="stepAfter" dataKey="rate" stroke="#C9A84C" strokeWidth={1.5} fill="url(#rbaCompactGrad)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </SafeChart>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <RbaRateComparisonBar />
        <RbaDecisionHistory />
      </div>
    </div>
  )
}

// ─── Policy panel — what is actually known about the next decisions ───────
//
// This panel used to be headed "MARKET IMPLIES" and showed "82% HOLD / 18%
// CUT" for the RBA and "65% / 35%" for the FOMC, above four named banks'
// forecasts. Every one of those figures was a literal typed into this file.
// There is no rate-futures feed connected to this app, and there never was —
// the numbers described nothing, had no as-of date, and did not move.
//
// That is the same failure as the fabricated Brent price in the morning brief,
// and worse in one respect: a market-implied cut probability is precisely the
// figure someone positions against, and attributing a HOLD call to CBA by name
// makes a claim about a real institution's published view.
//
// Replaced with what verifiedConstants actually holds — the last decision, the
// current level, and the scheduled date of the next meeting — plus an explicit
// statement that market pricing is not connected. Removing the number entirely
// rather than labelling it, for the same reason the scanner's breakout prices
// were removed: there is then nothing left to misread.

function PolicyRow({ label, rate, verb, decidedOn, nextMeeting, now }) {
  const next = nextMeeting ? new Date(`${nextMeeting}T00:00:00`) : null
  const days = next ? Math.max(0, Math.ceil((next - now) / 86400000)) : null
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-2xs text-terminal-text-dim">{label}</span>
        <span className="text-xs font-bold text-terminal-gold tabular-nums">{rate}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs text-terminal-text-dim/70">
          Last: <span className="text-terminal-text-bright font-semibold">{verb}</span>
          {decidedOn ? ` · ${new Date(`${decidedOn}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}
        </span>
        {next && (
          <span className="text-2xs text-terminal-text-dim/70 whitespace-nowrap">
            Next: {next.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            <span className="text-terminal-gold/80"> ({days}d)</span>
          </span>
        )}
      </div>
    </div>
  )
}

function MarketPricingPanel() {
  const { rba, fed } = VERIFIED_CONSTANTS
  // Captured once rather than read in the render body: a clock read during
  // render makes "12d away" change only when something unrelated re-renders,
  // and makes the component non-idempotent.
  const [now] = useState(() => Date.now())
  // fed.cashRate is the TOP of the target range (4.50 of 4.25-4.50), not its
  // midpoint — the label below says so. Deriving a midpoint would mean parsing
  // rateRange, a display string, in a render body: it would work until someone
  // changed an en dash to a hyphen, and then it would be quietly wrong rather
  // than broken.
  const auUsSpread = rba.cashRate - fed.cashRate
  return (
    <div className="p-2 border-t border-terminal-border flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">POLICY SETTINGS</span>
        <VerifiedBadge dataKey="rba" alwaysShow />
      </div>

      <PolicyRow
        label="RBA cash rate"
        rate={`${rba.cashRate}%`}
        verb={rba.lastDecisionVerb}
        decidedOn={rba.lastDecision}
        nextMeeting={rba.nextMeeting}
        now={now}
      />
      <PolicyRow
        label="US Fed funds"
        rate={fed.rateRange}
        verb={fed.lastDecisionVerb}
        decidedOn={fed.lastDecision}
        nextMeeting={fed.nextMeeting}
        now={now}
      />

      {/* The AU-US policy spread — derived from the two rates above rather
          than maintained separately, so it cannot disagree with them. The Fed
          target is a range, so the midpoint is used and the label says so.
          This is the one comparative number this panel can state honestly, and
          it is the one that matters for the currency. */}
      <div className="mt-2 pt-2 border-t border-terminal-border/50">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xs text-terminal-text-dim">AU − US spread</span>
          <span className="text-2xs font-bold tabular-nums" style={{ color: auUsSpread >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {auUsSpread >= 0 ? '+' : '−'}{Math.abs(auUsSpread).toFixed(2)}pp
          </span>
        </div>
        <div className="text-2xs text-terminal-text-dim/50">RBA cash rate vs Fed target upper bound</div>
      </div>

      <div className="mt-2 pt-2 border-t border-terminal-border/50">
        <div className="text-2xs text-terminal-text-dim/60 leading-snug">
          No rate-futures feed is connected, so no market-implied probability of a
          hold or cut is shown. Figures above are the published settings.
        </div>
      </div>
    </div>
  )
}

// ─── Yield curve — AU vs US shown together by default (dual-country panel
// for SECTION 2's right column; the full 5-country selector interaction
// stays available via the props passed in from the module). ────────────────

// ON THE PERIOD TOGGLE, AND WHY IT HAS TWO OPTIONS RATHER THAN FOUR.
//
// The obvious control here is [TODAY] [3M AGO] [6M AGO] [1Y AGO] with a faded
// ghost line for whichever is picked. There is no 3-, 6- or 12-month yield
// series in this build. Generating one — shifting each point by a seeded
// pseudo-random ±0.2 so it looks plausible and stays stable between renders —
// would put a line on a chart labelled "6M AGO" that describes nothing. It
// would be the most convincing fabricated figure in the terminal, because a
// curve reads as data in a way a single number does not.
//
// What DOES exist is `prev`: the previous published curve for both countries,
// already carried in YIELD_CURVES and already used by this module's tooltip
// and by the spread monitor. So the toggle offers the comparison that is real,
// and says plainly that the others are not available rather than drawing them.

function YieldCurveDualPanel({ chartData, yMin, yMax, primaryStats }) {
  const { shape } = primaryStats
  const [ghost, setGhost] = useState(false)
  // Both curves' 2s10s, in basis points. The shape word alone says which side
  // of zero the curve is on; the number says how far, and "+15bp" versus
  // "+120bp" are different worlds wearing the same NORMAL label. The US badge
  // is what makes the pair worth showing side by side at all — an inverted US
  // curve beside a normal AU one is the single most-watched divergence in this
  // module.
  const auStats = getCurveStats('AU')
  const usStats = getCurveStats('US')
  const bp = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}bp`)
  const toneFor = (sh) => sh === 'INVERTED' ? 'border-terminal-red/40 text-terminal-red'
    : sh === 'FLAT' ? 'border-terminal-gold/40 text-terminal-gold'
    : 'border-terminal-green/40 text-terminal-green'
  return (
    <div className="flex flex-col h-full border-b border-terminal-border">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        <span className="text-terminal-gold">YIELD CURVE</span>
        <span className="font-bold" style={{ color: YIELD_CURVES.AU.color }}>AU</span>
        <span className="text-terminal-text-dim">vs</span>
        <span className="font-bold" style={{ color: YIELD_CURVES.US.color }}>US</span>
        <span className={`ml-auto text-2xs px-1.5 py-0.5 border font-bold ${
          shape === 'INVERTED' ? 'border-terminal-red/40 text-terminal-red' :
          shape === 'FLAT'     ? 'border-terminal-gold/40 text-terminal-gold' :
                                  'border-terminal-green/40 text-terminal-green'
        }`}>{shape === '—' ? 'NORMAL CURVE' : `${shape} CURVE`}</span>
      </div>

      {/* 2s10s for each curve, under the header where the legend colours are. */}
      <div className="flex items-center gap-3 px-2 py-1 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
        <span className="text-2xs text-terminal-text-dim/60 tracking-wider" style={{ fontSize: 8 }}>2s10s SPREAD</span>
        {[['AU', auStats, YIELD_CURVES.AU.color], ['US', usStats, YIELD_CURVES.US.color]].map(([lbl, st, col]) => (
          <span key={lbl} className="flex items-center gap-1.5">
            <span className="text-2xs font-bold" style={{ color: col }}>{lbl}</span>
            <span className="text-2xs font-mono tabular-nums text-terminal-text-bright">{bp(st.spread)}</span>
            <span className={`badge ${toneFor(st.shape)}`} style={{ borderWidth: 1, borderStyle: 'solid' }}>{st.shape}</span>
          </span>
        ))}
      </div>
      {/* Period comparison. TODAY is always drawn at full opacity; the ghost
          is the previous published curve at 30%. */}
      <div className="flex items-center gap-1 px-2 py-1 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
        {[[false, 'TODAY'], [true, '+ PREV CURVE']].map(([val, label]) => (
          <button
            key={label}
            onClick={() => setGhost(val)}
            className={`text-2xs px-2 py-0.5 rounded-full border transition-colors ${
              ghost === val
                ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold'
                : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold'
            }`}
          >{label}</button>
        ))}
        {ghost ? (
          <span className="ml-auto flex items-center gap-2 text-terminal-text-dim/60" style={{ fontSize: 8 }}>
            <span className="flex items-center gap-1">
              <span style={{ width: 12, height: 2, background: '#C9A84C', display: 'inline-block' }} />today
            </span>
            <span className="flex items-center gap-1">
              <span style={{ width: 12, height: 2, background: '#C9A84C', opacity: 0.3, display: 'inline-block' }} />previous
            </span>
          </span>
        ) : (
          <span className="ml-auto text-terminal-text-dim/45 truncate" style={{ fontSize: 8 }}
            title="No 3-, 6- or 12-month yield series is held in this build, so no older ghost curve can be drawn without inventing one.">
            no 3M/6M/1Y series held — only the previous curve
          </span>
        )}
      </div>

      <div style={{ height: 160 }} className="px-2 py-2">
        <SafeChart width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#0F1E35" vertical={false} />
            <XAxis dataKey="tenor" tick={{ fontSize: 8 }} />
            <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${v.toFixed(1)}%`} domain={[yMin, yMax]} width={36} />
            <Tooltip content={<YieldTooltip />} />
            {/* Ghosts first, so today's curves paint over them. */}
            {ghost && (
              <Line type="monotone" dataKey="AUprev" stroke={YIELD_CURVES.AU.color} strokeOpacity={0.3}
                strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
            )}
            {ghost && (
              <Line type="monotone" dataKey="USprev" stroke={YIELD_CURVES.US.color} strokeOpacity={0.3}
                strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
            )}
            <Line type="monotone" dataKey="AU" stroke={YIELD_CURVES.AU.color} strokeWidth={2} dot={{ fill: YIELD_CURVES.AU.color, r: 2.5 }} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="US" stroke={YIELD_CURVES.US.color} strokeWidth={2} strokeDasharray="5 3" dot={{ fill: YIELD_CURVES.US.color, r: 2.5 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </SafeChart>
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-center overflow-y-auto">
        <MarketPricingPanel />
      </div>
    </div>
  )
}

// ─── Bond spreads — compact interpretation table ────────────────────────────

function bp(v) { return `${v >= 0 ? '+' : ''}${Math.round(v * 100)}bp` }

function BondSpreadsTable() {
  const au10 = YIELD_CURVES.AU.points.find(p => p.m === '10Y')?.y
  const us10 = YIELD_CURVES.US.points.find(p => p.m === '10Y')?.y
  const au2  = YIELD_CURVES.AU.points.find(p => p.m === '2Y')?.y
  const uk10 = YIELD_CURVES.UK.points.find(p => p.m === '10Y')?.y
  const jp10 = YIELD_CURVES.JP.points.find(p => p.m === '10Y')?.y
  const de10 = YIELD_CURVES.DE.points.find(p => p.m === '10Y')?.y

  const rows = [
    { name: 'AU vs US 10Y',  value: au10 - us10, note: Math.abs(au10 - us10) < 0.1 ? 'Near parity' : au10 > us10 ? 'AU pays more' : 'US pays more' },
    { name: 'AU 2Y vs 10Y',  value: au10 - au2,  note: au10 - au2 > 0.15 ? 'Steepening' : au10 - au2 > 0 ? 'Mildly steep' : 'Flat/inverted' },
    { name: 'AU vs UK 10Y',  value: au10 - uk10, note: au10 > uk10 ? 'AU pays more' : 'UK pays more' },
    { name: 'AU vs JP 10Y',  value: au10 - jp10, note: 'AU carry premium vs Japan' },
    { name: 'AU vs DE 10Y',  value: au10 - de10, note: au10 > de10 ? 'AU pays more' : 'DE pays more' },
  ]

  return (
    <div className="border-t border-terminal-border flex-shrink-0">
      <div className="panel-header">BOND SPREADS</div>
      <table className="terminal-table w-full">
        <tbody>
          {rows.map(r => (
            <tr key={r.name}>
              <td className="px-2 py-1 text-2xs text-terminal-text-dim">{r.name}</td>
              <td className={`px-1 py-1 text-2xs text-right font-bold ${r.value >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>{bp(r.value)}</td>
              <td className="px-2 py-1 text-2xs text-terminal-text-dim/70">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── FX rates grid — compact 2-col x 5-row, flag + pair + rate + 1D change ──

function FxRatesGrid({ pairs, isFetching, onSelectPair }) {
  const top10 = pairs.slice(0, 10)
  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        <span className="text-terminal-gold">FX RATES</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case">AUD BASE</span>
        {isFetching && <span className="text-2xs text-terminal-text-dim font-normal animate-pulse ml-auto">LOADING...</span>}
      </div>
      <div className="grid grid-cols-2">
        {top10.map(p => {
          const dec = rateDecimals(p.pair)
          const base = p.pair.split('/')[0]
          const flag = FLAG_BY_CCY[base] ?? '🏳'
          const pct = p.pct ?? 0
          return (
            <button
              key={p.pair}
              onClick={() => onSelectPair(p.pair)}
              className="flex items-center gap-2 px-2 py-1.5 border-r border-b border-terminal-border hover:bg-terminal-accent/20 transition-colors text-left"
            >
              <span className="text-sm flex-shrink-0">{flag}</span>
              <span className="text-2xs font-bold text-terminal-text-bright flex-shrink-0 w-16">{p.pair}</span>
              <span className="text-2xs text-terminal-text-bright ml-auto">{p.mid?.toFixed(dec)}</span>
              <span className={`text-2xs w-14 text-right flex-shrink-0 ${pct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── FX section: currency strength index + AUD TWI ─────────────────────────

// The 30-day series and the mean now live in useAudStrength, shared with the
// TWI card above the FX grid. Same query key, so it is still one set of
// requests however many panels read it.

function CurrencyStrengthIndex() {
  const results = useAudStrength()
  const rows = results.data ?? []
  const mean = meanMove(rows)
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.pct ?? 0)))

  return (
    <div className="border-t border-terminal-border p-2 flex-shrink-0">
      <div className="text-2xs text-terminal-gold font-bold mb-1.5 tracking-widest">
        AUD STRENGTH VS MAJORS (30D)
        {results.isFetching && <span className="text-terminal-text-dim font-normal normal-case ml-1 animate-pulse">...</span>}
      </div>
      <div className="flex flex-col gap-1">
        {rows.length === 0 && !results.isFetching && (
          <div className="text-2xs text-terminal-text-dim/60">Unavailable</div>
        )}
        {rows.map(({ ccy, pct }) => (
          <div key={ccy} className="flex items-center gap-1.5">
            <span className="text-2xs text-terminal-text-dim w-8 flex-shrink-0">{ccy}</span>
            <div className="flex-1 h-2.5 relative bg-terminal-surface2 rounded-sm overflow-hidden">
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-terminal-border-gold" />
              {pct != null && (
                <div
                  className={`absolute top-0 bottom-0 ${pct >= 0 ? 'bg-terminal-green' : 'bg-terminal-red'}`}
                  style={{
                    width: `${(Math.abs(pct) / maxAbs / 2) * 100}%`,
                    left: pct >= 0 ? '50%' : `${50 - (Math.abs(pct) / maxAbs / 2) * 100}%`,
                  }}
                />
              )}
            </div>
            <span className={`text-2xs w-14 text-right flex-shrink-0 font-semibold ${
              pct == null ? 'text-terminal-text-dim' : pct >= 0 ? 'text-terminal-green' : 'text-terminal-red'
            }`}>
              {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
      {/* The TWI moved to its own card above the FX grid, where it has the
          room to carry its source and its date. What belongs here is the
          summary of the bars directly above it. */}
      {mean != null && (
        <div className="mt-2 pt-2 border-t border-terminal-border/50 flex items-center justify-between">
          <span className="text-2xs text-terminal-text-dim">MEAN ACROSS MAJORS</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: mean >= 0 ? '#2D8A50' : '#CC4444' }}>
            {mean >= 0 ? '+' : ''}{mean.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  )
}

export default function FXModule() {
  const { openModal } = useStore()
  const { canAccess, tier } = useSubscription()
  const [historyPair, setHistoryPair] = useState(null)
  const [fxAttemptKey, setFxAttemptKey]   = useState(0)
  const [yieldView3D, setYieldView3D] = useState(false)

  const askAI = (fields) => dispatchAskAI(fields)

  // Frankfurter — no key needed. fetchFxRates already retries 3x + tries a
  // direct (non-proxied) call internally; fetchFxRatesUnified adds a final
  // stale-cache safety net on top for total failure. Shared queryKey with
  // TickerTape (fetch) and AIPanel (passive read) — all three now expect the
  // same { data, stale, source } envelope.
  const { data: fxResult, isError, isFetching, refetch } = useQuery({
    queryKey: ['fxRates'],
    queryFn:  () => fetchFxRatesUnified('AUD'),
    staleTime: 5 * 60_000,
    retry: false,
    enabled: canAccess('prime'),
  })
  const rawRates  = fxResult?.data
  const fxDelayed = fxResult?.stale === true

  const handleFxRetry = () => { setFxAttemptKey((k) => k + 1); refetch() }

  // Metals: tries Frankfurter (ECB XAU) then ExchangeRate-API
  const { data: metalsRates } = useQuery({
    queryKey: ['metalsRates'],
    queryFn:  fetchMetalsRates,
    staleTime: 10 * 60_000,
    retry: 1,
    enabled: canAccess('prime'),
  })

  const pairs      = rawRates ? transformFxRates(rawRates) : []
  const isLive     = !!rawRates && !isError
  const audUsd     = rawRates?.USD ?? null
  const metals     = metalsRates ? extractMetals(metalsRates) : []

  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  // Yield curve chart data — AU vs US, the pairing SECTION 2 always shows
  const allTenors = useMemo(() => {
    const tenorSet = new Set()
    YIELD_CURVES.AU.points.forEach(p => tenorSet.add(p.m))
    YIELD_CURVES.US.points.forEach(p => tenorSet.add(p.m))
    const ORDER = ['3M','6M','1Y','2Y','3Y','5Y','10Y','30Y']
    return ORDER.filter(t => tenorSet.has(t))
  }, [])

  // Both the current curve and the previous published one. `prev` is already
  // in YIELD_CURVES and already drives the tooltip's "vs prev mo" and the
  // spread monitor's move — the ghost lines draw the same numbers rather than
  // introducing a second version of last month.
  const chartData = useMemo(() => allTenors.map(tenor => ({
    tenor,
    AU: YIELD_CURVES.AU.points.find(p => p.m === tenor)?.y ?? null,
    US: YIELD_CURVES.US.points.find(p => p.m === tenor)?.y ?? null,
    AUprev: YIELD_CURVES.AU.prev?.[tenor] ?? null,
    USprev: YIELD_CURVES.US.prev?.[tenor] ?? null,
  })), [allTenors])

  const allYieldValues = chartData.flatMap(r => [r.AU, r.US]).filter(v => typeof v === 'number')
  const yMin = allYieldValues.length ? Math.floor((Math.min(...allYieldValues) - 0.2) * 10) / 10 : 0
  const yMax = allYieldValues.length ? Math.ceil( (Math.max(...allYieldValues) + 0.2) * 10) / 10 : 6

  const auCurveStats = getCurveStats('AU')

  if (!canAccess('prime')) {
    return (
      <div className="h-full flex flex-col overflow-hidden relative">
        <ModuleHeader title="RATES" subtitle="FX Pairs · Yield Curves · Metals" />
        <UpgradePrompt feature="Rates & FX Module" requiredTier="prime" currentTier={tier} />
      </div>
    )
  }

  return (
    <>
    <div className="h-full flex flex-col overflow-y-auto overflow-x-hidden">
    <ModuleHeader
      title="RATES"
      subtitle="FX Pairs · Yield Curves · Metals"
      moduleId="fx"
      isFetching={isFetching}
      lastUpdated={fxResult?.cachedAt}
      onRefresh={refetch}
    />

    {/* SECTION 1 — global policy rates, expandable comparison cards */}
    <CentralBankCards />

    {/* SECTION 2 — RBA (left 55%) vs yield curve + market pricing (right 45%) */}
    <div className="flex border-b border-terminal-border flex-shrink-0" style={{ height: 480 }}>
      <div className="h-full border-r border-terminal-border" style={{ width: '55%' }}>
        <CompactRbaDashboard askAI={askAI} />
      </div>
      <div className="h-full" style={{ width: '45%' }}>
        <YieldCurveDualPanel chartData={chartData} yMin={yMin} yMax={yMax} primaryStats={auCurveStats} />
      </div>
    </div>

    {/* SECTION 2b — central bank tracker: RBA decision timeline, last decision
        by bank, AU/US spread and the 90-day meeting calendar. */}
    <div className="border-b border-terminal-border flex-shrink-0">
      <CentralBankTracker curves={YIELD_CURVES} />
    </div>

    {/* SECTION 2c — AUD trade-weighted index. Full width above the FX grid
        rather than inside its 60% column: it is the headline AUD number and
        needs the room to carry its source, its date and the measured 30-day
        move beside it. */}
    <AudTwiCard />

    {/* SECTION 3 — FX rates grid + converter + strength index */}
    <div className="flex flex-shrink-0">
      <div className="flex flex-col border-r border-terminal-border" style={{ width: '60%' }}>
        {isFetching && !rawRates ? (
          <ModuleLoader name="RATES" />
        ) : !isLive ? (
          <FxRetryCountdown key={fxAttemptKey} onRetry={handleFxRetry} />
        ) : (
          <FxRatesGrid pairs={pairs} isFetching={isFetching} onSelectPair={setHistoryPair} />
        )}
        {audUsd && (
          <div className="border-b border-terminal-border p-2 flex-shrink-0">
            <div className="text-2xs text-terminal-gold font-bold mb-1">AUD/USD · LIVE</div>
            <div className="text-2xl font-bold text-terminal-text-bright">{audUsd.toFixed(4)}</div>
            <div className="text-2xs text-terminal-text-dim mt-0.5">1 AUD = {audUsd.toFixed(4)} USD · 1 USD = {(1 / audUsd).toFixed(4)} AUD</div>
            <div className="text-2xs text-terminal-text-dim mt-0.5">{updatedTime} AEST · Frankfurter{fxDelayed ? ' · STALE' : ''}</div>
          </div>
        )}
        <CurrencyConverter rates={rawRates} />
      </div>
      <div className="flex flex-col" style={{ width: '40%' }}>
        <CurrencyStrengthIndex />
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

    {/* SECTION 4 — bond spreads */}
    <BondSpreadsTable />

    {/* SECTION 5 — yield curve animation / 3D surface */}
    <div className="border-t border-terminal-border">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-terminal-border/50">
        <span className="text-2xs text-terminal-text-dim tracking-widest">YIELD CURVE OVER TIME</span>
        <div className="ml-auto flex items-center border border-terminal-border rounded-full overflow-hidden">
          <button
            onClick={() => setYieldView3D(false)}
            className={`text-2xs px-2.5 py-0.5 font-bold normal-case transition-colors ${!yieldView3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
          >2D CHART</button>
          <button
            onClick={() => setYieldView3D(true)}
            className={`text-2xs px-2.5 py-0.5 font-bold normal-case transition-colors ${yieldView3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
          >3D SURFACE</button>
        </div>
      </div>
      {yieldView3D ? (
        <div style={{ height: 420 }}>
          <Suspense fallback={<Viz3DLoader />}>
            <YieldCurve3D auCurve={YIELD_CURVES.AU} usCurve={YIELD_CURVES.US} />
          </Suspense>
        </div>
      ) : (
        <YieldCurveAnimator curve={YIELD_CURVES.AU} />
      )}
    </div>

    {/* SECTION 6 — every tracked bank's next 90 days, in order */}
    <UpcomingDecisions />
    </div>
    {historyPair && <FxHistoryModal pair={historyPair} onClose={() => setHistoryPair(null)} />}
    </>
  )
}
