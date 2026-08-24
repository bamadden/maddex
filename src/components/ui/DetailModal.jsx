import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import {
  fetchCoinOHLC, fetchCoinHistory, fetchYFHistory, transformYFHistory,
  transformCoinOHLC, transformCoinHistory, toYFRange, fetchNews, askClaude,
  fetchQuoteSummary, fetchYahooQuoteBatch,
} from '../../services/api'
import { DataUnavailable } from './DataUnavailable'
import TradingChart from '../charts/TradingChart'
import { earningsFor, daysUntil } from '../../services/earningsCalendar'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt, colorClass } from '../../utils/format'
import { toYahooSymbol, timeframeToDays, COIN_IDS_MAP } from '../../utils/assetUtils'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import ResearchNoteGenerator from '../researchNote/ResearchNoteGenerator'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, Legend,
} from 'recharts'

const TIMEFRAMES  = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y']
const CHART_TYPES = ['area', 'line', 'candle', 'pro']

// Next scheduled earnings date — hardcoded for the app's top 20 most-viewed
// ASX/US stocks (indicative reporting-season dates, not a live feed).
const NEXT_EARNINGS = {
  'BHP.AX': '17 Feb 2026', 'CBA.AX': '11 Feb 2026', 'CSL.AX': '11 Feb 2026',
  'WBC.AX': '05 May 2026', 'NAB.AX': '07 May 2026', 'ANZ.AX': '14 May 2026',
  'WES.AX': '26 Feb 2026', 'MQG.AX': '02 Nov 2026', 'WOW.AX': '26 Feb 2026',
  'RIO.AX': '18 Feb 2026', 'FMG.AX': '30 Jan 2026', 'TLS.AX': '13 Feb 2026',
  AAPL: '29 Jan 2026', NVDA: '25 Feb 2026', MSFT: '27 Jan 2026',
  TSLA: '21 Jan 2026', AMZN: '05 Feb 2026', META: '28 Jan 2026',
  GOOG: '03 Feb 2026', NFLX: '20 Jan 2026',
}

// ─── Crypto coin colour circle + descriptions ─────────────────────────────────
// Same deterministic-hash approach as CryptoModule.jsx's CoinCircle — kept as
// a small local copy rather than a cross-import from modules/ into
// components/ui/, which would invert this app's dependency direction.
const CIRCLE_PALETTE = ['#f7931a', '#627eea', '#9945ff', '#00d4ff', '#f0b90b', '#26a17b', '#e84142', '#2775ca', '#8247e5', '#c8a84b']
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function coinColor(symbol) {
  return CIRCLE_PALETTE[hashStr(symbol ?? '') % CIRCLE_PALETTE.length]
}
function CoinCircle({ symbol, size = 40 }) {
  const color = coinColor(symbol)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `${color}26`, border: `1.5px solid ${color}66`, color, fontSize: size * 0.4 }}
    >
      {symbol?.[0] ?? '?'}
    </span>
  )
}

const COIN_DESCRIPTIONS = {
  BTC:  'The original cryptocurrency and global store of value. Fixed supply of 21M coins, secured by proof-of-work mining.',
  ETH:  'Programmable blockchain powering decentralised applications and smart contracts. Transitioned to proof-of-stake in 2022.',
  XRP:  'Payment protocol and digital asset designed for instant cross-border settlements. Operated by Ripple Labs, 300+ institutional partners globally.',
  SOL:  'High-performance blockchain processing 65,000+ transactions per second at fractions of a cent. Leading DeFi and NFT ecosystem.',
  BNB:  'Native token of the Binance ecosystem and BNB Chain. Used for trading fee discounts, gas fees, and DeFi applications.',
  ADA:  'Peer-reviewed, research-driven blockchain built for sustainability and scalability. Focus on emerging markets and financial inclusion.',
  DOGE: 'Originally a meme cryptocurrency, now a widely accepted payment token with one of the largest retail communities in crypto.',
  AVAX: 'Fast, low-cost smart contract platform with sub-second finality. Supports custom blockchains and is strong in DeFi and gaming.',
  TON:  "The Open Network — blockchain developed from Telegram's original design. Fast growing ecosystem tied to Telegram's 900M+ user base.",
  LINK: 'Decentralised oracle network connecting smart contracts to real-world data. Infrastructure layer for DeFi protocols.',
}
function coinDescription(symbol, name) {
  return COIN_DESCRIPTIONS[symbol] ?? `${name ?? symbol} is a digital asset traded on major cryptocurrency exchanges. Track its price, market cap, and trading volume alongside the rest of the top 20 by market cap.`
}

const REC_LABELS = ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']
const REC_COLORS = ['#22c55e', '#86efac', '#fbbf24', '#f97316', '#ef4444']

// ─── Candlestick Chart ────────────────────────────────────────────────────────

function CandleChart({ data }) {
  const containerRef = useRef(null)
  const [width, setWidth]     = useState(600)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (!data || data.length === 0) {
    return <div ref={containerRef} className="w-full h-full flex items-center justify-center text-2xs text-terminal-text-dim">NO DATA</div>
  }

  const height    = 200
  const padLeft   = 52
  const padRight  = 12
  const padTop    = 12
  const padBottom = 24
  const chartW    = width - padLeft - padRight
  const chartH    = height - padTop - padBottom

  const prices  = data.flatMap((d) => [d.high, d.low])
  const minP    = Math.min(...prices)
  const maxP    = Math.max(...prices)
  const range   = maxP - minP || 1
  const pricePad = range * 0.05

  const toY = (p) => padTop + chartH - ((p - (minP - pricePad)) / (range + pricePad * 2)) * chartH
  const toX = (i) => padLeft + (i / (data.length - 1 || 1)) * chartW

  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const price = minP - pricePad + ((range + pricePad * 2) * i) / 4
    return { price, y: toY(price) }
  })

  const xStep   = Math.max(1, Math.floor(data.length / 7))
  const xLabels = data
    .map((d, i) => ({ date: d.date, x: toX(i) }))
    .filter((_, i) => i % xStep === 0)

  const candleW = Math.max(2, Math.min(12, (chartW / data.length) * 0.6))

  return (
    <div ref={containerRef} className="w-full relative" style={{ height: `${height}px` }}>
      <svg width={width} height={height} onMouseLeave={() => setTooltip(null)}>
        {yLabels.map((lbl) => (
          <line key={lbl.price} x1={padLeft} y1={lbl.y} x2={width - padRight} y2={lbl.y} stroke="#0d2244" strokeWidth={1} />
        ))}
        {yLabels.map((lbl) => (
          <text key={lbl.price} x={padLeft - 4} y={lbl.y + 3} textAnchor="end" fill="#4a6580" fontSize={9} fontFamily="IBM Plex Mono">
            {lbl.price >= 1000 ? fmt.price(lbl.price, 0) : fmt.price(lbl.price, 2)}
          </text>
        ))}
        {xLabels.map((lbl) => (
          <text key={lbl.date} x={lbl.x} y={height - 4} textAnchor="middle" fill="#4a6580" fontSize={9} fontFamily="IBM Plex Mono">
            {lbl.date}
          </text>
        ))}
        {data.map((d, i) => {
          const x     = toX(i)
          const yHigh = toY(d.high)
          const yLow  = toY(d.low)
          const yOpen  = toY(d.open)
          const yClose = toY(d.close)
          const isBull = d.close >= d.open
          const color  = isBull ? 'var(--color-gain)' : 'var(--color-loss)'
          const bodyTop    = Math.min(yOpen, yClose)
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen))
          return (
            <g key={i} onMouseEnter={() => setTooltip({ ...d, x, y: bodyTop })}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={1} />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} />
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs z-10"
          style={{ left: Math.min(tooltip.x + 8, width - 140), top: Math.max(tooltip.y - 60, 8) }}
        >
          <div className="text-terminal-text-dim mb-0.5">{tooltip.date}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-terminal-text-dim">O</span><span className="text-terminal-text-bright">{fmt.price(tooltip.open)}</span>
            <span className="text-terminal-green">H</span><span className="text-terminal-green">{fmt.price(tooltip.high)}</span>
            <span className="text-terminal-red">L</span><span className="text-terminal-red">{fmt.price(tooltip.low)}</span>
            <span className="text-terminal-text-dim">C</span><span className="text-terminal-text-bright font-semibold">{fmt.price(tooltip.close)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Recharts tooltip ─────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="text-terminal-gold font-semibold">{fmt.aud(payload[0].value)}</div>
    </div>
  )
}

// ─── 52W Range bar ────────────────────────────────────────────────────────────

function RangeBar({ price, low, high }) {
  if (low == null || high == null || low >= high) return null
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="text-terminal-red w-16 text-right">{fmt.aud(low, { decimals: 2 })}</span>
      <div className="flex-1 relative h-1 bg-terminal-border/40">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-terminal-red via-terminal-gold to-terminal-green" style={{ width:'100%', opacity:0.3 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-terminal-gold border border-terminal-bg" style={{ left:`${pct}%`, transform:'translate(-50%, -50%)' }} />
      </div>
      <span className="text-terminal-green w-16">{fmt.aud(high, { decimals: 2 })}</span>
    </div>
  )
}

// ─── Market Status badge ──────────────────────────────────────────────────────

function MarketStatusBadge({ extra = {} }) {
  const { isOpen, exchange } = extra
  const label = isOpen ? 'OPEN' : 'CLOSED'
  const cls   = isOpen
    ? 'border-terminal-green text-terminal-green'
    : 'border-terminal-text-dim/40 text-terminal-text-dim'
  const dot   = isOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-text-dim/40'
  return (
    <div className={`flex items-center gap-1.5 border px-2 py-0.5 text-2xs ${cls}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      {exchange && <span className="text-terminal-text-dim">{exchange} ·</span>}
      <span className="font-bold">{label}</span>
    </div>
  )
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true, noCols = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-l-2 border-terminal-gold/25 mt-1.5">
      <button
        className="w-full flex items-center justify-between px-3 py-1 hover:bg-terminal-accent/10 transition-colors text-left select-none"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-2xs font-bold text-terminal-gold/70 tracking-widest">{title}</span>
        <span className="text-terminal-text-dim/40 text-2xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={`px-3 pb-2 pt-0.5 ${noCols ? '' : 'grid grid-cols-2 gap-x-6'}`}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Data row ─────────────────────────────────────────────────────────────────

function DataRow({ label, value, cls = '' }) {
  return (
    <div className="flex justify-between items-baseline py-0.5 border-b border-terminal-border/20 last:border-0 min-w-0">
      <span className="text-2xs text-terminal-text-dim/60 mr-2 flex-shrink-0">{label}</span>
      <span className={`text-2xs font-semibold text-right truncate ${cls || 'text-terminal-text-bright'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ─── Analyst consensus bar ───────────────────────────────────────────────────

function AnalystBar({ recMean, analystCount }) {
  if (!recMean) return <p className="text-2xs text-terminal-text-dim/50 py-1">No analyst coverage data</p>
  const clamped = Math.max(1, Math.min(5, recMean))
  const pct     = ((clamped - 1) / 4) * 100
  const idx     = Math.min(4, Math.max(0, Math.round(clamped) - 1))
  return (
    <div className="w-full py-0.5">
      <div className="flex h-2 rounded-sm overflow-hidden gap-px">
        {REC_COLORS.map((c, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: c, opacity: i === idx ? 1 : 0.18 }} />
        ))}
      </div>
      <div className="relative h-2 mt-0.5">
        <div className="absolute" style={{ left: `calc(${pct}% - 4px)`, top: -1 }}>
          <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `6px solid ${REC_COLORS[idx]}` }} />
        </div>
      </div>
      <div className="flex justify-between mt-0.5 px-0.5">
        {REC_LABELS.map((l, i) => (
          <span key={l} className="text-terminal-text-dim/40 text-center leading-tight" style={{ fontSize: '9px', width: '20%' }}>
            {l.split(' ').map((w, wi) => <span key={wi} className="block">{w}</span>)}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs font-bold" style={{ color: REC_COLORS[idx] }}>{REC_LABELS[idx]}</span>
        <span className="text-2xs text-terminal-text-dim/60">{recMean.toFixed(2)} / 5 · {analystCount ?? '—'} analysts</span>
      </div>
    </div>
  )
}

// ─── AI Fundamentals panel ────────────────────────────────────────────────────

function AIFundamentalsPanel({ asset, displayPrice, display52High, display52Low, qs }) {
  const { usdToAud } = useAudRates()
  const [text, setText]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [triggered, setTriggered] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    setText('')
    const { symbol, name, pct } = asset
    const priceAud = displayPrice ?? asset.price
    const rangeCtx = display52High != null
      ? ` | 52W: ${fmt.aud(display52Low, { clarify: true })} – ${fmt.aud(display52High, { clarify: true })}` : ''

    const isAud = qs?.currency === 'AUD'
    const conv  = (v) => (v == null ? null : isAud ? v : usdToAud(v))
    const big   = (v) => {
      const n = conv(v)
      if (!n) return null
      const a = Math.abs(n)
      if (a >= 1e12) return `A$${(n/1e12).toFixed(2)}T`
      if (a >= 1e9)  return `A$${(n/1e9).toFixed(1)}B`
      if (a >= 1e6)  return `A$${(n/1e6).toFixed(0)}M`
      return `A$${n.toFixed(0)}`
    }

    let fundamentalCtx = ''
    if (qs) {
      fundamentalCtx = [
        qs.sector           ? `Sector: ${qs.sector}` : null,
        qs.industry         ? `Industry: ${qs.industry}` : null,
        qs.marketCap        ? `Mkt Cap: ${big(qs.marketCap)}` : null,
        qs.trailingPE       ? `P/E: ${qs.trailingPE.toFixed(1)}x` : null,
        qs.forwardPE        ? `Fwd P/E: ${qs.forwardPE.toFixed(1)}x` : null,
        qs.revenue          ? `Revenue: ${big(qs.revenue)}` : null,
        qs.grossMargins     ? `Gross Margin: ${(qs.grossMargins * 100).toFixed(1)}%` : null,
        qs.operatingMargins ? `Op Margin: ${(qs.operatingMargins * 100).toFixed(1)}%` : null,
        qs.roe              ? `ROE: ${(qs.roe * 100).toFixed(1)}%` : null,
        qs.beta             ? `Beta: ${qs.beta.toFixed(2)}` : null,
        qs.divYield         ? `Div Yield: ${(qs.divYield * 100).toFixed(2)}%` : null,
        qs.recKey           ? `Consensus: ${qs.recKey}` : null,
        qs.targetMean       ? `Target: ${big(qs.targetMean)}` : null,
        qs.ma50             ? `50D MA: ${fmt.aud(conv(qs.ma50), { clarify: true })}` : null,
        qs.ma200            ? `200D MA: ${fmt.aud(conv(qs.ma200), { clarify: true })}` : null,
        qs.week52Change     ? `52W Chg: ${(qs.week52Change * 100).toFixed(1)}%` : null,
      ].filter(Boolean).join(' | ')
    }

    const prompt = [
      `${name ?? symbol} (${symbol})`,
      `Price: ${fmt.aud(priceAud, { clarify: true })} | Day: ${pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}${rangeCtx}`,
      fundamentalCtx || null,
      '',
      'Provide a comprehensive analysis (max 200 words):',
      '1. ASSESSMENT — valuation and market position',
      '2. TECHNICALS — key levels, momentum, trend strength',
      '3. OUTLOOK — near-term catalysts or headwinds',
      '4. RISK — main risks for AUD-based investors',
    ].filter(v => v !== null).join('\n')

    try {
      await askClaude([{ role: 'user', content: prompt }], (_, full) => setText(full))
    } catch (e) {
      setText(`[ERROR] ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [asset, displayPrice, display52High, display52Low, qs, usdToAud])

  useEffect(() => {
    if (!triggered) { setTriggered(true); generate() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-2xs text-terminal-text-dim/40 italic">AI-generated · not financial advice</span>
        <button
          onClick={generate}
          disabled={loading}
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors disabled:opacity-40"
        >
          {loading ? 'GENERATING...' : '↻ REFRESH'}
        </button>
      </div>
      <div className="min-h-[60px]">
        {loading && !text && (
          <div className="text-2xs text-terminal-gold/70 animate-pulse">Analysing {asset.symbol}...</div>
        )}
        {text && (
          <p className="text-2xs text-terminal-text leading-relaxed">
            {text}{loading && <span className="text-terminal-gold animate-pulse">▋</span>}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Asset news panel ─────────────────────────────────────────────────────────

function AssetNewsPanel({ symbol, name }) {
  const { data: news } = useQuery({
    queryKey:  ['news'],
    queryFn:   fetchNews,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const keywords = [
    symbol.replace(/\.AX$/, '').replace(/^\^/, ''),
    ...(name ? name.split(' ').slice(0, 2) : []),
  ]
  const matching = ((news?.articles) ?? []).filter((n) =>
    keywords.some((kw) => kw.length > 2 && n.headline.toLowerCase().includes(kw.toLowerCase()))
  ).slice(0, 5)

  if (!matching.length) {
    return <p className="text-2xs text-terminal-text-dim/40 py-1">No related news found</p>
  }

  return (
    <div>
      {matching.map((n) => (
        <a
          key={n.id}
          href={n.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 py-1 border-b border-terminal-border/20 last:border-0 hover:bg-terminal-accent/10 transition-colors group -mx-3 px-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-2xs text-terminal-text group-hover:text-terminal-text-bright leading-tight">{n.headline}</div>
            <div className="text-2xs text-terminal-text-dim/50">{n.source} · {n.time}</div>
          </div>
          <span className="text-terminal-text-dim/30 text-2xs flex-shrink-0 mt-0.5 group-hover:text-terminal-gold">↗</span>
        </a>
      ))}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function DetailModal() {
  const { modalAsset, closeModal, addToWatchlist, watchlist, addAlert, setActiveModule, openCompare } = useStore()
  const queryClient = useQueryClient()

  const [timeframe, setTimeframe] = useState('1M')
  const [chartType, setChartType] = useState('area')
  const { audUsd, usdToAud } = useAudRates()

  const [alertOpen, setAlertOpen]     = useState(false)
  const [alertPrice, setAlertPrice]   = useState('')
  const [alertDir, setAlertDir]       = useState('above')
  const [alertSaved, setAlertSaved]   = useState(false)

  const [compareOpen, setCompareOpen]     = useState(false)
  const [compareInput, setCompareInput]   = useState('')
  const [compareSymbol, setCompareSymbol] = useState(null)

  const [noteOpen, setNoteOpen] = useState(false)
  const [researchNoteOpen, setResearchNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)

  const overlayRef = useRef(null)

  useEffect(() => {
    if (modalAsset) {
      setTimeframe('1M'); setChartType('area')
      setAlertOpen(false); setAlertPrice(''); setAlertSaved(false)
      setCompareOpen(false); setCompareInput(''); setCompareSymbol(null)
      setNoteOpen(false); setNoteSaved(false)
      setResearchNoteOpen(false)
      try { setNoteText(JSON.parse(localStorage.getItem('madden_research_notes') ?? '{}')[modalAsset.symbol] ?? '') } catch { setNoteText('') }
    }
  }, [modalAsset?.symbol])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) closeModal()
  }, [closeModal])

  const coinId        = modalAsset?.coinId ?? COIN_IDS_MAP[modalAsset?.symbol?.toUpperCase()]
  const days          = timeframeToDays(timeframe)
  const isCryptoModal = !!modalAsset && modalAsset.type === 'crypto' && !!coinId
  const isEquity      = !!modalAsset && (modalAsset.type === 'asx' || modalAsset.type === 'us')
  const isStockOrIdx  = !!modalAsset && (isEquity || modalAsset.type === 'index')
  const yfSym         = modalAsset ? toYahooSymbol(modalAsset.symbol, modalAsset.type) : null
  const yfRange       = toYFRange(timeframe)

  // Chart queries
  const { data: cryptoHistory, isFetching: cryptoHistLoading } = useQuery({
    queryKey:  ['modalCryptoHistory', coinId, timeframe],
    queryFn:   () => fetchCoinHistory(coinId, 'aud', days),
    enabled:   isCryptoModal && chartType !== 'candle',
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const { data: cryptoOHLC, isFetching: cryptoOHLCLoading } = useQuery({
    queryKey:  ['modalCryptoOHLC', coinId, timeframe],
    queryFn:   () => fetchCoinOHLC(coinId, days),
    enabled:   isCryptoModal && chartType === 'candle',
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const { data: stockHistory, isFetching: stockLoading } = useQuery({
    queryKey:  ['modalStockHistory', yfSym, timeframe],
    queryFn:   () => fetchYFHistory(yfSym, yfRange),
    enabled:   isStockOrIdx && !!yfSym,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // COMPARE mode — second series, normalised to 100 at period start, overlaid
  // on the same chart. Only supports Yahoo-style symbols (stocks/indices) —
  // covers the overwhelming majority of comparisons users actually want.
  const compareYfSym = compareSymbol ? toYahooSymbol(compareSymbol, undefined) : null
  const { data: compareHistory, isFetching: compareLoading } = useQuery({
    queryKey:  ['modalCompareHistory', compareYfSym, timeframe],
    queryFn:   () => fetchYFHistory(compareYfSym, yfRange),
    enabled:   compareOpen && !!compareYfSym,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // Fundamental data — equity only
  const { data: qs, isLoading: qsLoading } = useQuery({
    queryKey:  ['quoteSummary', yfSym],
    queryFn:   () => fetchQuoteSummary(yfSym),
    enabled:   isEquity && !!yfSym,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // Batched v7 quote data — fallback for the fields above when quoteSummary
  // (a separate Yahoo endpoint) is rate-limited or slow to load, so one
  // endpoint being down doesn't leave every fundamental field blank.
  const { data: qvBatch } = useQuery({
    queryKey:  ['yahooQuoteBatch', yfSym],
    queryFn:   () => fetchYahooQuoteBatch([yfSym]),
    enabled:   isEquity && !!yfSym,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const qv = qvBatch?.[yfSym]
  const pick = (key) => qs?.[key] ?? qv?.[key]

  if (!modalAsset) return null

  const { symbol, name, price, pct, change, type, extra = {} } = modalAsset
  const priceCls  = colorClass(pct)
  const pctSign   = pct > 0 ? '+' : ''
  const isInWL    = watchlist.includes(symbol)
  const upcomingEarnings = (type === 'asx' || type === 'index') ? earningsFor(symbol) : null

  const displayPrice  = price
  const displayChange = change
  const display52High = extra.week52High ?? qv?.week52High
  const display52Low  = extra.week52Low  ?? qv?.week52Low
  const showUsdSub    = extra.currency === 'USD' && extra.nativePrice != null

  // Fundamental data helpers (quoteSummary values are in native currency)
  const qsCurrency = qs?.currency ?? (type === 'asx' ? 'AUD' : 'USD')
  const isQsAud    = qsCurrency === 'AUD'
  const toQsAud    = (v) => (v == null || !Number.isFinite(v)) ? null : (isQsAud ? v : usdToAud(v))

  const fmtBig = (v) => {
    if (v == null) return '—'
    const a = Math.abs(v)
    if (a >= 1e12) return `A$${(v / 1e12).toFixed(2)}T`
    if (a >= 1e9)  return `A$${(v / 1e9).toFixed(1)}B`
    if (a >= 1e6)  return `A$${(v / 1e6).toFixed(0)}M`
    if (a >= 1e3)  return `A$${(v / 1e3).toFixed(1)}K`
    return `A$${v.toFixed(2)}`
  }
  const fmtAmt    = (v) => { const a = toQsAud(v); return a == null ? '—' : fmtBig(a) }
  const fmtX      = (v, dp = 1) => v == null ? '—' : `${v.toFixed(dp)}x`
  const fmtPc     = (v) => v == null ? '—' : `${(v * 100).toFixed(2)}%`
  const fmtPcSign = (v) => { if (v == null) return '—'; const n = v * 100; return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` }
  const fmtDt     = (ts) => {
    if (!ts) return '—'
    try {
      const d = new Date(typeof ts === 'number' ? ts * 1000 : ts)
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return '—' }
  }

  // Chart data
  let chartData   = []
  let isLiveChart = false

  if (type === 'crypto') {
    if ((chartType === 'candle' || chartType === 'pro') && Array.isArray(cryptoOHLC)) {
      chartData = transformCoinOHLC(cryptoOHLC); isLiveChart = true
    } else if (chartType !== 'candle' && chartType !== 'pro' && cryptoHistory?.prices) {
      chartData = transformCoinHistory(cryptoHistory); isLiveChart = true
    }
  } else if (isStockOrIdx && stockHistory) {
    const raw    = transformYFHistory(stockHistory)
    const isAud  = type === 'asx' || type === 'index'
    chartData    = isAud ? raw : raw.map((d) => ({
      ...d,
      price: d.price != null ? usdToAud(d.price) : null,
      close: d.close != null ? usdToAud(d.close) : null,
      open:  d.open  != null ? usdToAud(d.open)  : null,
      high:  d.high  != null ? usdToAud(d.high)  : null,
      low:   d.low   != null ? usdToAud(d.low)   : null,
    }))
    isLiveChart  = true
  }

  const latest  = chartData[chartData.length - 1] ?? {}
  const allHigh = chartData.length ? Math.max(...chartData.map((d) => d.high ?? d.price ?? 0)) : null
  const allLow  = chartData.length ? Math.min(...chartData.map((d) => d.low  ?? d.price ?? Infinity)) : null

  // TradingChart wants {time, open, high, low, close, volume} — `time` as
  // a unix-second int (crypto, via transformCoinOHLC) or an ISO date
  // string (stocks, via transformYFHistory's rawDate). Only meaningful
  // once every bar actually has OHLC (i.e. the candle/pro fetch path).
  const proChartData = chartType === 'pro'
    ? chartData
        .filter((d) => d.open != null && d.high != null && d.low != null && d.close != null)
        .map((d) => ({ time: d.rawDate ?? d.time, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume ?? 0 }))
    : []

  // COMPARE mode — both series normalised to 100 at the period start and
  // zipped by index (both fetched for the same timeframe/range so lengths
  // are close enough for an index-based overlay, not a date-exact join).
  let compareData = []
  if (compareOpen && compareSymbol && chartData.length > 1) {
    const compareRaw = compareHistory ? transformYFHistory(compareHistory) : []
    const baseA = chartData[0]?.price
    const baseB = compareRaw[0]?.price
    if (baseA && baseB && compareRaw.length > 1) {
      const n = Math.min(chartData.length, compareRaw.length)
      compareData = Array.from({ length: n }, (_, i) => ({
        date: chartData[i].date,
        a: chartData[i].price != null ? (chartData[i].price / baseA) * 100 : null,
        b: compareRaw[i].price != null ? (compareRaw[i].price / baseB) * 100 : null,
      }))
    }
  }

  const isChartLoading = cryptoHistLoading || cryptoOHLCLoading || stockLoading
  const updatedTime    = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const typeBadgeColor = {
    asx:    'text-terminal-gold border-terminal-gold',
    crypto: 'text-terminal-green border-terminal-green',
    fx:     'text-terminal-blue-bright border-terminal-blue',
    index:  'text-terminal-text border-terminal-border',
    us:     'text-terminal-blue-bright border-terminal-blue',
  }[type] ?? 'text-terminal-text-dim border-terminal-border'

  const handleAskAI = () => {
    const exchangeLabel = { asx: 'ASX', us: 'US', crypto: 'Crypto', fx: 'FX', index: 'Index' }[type]
    closeModal()
    dispatchAskAI({
      name:     name ?? symbol,
      ticker:   symbol,
      exchange: exchangeLabel,
      price:    `A$${fmt.price(displayPrice)} (AUD)`,
      change:   pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : null,
      sector:   qs?.sector,
      date:     todayAEST(),
    })
  }

  const yFmt = (v) => {
    if (v >= 10000) return `$${(v / 1000).toFixed(0)}K`
    if (v >= 1000)  return `$${(v / 1000).toFixed(1)}K`
    if (v >= 1)     return `$${v.toFixed(2)}`
    return `$${v.toFixed(4)}`
  }

  // ─── Crypto raw data from cache ───────────────────────────────────────────────
  const cryptoMarkets = isCryptoModal ? queryClient.getQueryData(['cryptoMarkets', 'aud']) : null
  const coinRaw       = cryptoMarkets?.data?.find((c) => c.symbol === symbol?.toLowerCase())

  // ─── Equity sections (10 collapsible) ────────────────────────────────────────
  const equitySections = (
    <>
      <Section title="PRICE ACTION">
        <DataRow label="Open"
          value={latest.open  ? fmt.aud(latest.open)  : qs?.open     ? fmt.aud(toQsAud(qs.open))     : '—'} />
        <DataRow label="Day High"
          value={latest.high  ? fmt.aud(latest.high)  : qs?.dayHigh  ? fmt.aud(toQsAud(qs.dayHigh))  : '—'}
          cls="text-terminal-green" />
        <DataRow label="Day Low"
          value={latest.low   ? fmt.aud(latest.low)   : qs?.dayLow   ? fmt.aud(toQsAud(qs.dayLow))   : '—'}
          cls="text-terminal-red" />
        <DataRow label="Prev Close"
          value={pick('prevClose') ? fmt.aud(toQsAud(pick('prevClose'))) : '—'} />
        <DataRow label="Volume"
          value={pick('volume')    ? fmt.large(pick('volume'))    : '—'} />
        <DataRow label="Avg Vol (30D)"
          value={pick('avgVolume') ? fmt.large(pick('avgVolume')) : '—'} />
        <DataRow label="Period High"
          value={allHigh ? fmt.aud(allHigh) : display52High ? fmt.aud(display52High) : '—'}
          cls="text-terminal-green" />
        <DataRow label="Period Low"
          value={allLow && allLow !== Infinity ? fmt.aud(allLow) : display52Low ? fmt.aud(display52Low) : '—'}
          cls="text-terminal-red" />
        {NEXT_EARNINGS[symbol] && (
          <DataRow label="Next Earnings" value={NEXT_EARNINGS[symbol]} cls="text-terminal-gold" />
        )}
      </Section>

      <Section title="VALUATION">
        <DataRow label="Market Cap" value={(() => {
          const mc = pick('marketCap')
          if (!mc) return '—'
          if (isQsAud) return fmtBig(mc)
          const a = Math.abs(mc)
          const usd = a >= 1e12 ? `US$${(mc/1e12).toFixed(2)}T` : a >= 1e9 ? `US$${(mc/1e9).toFixed(1)}B` : a >= 1e6 ? `US$${(mc/1e6).toFixed(0)}M` : `US$${mc.toFixed(0)}`
          return `${fmtBig(toQsAud(mc))} (${usd})`
        })()} />
        <DataRow label="Enterprise Val" value={fmtAmt(qs?.enterpriseValue)} />
        <DataRow label="P/E (TTM)"      value={fmtX(pick('trailingPE'))} />
        <DataRow label="P/E (Forward)"  value={fmtX(pick('forwardPE'))} />
        <DataRow label="PEG Ratio"      value={fmtX(qs?.peg, 2)} />
        <DataRow label="P/S (TTM)"      value={fmtX(qs?.ps, 2)} />
        <DataRow label="P/B"            value={fmtX(pick('pb'), 2)} />
        <DataRow label="EV/Revenue"     value={fmtX(qs?.evRevenue, 2)} />
        <DataRow label="EV/EBITDA"      value={fmtX(qs?.evEbitda, 1)} />
        <DataRow label="Book Value"     value={pick('bookValue') ? fmt.aud(toQsAud(pick('bookValue'))) : '—'} />
        <DataRow label="Shares Outstanding" value={pick('sharesOutstanding') ? fmt.large(pick('sharesOutstanding')) : '—'} />
      </Section>

      <Section title="FINANCIALS">
        <DataRow label="Revenue"        value={fmtAmt(qs?.revenue)} />
        <DataRow label="Rev Growth"     value={fmtPcSign(qs?.revenueGrowth)} cls={colorClass(qs?.revenueGrowth)} />
        <DataRow label="Gross Profit"   value={fmtAmt(qs?.grossProfit)} />
        <DataRow label="Gross Margin"   value={fmtPc(qs?.grossMargins)} />
        <DataRow label="EBITDA Margin"  value={fmtPc(qs?.ebitdaMargins)} />
        <DataRow label="Op Margin"      value={fmtPc(qs?.operatingMargins)} />
        <DataRow label="Net Income"     value={fmtAmt(qs?.netIncome)} />
        <DataRow label="Net Margin"     value={fmtPc(qs?.profitMargins)} />
        <DataRow label="EPS (TTM)"      value={pick('epsTrailing') ? fmt.aud(toQsAud(pick('epsTrailing'))) : '—'} />
        <DataRow label="EPS (Fwd)"      value={pick('epsForward')  ? fmt.aud(toQsAud(pick('epsForward')))  : '—'} />
        <DataRow label="Free Cash Flow" value={fmtAmt(qs?.freeCashflow)} />
        <DataRow label="Op Cash Flow"   value={fmtAmt(qs?.operatingCF)} />
        <DataRow label="Total Debt"     value={fmtAmt(qs?.totalDebt)} />
        <DataRow label="Total Cash"     value={fmtAmt(qs?.totalCash)} />
        <DataRow label="Debt / Equity"  value={qs?.debtToEquity ? `${(qs.debtToEquity / 100).toFixed(2)}x` : '—'} />
        <DataRow label="Current Ratio"  value={qs?.currentRatio ? qs.currentRatio.toFixed(2) : '—'} />
      </Section>

      <Section title="RETURNS & EFFICIENCY">
        <DataRow label="Return on Equity" value={fmtPc(qs?.roe)}           cls={colorClass(qs?.roe)} />
        <DataRow label="Return on Assets" value={fmtPc(qs?.roa)}           cls={colorClass(qs?.roa)} />
        <DataRow label="Earnings Growth"  value={fmtPcSign(qs?.earningsGrowth)} cls={colorClass(qs?.earningsGrowth)} />
        <DataRow label="Revenue / Share"  value={qs?.revenuePerShare ? fmt.aud(toQsAud(qs.revenuePerShare)) : '—'} />
      </Section>

      {(qs?.divYield > 0 || qs?.lastDividend > 0 || qv?.divYield > 0) && (
        <Section title="DIVIDENDS">
          <DataRow label="Div Yield"     value={fmtPc(pick('divYield'))} />
          <DataRow label="Annual Div"    value={qs?.lastDividend ? fmt.aud(toQsAud(qs.lastDividend)) : '—'} />
          <DataRow label="Payout Ratio"  value={fmtPc(qs?.payoutRatio)} />
          <DataRow label="Last Div Date" value={fmtDt(qs?.lastDividendDate)} />
        </Section>
      )}

      <Section title="TECHNICALS">
        <DataRow label="50-Day MA"      value={pick('ma50')   ? fmt.aud(toQsAud(pick('ma50')))  : '—'} />
        <DataRow label="200-Day MA"     value={pick('ma200')  ? fmt.aud(toQsAud(pick('ma200'))) : '—'} />
        <DataRow label="52W Change"     value={fmtPcSign(qs?.week52Change)} cls={colorClass(qs?.week52Change)} />
        <DataRow label="Beta"           value={pick('beta')   ? pick('beta').toFixed(2) : '—'} />
        <DataRow label="Shares Short"   value={qs?.sharesShort ? fmt.large(qs.sharesShort) : '—'} />
        <DataRow label="Short Ratio"    value={qs?.shortRatio  ? `${qs.shortRatio.toFixed(1)}d` : '—'} />
        <DataRow label="Short % Float"  value={fmtPc(qs?.shortPctFloat)} />
        <DataRow label="Avg Vol (10D)"  value={qs?.avgVolume10d ? fmt.large(qs.avgVolume10d) : '—'} />
      </Section>

      {qs?.recMean != null && (
        <Section title="ANALYST CONSENSUS" noCols>
          <AnalystBar recMean={qs.recMean} analystCount={qs.analystCount} />
          <div className="grid grid-cols-2 gap-x-6 mt-2 pt-2 border-t border-terminal-border/20">
            <DataRow label="Target High" value={fmtAmt(qs.targetHigh)} cls="text-terminal-green" />
            <DataRow label="Target Low"  value={fmtAmt(qs.targetLow)}  cls="text-terminal-red" />
            <DataRow label="Target Mean" value={fmtAmt(qs.targetMean)} />
            {qs.targetMean && displayPrice > 0 && (
              <DataRow
                label="Upside"
                value={`${(((toQsAud(qs.targetMean) ?? displayPrice) / displayPrice - 1) * 100).toFixed(1)}%`}
                cls={colorClass((toQsAud(qs.targetMean) ?? displayPrice) / displayPrice - 1)}
              />
            )}
          </div>
        </Section>
      )}

      {(qs?.sector || qs?.description) && (
        <Section title="COMPANY PROFILE" defaultOpen={false} noCols>
          <div className="grid grid-cols-2 gap-x-6 mb-2">
            <DataRow label="Sector"    value={qs.sector}    />
            <DataRow label="Industry"  value={qs.industry}  />
            <DataRow label="Employees" value={qs.employees ? qs.employees.toLocaleString('en-AU') : '—'} />
            <DataRow label="HQ"        value={[qs.city, qs.country].filter(Boolean).join(', ') || '—'} />
          </div>
          {qs.website && (
            <a
              href={qs.website} target="_blank" rel="noopener noreferrer"
              className="text-2xs text-terminal-gold/70 hover:text-terminal-gold block mb-2"
            >
              {qs.website.replace(/^https?:\/\//, '')} ↗
            </a>
          )}
          {qs.description && (
            <p className="text-2xs text-terminal-text-dim/70 leading-relaxed">
              {qs.description.length > 450 ? qs.description.slice(0, 450) + '…' : qs.description}
            </p>
          )}
        </Section>
      )}

      <Section title="RELATED NEWS" noCols>
        <AssetNewsPanel symbol={symbol} name={name} />
      </Section>

      <Section title="AI ANALYSIS" noCols>
        <AIFundamentalsPanel
          key={symbol}
          asset={modalAsset}
          displayPrice={displayPrice}
          display52High={display52High}
          display52Low={display52Low}
          qs={qs}
        />
      </Section>
    </>
  )

  // ─── Crypto sections ──────────────────────────────────────────────────────────
  const volToMcap = coinRaw?.total_volume && coinRaw?.market_cap ? (coinRaw.total_volume / coinRaw.market_cap) * 100 : null

  const cryptoSections = (
    <>
      <Section title="ABOUT" noCols>
        <p className="text-2xs text-terminal-text-dim/80 leading-relaxed">
          {coinDescription(symbol, name)}
        </p>
      </Section>

      <Section title="MARKET DATA">
        <DataRow label="Market Cap"       value={coinRaw?.market_cap    ? `A$${fmtBig(coinRaw.market_cap).replace('A$', '')}` : '—'} />
        <DataRow label="Fully Diluted"     value={coinRaw?.fully_diluted_valuation ? `A$${fmtBig(coinRaw.fully_diluted_valuation).replace('A$', '')}` : '—'} />
        <DataRow label="24H Volume"       value={coinRaw?.total_volume  ? `A$${fmtBig(coinRaw.total_volume).replace('A$', '')}` : '—'} />
        <DataRow label="Vol / Mkt Cap"     value={volToMcap != null ? `${volToMcap.toFixed(2)}%` : '—'} />
        <DataRow label="Circulating Supply" value={coinRaw?.circulating_supply ? fmt.large(coinRaw.circulating_supply) : '—'} />
        <DataRow label="Max Supply"        value={coinRaw?.max_supply    ? fmt.large(coinRaw.max_supply) : '—'} />
        <DataRow label="All-Time High"     value={coinRaw?.ath           ? fmt.aud(coinRaw.ath) : '—'} />
        <DataRow label="% from ATH"        value={coinRaw?.ath_change_percentage != null ? `${coinRaw.ath_change_percentage.toFixed(1)}%` : '—'}
          cls={colorClass(coinRaw?.ath_change_percentage)} />
        <DataRow label="All-Time Low"      value={coinRaw?.atl           ? fmt.aud(coinRaw.atl) : '—'} />
        <DataRow label="% from ATL"        value={coinRaw?.atl_change_percentage != null ? `+${coinRaw.atl_change_percentage.toFixed(1)}%` : '—'}
          cls="text-terminal-green" />
      </Section>

      <Section title="PRICE PERFORMANCE">
        <DataRow label="24H Change"  value={pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
          cls={colorClass(pct)} />
        <DataRow label="7D Change"   value={coinRaw?.price_change_percentage_7d_in_currency != null
          ? `${coinRaw.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${coinRaw.price_change_percentage_7d_in_currency.toFixed(2)}%`
          : '—'} cls={colorClass(coinRaw?.price_change_percentage_7d_in_currency)} />
        <DataRow label="30D Change"  value={coinRaw?.price_change_percentage_30d_in_currency != null
          ? `${coinRaw.price_change_percentage_30d_in_currency > 0 ? '+' : ''}${coinRaw.price_change_percentage_30d_in_currency.toFixed(2)}%`
          : '—'} cls={colorClass(coinRaw?.price_change_percentage_30d_in_currency)} />
        <DataRow label="Mkt Cap Rank" value={coinRaw?.market_cap_rank ? `#${coinRaw.market_cap_rank}` : '—'} />
      </Section>

      <Section title="LINKS" noCols>
        <div className="flex flex-wrap gap-2">
          {[
            ['CoinGecko', coinId ? `https://www.coingecko.com/en/coins/${coinId}` : null],
            ['Whitepaper', null],
            ['Website', null],
          ].map(([label, href]) => (
            href
              ? <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className="text-2xs border border-terminal-border px-2 py-1 text-terminal-gold/70 hover:text-terminal-gold hover:border-terminal-gold/50 transition-colors">
                  {label} ↗
                </a>
              : <span key={label} className="text-2xs border border-terminal-border/40 px-2 py-1 text-terminal-text-dim/40 cursor-default">
                  {label}
                </span>
          ))}
        </div>
      </Section>

      <Section title="RELATED NEWS" noCols>
        <AssetNewsPanel symbol={symbol} name={name} />
      </Section>

      <Section title="AI ANALYSIS" noCols>
        <AIFundamentalsPanel
          key={symbol}
          asset={modalAsset}
          displayPrice={displayPrice}
          display52High={display52High}
          display52Low={display52Low}
          qs={null}
        />
      </Section>
    </>
  )

  // ─── FX / Index / other simplified sections ───────────────────────────────────
  const otherSections = (
    <>
      <Section title="PRICE DATA">
        <DataRow label="Current"      value={fmt.aud(displayPrice, { clarify: true })} />
        <DataRow label="Day Change"   value={pct != null ? `${pctSign}${pct.toFixed(2)}%` : '—'} cls={priceCls} />
        <DataRow label="Period High"  value={allHigh && allHigh > 0 ? fmt.aud(allHigh) : display52High ? fmt.aud(display52High) : '—'} cls="text-terminal-green" />
        <DataRow label="Period Low"   value={allLow && allLow !== Infinity ? fmt.aud(allLow) : display52Low ? fmt.aud(display52Low) : '—'} cls="text-terminal-red" />
      </Section>
      <Section title="RELATED NEWS" noCols>
        <AssetNewsPanel symbol={symbol} name={name} />
      </Section>
      <Section title="AI ANALYSIS" noCols>
        <AIFundamentalsPanel
          key={symbol}
          asset={modalAsset}
          displayPrice={displayPrice}
          display52High={display52High}
          display52Low={display52Low}
          qs={null}
        />
      </Section>
    </>
  )

  return (
    <div
      ref={overlayRef}
      className="modal-overlay fixed inset-0 z-50 flex items-stretch justify-end bg-black/70 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="panel-slide-in bg-terminal-panel border-l border-terminal-border flex flex-col overflow-hidden h-full"
        style={{ width: '100%', maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-2 px-4 py-3 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          {type === 'crypto' && <CoinCircle symbol={symbol} />}
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-terminal-text-bright leading-tight truncate">
              {name ?? symbol}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-2xs border border-terminal-gold/50 text-terminal-gold px-1.5 py-0.5 font-bold tracking-widest">
                {symbol}
              </span>
              {type === 'crypto' ? (
                <>
                  <span className={`text-2xs border px-1.5 py-0.5 font-bold tracking-widest uppercase ${typeBadgeColor}`}>
                    Cryptocurrency
                  </span>
                  {coinRaw?.market_cap_rank && (
                    <span className="text-2xs border border-terminal-border text-terminal-text-dim px-1.5 py-0.5">
                      Rank #{coinRaw.market_cap_rank}
                    </span>
                  )}
                </>
              ) : (
                <span className={`text-2xs border px-1.5 py-0.5 font-bold tracking-widest uppercase ${typeBadgeColor}`}>
                  {extra.exchange ?? type?.toUpperCase() ?? 'ASSET'}
                </span>
              )}
              {qs?.sector && (
                <span className="text-2xs border border-terminal-border text-terminal-text-dim px-1.5 py-0.5">
                  {qs.sector}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {(isChartLoading || qsLoading) && (
              <span className="text-2xs text-terminal-gold animate-pulse">LOADING...</span>
            )}
            {isStockOrIdx && (
              <button
                onClick={() => openCompare({ symbol, type })}
                title="Open full side-by-side comparison"
                className="text-2xs font-bold text-terminal-text-dim hover:text-terminal-gold border border-terminal-border hover:border-terminal-gold px-2 py-1 transition-colors"
              >COMPARE VIEW</button>
            )}
            <button
              onClick={() => setAlertOpen(o => !o)}
              title="Set price alert"
              className={`text-lg leading-none transition-colors ${alertOpen ? 'text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
            >🔔</button>
            <button onClick={closeModal} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Price-alert inline form */}
        {alertOpen && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-terminal-border bg-terminal-surface2 flex-shrink-0 flex-wrap">
            <span className="text-2xs text-terminal-text-dim">Alert when price is</span>
            <div className="flex gap-1">
              {['above', 'below'].map(d => (
                <button
                  key={d}
                  onClick={() => setAlertDir(d)}
                  className={`px-2 py-0.5 text-2xs rounded-full border transition-colors ${
                    alertDir === d ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold'
                  }`}
                >{d.toUpperCase()}</button>
              ))}
            </div>
            <input
              type="number"
              value={alertPrice}
              onChange={e => { setAlertPrice(e.target.value); setAlertSaved(false) }}
              placeholder={fmt.price(displayPrice)}
              className="cmd-input text-2xs border border-terminal-border px-2 py-0.5"
              style={{ width: 90 }}
            />
            <button
              onClick={() => {
                if (!alertPrice || isNaN(parseFloat(alertPrice))) return
                addAlert(symbol, alertPrice, alertDir)
                setAlertSaved(true)
              }}
              className="text-2xs font-bold px-2.5 py-0.5 bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors"
            >SET ALERT</button>
            {alertSaved && <span className="text-2xs text-terminal-green">✓ Alert saved</span>}
          </div>
        )}

        {/* Price row */}
        <div className="flex items-start gap-4 px-4 py-3 border-b border-terminal-border flex-shrink-0 flex-wrap">
          <div className="flex flex-col leading-tight">
            <span className="text-4xl font-bold text-terminal-text-bright tracking-tight">
              {fmt.aud(displayPrice, { clarify: true })}
            </span>
            {showUsdSub && (
              <span className="text-xs text-terminal-text-dim/60 mt-1">
                US${fmt.price(extra.nativePrice)} native
              </span>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {displayChange != null && (
                <span className={`text-sm font-semibold ${priceCls}`}>
                  {displayChange > 0 ? '+' : ''}{fmt.aud(displayChange, { clarify: true })}
                </span>
              )}
              {pct != null && (
                <span className={`text-base font-bold ${priceCls}`}>
                  {pct > 0 ? '▲' : pct < 0 ? '▼' : ''} {pctSign}{pct.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            {type === 'crypto' ? (
              <div className="flex items-center gap-1.5 border border-terminal-green text-terminal-green px-2 py-0.5 text-2xs">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                <span className="font-bold">24/7</span>
              </div>
            ) : (
              <MarketStatusBadge extra={extra} />
            )}
            {upcomingEarnings && (
              <div
                title={`${upcomingEarnings.type} results — estimates only`}
                className="flex items-center gap-1.5 border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 text-2xs whitespace-nowrap"
              >
                <span>📅</span>
                <span className="font-bold">
                  Earnings: {new Date(`${upcomingEarnings.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-terminal-text-dim">({daysUntil(upcomingEarnings.date)}d)</span>
              </div>
            )}
            {display52High != null && (
              <div className="w-48">
                <div className="text-2xs text-terminal-text-dim/50 mb-0.5">52W RANGE</div>
                <RangeBar price={displayPrice} low={display52Low} high={display52High} />
              </div>
            )}
          </div>
        </div>

        {/* Chart controls */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-terminal-border flex-shrink-0 flex-wrap">
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-0.5 rounded-full text-2xs transition-colors ${
                  timeframe === tf
                    ? 'bg-terminal-gold text-terminal-bg font-bold'
                    : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                }`}
              >{tf}</button>
            ))}
          </div>
          <span className="text-terminal-border ml-2">|</span>
          <div className="flex gap-1">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct}
                onClick={() => setChartType(ct)}
                className={`px-2.5 py-0.5 rounded-full text-2xs transition-colors ${
                  chartType === ct
                    ? 'bg-terminal-accent text-terminal-text-bright border border-terminal-gold'
                    : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                }`}
              >{ct.toUpperCase()}</button>
            ))}
          </div>
          {isStockOrIdx && (
            <>
              <span className="text-terminal-border ml-2">|</span>
              <button
                onClick={() => setCompareOpen(o => !o)}
                className={`px-2.5 py-0.5 rounded-full text-2xs font-bold transition-colors ${
                  compareOpen ? 'bg-terminal-blue-bright text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                }`}
              >COMPARE</button>
              {compareOpen && (
                <div className="flex items-center gap-1">
                  <input
                    value={compareInput}
                    onChange={e => setCompareInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && compareInput.trim()) setCompareSymbol(compareInput.trim().toUpperCase()) }}
                    placeholder="e.g. CBA.AX"
                    className="cmd-input text-2xs border border-terminal-border px-2 py-0.5"
                    style={{ width: 90 }}
                  />
                  <button
                    onClick={() => compareInput.trim() && setCompareSymbol(compareInput.trim().toUpperCase())}
                    className="text-2xs px-2 py-0.5 border border-terminal-blue text-terminal-blue-bright hover:bg-terminal-blue-bright hover:text-terminal-bg transition-colors"
                  >ADD</button>
                  {compareLoading && <span className="text-2xs text-terminal-text-dim animate-pulse">...</span>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Chart — the "pro" TradingChart needs room for its toolbar +
            indicator rows on top of the canvas, so it gets a taller slot
            than the other (compact) chart types. */}
        <div className={`flex-shrink-0 overflow-hidden ${chartType === 'pro' ? '' : 'px-4 py-2'}`} style={{ height: chartType === 'pro' ? '560px' : '200px' }}>
          {isChartLoading ? (
            <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">LOADING CHART...</div>
          ) : chartData.length === 0 ? (
            <DataUnavailable
              label={type === 'fx' || type === 'commodity' ? 'CHART UNAVAILABLE FOR THIS ASSET TYPE' : 'CHART DATA UNAVAILABLE'}
              className="h-full"
            />
          ) : chartData.length < 10 ? (
            <DataUnavailable label={`INSUFFICIENT DATA (${chartData.length} pts)`} className="h-full" />
          ) : compareOpen && compareData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid stroke="#0d2244" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} width={40} tickFormatter={(v) => v.toFixed(0)} />
                <Tooltip
                  contentStyle={{ background: '#0B1628', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '2px', fontFamily: 'IBM Plex Mono', fontSize: '10px' }}
                  formatter={(v, name) => [`${v.toFixed(1)}`, name === 'a' ? symbol : compareSymbol]}
                />
                <Legend wrapperStyle={{ fontSize: 9 }} formatter={(name) => name === 'a' ? symbol : compareSymbol} />
                <Line type="monotone" dataKey="a" stroke="#c8a84b" strokeWidth={1.5} dot={false} isAnimationActive={false} name="a" />
                <Line type="monotone" dataKey="b" stroke="#4a90d9" strokeWidth={1.5} dot={false} isAnimationActive={false} name="b" />
                <Brush dataKey="date" height={20} stroke="rgba(201,168,76,0.3)" fill="#0B1628" />
              </LineChart>
            </ResponsiveContainer>
          ) : chartType === 'candle' ? (
            <CandleChart data={chartData} />
          ) : chartType === 'pro' ? (
            proChartData.length >= 2 ? (
              <TradingChart
                symbol={symbol}
                name={name}
                basePrice={latest.close ?? price ?? 100}
                currency="AUD"
                data={proChartData}
                height={260}
              />
            ) : (
              <DataUnavailable label="NOT ENOUGH OHLC DATA FOR PRO CHART" className="h-full" />
            )
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="modalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#c8a84b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c8a84b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#0d2244" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={yFmt} domain={['auto', 'auto']} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="price" stroke="#c8a84b" strokeWidth={1.5} fill="url(#modalAreaGrad)" dot={false} isAnimationActive={false} />
                  <Brush dataKey="date" height={20} stroke="rgba(201,168,76,0.3)" fill="#0B1628" />
                </AreaChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#0d2244" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={yFmt} domain={['auto', 'auto']} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="price" stroke="#4a90d9" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Brush dataKey="date" height={20} stroke="rgba(201,168,76,0.3)" fill="#0B1628" />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* Scrollable data sections */}
        <div key={symbol} className="flex-1 overflow-y-auto px-3 py-0.5 min-h-0">
          {isEquity      && equitySections}
          {type === 'crypto' && cryptoSections}
          {!isEquity && type !== 'crypto' && otherSections}
          <div className="h-2" />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-4 py-2.5 border-t border-terminal-border bg-terminal-bg flex-shrink-0">
          <button
            onClick={handleAskAI}
            className="w-full text-xs font-bold tracking-widest px-3 py-2 bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors cursor-pointer"
          >
            ANALYSE WITH MADDENAI ▶
          </button>
          {(isStockOrIdx || isCryptoModal) && (
            <button
              onClick={() => setResearchNoteOpen(true)}
              className="w-full text-xs font-bold tracking-widest px-3 py-2 border border-terminal-gold/50 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors cursor-pointer"
            >
              📄 GENERATE RESEARCH NOTE
            </button>
          )}
          {(isStockOrIdx || isCryptoModal) && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('madden:open-correlation', { detail: { assets: [symbol.replace(/\.AX$/i, '')] } }))}
              className="w-full text-xs font-bold tracking-widest px-3 py-2 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors cursor-pointer"
            >
              🔗 VIEW CORRELATIONS
            </button>
          )}
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => !isInWL && addToWatchlist(symbol)}
              disabled={isInWL}
              className={`flex-1 text-2xs px-2 py-1.5 border transition-colors ${
                isInWL
                  ? 'border-terminal-green text-terminal-green opacity-70 cursor-default'
                  : 'border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg cursor-pointer'
              }`}
            >
              {isInWL ? '✓ WATCHING' : '+ WATCHLIST'}
            </button>
            <button
              onClick={() => { setActiveModule('portfolio'); closeModal() }}
              className="flex-1 text-2xs px-2 py-1.5 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors"
            >+ PORTFOLIO</button>
            <button
              onClick={() => setNoteOpen(o => !o)}
              className={`flex-1 text-2xs px-2 py-1.5 border transition-colors ${
                noteOpen ? 'border-terminal-gold text-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
              }`}
            >MY NOTES</button>
          </div>

          {noteOpen && (
            <div className="flex flex-col gap-1">
              <textarea
                value={noteText}
                onChange={e => { setNoteText(e.target.value); setNoteSaved(false) }}
                placeholder={`Notes on ${symbol}...`}
                className="cmd-input text-2xs border border-terminal-border px-2 py-1.5 resize-none"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    try {
                      const all = JSON.parse(localStorage.getItem('madden_research_notes') ?? '{}')
                      all[symbol] = noteText
                      localStorage.setItem('madden_research_notes', JSON.stringify(all))
                      setNoteSaved(true)
                    } catch {
                      // Persistence is best-effort — note stays in the textarea either way
                    }
                  }}
                  className="text-2xs font-bold px-2.5 py-0.5 bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors"
                >SAVE NOTE</button>
                {noteSaved && <span className="text-2xs text-terminal-green">✓ Saved</span>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-2xs text-terminal-text-dim/40">Updated {updatedTime} AEST</span>
              {isLiveChart && <span className="text-2xs text-terminal-green">● LIVE</span>}
            </div>
          </div>
        </div>
      </div>
      {researchNoteOpen && (
        <ResearchNoteGenerator
          asset={{ symbol, name: name ?? symbol, type }}
          onClose={() => setResearchNoteOpen(false)}
        />
      )}
    </div>
  )
}
