import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCryptoMarkets, fetchCoinHistory, fetchFearGreed, fetchTrendingCoins, fetchCryptoGlobal,
  transformCryptoMarkets, transformCoinHistory, transformFearGreed,
  COIN_IDS,
} from '../../services/api'
import { calculateCryptoMomentumIndex, scoreToColor, explainScore } from '../../services/maddenAiScoring'
import { useStore } from '../../store/useStore'
import { fmt } from '../../utils/format'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

function getSentimentColor(score) {
  if (score >= 75) return 'var(--color-gain-bright)'
  if (score >= 60) return 'var(--color-gain)'
  if (score >= 45) return 'var(--color-neutral)'
  if (score >= 30) return '#ff8c00'
  return 'var(--color-loss-bright)'
}

function getSentimentLabel(score) {
  if (score >= 75) return 'EXT GREED'
  if (score >= 60) return 'GREED'
  if (score >= 45) return 'NEUTRAL'
  if (score >= 30) return 'FEAR'
  return 'EXT FEAR'
}

// ── Fear & Greed Gauge ─────────────────────────────────────────────────────────

function FearGreedGauge({ data }) {
  const getColor = (v) =>
    v >= 75 ? 'var(--color-gain-bright)' :
    v >= 55 ? 'var(--color-neutral)' :
    v >= 45 ? '#f0c040' :
    v >= 25 ? '#ff8c00' :
              'var(--color-loss-bright)'
  const { value, label, prev, weekAgo, monthAgo } = data
  const color = getColor(value)
  return (
    <div className="flex flex-col items-center justify-center h-full px-1 py-1.5">
      <div className="text-2xs text-terminal-gold tracking-widest font-bold mb-1">FEAR &amp; GREED</div>
      <svg viewBox="0 0 120 70" style={{ width: '100%', maxWidth: 100, height: 'auto', display: 'block' }}>
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#0d2244" strokeWidth="10" />
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${(value / 100) * 157} 157`} strokeLinecap="butt" />
        <text x="60" y="60" textAnchor="middle" fill={color} fontSize="22" fontFamily="IBM Plex Mono" fontWeight="700">{value}</text>
      </svg>
      <div className="text-2xs font-bold mt-0.5" style={{ color }}>{label.toUpperCase()}</div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-0 mt-1 text-2xs w-full text-center">
        {[['PREV', prev], ['WEEK', weekAgo], ['MO', monthAgo]].map(([l, v]) => (
          <div key={l}>
            <div className="text-terminal-text-dim/60 text-[9px]">{l}</div>
            <div className="text-[10px]" style={{ color: getColor(v) }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
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

// ── MaddenAI Crypto Momentum — hero panel ─────────────────────────────────────

function MaddenAIMomentum({ momentum }) {
  const [expanded, setExpanded] = useState(false)
  if (!momentum) {
    return (
      <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">
        CALCULATING...
      </div>
    )
  }
  const color = scoreToColor(momentum.score)
  const { bullish, neutral, bearish } = momentum.breakdown ?? { bullish: 33, neutral: 34, bearish: 33 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 14px', height: '100%', boxSizing: 'border-box', borderLeft: '2px solid rgba(200,168,75,0.3)', background: 'rgba(200,168,75,0.018)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c8a84b', letterSpacing: '0.12em', marginBottom: 5 }}>
        MADDENAI CRYPTO MOMENTUM
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, color, fontFamily: 'IBM Plex Mono' }}>
          {momentum.score}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 10, color: 'rgba(100,130,160,0.5)' }}>/ 100</span>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{momentum.label.toUpperCase()}</span>
        </div>
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', height: 10, width: '100%', overflow: 'hidden', borderRadius: 2 }}>
          <div style={{ width: `${bullish}%`, background: 'var(--color-gain)', transition: 'width 0.5s' }} />
          <div style={{ width: `${neutral}%`, background: 'var(--color-neutral)', transition: 'width 0.5s' }} />
          <div style={{ width: `${bearish}%`, background: 'var(--color-loss)', transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginTop: 3 }}>
          <span style={{ color: 'var(--color-gain)' }}>{bullish}% BULL</span>
          <span style={{ color: 'var(--color-neutral)' }}>{neutral}% NEUT</span>
          <span style={{ color: 'var(--color-loss)' }}>{bearish}% BEAR</span>
        </div>
      </div>

      <div style={{ cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <span style={{ fontSize: 8, color: 'rgba(100,130,160,0.4)', letterSpacing: '0.05em' }}>
          {expanded ? '▲ HIDE DETAIL' : '▼ SHOW DETAIL'}
        </span>
        {expanded && (
          <div style={{ fontSize: 9, color: 'rgba(150,170,190,0.7)', marginTop: 4, borderTop: '1px solid rgba(13,34,68,0.6)', paddingTop: 4 }}>
            {explainScore(momentum)}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 6 }}>
        <span style={{ fontSize: 8, color: 'rgba(200,168,75,0.5)', letterSpacing: '0.1em' }}>
          POWERED BY MADDENAI ◆
        </span>
      </div>
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
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <svg viewBox="0 0 100 60" style={{ width:70, height:42, flexShrink:0 }}>
          <path d="M 8 54 A 42 42 0 0 1 92 54" fill="none" stroke="#0d2244" strokeWidth="9" />
          <path d="M 8 54 A 42 42 0 0 1 92 54" fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={`${(value / 100) * 131.9} 131.9`} strokeLinecap="butt" />
          <text x="50" y="50" textAnchor="middle" fill={color} fontSize="20" fontFamily="IBM Plex Mono" fontWeight="700">{value}</text>
        </svg>
        <div style={{ fontSize:9 }}>
          <div style={{ fontSize:11, fontWeight:700, color, marginBottom:4 }}>{label.toUpperCase()}</div>
          <div style={{ color:'rgba(100,130,160,0.5)', marginBottom:2 }}>PREV: <span style={{ color:getColor(prev) }}>{prev}</span></div>
          <div style={{ color:'rgba(100,130,160,0.5)' }}>7D: <span style={{ color:getColor(weekAgo) }}>{weekAgo}</span></div>
        </div>
      </div>
    </div>
  )
}

function MarketPulsePanel({ globalData, currency }) {
  if (!globalData) return <div style={P.wrap}><div style={P.title}>MARKET PULSE</div><div style={P.empty}>LOADING...</div></div>
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
      <div style={P.title}>MARKET PULSE</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px', fontSize:9 }}>
        {[
          { label:'MKT CAP', value: fmtB(cap), color:'#d4dce8' },
          { label:'24H CHG', value: chg != null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—', color: chgColor },
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

function DominancePanel({ globalData }) {
  if (!globalData) return <div style={P.wrap}><div style={P.title}>DOMINANCE</div><div style={P.empty}>LOADING...</div></div>
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
  return (
    <div style={P.wrap}>
      <div style={P.title}>DOMINANCE</div>
      <div style={{ height:8, display:'flex', borderRadius:2, overflow:'hidden', marginBottom:7 }}>
        {bars.map(b => <div key={b.label} style={{ width:`${b.pct}%`, background:b.color, transition:'width 0.5s' }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 8px' }}>
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
  const [titleBarHeight, setTitleBarHeight] = useState(28)
  const titleBarRef = useRef(null)
  const { openModal, currency } = useStore()

  useEffect(() => {
    if (titleBarRef.current) {
      const h = titleBarRef.current.offsetHeight
      console.log('Crypto title bar height:', h)
      setTitleBarHeight(h)
    }
  }, [])
  const vsCurrency = currency.toLowerCase()
  const currPrefix = currency === 'AUD' ? 'A$' : 'US$'

  const { data: rawMarketsResult, isError: marketsError, refetch: refetchMarkets } = useQuery({
    queryKey: ['cryptoMarkets', vsCurrency],
    queryFn:  () => fetchCryptoMarkets(vsCurrency),
    staleTime: 60_000,
    retry: 1,
  })

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

  const yAxisFmt = (v) => {
    if (v >= 1_000_000) return `${currPrefix}${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `${currPrefix}${(v / 1_000).toFixed(0)}K`
    return `${currPrefix}${v.toFixed(0)}`
  }

  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const handleOpenModal = (coin) => openModal?.({
    symbol: coin.symbol, name: coin.name, price: coin.price,
    pct: coin.pct24h, change: null, type: 'crypto', coinId: COIN_IDS[coin.symbol],
  })

  const askAI = (coin) => {
    const prompt = `Analyse ${coin.name} (${coin.symbol}): price ${currPrefix}${coin.price.toLocaleString('en-AU', { maximumFractionDigits: 2 })}, 24h ${coin.pct24h.toFixed(2)}%, 7d ${(coin.pct7d ?? 0).toFixed(2)}%, mkt cap ${currPrefix}${coin.mktCap}. Sentiment: ${calcSentiment(coin.pct24h, coin.pct7d)}/100. Provide brief outlook for AUD-based investors.`
    window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt } }))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Row 1: 4-Panel Dashboard ── */}
      <div className="flex border-b border-terminal-border flex-shrink-0 divide-x divide-terminal-border"
        style={{ height: 120, flexShrink: 0 }}>
        <MaddenAIPanel momentum={momentum} />
        <FearGreedPanel data={fearGreed} />
        <MarketPulsePanel globalData={globalData} currency={currency} />
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
          {rawMarkets
            ? <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE · {updatedTime}</span>
            : !marketsError && <span className="text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>
          }
          {marketsError && <span className="text-terminal-red text-2xs font-normal">⚠ UNAVAILABLE</span>}
        </div>
        {/* Gap cover — fills any sub-pixel gap between title bar and column headers */}
        <div style={{ position: 'sticky', top: titleBarHeight, zIndex: 15, height: 2, background: '#071428', margin: 0, padding: 0 }} />

        {marketsError ? (
          <DataUnavailable label="CRYPTO MARKETS UNAVAILABLE" onRetry={refetchMarkets} />
        ) : markets ? (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            {/* Column headers — sticky below title bar, z-index 10 */}
            <thead style={{ position: 'sticky', top: titleBarHeight + 2, zIndex: 10 }}>
              <tr style={{ background: '#071428', borderBottom: '1px solid #c8a84b' }}>
                <th style={{ ...HEAD, textAlign: 'right', width: 28 }}>#</th>
                <th style={{ ...HEAD, textAlign: 'left' }}>ASSET</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>PRICE</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>24H%</th>
                <th style={{ ...HEAD, textAlign: 'right' }} className="hidden sm:table-cell">7D%</th>
                <th style={{ ...HEAD, textAlign: 'right', width: 140, minWidth: 140 }} className="hidden md:table-cell">SENTIMENT</th>
                <th style={{ ...HEAD, textAlign: 'right' }} className="hidden lg:table-cell">7D CHART</th>
                <th style={{ ...HEAD, textAlign: 'right' }} className="hidden md:table-cell">MKT CAP</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>AI</th>
              </tr>
            </thead>
            <tbody>
              {markets.map(coin => {
                const sentScore = calcSentiment(coin.pct24h, coin.pct7d)
                const sentColor = getSentimentColor(sentScore)
                const sentLabel = getSentimentLabel(sentScore)
                return (
                  <tr key={coin.symbol}
                    style={{ borderBottom: '1px solid rgba(13,34,68,0.4)', background: 'transparent', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,127,232,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    onClick={() => handleOpenModal(coin)}>
                    <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }}>{coin.rank}</td>
                    <td style={{ ...CELL, textAlign: 'left' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-bright)' }}>{coin.symbol}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-dim)', marginLeft: 4 }} className="hidden xl:inline">{coin.name}</span>
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {currency === 'AUD' ? fmt.aud(coin.price) : `US$${coin.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', fontWeight: 600, color: coin.pct24h >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                      {fmt.pct(coin.pct24h)}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', fontWeight: 600, color: (coin.pct7d ?? 0) >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}
                      className="hidden sm:table-cell">
                      {fmt.pct(coin.pct7d)}
                    </td>
                    {/* Sentiment — fixed 140px, visual bar with aligned | separator */}
                    <td style={{ width: 140, minWidth: 140, maxWidth: 140, padding: '5px 8px', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'middle', position: 'static' }}
                      className="hidden md:table-cell">
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
                    <td style={{ ...CELL, textAlign: 'right' }} className="hidden lg:table-cell">
                      <Sparkline prices={coin.sparkline} pct={coin.pct7d} />
                    </td>
                    <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }} className="hidden md:table-cell">
                      {currPrefix}{coin.mktCap}
                    </td>
                    <td style={{ ...CELL, textAlign: 'right' }} onClick={e => { e.stopPropagation(); askAI(coin) }}>
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
        ) : null}
      </div>

    </div>
  )
}
