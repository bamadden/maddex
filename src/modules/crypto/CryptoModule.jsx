import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import {
  fetchCoinHistory, fetchFearGreed, fetchTrendingCoins, fetchCryptoGlobal,
  transformCryptoMarkets, transformCoinHistory, transformFearGreed,
  COIN_IDS,
} from '../../services/api'
import { fetchCryptoMarketsUnified } from '../../services/dataService'
import { calculateCryptoMomentumIndex, scoreToColor } from '../../services/maddenAiScoring'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt } from '../../utils/format'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { ModuleLoader, StaleBadge } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'
import PriceChange from '../../components/ui/PriceChange'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ── Coin colour circle (deterministic hash, not a real logo — Bloomberg-
// terminal-style abstract avatar rather than brand marks) ──────────────────
const CIRCLE_PALETTE = ['#f7931a', '#627eea', '#9945ff', '#00d4ff', '#f0b90b', '#26a17b', '#e84142', '#2775ca', '#8247e5', '#c8a84b']
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function coinColor(symbol) {
  return CIRCLE_PALETTE[hashStr(symbol) % CIRCLE_PALETTE.length]
}
function CoinCircle({ symbol, size = 22 }) {
  const color = coinColor(symbol)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `${color}26`, border: `1px solid ${color}66`, color, fontSize: size * 0.42 }}
    >
      {symbol?.[0] ?? '?'}
    </span>
  )
}


// ── Sparkline ──────────────────────────────────────────────────────────────────

function Sparkline({ prices, pct }) {
  if (!prices?.length) return <span style={{ display: 'inline-block', width: 64 }} />
  const sampled = prices.filter((_, i) => i % 4 === 0)
  const min = Math.min(...sampled), max = Math.max(...sampled)
  const range = max - min || 1
  const w = 64, h = 20
  const pts = sampled.map((p, i) =>
    `${(i / (sampled.length - 1)) * w},${h - ((p - min) / range) * (h - 2) - 1}`
  ).join(' ')
  const color = (pct ?? 0) >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'middle', width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', opacity: 0.8 }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
  )
}

// ── Sentiment helpers ──────────────────────────────────────────────────────────

function calcSentiment(pct24h, pct7d) {
  let score = 50
  score += Math.min(22, Math.max(-22, (pct24h ?? 0) * 2.5))
  score += Math.min(14, Math.max(-14, (pct7d  ?? 0) * 1.0))
  return Math.round(Math.min(100, Math.max(0, score)))
}

function getSentimentLabel(score) {
  if (score >= 75) return 'EXT GREED'
  if (score >= 60) return 'GREED'
  if (score >= 45) return 'NEUTRAL'
  if (score >= 30) return 'FEAR'
  return 'EXT FEAR'
}

// ── Chart tooltip ──────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  const formatted = currency === 'AUD'
    ? fmt.aud(val)
    : `US$${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="text-terminal-gold font-semibold">{formatted}</div>
    </div>
  )
}

// ── Trending ───────────────────────────────────────────────────────────────────

function TrendingSection() {
  const { data: trending, isLoading } = useQuery({
    queryKey: ['trendingCoins'],
    queryFn:  fetchTrendingCoins,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const coins = trending?.coins?.slice(0, 10) ?? []
  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        TRENDING
        <span className="text-terminal-gold text-2xs font-normal normal-case">CoinGecko</span>
        {isLoading && <span className="text-terminal-text-dim text-2xs animate-pulse">...</span>}
      </div>
      <div className="flex gap-1.5 px-2 pb-1.5 overflow-x-auto">
        {coins.map(({ item: c }, i) => (
          <div key={c.id} className="flex items-center gap-1 border border-terminal-border/50 px-1.5 py-0.5 flex-shrink-0">
            <span className="text-2xs text-terminal-text-dim">#{i + 1}</span>
            <span className="text-2xs font-bold text-terminal-gold">{c.symbol.toUpperCase()}</span>
            {c.data?.price_change_percentage_24h?.usd != null && (
              <span className="text-2xs font-semibold" style={{
                color: c.data.price_change_percentage_24h.usd >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
              }}>
                {c.data.price_change_percentage_24h.usd >= 0 ? '▲' : '▼'}{Math.abs(c.data.price_change_percentage_24h.usd).toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 4-Panel dashboard shared styles ───────────────────────────────────────────

const P = {
  wrap:  { flex:1, display:'flex', flexDirection:'column', padding:'8px 10px', overflow:'hidden', boxSizing:'border-box' },
  title: { fontSize:9, fontWeight:700, color:'#c8a84b', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' },
  empty: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'rgba(100,130,160,0.5)' },
}

function MaddenAIPanel({ momentum }) {
  if (!momentum) return <div style={P.wrap}><div style={P.title}>MADDENAI MOMENTUM</div><div style={P.empty}>CALCULATING...</div></div>
  const color = scoreToColor(momentum.score)
  const { bullish = 33, neutral = 34, bearish = 33 } = momentum.breakdown ?? {}
  return (
    <div style={P.wrap}>
      <div style={P.title}>MADDENAI MOMENTUM</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:5 }}>
        <span style={{ fontSize:36, fontWeight:700, lineHeight:1, color, fontFamily:'IBM Plex Mono' }}>{momentum.score}</span>
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <span style={{ fontSize:9, color:'rgba(100,130,160,0.5)' }}>/ 100</span>
          <span style={{ fontSize:11, fontWeight:700, color }}>{momentum.label.toUpperCase()}</span>
        </div>
      </div>
      <div style={{ height:6, display:'flex', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${bullish}%`, background:'var(--color-gain)', transition:'width 0.5s' }} />
        <div style={{ width:`${neutral}%`, background:'var(--color-neutral)', transition:'width 0.5s' }} />
        <div style={{ width:`${bearish}%`, background:'var(--color-loss)', transition:'width 0.5s' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, marginTop:2 }}>
        <span style={{ color:'var(--color-gain)' }}>{bullish}% BULL</span>
        <span style={{ color:'var(--color-neutral)' }}>{neutral}% NEUT</span>
        <span style={{ color:'var(--color-loss)' }}>{bearish}% BEAR</span>
      </div>
    </div>
  )
}

function FearGreedPanel({ data }) {
  const getColor = (v) =>
    v >= 75 ? 'var(--color-gain-bright)' : v >= 55 ? 'var(--color-neutral)' :
    v >= 45 ? '#f0c040' : v >= 25 ? '#ff8c00' : 'var(--color-loss-bright)'
  if (!data) return <div style={P.wrap}><div style={P.title}>FEAR &amp; GREED</div><div style={P.empty}>LOADING...</div></div>
  const { value, label, prev, weekAgo } = data
  const color = getColor(value)
  return (
    <div style={P.wrap}>
      <div style={P.title}>FEAR &amp; GREED</div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <svg viewBox="0 0 100 66" style={{ width:96, height:64, flexShrink:0 }}>
          <path d="M 8 54 A 42 42 0 0 1 92 54" fill="none" stroke="#0d2244" strokeWidth="9" />
          <path d="M 8 54 A 42 42 0 0 1 92 54" fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={`${(value / 100) * 131.9} 131.9`} strokeLinecap="butt" />
          <text x="50" y="48" textAnchor="middle" fill={color} fontSize="26" fontFamily="IBM Plex Mono" fontWeight="700">{value}</text>
          <text x="10" y="64" textAnchor="start" fill="var(--color-loss)" fontSize="6" fontFamily="IBM Plex Mono" letterSpacing="0.05em">FEAR</text>
          <text x="50" y="64" textAnchor="middle" fill="#c8a84b" fontSize="6" fontFamily="IBM Plex Mono" letterSpacing="0.05em">NEUTRAL</text>
          <text x="90" y="64" textAnchor="end" fill="var(--color-gain)" fontSize="6" fontFamily="IBM Plex Mono" letterSpacing="0.05em">GREED</text>
        </svg>
        <div style={{ fontSize:9 }}>
          <div style={{ fontSize:12, fontWeight:700, color, marginBottom:4 }}>{label.toUpperCase()}</div>
          <div style={{ color:'rgba(100,130,160,0.5)', marginBottom:2 }}>PREV: <span style={{ color:getColor(prev) }}>{prev}</span></div>
          <div style={{ color:'rgba(100,130,160,0.5)' }}>7D: <span style={{ color:getColor(weekAgo) }}>{weekAgo}</span></div>
        </div>
      </div>
    </div>
  )
}

function MarketPulsePanel({ globalData, currency, capSparkline }) {
  if (!globalData) return <div style={P.wrap}><div style={P.title}>TOTAL MARKET CAP</div><div style={P.empty}>LOADING...</div></div>
  const ccy = currency === 'AUD' ? 'aud' : 'usd'
  const sym = currency === 'AUD' ? 'A$' : 'US$'
  const cap = globalData.total_market_cap?.[ccy]
  const vol = globalData.total_volume?.[ccy]
  const chg = globalData.market_cap_change_percentage_24h_usd
  const coins = globalData.active_cryptocurrencies
  const fmtB = (v) => {
    if (!v) return '—'
    if (v >= 1e12) return `${sym}${(v/1e12).toFixed(2)}T`
    if (v >= 1e9)  return `${sym}${(v/1e9).toFixed(1)}B`
    return `${sym}${v.toFixed(0)}`
  }
  const chgColor = chg >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  return (
    <div style={P.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={P.title}>TOTAL MARKET CAP</div>
        {capSparkline?.length > 1 && <Sparkline prices={capSparkline} pct={chg} />}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#e8ecf0', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>
        {fmtB(cap)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: chgColor, marginBottom: 6 }}>
        {chg != null ? `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}% (24h)` : '—'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px', fontSize:9 }}>
        {[
          { label:'VOLUME', value: fmtB(vol), color:'#d4dce8' },
          { label:'COINS', value: coins?.toLocaleString() ?? '—', color:'#d4dce8' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ color:'rgba(100,130,160,0.55)', fontSize:8 }}>{label}</div>
            <div style={{ color, fontWeight:600 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Yesterday's BTC dominance isn't in CoinGecko's /global snapshot — persisted
// locally (same pattern as MarketSentimentBanner's score history) so a
// "vs yesterday" delta can be shown without an extra API call.
const BTC_DOM_KEY = 'maddex_btc_dominance_history'
function readBtcDomHistory() {
  try { return JSON.parse(localStorage.getItem(BTC_DOM_KEY) ?? '[]') } catch { return [] }
}
function writeBtcDomHistory(pct) {
  try {
    const hist = readBtcDomHistory()
    const today = new Date().toISOString().slice(0, 10)
    if (hist[hist.length - 1]?.date === today) return
    hist.push({ date: today, pct })
    if (hist.length > 90) hist.splice(0, hist.length - 90)
    localStorage.setItem(BTC_DOM_KEY, JSON.stringify(hist))
  } catch { /* ignore */ }
}
function btcDomYesterday() {
  const hist = readBtcDomHistory()
  return hist.length ? hist[hist.length - 1].pct : null
}

function DominanceArc({ pct, color, size = 56 }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0d2244" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size * 0.22} fontFamily="IBM Plex Mono" fontWeight="700">
        {pct.toFixed(0)}%
      </text>
    </svg>
  )
}

function DominancePanel({ globalData }) {
  const btcYesterday = btcDomYesterday()

  useEffect(() => {
    const btc = globalData?.market_cap_percentage?.btc
    if (btc != null) writeBtcDomHistory(btc)
  }, [globalData])

  if (!globalData) return <div style={P.wrap}><div style={P.title}>BTC DOMINANCE</div><div style={P.empty}>LOADING...</div></div>
  const pct = globalData.market_cap_percentage ?? {}
  const btc = pct.btc ?? 0
  const eth = pct.eth ?? 0
  const sol = pct.sol ?? 0
  const others = Math.max(0, 100 - btc - eth - sol)
  const bars = [
    { label:'BTC', pct:btc,    color:'#f7931a' },
    { label:'ETH', pct:eth,    color:'#627eea' },
    { label:'SOL', pct:sol,    color:'#9945ff' },
    { label:'OTHERS', pct:others, color:'rgba(100,130,160,0.35)' },
  ]
  const delta = btcYesterday != null ? btc - btcYesterday : null
  return (
    <div style={P.wrap}>
      <div style={P.title}>BTC DOMINANCE</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <DominanceArc pct={btc} color="#f7931a" />
        <div>
          <div style={{ fontSize: 9, color: 'rgba(100,130,160,0.6)' }}>of total mkt cap</div>
          {delta != null && (
            <div style={{ fontSize: 10, fontWeight: 600, color: delta >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}pp vs yday
            </div>
          )}
        </div>
      </div>
      <div style={{ height:6, display:'flex', borderRadius:2, overflow:'hidden', marginBottom:5 }}>
        {bars.map(b => <div key={b.label} style={{ width:`${b.pct}%`, background:b.color, transition:'width 0.5s' }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px' }}>
        {bars.map(b => (
          <div key={b.label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9 }}>
            <span style={{ width:6, height:6, borderRadius:1, background:b.color, flexShrink:0 }} />
            <span style={{ color:'rgba(100,130,160,0.6)', fontSize:8 }}>{b.label}</span>
            <span style={{ color:'#d4dce8', fontWeight:600, marginLeft:'auto' }}>{b.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Timeframe config ───────────────────────────────────────────────────────────

const TIMEFRAMES = ['1D', '7D', '1M', '3M', '1Y']
const TF_DAYS    = { '1D': 1, '7D': 7, '1M': 30, '3M': 90, '1Y': 365 }
const TOP_COINS  = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT', 'LINK']

// ── Shared cell styles ─────────────────────────────────────────────────────────

const CELL = { padding: '5px 8px', fontSize: '10px', verticalAlign: 'middle', position: 'static' }
const HEAD = { padding: '6px 8px', fontSize: '9px', color: '#c8a84b', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#071428', verticalAlign: 'middle' }

// ── Main Module ────────────────────────────────────────────────────────────────

export default function CryptoModule() {
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  const [timeframe, setTimeframe]       = useState('3M')
  const [perfTimeframe, setPerfTimeframe] = useState('1M')
  const [titleBarHeight, setTitleBarHeight] = useState(28)
  const titleBarRef = useRef(null)
  const { openModal, currency } = useStore()
  const { usdToAud, audToUsd } = useAudRates()

  useEffect(() => {
    if (titleBarRef.current) {
      const h = titleBarRef.current.offsetHeight
      console.log('Crypto title bar height:', h)
      setTitleBarHeight(h)
    }
  }, [])
  const vsCurrency = currency.toLowerCase()
  const currPrefix = currency === 'AUD' ? 'A$' : 'US$'

  const { data: rawMarketsResult, isError: marketsError, isFetching: marketsFetching, refetch: refetchMarkets } = useQuery({
    queryKey: ['cryptoMarkets', vsCurrency],
    queryFn:  () => fetchCryptoMarketsUnified(vsCurrency),
    staleTime: 60_000,
    retry: 1,
  })
  const marketsDelayed = rawMarketsResult?.stale === true

  const { data: rawFearGreed } = useQuery({
    queryKey: ['fearGreed'],
    queryFn:  fetchFearGreed,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const { data: globalData } = useQuery({
    queryKey: ['cryptoGlobal'],
    queryFn:  fetchCryptoGlobal,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const days = TF_DAYS[timeframe] ?? 90
  const { data: rawHistory, isFetching: chartLoading, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['coinHistory', selectedCoin, vsCurrency, days],
    queryFn:  () => fetchCoinHistory(COIN_IDS[selectedCoin] ?? selectedCoin.toLowerCase(), vsCurrency, days),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rawMarkets = rawMarketsResult?.data
  const markets    = rawMarkets   ? transformCryptoMarkets(rawMarkets, vsCurrency) : null
  const fearGreed  = rawFearGreed ? transformFearGreed(rawFearGreed)               : null
  const chartData  = rawHistory   ? transformCoinHistory(rawHistory)               : null

  const momentum = useMemo(() => {
    if (!rawMarkets) return null
    const coins = rawMarkets.map((c) => ({
      symbol: c.symbol?.toUpperCase(),
      change24h: c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d_in_currency,
      volume24h: c.total_volume,
      marketCap: c.market_cap,
    }))
    return calculateCryptoMomentumIndex({ coins, fearGreed })
  }, [rawMarkets, fearGreed])

  // Approximate total-market-cap 7d trend from constituent coins' own 7d
  // sparklines (already fetched with the markets batch) — avoids a separate
  // /global market-cap-chart call just for a tiny trend line.
  const capSparkline = useMemo(() => {
    if (!rawMarkets?.length) return []
    const withSpark = rawMarkets.filter(c => c.sparkline_in_7d?.price?.length && c.market_cap && c.current_price)
    if (!withSpark.length) return []
    const len = Math.min(...withSpark.map(c => c.sparkline_in_7d.price.length))
    const totals = new Array(len).fill(0)
    for (const c of withSpark) {
      const weight = c.market_cap / c.current_price
      const prices = c.sparkline_in_7d.price
      const offset = prices.length - len
      for (let i = 0; i < len; i++) totals[i] += prices[offset + i] * weight
    }
    return totals
  }, [rawMarkets])

  // Top 5 coins by rank, normalised to 100 at the start of the selected
  // period, for the performance-comparison chart below the table.
  const PERF_DAYS = { '7D': 7, '1M': 30, '3M': 90 }
  const perfDays = PERF_DAYS[perfTimeframe] ?? 30
  // markets is rebuilt fresh from rawMarkets every render (transformCryptoMarkets
  // returns new objects each time), so memoizing this slice wouldn't actually
  // skip work — a plain derived value avoids the pointless memo.
  const perfCoins = (markets ?? []).slice(0, 5)

  const perfHistoryResults = useQueries({
    queries: perfCoins.map((c) => ({
      queryKey: ['coinHistoryPerf', c.symbol, vsCurrency, perfDays],
      queryFn:  () => fetchCoinHistory(COIN_IDS[c.symbol] ?? c.symbol.toLowerCase(), vsCurrency, perfDays),
      staleTime: 5 * 60_000,
      retry: 1,
      enabled: perfCoins.length > 0,
    })),
  })

  const perfChartData = useMemo(() => {
    if (!perfCoins.length) return { rows: [], finalPct: {} }
    const series = perfCoins.map((c, i) => {
      const raw = perfHistoryResults[i]?.data
      if (!raw?.prices?.length) return null
      return { symbol: c.symbol, prices: raw.prices }
    })
    if (series.some(s => !s)) return { rows: [], finalPct: {} }

    const len = Math.min(...series.map(s => s.prices.length))
    const bases = series.map(s => s.prices[s.prices.length - len][1])
    const rows = []
    for (let i = 0; i < len; i++) {
      const row = { date: new Date(series[0].prices[series[0].prices.length - len + i][0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
      series.forEach((s, si) => {
        row[s.symbol] = (s.prices[s.prices.length - len + i][1] / bases[si]) * 100
      })
      rows.push(row)
    }
    const finalPct = {}
    series.forEach((s) => { finalPct[s.symbol] = rows[rows.length - 1]?.[s.symbol] - 100 })
    return { rows, finalPct }
  }, [perfCoins, perfHistoryResults])

  const yAxisFmt = (v) => {
    if (v >= 1_000_000) return `${currPrefix}${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `${currPrefix}${(v / 1_000).toFixed(0)}K`
    return `${currPrefix}${v.toFixed(0)}`
  }

  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  // modalAsset.price is always AUD (DetailModal's primary display expects
  // AUD universally, same convention equities use); nativePrice/currency
  // carry the USD figure for the dual-display sub-line regardless of which
  // unit the table itself is currently showing.
  const handleOpenModal = (coin) => {
    const isAudTable = currency === 'AUD'
    const audPrice = isAudTable ? coin.price : usdToAud(coin.price)
    const usdPrice = isAudTable ? audToUsd(coin.price) : coin.price
    openModal?.({
      symbol: coin.symbol, name: coin.name, price: audPrice,
      pct: coin.pct24h, change: null, type: 'crypto', coinId: COIN_IDS[coin.symbol],
      extra: { currency: 'USD', nativePrice: usdPrice },
    })
  }

  const askAI = (coin) => {
    dispatchAskAI({
      name:   coin.name,
      ticker: coin.symbol,
      price:  `${currPrefix}${coin.price.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`,
      change: `${coin.pct24h >= 0 ? '+' : ''}${coin.pct24h.toFixed(2)}% (24h)`,
      sector: 'Crypto',
      date:   todayAEST(),
    })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="CRYPTO"
        subtitle="Bitcoin · Ethereum · Top 20 by Market Cap"
        isFetching={marketsFetching}
        lastUpdated={rawMarketsResult?.cachedAt}
        onRefresh={refetchMarkets}
      />

      {/* ── Row 1: 4-Panel Dashboard ── */}
      <div className="flex border-b border-terminal-border flex-shrink-0 divide-x divide-terminal-border"
        style={{ height: 120, flexShrink: 0 }}>
        <MaddenAIPanel momentum={momentum} />
        <FearGreedPanel data={fearGreed} />
        <MarketPulsePanel globalData={globalData} currency={currency} capSparkline={capSparkline} />
        <DominancePanel globalData={globalData} />
      </div>

      {/* ── Row 2: Price chart ── */}
      <div className="flex border-b border-terminal-border flex-shrink-0 flex-col overflow-hidden"
        style={{ height: 'clamp(140px, 17vh, 165px)' }}>
        <div className="flex items-center gap-1 px-2 py-0.5 border-b border-terminal-border/50 flex-shrink-0 flex-wrap">
          <span className="text-2xs text-terminal-text-dim font-bold">{selectedCoin}/{currency}</span>
          <div className="flex gap-0.5 flex-wrap">
            {TOP_COINS.map(coin => (
              <button key={coin} onClick={() => setSelectedCoin(coin)}
                className={`px-1 py-0 text-[9px] transition-colors ${
                  selectedCoin === coin
                    ? 'bg-terminal-gold text-terminal-bg font-bold'
                    : 'text-terminal-text-dim hover:text-terminal-text'
                }`}>
                {coin}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 ml-auto">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-1 py-0 text-[9px] transition-colors ${
                  timeframe === tf
                    ? 'border border-terminal-gold text-terminal-gold'
                    : 'text-terminal-text-dim hover:text-terminal-gold'
                }`}>
                {tf}
              </button>
            ))}
          </div>
          {chartLoading && <span className="text-terminal-text-dim text-[9px] animate-pulse">...</span>}
        </div>
        <div className="flex-1 min-h-0 px-0.5 pb-0.5">
          {historyError && !rawHistory ? (
            <DataUnavailable label="CHART UNAVAILABLE" onRetry={refetchHistory} className="h-full" />
          ) : chartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="cryptoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c8a84b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#c8a84b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#0d2244" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 7 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 7 }} tickFormatter={yAxisFmt} domain={['auto', 'auto']} width={46} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area type="monotone" dataKey="price" stroke="#c8a84b" strokeWidth={1.5}
                  fill="url(#cryptoGrad)" dot={false} isAnimationActive={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">
              LOADING CHART...
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Trending ── */}
      <TrendingSection />

      {/* ── Row 3: Top 20 Table ── */}
      <div className="flex-1 min-h-0 overflow-auto" style={{ background: '#071428', position: 'relative' }}>
        {/* Title bar — sticky at top with solid background, z-index 20 */}
        <div ref={titleBarRef} className="panel-header crypto-title-bar flex items-center gap-2 flex-wrap"
          style={{ position: 'sticky', top: 0, zIndex: 20, background: '#071428', borderBottom: '1px solid #0d2244', margin: 0 }}>
          <span>TOP 20 BY MKT CAP ({currency})</span>
          {rawMarkets && marketsDelayed && <StaleBadge cachedAt={rawMarketsResult?.cachedAt} />}
          {rawMarkets && !marketsDelayed
            ? <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE · {updatedTime}</span>
            : !rawMarkets && !marketsError && <span className="text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>
          }
          {!rawMarkets && marketsError && <span className="text-terminal-red text-2xs font-normal">⚠ UNAVAILABLE</span>}
        </div>
        {/* Gap cover — fills any sub-pixel gap between title bar and column headers */}
        <div style={{ position: 'sticky', top: titleBarHeight, zIndex: 15, height: 2, background: '#071428', margin: 0, padding: 0 }} />

        {marketsError ? (
          <DataUnavailable label="CRYPTO MARKETS UNAVAILABLE" onRetry={refetchMarkets} />
        ) : markets ? (
          <SortableCoinTable
            markets={markets}
            currPrefix={currPrefix}
            usdToAud={usdToAud}
            titleBarHeight={titleBarHeight}
            onRowClick={handleOpenModal}
            onAskAI={askAI}
          />
        ) : <ModuleLoader name="CRYPTO" />}
      </div>

      {/* ── Row 4: 30-day performance comparison ── */}
      <PerformanceChart
        coins={perfCoins}
        data={perfChartData}
        timeframe={perfTimeframe}
        onTimeframeChange={setPerfTimeframe}
        isLoading={perfHistoryResults.some(r => r.isFetching)}
      />

    </div>
  )
}

// ── Sortable coin table ────────────────────────────────────────────────────
const COIN_COLUMNS = [
  { key: 'rank',       label: '#',         align: 'right', width: 28 },
  { key: 'symbol',     label: 'COIN',      align: 'left' },
  { key: 'price',      label: 'PRICE',     align: 'right' },
  { key: 'pct24h',     label: '24H%',      align: 'right' },
  { key: 'pct7d',      label: '7D%',       align: 'right', cell: 'sm' },
  { key: 'marketCap',  label: 'MKT CAP',   align: 'right', cell: 'md' },
  { key: 'volume',     label: 'VOLUME 24H', align: 'right', cell: 'lg' },
  { key: 'supply',     label: 'SUPPLY',    align: 'right', cell: 'lg', width: 100 },
  { key: 'sentiment',  label: 'SENTIMENT', align: 'right', cell: 'xl', width: 130 },
  { key: 'sparkline',  label: '7D CHART',  align: 'right', cell: 'xl' },
  { key: 'ai',         label: 'AI',        align: 'right' },
]

function SortableCoinTable({ markets, currPrefix, usdToAud, titleBarHeight, onRowClick, onAskAI }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const toggleSort = (key) => {
    if (!['rank', 'symbol', 'price', 'pct24h', 'pct7d', 'marketCap', 'volume'].includes(key)) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = sortKey ? [...markets].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortDir === 'asc' ? cmp : -cmp
  }) : markets

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead style={{ position: 'sticky', top: titleBarHeight + 2, zIndex: 10 }}>
        <tr style={{ background: '#071428', borderBottom: '1px solid #c8a84b' }}>
          {COIN_COLUMNS.map(col => (
            <th
              key={col.key}
              onClick={() => toggleSort(col.key)}
              style={{ ...HEAD, textAlign: col.align, width: col.width, minWidth: col.width, cursor: 'pointer' }}
              className={col.cell === 'sm' ? 'hidden sm:table-cell' : col.cell === 'md' ? 'hidden md:table-cell' : col.cell === 'lg' ? 'hidden lg:table-cell' : col.cell === 'xl' ? 'hidden xl:table-cell' : ''}
            >
              {col.label}
              {sortKey === col.key && <span style={{ color: '#c8a84b', marginLeft: 3 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(coin => {
          const sentScore = calcSentiment(coin.pct24h, coin.pct7d)
          const sentLabel = getSentimentLabel(sentScore)
          const audPrice = usdToAud(coin.price)
          const supplyPct = coin.maxSupply ? Math.min(100, (coin.circulatingSupply / coin.maxSupply) * 100) : null
          return (
            <tr key={coin.symbol}
              style={{ borderBottom: '1px solid rgba(13,34,68,0.4)', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,127,232,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              onClick={() => onRowClick(coin)}>
              <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }}>{coin.rank}</td>
              <td style={{ ...CELL, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CoinCircle symbol={coin.symbol} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-bright)' }}>{coin.symbol}</div>
                    <div style={{ fontSize: 9, color: 'var(--color-text-dim)' }} className="hidden xl:block">{coin.name}</div>
                  </div>
                </div>
              </td>
              <td style={{ ...CELL, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 700, fontFamily: 'IBM Plex Mono' }}>
                  US${coin.price.toLocaleString('en-US', { maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                </div>
                <div style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>
                  {fmt.aud(audPrice)}
                </div>
              </td>
              <td style={{ ...CELL, textAlign: 'right' }}>
                <PriceChange pct={coin.pct24h} className="justify-end" />
              </td>
              <td style={{ ...CELL, textAlign: 'right' }} className="hidden sm:table-cell">
                <PriceChange pct={coin.pct7d} className="justify-end" />
              </td>
              <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }} className="hidden md:table-cell">
                {currPrefix}{coin.mktCap}
              </td>
              <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }} className="hidden lg:table-cell">
                {currPrefix}{coin.vol24h}
              </td>
              {/* Supply bar — circulating/max, gold fill */}
              <td style={{ ...CELL, textAlign: 'right' }} className="hidden lg:table-cell">
                {supplyPct != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <div style={{ width: 44, height: 4, background: 'rgba(100,120,160,0.2)', borderRadius: 2, flexShrink: 0 }}>
                      <div style={{ width: `${supplyPct}%`, height: '100%', borderRadius: 2, background: '#c8a84b' }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--color-text-dim)', width: 28, textAlign: 'right' }}>{supplyPct.toFixed(0)}%</span>
                  </div>
                ) : <span style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>∞</span>}
              </td>
              {/* Sentiment — fixed width, visual bar with aligned | separator */}
              <td style={{ width: 130, minWidth: 130, maxWidth: 130, padding: '5px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}
                className="hidden xl:table-cell">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#1a3a6a', width: 8, flexShrink: 0, textAlign: 'center' }}>|</span>
                  <div style={{ width: 40, height: 4, background: 'rgba(100,120,160,0.2)', borderRadius: 2, flexShrink: 0 }}>
                    <div style={{ width: `${sentScore}%`, height: '100%', borderRadius: 2,
                      background: sentScore >= 67 ? 'var(--color-gain)' : sentScore >= 34 ? '#c8a84b' : 'var(--color-loss)'
                    }} />
                  </div>
                  <span style={{ width: 22, textAlign: 'right', flexShrink: 0, fontSize: 10,
                    color: sentScore >= 67 ? 'var(--color-gain)' : sentScore >= 34 ? '#c8a84b' : 'var(--color-loss)'
                  }}>{sentScore}</span>
                  <span style={{ fontSize: 9, color: 'rgba(100,130,160,0.8)', textTransform: 'uppercase' }}>{sentLabel}</span>
                </div>
              </td>
              <td style={{ ...CELL, textAlign: 'right' }} className="hidden xl:table-cell">
                <Sparkline prices={coin.sparkline} pct={coin.pct7d} />
              </td>
              <td style={{ ...CELL, textAlign: 'right' }} onClick={e => { e.stopPropagation(); onAskAI(coin) }}>
                <span style={{ fontSize: 9, color: '#c8a84b', cursor: 'pointer', border: '1px solid rgba(200,168,75,0.3)', padding: '2px 4px' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#c8a84b' }}>
                  AI
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── 30-day performance comparison chart ───────────────────────────────────
const PERF_TIMEFRAMES = ['7D', '1M', '3M']
const PERF_LINE_COLORS = ['#c8a84b', '#627eea', '#00d4ff', '#f7931a', '#9945ff']

function PerformanceChart({ coins, data, timeframe, onTimeframeChange, isLoading }) {
  return (
    <div className="flex-shrink-0 border-t border-terminal-border flex flex-col overflow-hidden" style={{ height: 180 }}>
      <div className="flex items-center gap-2 px-2 py-1 border-b border-terminal-border/50 flex-shrink-0 flex-wrap">
        <span className="text-2xs text-terminal-text-dim font-bold">TOP 5 PERFORMANCE — NORMALISED TO 100</span>
        <div className="flex gap-0.5 ml-auto">
          {PERF_TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => onTimeframeChange(tf)}
              className={`px-1.5 py-0 text-[9px] rounded-full transition-colors ${
                timeframe === tf ? 'bg-terminal-gold text-terminal-bg font-bold' : 'text-terminal-text-dim hover:text-terminal-gold border border-terminal-border'
              }`}>
              {tf}
            </button>
          ))}
        </div>
        {isLoading && <span className="text-terminal-text-dim text-[9px] animate-pulse">...</span>}
        <div className="flex gap-2 flex-wrap w-full">
          {coins.map((c, i) => (
            <span key={c.symbol} className="text-[9px] flex items-center gap-1" style={{ color: PERF_LINE_COLORS[i % PERF_LINE_COLORS.length] }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: PERF_LINE_COLORS[i % PERF_LINE_COLORS.length], display: 'inline-block' }} />
              {c.symbol} {data.finalPct?.[c.symbol] != null ? `${data.finalPct[c.symbol] >= 0 ? '+' : ''}${data.finalPct[c.symbol].toFixed(1)}%` : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 px-1 pb-1">
        {data.rows?.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#0d2244" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 7 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 7 }} domain={['auto', 'auto']} width={36} tickFormatter={(v) => v.toFixed(0)} />
              <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #c8a84b', fontSize: 9 }} />
              {coins.map((c, i) => (
                <Line key={c.symbol} type="monotone" dataKey={c.symbol} stroke={PERF_LINE_COLORS[i % PERF_LINE_COLORS.length]}
                  strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">
            LOADING PERFORMANCE DATA...
          </div>
        )}
      </div>
    </div>
  )
}
