import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { fetchCoinOHLC, fetchCoinHistory, fetchYFHistory, transformYFHistory, transformCoinOHLC, transformCoinHistory, toYFRange, fetchNews, askClaude } from '../../services/api'
import { DataUnavailable } from './DataUnavailable'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt, colorClass } from '../../utils/format'
import { toYahooSymbol, timeframeToDays, COIN_IDS_MAP } from '../../utils/assetUtils'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const TIMEFRAMES  = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y']
const CHART_TYPES = ['area', 'line', 'candle']

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

  const height    = 240
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

// ─── Type-specific extra stats ────────────────────────────────────────────────

function TypeStats({ asset }) {
  const { type, extra = {} } = asset
  const rows = []
  if (type === 'asx') {
    rows.push(
      { label: 'DIV YIELD', value: extra.divYield != null ? `${extra.divYield}%` : '—' },
      { label: 'FRANKING',  value: extra.franking  != null ? `${extra.franking}%` : '—' },
      { label: 'SECTOR',    value: extra.sector    ?? '—' },
      { label: 'INDEX',     value: extra.index     ?? 'ASX 200' },
    )
  } else if (type === 'crypto') {
    rows.push(
      { label: 'SUPPLY',    value: extra.supply     ?? '—' },
      { label: 'DOMINANCE', value: extra.dominance  != null ? `${extra.dominance}%` : '—' },
      { label: 'ATH (AUD)', value: extra.ath        ? fmt.aud(extra.ath)        : '—' },
      { label: 'ATL (AUD)', value: extra.atl        ? fmt.aud(extra.atl)        : '—' },
    )
  } else if (type === 'fx') {
    rows.push(
      { label: 'IR DIFF',   value: extra.irDiff     ?? '—' },
      { label: 'CARRY YLD', value: extra.carryYield ?? '—' },
      { label: 'BIAS',      value: extra.bias       ?? '—' },
    )
  } else if (type === 'index') {
    rows.push(
      { label: 'P/E RATIO', value: extra.pe    != null ? extra.pe.toString() : '—' },
      { label: 'DIV YIELD', value: extra.yield != null ? `${extra.yield}%`   : '—' },
      { label: 'YTD',       value: extra.ytd   != null ? fmt.pct(extra.ytd)  : '—' },
    )
  } else {
    rows.push(
      { label: 'P/E RATIO', value: extra.pe     != null ? extra.pe.toString()    : '—' },
      { label: 'MKT CAP',   value: extra.mktCap ?? '—' },
      { label: 'SECTOR',    value: extra.sector ?? '—' },
    )
  }
  return (
    <div className="border-l border-terminal-border pl-3 space-y-1.5">
      <div className="text-2xs text-terminal-gold font-bold uppercase tracking-widest mb-1">
        {type === 'asx' ? 'ASX INFO' : type === 'crypto' ? 'CHAIN INFO' : type === 'fx' ? 'FX INFO' : 'INFO'}
      </div>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="text-2xs text-terminal-text-dim">{r.label}</div>
          <div className="text-xs font-semibold text-terminal-text-bright">{r.value}</div>
        </div>
      ))}
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

// ─── AI Analysis panel ────────────────────────────────────────────────────────

function AIAnalysisPanel({ asset }) {
  const [text, setText] = useState(null)
  const [loading, setLoading] = useState(false)
  const [triggered, setTriggered] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    setText('')
    const { symbol, name, price, pct, extra = {} } = asset
    const rangeStr = extra.week52High != null
      ? ` 52W range: ${fmt.aud(extra.week52Low)} – ${fmt.aud(extra.week52High)}.` : ''
    const prompt = `You are MADDEN AI, an elite Australian financial analyst. Provide a concise professional analysis of ${name} (${symbol}). Current price: ${fmt.aud(price)}. Day change: ${pct != null ? pct.toFixed(2) : '—'}%.${rangeStr} Include: current price action assessment, key support/resistance levels, relevant macro factors from an Australian investor perspective, and short-term outlook. Keep to 150 words maximum.`
    try {
      await askClaude([{ role:'user', content: prompt }], (_, full) => setText(full))
    } catch (e) {
      setText(`[ERROR] ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [asset])

  // Auto-trigger once per asset open
  useEffect(() => {
    if (!triggered) { setTriggered(true); generate() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="border-t border-terminal-border flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-terminal-border bg-terminal-header">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">▲ MADDEN AI ANALYSIS</span>
        <button
          onClick={generate}
          disabled={loading}
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors disabled:opacity-40"
        >
          {loading ? 'GENERATING...' : '↻ REFRESH'}
        </button>
      </div>
      <div className="px-4 py-2 min-h-[60px] max-h-[100px] overflow-auto">
        {text === null && !loading && (
          <div className="text-2xs text-terminal-text-dim/50 italic">Generating analysis...</div>
        )}
        {loading && text === '' && (
          <div className="text-2xs text-terminal-gold animate-pulse">ANALYSING {asset.symbol}...</div>
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

// ─── News panel ───────────────────────────────────────────────────────────────

function AssetNewsPanel({ symbol, name }) {
  const { data: news } = useQuery({
    queryKey:  ['news'],
    queryFn:   fetchNews,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const keywords = [symbol.replace(/\.AX$/,'').replace(/^\^/,''), ...(name ? name.split(' ').slice(0,2) : [])]
  const matching = (news ?? []).filter((n) =>
    keywords.some((kw) => kw.length > 2 && n.headline.toLowerCase().includes(kw.toLowerCase()))
  ).slice(0, 4)

  if (!matching.length) return null

  return (
    <div className="border-t border-terminal-border flex-shrink-0">
      <div className="px-4 py-1 border-b border-terminal-border bg-terminal-header text-2xs text-terminal-gold font-bold tracking-widest">
        RELATED NEWS
      </div>
      <div className="overflow-auto max-h-[120px]">
        {matching.map((n) => (
          <a
            key={n.id}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 px-4 py-1.5 border-b border-terminal-border/30 last:border-0 hover:bg-terminal-accent/20 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-2xs text-terminal-text group-hover:text-terminal-text-bright truncate">{n.headline}</div>
              <div className="text-2xs text-terminal-text-dim/60">{n.source} · {n.time}</div>
            </div>
            <span className="text-terminal-text-dim/30 text-2xs flex-shrink-0 group-hover:text-terminal-gold">↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function DetailModal() {
  const { modalAsset, closeModal, addToWatchlist, watchlist, setChatOpen, addChatMessage } = useStore()

  const [timeframe, setTimeframe] = useState('1M')
  const [chartType, setChartType] = useState('area')
  const { audUsd, usdToAud } = useAudRates()

  const overlayRef = useRef(null)

  useEffect(() => {
    if (modalAsset) { setTimeframe('1M'); setChartType('area') }
  }, [modalAsset?.symbol])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) closeModal()
  }, [closeModal])

  // ─ Crypto: market chart (line/area) + OHLC (candles)
  const coinId        = modalAsset?.coinId ?? COIN_IDS_MAP[modalAsset?.symbol?.toUpperCase()]
  const days          = timeframeToDays(timeframe)
  const isCryptoModal = !!modalAsset && modalAsset.type === 'crypto' && !!coinId

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

  // ─ Stock/index history via Yahoo Finance
  const isEquity = !!modalAsset && (modalAsset.type === 'asx' || modalAsset.type === 'us' || modalAsset.type === 'index')
  const yfSym    = modalAsset ? toYahooSymbol(modalAsset.symbol, modalAsset.type) : null
  const yfRange  = toYFRange(timeframe)

  const { data: stockHistory, isFetching: stockLoading } = useQuery({
    queryKey:  ['modalStockHistory', yfSym, timeframe],
    queryFn:   () => fetchYFHistory(yfSym, yfRange),
    enabled:   isEquity && !!yfSym,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  if (!modalAsset) return null

  const { symbol, name, price, pct, change, type, extra = {} } = modalAsset
  const priceCls    = colorClass(pct)
  const pctSign     = pct > 0 ? '+' : ''
  const isInWatchlist = watchlist.includes(symbol)

  // Build chart data
  let chartData   = []
  let isLiveChart = false

  if (type === 'crypto') {
    if (chartType === 'candle' && cryptoOHLC && Array.isArray(cryptoOHLC)) {
      chartData   = transformCoinOHLC(cryptoOHLC)
      isLiveChart = true
    } else if (chartType !== 'candle' && cryptoHistory?.prices) {
      chartData   = transformCoinHistory(cryptoHistory)
      isLiveChart = true
    }
  } else if (isEquity && stockHistory) {
    const raw = transformYFHistory(stockHistory)
    const isAud = type === 'asx'
    chartData = isAud
      ? raw
      : raw.map((d) => ({
          ...d,
          price: d.price != null ? usdToAud(d.price) : null,
          close: d.close != null ? usdToAud(d.close) : null,
          open:  d.open  != null ? usdToAud(d.open)  : null,
          high:  d.high  != null ? usdToAud(d.high)  : null,
          low:   d.low   != null ? usdToAud(d.low)   : null,
        }))
    isLiveChart = true
  }

  const slicedData = chartData
  const latest     = slicedData[slicedData.length - 1] ?? {}
  const allHigh    = slicedData.length ? Math.max(...slicedData.map((d) => d.high ?? d.price)) : null
  const allLow     = slicedData.length ? Math.min(...slicedData.map((d) => d.low  ?? d.price)) : null

  const isLoading   = cryptoHistLoading || cryptoOHLCLoading || stockLoading
  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const typeBadgeColor = {
    asx:       'text-terminal-gold border-terminal-gold',
    crypto:    'text-terminal-green border-terminal-green',
    fx:        'text-terminal-blue-bright border-terminal-blue',
    index:     'text-terminal-text border-terminal-border',
    us:        'text-terminal-blue-bright border-terminal-blue',
    commodity: 'text-terminal-gold border-terminal-gold/50',
  }[type] ?? 'text-terminal-text-dim border-terminal-border'

  const handleAskAI = () => {
    setChatOpen(true)
    addChatMessage({
      role: 'user',
      content: `Analyse ${symbol}: current price A$${fmt.price(price)}, ${pctSign}${pct?.toFixed(2)}% today. Provide concise professional analysis covering key drivers, technicals, risks, and outlook from an Australian investor perspective.`,
    })
    closeModal()
  }

  const handleAddWatchlist = () => { if (!isInWatchlist) addToWatchlist(symbol) }

  const yFmt = (v) => {
    if (v >= 100000) return `$${(v / 1000).toFixed(0)}K`
    if (v >= 1000)   return `$${(v / 1000).toFixed(1)}K`
    if (v >= 1)      return `$${v.toFixed(2)}`
    return `$${v.toFixed(4)}`
  }

  return (
    <div
      ref={overlayRef}
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="modal-panel bg-terminal-panel border border-terminal-border flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 1100, height: '88vh', maxHeight: 820 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className={`text-2xs border px-1.5 py-0.5 font-bold tracking-widest uppercase ${typeBadgeColor}`}>
            {type?.toUpperCase() ?? 'ASSET'}
          </span>
          <span className="text-base font-bold text-terminal-gold tracking-wider">{symbol}</span>
          {name && <span className="text-sm text-terminal-text-dim">{name}</span>}
          <div className="ml-auto flex items-center gap-3">
            {isLoading && <span className="text-2xs text-terminal-gold animate-pulse">LOADING...</span>}
            <button onClick={closeModal} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Price row */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-terminal-border flex-shrink-0 flex-wrap">
          <span className="text-2xl font-bold text-terminal-text-bright">{fmt.aud(price)}</span>
          {change != null && (
            <span className={`text-sm font-semibold ${priceCls}`}>{change > 0 ? '+' : ''}{fmt.price(change)}</span>
          )}
          {pct != null && (
            <span className={`text-lg font-bold ${priceCls}`}>{pct > 0 ? '▲' : pct < 0 ? '▼' : ''} {pctSign}{pct?.toFixed(2)}%</span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <MarketStatusBadge extra={extra} />
            {extra.week52High != null && (
              <div className="w-48">
                <div className="text-2xs text-terminal-text-dim/50 mb-0.5">52W RANGE</div>
                <RangeBar price={price} low={extra.week52Low} high={extra.week52High} />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-terminal-border flex-shrink-0">
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 text-2xs transition-colors ${
                  timeframe === tf
                    ? 'bg-terminal-gold text-terminal-bg font-bold'
                    : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <span className="text-terminal-border ml-2">|</span>
          <div className="flex gap-1">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct}
                onClick={() => setChartType(ct)}
                className={`px-2 py-0.5 text-2xs transition-colors ${
                  chartType === ct
                    ? 'bg-terminal-accent text-terminal-text-bright border border-terminal-gold'
                    : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                }`}
              >
                {ct.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="flex-shrink-0 px-4 py-2 overflow-hidden" style={{ height: '220px', width: '100%' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">LOADING CHART...</div>
          ) : slicedData.length === 0 ? (
            <DataUnavailable
              label={type === 'fx' || type === 'commodity' ? 'CHART UNAVAILABLE FOR THIS ASSET TYPE' : 'CHART DATA UNAVAILABLE'}
              className="h-full"
            />
          ) : slicedData.length < 10 ? (
            <DataUnavailable
              label={`INSUFFICIENT DATA (${slicedData.length} point${slicedData.length !== 1 ? 's' : ''})`}
              className="h-full"
            />
          ) : chartType === 'candle' ? (
            <CandleChart data={slicedData} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={slicedData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
                </AreaChart>
              ) : (
                <LineChart data={slicedData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#0d2244" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={yFmt} domain={['auto', 'auto']} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="price" stroke="#4a90d9" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats */}
        <div className="border-t border-terminal-border flex-shrink-0">
          <div className="grid grid-cols-[1fr_auto] gap-0">
            <div className="p-3 grid grid-cols-3 xl:grid-cols-6 gap-x-4 gap-y-1.5">
              {[
                { label: 'OPEN',        value: latest.open  ? fmt.aud(latest.open)  : extra.open  ? fmt.aud(extra.open)  : '—' },
                { label: 'HIGH',        value: latest.high  ? fmt.aud(latest.high)  : extra.high  ? fmt.aud(extra.high)  : '—', cls: 'text-terminal-green' },
                { label: 'LOW',         value: latest.low   ? fmt.aud(latest.low)   : extra.low   ? fmt.aud(extra.low)   : '—', cls: 'text-terminal-red' },
                { label: 'CLOSE',       value: latest.close ? fmt.aud(latest.close) : '—' },
                { label: 'PERIOD HIGH', value: allHigh      ? fmt.aud(allHigh)      : extra.week52High ? fmt.aud(extra.week52High) : '—', cls: 'text-terminal-green' },
                { label: 'PERIOD LOW',  value: allLow       ? fmt.aud(allLow)       : extra.week52Low  ? fmt.aud(extra.week52Low)  : '—', cls: 'text-terminal-red' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xs text-terminal-text-dim">{s.label}</div>
                  <div className={`text-xs font-semibold ${s.cls || 'text-terminal-text-bright'}`}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="p-3 min-w-[160px] border-l border-terminal-border">
              <TypeStats asset={modalAsset} />
            </div>
          </div>
        </div>

        {/* Related news */}
        <AssetNewsPanel symbol={symbol} name={name} />

        {/* AI analysis */}
        <AIAnalysisPanel key={symbol} asset={modalAsset} />

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-terminal-border bg-terminal-bg flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddWatchlist}
              disabled={isInWatchlist}
              className={`text-2xs px-3 py-1.5 border transition-colors ${
                isInWatchlist
                  ? 'border-terminal-green text-terminal-green opacity-70 cursor-default'
                  : 'border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg cursor-pointer'
              }`}
            >
              {isInWatchlist ? '✓ WATCHING' : '+ ADD TO WATCHLIST'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-terminal-text-dim/40">Updated {updatedTime} AEST</span>
            {isLiveChart && <span className="text-2xs text-terminal-green">● LIVE</span>}
            <button
              onClick={handleAskAI}
              className="text-2xs px-3 py-1.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors cursor-pointer"
            >
              ▲ ASK AI
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
