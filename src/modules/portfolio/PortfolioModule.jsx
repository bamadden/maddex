import { useState, useEffect, lazy, Suspense } from 'react'
import { Briefcase } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchYFQuote, USING_MOCK_DATA } from '../../services/api'
import { fetchEquityQuotes } from '../../services/dataService'
import { formatMarketCap } from '../../utils/format'
import { useAudRates } from '../../hooks/useAudRates'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useSubscription } from '../../hooks/useSubscription'
import { supabase } from '../../lib/supabase'
import { fmt, colorClass } from '../../utils/format'
import { StatBox } from '../../components/ui/Panel'
import { DemoBadge, Viz3DLoader } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { toYahooSymbol } from '../../utils/assetUtils'
import { dispatchAskAI } from '../../utils/askAI'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Line } from 'recharts'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'
import StressTest from './StressTest'
import PortfolioAnalytics from './PortfolioAnalytics'
import PortfolioBuilderModal from '../../components/portfolioBuilder/PortfolioBuilderModal'
import PortfolioSnapshot from '../../components/portfolio/PortfolioSnapshot'
import { logActivity } from '../../services/activityLogService'
import { SkeletonCard } from '../../components/ui/Skeleton'
import AnimatedNumber from '../../components/ui/AnimatedNumber'

const TABS = [
  { key: 'holdings',    label: 'HOLDINGS' },
  { key: 'performance', label: 'PERFORMANCE' },
  { key: 'stresstest',  label: 'STRESS TEST' },
  { key: 'ai',          label: 'AI ANALYSIS' },
  { key: 'analytics',   label: 'ANALYTICS' },
]

// Code-split — three.js/@react-three pull in a large bundle only needed
// once the user actually switches to the 3D view.
const Portfolio3D = lazy(() => import('../../components/visualisations/Portfolio3D'))

const STORAGE_KEY = 'madden_portfolio_v2'

const CRYPTO_SYMS = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','AVAX','DOGE','DOT','MATIC','LINK','LTC','ATOM','OP','ARB','NEAR','APT','SUI'])
const ASX_KNOWN   = new Set(['BHP','CBA','CSL','ANZ','WBC','NAB','WOW','RIO','MQG','TLS','FMG','MIN','PLS','WDS','ORG','REA','WTC','XRO','AGL','IAG','QBE','STO','WPL','ALL','GMG'])

function detectType(sym) {
  const s = sym.toUpperCase().replace(/\.AX$|:ASX$/, '').trim()
  if (CRYPTO_SYMS.has(s)) return 'crypto'
  const raw = sym.toUpperCase()
  if (raw.endsWith('.AX') || raw.endsWith(':ASX') || ASX_KNOWN.has(s)) return 'asx'
  return 'us'
}

function cleanSymbol(sym, type) {
  const s = sym.toUpperCase().trim()
  if (type === 'asx') return s.replace(/\.AX$|:ASX$/, '')
  return s
}

// Rotating palette for the per-stock donut — cycles once holdings outnumber
// the palette, which is fine since colors only need to be locally distinct.
const STOCK_PALETTE = ['#C9A84C', '#1e5fa8', '#9b59b6', '#2ea05a', '#e0685a', '#4ac9c9', '#d4a72c', '#7986cb', '#f06292', '#81c784']

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <span className="text-terminal-gold">{payload[0].name}: </span>
      <span className="text-terminal-text-bright">{fmt.aud(payload[0].value)}</span>
    </div>
  )
}

// symbol (no .AX suffix, uppercase) -> GICS sector, for holdings that match
// a tracked demo stock. Anything else (a real ticker not in the demo
// universe, or crypto) falls back to 'Other' in the sector breakdown.
const SECTOR_BY_SYMBOL = Object.fromEntries([
  ...Object.entries(MOCK_ASX_STOCKS).map(([sym, s]) => [sym.replace(/\.AX$/, ''), s.sector]),
  ...Object.entries(MOCK_US_STOCKS).map(([sym, s]) => [sym, s.sector]),
])

// ─── Sector / Country / Currency allocation breakdown ─────────────────────────

function BreakdownBars({ title, rows }) {
  if (!rows.length) return null
  return (
    <div className="px-2 py-2 border-t border-terminal-border">
      <div className="text-2xs text-terminal-text-dim tracking-widest mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="space-y-0.5">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-terminal-text">{r.label}</span>
              <span className="text-terminal-text-dim">{r.pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-terminal-border/40 rounded-sm overflow-hidden">
              <div className="h-full bg-terminal-gold" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AI Analysis tab — example fallback ────────────────────────────────────
// The real "RUN AI ANALYSIS" button calls the Claude API, which fails at
// zero credit balance like every other AI entry point this session. Rather
// than leave the tab showing nothing until that error surfaces in the AI
// panel, this renders a data-driven example computed from the portfolio's
// actual sector mix — clearly labelled as an example, not a substitute.
const COMMON_SECTORS = ['Financials', 'Materials', 'Health Care', 'Information Technology', 'Consumer Discretionary', 'Energy', 'Real Estate', 'Industrials']

function MockAnalysisPreview({ bySector, mktTotal }) {
  const top = bySector[0]
  const diversificationScore = Math.max(15, Math.round(100 - (top?.pct ?? 0) * 0.8))
  const present = new Set(bySector.map((s) => s.label))
  const underweight = COMMON_SECTORS.find((s) => !present.has(s)) ?? 'Financials'
  const concentrated = top && top.pct >= 40

  return (
    <div className="w-full max-w-lg text-left">
      <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-terminal-gold/10 border border-terminal-gold/40 text-terminal-gold text-2xs font-semibold">
        ⚠ EXAMPLE ANALYSIS — add AI credits to generate your personalised analysis
      </div>
      <div className="space-y-3 text-2xs">
        <div>
          <div className="text-terminal-text-dim/60 tracking-widest mb-1">DIVERSIFICATION SCORE</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-bold text-terminal-gold">{diversificationScore}/100</span>
            <span className="text-terminal-text-dim">
              {diversificationScore >= 70 ? 'Well diversified across sectors' : diversificationScore >= 45 ? 'Moderately concentrated' : 'Highly concentrated — few holdings drive most of the return'}
            </span>
          </div>
        </div>
        <div>
          <div className="text-terminal-text-dim/60 tracking-widest mb-1">TOP RISK</div>
          <div className="text-terminal-text-bright">
            {concentrated
              ? `Concentration in ${top.label} (${top.pct.toFixed(0)}% of portfolio value) — a sector-specific shock would disproportionately affect returns.`
              : 'No single sector dominates the portfolio — concentration risk is currently limited.'}
          </div>
        </div>
        <div>
          <div className="text-terminal-text-dim/60 tracking-widest mb-1">TOP OPPORTUNITY</div>
          <div className="text-terminal-text-bright">Underweight {underweight} — consider whether this sector deserves representation given its typical weight in the ASX 200.</div>
        </div>
        <div>
          <div className="text-terminal-text-dim/60 tracking-widest mb-1">MACRO ALIGNMENT</div>
          <div className="text-terminal-text-bright">RBA on hold at 4.35% with a cautious easing bias — rate-sensitive sectors (Financials, Real Estate) may benefit if cuts arrive in 2027; commodity-heavy portfolios stay exposed to China demand.</div>
        </div>
        <div>
          <div className="text-terminal-text-dim/60 tracking-widest mb-1">SUGGESTIONS</div>
          <ul className="list-disc list-inside space-y-0.5 text-terminal-text-bright">
            <li>Trim the largest single-sector weighting toward the portfolio's long-run average.</li>
            <li>Add exposure to {underweight} to smooth sector-level drawdowns.</li>
            <li>Review currency mix — {fmt.aud(mktTotal, { decimals: 0, clarify: true })} tracked, check AUD/USD exposure against your risk tolerance.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function groupByPct(live, keyFn, othersLabel = 'Other') {
  const totals = {}
  let sum = 0
  for (const h of live) {
    if (!h.mktVal) continue
    const key = keyFn(h)
    totals[key] = (totals[key] ?? 0) + h.mktVal
    sum += h.mktVal
  }
  if (!sum) return []
  const rows = Object.entries(totals)
    .map(([label, value]) => ({ label, pct: (value / sum) * 100 }))
    .sort((a, b) => b.pct - a.pct)
  // Collapse a long tail into "Other" so the bar list stays scannable
  if (rows.length > 4) {
    const top = rows.slice(0, 3)
    const restPct = rows.slice(3).reduce((s, r) => s + r.pct, 0)
    return [...top, { label: othersLabel, pct: restPct }]
  }
  return rows
}

// ─── Performance chart (illustrative demo trajectory) ─────────────────────────
// This app has no real historical-price feed wired into the portfolio yet
// (see the DEMO badges used everywhere else for the same reason), so the
// chart traces a seeded random walk that starts flat and lands exactly on
// today's real mktTotal/pnlPct — the shape is illustrative, the endpoint
// isn't. A deterministic seed (not Math.random()) keeps the line stable
// across re-renders instead of jumping every time state changes elsewhere.
function seededRng(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const PERIODS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }

function buildSeries(days, endValue, cumReturnPct, seed) {
  const rng = seededRng(seed)
  const startValue = endValue / (1 + cumReturnPct / 100)
  const points = []
  for (let i = 0; i < days; i++) {
    const t = days > 1 ? i / (days - 1) : 1
    const target = startValue + (endValue - startValue) * t
    const wobble = (rng() - 0.5) * endValue * 0.02 * (1 - t * 0.6)
    points.push(Math.max(0, target + wobble))
  }
  points[points.length - 1] = endValue
  return points
}

function PerformanceChart({ mktTotal, pnlPct, prefix }) {
  const [period, setPeriod] = useState('1M')
  if (!mktTotal) return null

  const days = PERIODS[period]
  // Scale the demo return by the selected window — a 1Y view shouldn't
  // show the same % move as a 1M view.
  const periodScale = { '1M': 1, '3M': 1.6, '6M': 2.2, '1Y': 3.4 }[period]
  const portfolioReturn = pnlPct * (period === '1M' ? 0.35 : periodScale * 0.35)
  const benchReturn = portfolioReturn * 0.55 - 0.6 // ASX 200 trails slightly, illustratively

  const portfolioSeries = buildSeries(days, mktTotal, portfolioReturn, 1337)
  const benchStart = mktTotal / (1 + portfolioReturn / 100)
  const benchSeries = buildSeries(days, benchStart * (1 + benchReturn / 100), benchReturn, 7331)

  const data = portfolioSeries.map((v, i) => ({ i, portfolio: v, benchmark: benchSeries[i] }))

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        <span>PERFORMANCE</span>
        <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">illustrative — demo pricing history</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-2xs normal-case">
            <span className="text-terminal-text-dim">Your portfolio:</span>{' '}
            <span className={portfolioReturn >= 0 ? 'text-terminal-green font-bold' : 'text-terminal-red font-bold'}>{fmt.pct(portfolioReturn)}</span>
            {' | '}
            <span className="text-terminal-text-dim">ASX 200:</span>{' '}
            <span className={benchReturn >= 0 ? 'text-terminal-green font-bold' : 'text-terminal-red font-bold'}>{fmt.pct(benchReturn)}</span>
          </span>
          <div className="flex border border-terminal-border rounded-full overflow-hidden">
            {Object.keys(PERIODS).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-2xs px-2 py-0.5 font-bold normal-case transition-colors ${period === p ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
              >{p}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-40 px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#0d2244" vertical={false} />
            <XAxis dataKey="i" tick={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 8 }} width={44}
              domain={[(min) => min * 0.99, (max) => max * 1.01]}
              tickFormatter={(v) => `${prefix}${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]?.payload
                if (!p) return null
                return (
                  <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs space-y-0.5">
                    <div><span className="text-terminal-gold">Portfolio: </span><span className="text-terminal-text-bright">{prefix}{p.portfolio.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                    <div><span className="text-terminal-muted">ASX 200: </span><span className="text-terminal-text-dim">{prefix}{p.benchmark.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  </div>
                )
              }}
            />
            <Area type="monotone" dataKey="portfolio" stroke="#C9A84C" strokeWidth={1.5} fill="url(#portfolioFill)" isAnimationActive={false} />
            <Line type="monotone" dataKey="benchmark" stroke="#637899" strokeWidth={1.25} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Add Holding Form ─────────────────────────────────────────────────────────

function AddHoldingForm({ onAdd, onCancel, atLimit, limit }) {
  const [sym,     setSym]     = useState('')
  const [shares,  setShares]  = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [ccy,     setCcy]     = useState('AUD')
  const [vstatus, setVstatus] = useState('idle') // idle | validating | error | ready
  const [verr,    setVerr]    = useState('')
  const [vdata,   setVdata]   = useState(null)

  const handleValidate = async () => {
    const s = sym.toUpperCase().trim()
    if (!s) { setVerr('Enter a ticker symbol'); setVstatus('error'); return }
    setVstatus('validating'); setVerr(''); setVdata(null)

    const type = detectType(s)
    if (type === 'crypto') {
      setVdata({ name: s, type: 'crypto', last: null })
      setVstatus('ready')
      return
    }

    const yfSym = toYahooSymbol(s, type)
    try {
      const q = await fetchYFQuote(yfSym)
      setVdata({ name: q.name || s, type, yfSym, last: q.last })
      setVstatus('ready')
    } catch (e) {
      // If US lookup failed, try as ASX
      if (type === 'us') {
        try {
          const axSym = s + '.AX'
          const q2    = await fetchYFQuote(axSym)
          setVdata({ name: q2.name || s, type: 'asx', yfSym: axSym, last: q2.last })
          setVstatus('ready')
          return
        } catch {}
      }
      const msg      = (e.message ?? '').toLowerCase()
      const notFound = msg.includes('no data') || msg.includes('404') || msg.includes('error')
      setVerr(notFound ? 'TICKER NOT FOUND — check symbol and try again' : (e.message || 'DATA SOURCE ERROR'))
      setVstatus('error')
    }
  }

  const handleAdd = () => {
    if (vstatus !== 'ready' || !vdata) return
    if (atLimit) {
      setVerr(`PORTFOLIO LIMIT REACHED (${limit}) — upgrade to Prime for unlimited`); setVstatus('error'); return
    }
    const sharesN = parseFloat(shares)
    const costN   = parseFloat(avgCost)
    if (!sharesN || sharesN <= 0 || !costN || costN <= 0) {
      setVerr('Enter valid shares and average buy price'); setVstatus('error'); return
    }
    onAdd({
      id:           Date.now().toString(),
      symbol:       cleanSymbol(sym, vdata.type),
      yfSym:        vdata.yfSym,
      name:         vdata.name,
      shares:       sharesN,
      avgCost:      costN,
      costCurrency: ccy,
      type:         vdata.type,
      addedAt:      new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <div className="border border-terminal-border bg-terminal-panel p-3 space-y-2 max-w-xl">
      <div className="text-2xs font-bold text-terminal-gold tracking-widest">ADD HOLDING</div>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-terminal-bg border border-terminal-border px-2 py-1 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono uppercase"
          placeholder="TICKER — e.g. AAPL, BHP.AX, BTC"
          value={sym}
          onChange={(e) => { setSym(e.target.value.toUpperCase()); setVstatus('idle'); setVdata(null) }}
          onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
        />
        <button
          onClick={handleValidate}
          disabled={vstatus === 'validating'}
          className={`px-3 py-1 text-2xs font-bold border transition-colors ${
            vstatus === 'validating' ? 'border-terminal-border text-terminal-text-dim animate-pulse cursor-not-allowed'
            : vstatus === 'ready'   ? 'border-terminal-green text-terminal-green hover:bg-terminal-green/10'
            : 'border-terminal-gold text-terminal-gold hover:bg-terminal-gold/10'
          }`}
        >
          {vstatus === 'validating' ? 'CHECKING...' : vstatus === 'ready' ? '✓ VALIDATED' : 'VALIDATE'}
        </button>
      </div>

      {vstatus === 'ready' && vdata && (
        <div className="text-2xs text-terminal-green px-1">
          ✓ {vdata.name}
          {vdata.type === 'asx'    && ' · ASX'}
          {vdata.type === 'us'     && ' · US EQUITY'}
          {vdata.type === 'crypto' && ' · CRYPTO (use CRYPTO MODULE for live price)'}
          {vdata.last != null && ` · Last: ${vdata.last.toFixed(2)}`}
        </div>
      )}
      {vstatus === 'error' && <div className="text-2xs text-terminal-red px-1">⚠ {verr}</div>}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-2xs text-terminal-text-dim mb-1">SHARES / UNITS</div>
          <input type="number" min="0" step="any" placeholder="0.00" value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold"
          />
        </div>
        <div>
          <div className="text-2xs text-terminal-text-dim mb-1">AVG BUY PRICE</div>
          <input type="number" min="0" step="any" placeholder="0.00" value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold"
          />
        </div>
        <div>
          <div className="text-2xs text-terminal-text-dim mb-1">COST CURRENCY</div>
          <div className="flex border border-terminal-border h-[30px]">
            {['AUD', 'USD'].map((c) => (
              <button key={c} onClick={() => setCcy(c)}
                className={`flex-1 text-2xs font-bold transition-colors ${
                  ccy === c ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleAdd}
          disabled={vstatus !== 'ready'}
          className={`flex-1 py-1.5 text-2xs font-bold border transition-colors ${
            vstatus === 'ready'
              ? 'border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg'
              : 'border-terminal-border/30 text-terminal-text-dim/40 cursor-not-allowed'
          }`}
        >
          ADD TO PORTFOLIO
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-2xs border border-terminal-border text-terminal-text-dim hover:text-terminal-text-bright transition-colors">
          CANCEL
        </button>
      </div>
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

const PORTFOLIO_LIMIT = 10 // Core tier — Prime+ is unlimited

export default function PortfolioModule() {
  const { openModal, currency } = useStore()
  const { user, profile } = useAuthStore()
  const [showSnapshot, setShowSnapshot] = useState(false)
  const { canAccess } = useSubscription()
  const { usdToAud, audUsd }   = useAudRates()
  const displayMul = currency === 'USD' ? audUsd : 1
  const prefix     = currency === 'USD' ? 'US$' : 'A$'

  const fmtCur = (audVal) => {
    if (audVal == null || isNaN(audVal)) return '—'
    const v   = audVal * displayMul
    const abs = Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${v < 0 ? '-' : ''}${prefix}${abs}`
  }

  const [holdings, setHoldings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [allocView3D, setAllocView3D] = useState(false)
  const [dbSynced, setDbSynced] = useState(false)
  const [activeTab, setActiveTab] = useState('holdings')

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
  }, [holdings])

  // Load from Supabase on mount when logged in
  useEffect(() => {
    if (!user || dbSynced) return
    supabase.from('portfolio_holdings').select('*').order('added_at').then(({ data }) => {
      if (data && data.length > 0) {
        const mapped = data.map(r => ({
          id: r.id,
          symbol: r.symbol,
          yfSym: toYahooSymbol(r.symbol, detectType(r.symbol)),
          name: r.name || r.symbol,
          shares: parseFloat(r.shares),
          avgCost: parseFloat(r.avg_buy_price),
          costCurrency: r.currency || 'AUD',
          type: detectType(r.symbol),
          addedAt: r.added_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        }))
        setHoldings(mapped)
      }
      setDbSynced(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const addHolding = async (h) => {
    setHoldings((prev) => {
      const idx = prev.findIndex((p) => p.symbol === h.symbol && p.type === h.type)
      if (idx >= 0) { const u = [...prev]; u[idx] = h; return u }
      return [...prev, h]
    })
    logActivity('portfolio', `Added ${h.shares} ${h.symbol} to portfolio`)
    setShowAddForm(false)
    if (user) {
      const { data, error } = await supabase.from('portfolio_holdings').insert({
        symbol: h.symbol,
        name: h.name,
        shares: h.shares,
        avg_buy_price: h.avgCost,
        currency: h.costCurrency,
      }).select().single()
      // Swap the client-generated id for Supabase's real row id — without
      // this, deleting a holding added this session targets an id that
      // doesn't exist in the DB and silently does nothing.
      if (!error && data?.id) {
        setHoldings((prev) => prev.map((p) => (p.id === h.id ? { ...p, id: data.id } : p)))
      }
    }
  }

  // Sequential — addHolding is itself async (Supabase insert when logged
  // in) and reads/writes `holdings` via functional setState, so importing
  // one at a time avoids racing several inserts against the same state.
  const importFromBuilder = async (shapedHoldings) => {
    for (const h of shapedHoldings) {
      await addHolding(h)
    }
    setShowBuilder(false)
  }

  const deleteHolding = async (id) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id))
    if (user) {
      await supabase.from('portfolio_holdings').delete().eq('id', id)
    }
  }

  // Batch fetch for equity holdings
  const equityHoldings = holdings.filter((h) => h.type !== 'crypto')
  const yfSymbols = [...new Set(equityHoldings.map((h) => h.yfSym ?? toYahooSymbol(h.symbol, h.type)))]

  const { data: portfolioResult, isFetching, isError, refetch } = useQuery({
    queryKey:  ['yfPortfolio', ...yfSymbols],
    queryFn:   () => fetchEquityQuotes(yfSymbols),
    staleTime: 60_000,
    retry: 1,
    enabled:   yfSymbols.length > 0,
  })
  const batchQuotes = portfolioResult?.data
  const isDelayed    = portfolioResult?.stale === true

  const computed = holdings.map((h) => {
    const isCrypto = h.type === 'crypto'
    const isAsx    = h.type === 'asx'
    const yfSym    = h.yfSym ?? toYahooSymbol(h.symbol, h.type)
    const q        = isCrypto ? null : (batchQuotes?.[yfSym] ?? null)

    let last = null, dayPct = 0, loadState = 'pending', nativePrice = null, currency = isAsx ? 'AUD' : 'USD'
    if (q) {
      last        = isAsx ? q.last : usdToAud(q.last)
      nativePrice = isAsx ? null : q.last
      currency    = q.currency ?? currency
      dayPct      = q.pct ?? 0
      loadState   = 'live'
    } else if (!isCrypto && isError) {
      loadState = 'error'
    } else if (isCrypto) {
      loadState = 'crypto'
    }

    const avgCostAud = h.costCurrency === 'USD' ? usdToAud(h.avgCost) : h.avgCost
    const mktVal     = last != null ? last * h.shares : null
    const totalCost  = avgCostAud * h.shares
    const pnl        = mktVal != null ? mktVal - totalCost : null
    const pnlPct     = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null
    const marketCap = q?.marketCap != null ? (isAsx ? q.marketCap : usdToAud(q.marketCap)) : null
    return { ...h, last, dayPct, mktVal, totalCost, pnl, pnlPct, loadState, isOpen: q?.isOpen, nativePrice, currency, marketCap }
  })

  const live      = computed.filter((h) => h.mktVal != null)
  const mktTotal  = live.reduce((s, h) => s + h.mktVal, 0)
  const liveCost  = live.reduce((s, h) => s + h.totalCost, 0)
  const costTotal = computed.reduce((s, h) => s + h.totalCost, 0)
  const totalPnl  = mktTotal - liveCost
  const pnlPct    = liveCost > 0 ? (totalPnl / liveCost) * 100 : 0
  const dayPnl    = live.reduce((s, h) => s + h.mktVal * (h.dayPct / 100), 0)

  // Allocation by individual stock (not asset class) — largest position first.
  const allocData = live
    .map((h) => ({
      name:  h.type === 'asx' ? h.symbol + '.AX' : h.symbol,
      value: h.mktVal,
      pct:   mktTotal ? ((h.mktVal / mktTotal) * 100).toFixed(1) : '0.0',
    }))
    .sort((a, b) => b.value - a.value)

  const pnlData  = live.filter((h) => h.pnl != null).map((h) => ({
    symbol: h.symbol, pnl: parseFloat((h.pnl * displayMul).toFixed(0)),
  }))
  const updatedAt = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const bySector   = groupByPct(live, (h) => SECTOR_BY_SYMBOL[h.symbol] ?? 'Other')
  const byCountry  = groupByPct(live, (h) => h.type === 'asx' ? 'Australia' : h.type === 'crypto' ? 'Crypto (borderless)' : 'United States')
  const byCurrency = groupByPct(live, (h) => h.type === 'us' ? 'USD' : 'AUD')

  const bestPerformer = live.filter((h) => h.pnlPct != null).sort((a, b) => b.pnlPct - a.pnlPct)[0] ?? null

  const runAiAnalysis = () => dispatchAskAI({
    instruction:
      'You are MaddenAI. Analyse this portfolio and provide:\n' +
      '1. Portfolio composition assessment (diversification)\n' +
      '2. Key risks (concentration, sector, currency)\n' +
      '3. Performance attribution (what\'s driving P&L)\n' +
      '4. 3 specific suggestions for improvement\n' +
      '5. Macro outlook for this portfolio\n\n' +
      `Holdings: ${JSON.stringify(live.map((h) => ({
        symbol: h.symbol, type: h.type, shares: h.shares,
        avgCost: h.avgCost, last: h.last, mktVal: h.mktVal,
        pnl: h.pnl, pnlPct: h.pnlPct, dayPct: h.dayPct,
      })))}\n` +
      `Total value: ${fmtCur(mktTotal)}\n` +
      `Total P&L: ${fmtCur(totalPnl)} (${fmt.pct(pnlPct)})\n\n` +
      'Format in professional markdown. Australian investor perspective. General information only, not advice.',
  }, { fullscreen: true, rawPrompt: true })

  // ─── EMPTY STATE ───────────────────────────────────────────────────────────

  if (holdings.length > 0 && isFetching && !portfolioResult && yfSymbols.length > 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <ModuleHeader title="PORTFOLIO" subtitle="Loading live prices…" isFetching />
        <div className="p-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} rows={2} />)}
        </div>
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <ModuleHeader
          title="PORTFOLIO"
          subtitle="Track your holdings across ASX, US equities, and crypto"
          right={(
            <button
              onClick={() => setShowBuilder(true)}
              className="text-2xs px-3 py-1 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-wide"
            >BUILD WITH AI ▶</button>
          )}
        />
        {showBuilder && <PortfolioBuilderModal onImport={importFromBuilder} onClose={() => setShowBuilder(false)} />}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 bg-terminal-bg">
        {showAddForm
          ? <div className="w-full max-w-sm">
              <AddHoldingForm onAdd={addHolding} onCancel={() => setShowAddForm(false)} atLimit={!canAccess('prime') && holdings.length >= PORTFOLIO_LIMIT} limit={PORTFOLIO_LIMIT} />
            </div>
          : <>
              <span className="w-12 h-12 rounded-full border border-terminal-gold/40 text-terminal-gold flex items-center justify-center">
                <Briefcase size={22} strokeWidth={1.75} />
              </span>
              <div className="text-terminal-text-bright text-base font-semibold tracking-wide">NO HOLDINGS YET</div>
              <div className="text-terminal-text-dim text-sm text-center max-w-sm leading-relaxed -mt-2">
                Add your first holding to track performance
              </div>
              <button onClick={() => setShowAddForm(true)}
                className="px-6 py-2.5 text-sm font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors tracking-widest">
                + ADD HOLDING
              </button>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="text-2xs text-terminal-text-dim/60">QUICK ADD:</span>
                {['BHP.AX', 'CBA.AX', 'AAPL', 'MSFT', 'BTC', 'ETH'].map((s) => (
                  <button key={s} onClick={() => setShowAddForm(true)}
                    className="px-2 py-0.5 text-2xs border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors">
                    {s}
                  </button>
                ))}
              </div>
              <div className="text-2xs text-terminal-text-dim/40">Supports ASX (BHP.AX), US equities, and major crypto</div>
            </>
        }
        </div>
      </div>
    )
  }

  // ─── MAIN VIEW ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full grid grid-rows-[auto_auto_auto_1fr] overflow-hidden">
      <ModuleHeader
        title="PORTFOLIO"
        subtitle={`${holdings.length} positions · ${equityHoldings.length} equities tracked`}
        moduleId="portfolio"
        isFetching={isFetching}
        onRefresh={yfSymbols.length > 0 ? refetch : undefined}
        right={(
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBuilder(true)}
              className="text-2xs px-3 py-1 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-wide"
            >BUILD WITH AI ▶</button>
            {live.length > 0 && (
              <button
                onClick={runAiAnalysis}
                className="text-2xs px-3 py-1 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-wide"
              >AI ANALYSIS ▶</button>
            )}
            {live.length > 0 && (
              <button
                onClick={() => setShowSnapshot(true)}
                className="text-2xs px-3 py-1 border border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-border-gold transition-colors font-bold tracking-wide"
              >SHARE</button>
            )}
          </div>
        )}
      />
      {showBuilder && <PortfolioBuilderModal onImport={importFromBuilder} onClose={() => setShowBuilder(false)} />}
      {showSnapshot && (
        <PortfolioSnapshot
          holdings={live}
          totalPnl={totalPnl}
          pnlPct={pnlPct}
          mktTotal={mktTotal}
          currency={currency}
          ownerName={profile?.first_name || user?.email?.split('@')[0] || 'A Maddex user'}
          onClose={() => setShowSnapshot(false)}
        />
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 xl:grid-cols-9 border-b border-terminal-border flex-shrink-0">
        <StatBox
          label="PORTFOLIO VALUE"
          value={mktTotal > 0 ? <AnimatedNumber value={mktTotal} format={fmtCur} /> : '—'}
          color="text-terminal-text-bright"
        />
        <StatBox label="TOTAL COST"      value={fmtCur(costTotal)} color="text-terminal-text-dim" />
        <StatBox
          label="UNREALIZED P&L"
          value={live.length ? fmtCur(totalPnl) : '—'}
          sub={live.length ? fmt.pct(pnlPct) : ''}
          color={totalPnl >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
        />
        <StatBox
          label="TODAY'S P&L"
          value={live.length ? fmtCur(dayPnl) : '—'}
          color={dayPnl >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
        />
        <StatBox label="POSITIONS"   value={holdings.length} color="text-terminal-text-bright" />
        <StatBox
          label="LIVE PRICES"
          value={isDelayed ? `${live.length}/${equityHoldings.length} ⏱` : `${live.length}/${equityHoldings.length}`}
          color={isFetching ? 'text-terminal-gold' : isDelayed ? 'text-terminal-gold/80' : 'text-terminal-text-dim'}
        />
        <StatBox label="DISPLAY CCY" value={currency}  color="text-terminal-gold" />
        <StatBox label="UPDATED"     value={updatedAt} color="text-terminal-text-dim" />
        <StatBox
          label="BEST PERFORMER"
          value={bestPerformer ? bestPerformer.symbol : '—'}
          sub={bestPerformer ? fmt.pct(bestPerformer.pnlPct) : ''}
          color="text-terminal-green"
        />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-terminal-border flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`text-2xs font-bold tracking-widest px-4 py-2 border-b-2 transition-colors ${
              activeTab === t.key
                ? 'text-terminal-gold border-terminal-gold'
                : 'text-terminal-text-dim border-transparent hover:text-terminal-text'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* Everything below occupies the grid's single 1fr row — wrapped in one
          flex-col container so the optional add-form (flex-shrink-0) and
          whichever tab is active (flex-1) share that row correctly instead
          of each becoming its own auto-sized implicit grid row. */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {showAddForm && (
        <div className="border-b border-terminal-border px-3 py-2 bg-terminal-panel flex-shrink-0">
          <AddHoldingForm onAdd={addHolding} onCancel={() => setShowAddForm(false)} atLimit={!canAccess('prime') && holdings.length >= PORTFOLIO_LIMIT} limit={PORTFOLIO_LIMIT} />
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="flex-1 overflow-y-auto">
          <PerformanceChart mktTotal={mktTotal} pnlPct={pnlPct} prefix={prefix} />
        </div>
      )}

      {activeTab === 'stresstest' && (
        <StressTest holdings={computed} fmtCur={fmtCur} />
      )}

      {activeTab === 'ai' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center overflow-y-auto">
          <div className="text-3xl">▲</div>
          <div className="text-terminal-text-bright text-sm font-semibold">AI Portfolio Analysis</div>
          <div className="text-terminal-text-dim text-2xs max-w-sm leading-relaxed">
            MaddenAI will assess your diversification, key risks, performance attribution, and give
            specific suggestions — opens full-screen in the AI panel.
          </div>
          <button
            onClick={runAiAnalysis}
            disabled={live.length === 0}
            className="mt-1 text-xs font-bold text-terminal-gold border border-terminal-gold/50 px-5 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >{live.length === 0 ? 'ADD LIVE HOLDINGS FIRST' : 'RUN AI ANALYSIS ▶'}</button>
          {live.length > 0 && <MockAnalysisPreview bySector={bySector} mktTotal={mktTotal} />}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="flex-1 overflow-y-auto">
          <PortfolioAnalytics holdings={live} mktTotal={mktTotal} fmtCur={fmtCur} />
        </div>
      )}

      {/* Holdings table + allocation */}
      {activeTab === 'holdings' && (
      <div className="flex-1 grid grid-cols-[1fr_220px] min-h-0 overflow-hidden">
        <div className="flex flex-col border-r border-terminal-border overflow-hidden">
          <div className="panel-header flex items-center gap-2 flex-shrink-0">
            POSITIONS
            <span className="text-2xs text-terminal-gold font-normal normal-case">ALL VALUES {currency}</span>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="ml-2 px-2 py-0.5 text-2xs border border-terminal-gold/50 text-terminal-gold/70 hover:border-terminal-gold hover:text-terminal-gold transition-colors"
            >
              + ADD
            </button>
            {isFetching
              ? <span className="text-2xs text-terminal-text-dim font-normal animate-pulse ml-auto">FETCHING PRICES...</span>
              : isError
                ? <span className="text-2xs text-terminal-red font-normal ml-auto">
                    ⚠ PRICE ERROR
                    <button onClick={refetch} className="underline ml-1 hover:text-terminal-gold">RETRY</button>
                  </span>
                : USING_MOCK_DATA
                  ? <span className="ml-auto"><DemoBadge /></span>
                  : <span className="text-2xs text-terminal-text-dim font-normal ml-auto">{updatedAt} AEST</span>
            }
          </div>
          <div className="overflow-auto flex-1">
            <table className="terminal-table w-full">
              <thead className="sticky top-0 bg-terminal-header">
                <tr>
                  <th className="px-2 text-left">SYMBOL</th>
                  <th className="px-1 text-left hidden md:table-cell">TYPE</th>
                  <th className="px-1 text-right">SHARES</th>
                  <th className="px-1 text-right">AVG COST</th>
                  <th className="px-1 text-right">LAST</th>
                  <th className="px-1 text-right">MKT VAL</th>
                  <th className="px-1 text-right">P&amp;L</th>
                  <th className="px-1 text-right">P&amp;L%</th>
                  <th className="px-1 text-right">DAY%</th>
                  <th className="px-1 text-right hidden xl:table-cell">WT%</th>
                  <th className="px-1 text-right hidden 2xl:table-cell">MKT CAP</th>
                  <th className="px-1 text-center">✕</th>
                </tr>
              </thead>
              <tbody>
                {computed.map((h) => {
                  const pnlCls = h.pnl != null ? (h.pnl >= 0 ? 'pos' : 'neg') : ''
                  const dayCls = colorClass(h.dayPct)
                  const dispSym = h.type === 'asx' ? h.symbol + '.AX' : h.symbol
                  return (
                    <tr key={h.id}
                      className="hover:bg-terminal-accent/20 cursor-pointer"
                      onClick={() => h.last && openModal?.({
                        symbol: h.symbol, name: h.name || h.symbol,
                        price:  h.last * displayMul,
                        pct:    h.dayPct,
                        change: (h.last * (h.dayPct / 100)) * displayMul,
                        type:   h.type,
                        extra:  { nativePrice: h.nativePrice, currency: h.currency },
                      })}
                    >
                      <td className="px-2 py-0.5 text-xs font-bold text-terminal-text-bright">{dispSym}</td>
                      <td className="px-1 py-0.5 text-2xs hidden md:table-cell">
                        <span className={h.type === 'asx' ? 'text-terminal-gold' : h.type === 'crypto' ? 'text-purple-400' : 'text-terminal-blue-bright'}>
                          {h.type === 'asx' ? 'ASX' : h.type === 'crypto' ? 'CRYPTO' : 'US'}
                        </span>
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right">{h.shares}</td>
                      <td className="px-1 py-0.5 text-2xs text-right text-terminal-text-dim">
                        {h.costCurrency === 'USD' ? 'US$' : 'A$'}{h.avgCost.toFixed(2)}
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right font-semibold">
                        {h.loadState === 'pending' && isFetching
                          ? <span className="animate-pulse text-terminal-text-dim">...</span>
                          : h.loadState === 'crypto'
                            ? <span className="text-purple-400/60 text-2xs">→ F3</span>
                            : h.loadState === 'error'
                              ? <span className="text-terminal-red text-2xs">ERR</span>
                              : h.last != null
                                ? fmtCur(h.last)
                                : <span className="text-terminal-text-dim">—</span>
                        }
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right">{h.mktVal ? fmtCur(h.mktVal) : '—'}</td>
                      <td className={`px-1 py-0.5 text-2xs text-right font-semibold ${pnlCls}`}>
                        {h.pnl != null ? fmtCur(h.pnl) : '—'}
                      </td>
                      <td className={`px-1 py-0.5 text-2xs text-right font-semibold ${pnlCls}`}>
                        {h.pnlPct != null ? fmt.pct(h.pnlPct) : '—'}
                      </td>
                      <td className={`px-1 py-0.5 text-2xs text-right ${dayCls}`}>
                        {h.dayPct ? fmt.pct(h.dayPct) : '—'}
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right text-terminal-text-dim hidden xl:table-cell">
                        {h.mktVal && mktTotal ? ((h.mktVal / mktTotal) * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right text-terminal-text-dim hidden 2xl:table-cell">
                        {formatMarketCap(h.marketCap)}
                      </td>
                      <td className="px-1 py-0.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => deleteHolding(h.id)}
                          className="text-terminal-text-dim/40 hover:text-terminal-red transition-colors px-1 text-2xs"
                          title="Remove position"
                        >✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col overflow-y-auto">
          <div className="panel-header flex-shrink-0 flex items-center gap-2">
            <span>ALLOCATION</span>
            {allocData.length > 0 && (
              <div className="ml-auto flex items-center border border-terminal-border rounded-full overflow-hidden">
                <button
                  onClick={() => setAllocView3D(false)}
                  className={`text-2xs px-2 py-0.5 font-bold normal-case transition-colors ${!allocView3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                >2D</button>
                <button
                  onClick={() => setAllocView3D(true)}
                  className={`text-2xs px-2 py-0.5 font-bold normal-case transition-colors ${allocView3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                >3D</button>
              </div>
            )}
          </div>
          {allocData.length > 0 ? (
            allocView3D ? (
              <div style={{ height: 260 }} className="flex-shrink-0 border-b border-terminal-border">
                <Suspense fallback={<Viz3DLoader />}>
                  <Portfolio3D
                    holdings={live}
                    onSelect={(h) => h.last && openModal?.({
                      symbol: h.symbol, name: h.name || h.symbol,
                      price:  h.last * displayMul,
                      pct:    h.dayPct,
                      change: (h.last * (h.dayPct / 100)) * displayMul,
                      type:   h.type,
                    })}
                  />
                </Suspense>
              </div>
            ) : (
            <>
              <div className="h-40 p-2 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocData} cx="50%" cy="50%" innerRadius={30} outerRadius={58}
                      dataKey="value" isAnimationActive={false}>
                      {allocData.map((d, i) => (
                        <Cell key={d.name} fill={STOCK_PALETTE[i % STOCK_PALETTE.length]} stroke="#040d1a" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-auto px-2 pb-1">
                {allocData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: STOCK_PALETTE[i % STOCK_PALETTE.length] }} />
                      <span className="text-2xs">{d.name}</span>
                    </div>
                    <span className="text-2xs text-terminal-text-dim">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-2xs text-terminal-text-dim animate-pulse">
              LOADING PRICES...
            </div>
          )}

          {pnlData.length > 0 && (
            <>
              <div className="panel-header border-t border-terminal-border flex-shrink-0">P&amp;L BY POSITION</div>
              <div className="h-36 p-1 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="#0d2244" vertical={false} />
                    <XAxis dataKey="symbol" tick={{ fontSize: 7 }} />
                    <YAxis tick={{ fontSize: 7 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                            <span className="text-terminal-gold">{payload[0].payload.symbol}: </span>
                            <span className={payload[0].value >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
                              {prefix}{Math.abs(payload[0].value).toLocaleString()}
                            </span>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="pnl" isAnimationActive={false}>
                      {pnlData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <BreakdownBars title="BY SECTOR"   rows={bySector} />
          <BreakdownBars title="BY COUNTRY"  rows={byCountry} />
          <BreakdownBars title="BY CURRENCY" rows={byCurrency} />

          {holdings.some((h) => h.type === 'crypto') && (
            <div className="border-t border-terminal-border p-2 text-2xs text-terminal-text-dim/60 flex-shrink-0">
              ⚠ Crypto live prices in CRYPTO MODULE (F3)
            </div>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  )
}
