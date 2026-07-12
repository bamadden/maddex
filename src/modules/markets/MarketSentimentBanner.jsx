import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
  Customized, LineChart, Line, XAxis, YAxis, ReferenceLine,
} from 'recharts'
import {
  fetchYFBatch, YF_INDICES, fetchCryptoMarkets, fetchFearGreed, transformFearGreed,
  ASX_STOCKS, fetchBatch,
} from '../../services/api'
import { useStore } from '../../store/useStore'
import {
  calculateMarketSentimentScore, generateShortSummary, scoreToColor,
} from '../../services/maddenAiScoring'

const ALL_INDEX_SYMBOLS  = YF_INDICES.map((i) => i.symbol)
const PREV_SCORE_KEY     = 'maddex_sentiment_prev'
const HISTORY_KEY        = 'maddex_sentiment_history'
const MAX_HISTORY        = 365

const SHORT_NAMES = {
  'Crypto Fear & Greed':   'F&G Index',
  'ASX Market Breadth':    'ASX Breadth',
  'ASX Price Momentum':    'ASX Momentum',
  'S&P 500 Momentum':      'S&P 500',
  'BTC Risk Appetite':     'BTC',
  'Crypto Market Breadth': 'Crypto Breadth',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function factorBarColor(score) {
  if (score >= 65) return 'var(--color-gain)'
  if (score >= 45) return 'var(--color-neutral)'
  return 'var(--color-loss)'
}

function radarStroke(score) {
  if (score >= 67) return 'var(--color-gain, #2d8a50)'
  if (score >= 34) return 'var(--color-neutral, #c9a84c)'
  return 'var(--color-loss, #a83232)'
}

function radarFill(score) {
  if (score >= 67) return 'rgba(45,138,80,0.2)'
  if (score >= 34) return 'rgba(201,168,76,0.15)'
  return 'rgba(168,50,50,0.2)'
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writeHistory(score, label) {
  try {
    const hist = readHistory()
    hist.push({ timestamp: Date.now(), score, label })
    if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
  } catch { /* ignore */ }
}

function filterHistory(hist, tab) {
  const now = Date.now()
  const windows = { '1D': 86_400_000, '1W': 7 * 86_400_000, '1M': 30 * 86_400_000, '1Y': 365 * 86_400_000 }
  const cutoff = now - (windows[tab] ?? windows['1W'])
  return hist.filter((h) => h.timestamp >= cutoff)
}

function fmtTimestamp(ts, tab) {
  const d = new Date(ts)
  if (tab === '1D') return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  if (tab === '1W') return d.toLocaleDateString('en-AU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  if (tab === '1M') return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
}

function histStats(hist) {
  if (!hist.length) return null
  const scores = hist.map((h) => h.score)
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null
  const now  = Date.now()
  const last7d  = hist.filter((h) => h.timestamp >= now - 7  * 86_400_000).map((h) => h.score)
  const last30d = hist.filter((h) => h.timestamp >= now - 30 * 86_400_000).map((h) => h.score)
  const maxEntry = hist.reduce((a, b) => b.score > a.score ? b : a, hist[0])
  const minEntry = hist.reduce((a, b) => b.score < a.score ? b : a, hist[0])
  return {
    avg7d:  avg(last7d),
    avg30d: avg(last30d),
    ath:    { score: maxEntry.score, date: new Date(maxEntry.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' }) },
    atl:    { score: minEntry.score, date: new Date(minEntry.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' }) },
  }
}

function getFactorDescription(name, score, { asxChanges, fearGreed }) {
  const gainers = asxChanges?.filter((c) => (c ?? 0) > 0).length ?? 0
  const total   = asxChanges?.length ?? 0
  const fgLbl   = fearGreed?.label ?? null
  switch (name) {
    case 'Crypto Fear & Greed':   return fgLbl ? `${fgLbl} — crypto ${score < 40 ? 'risk-off' : score > 60 ? 'risk-on' : 'cautious'}` : null
    case 'ASX Market Breadth':    return total > 0 ? `${gainers} of ${total} tracked stocks advancing` : null
    case 'ASX Price Momentum':    return score > 55 ? 'ASX avg gain positive' : score < 45 ? 'ASX avg loss negative' : 'ASX broadly flat'
    case 'S&P 500 Momentum':      return score > 55 ? 'S&P 500 positive' : score < 45 ? 'S&P 500 under pressure' : 'S&P 500 flat'
    case 'BTC Risk Appetite':     return score > 60 ? 'Bitcoin advancing — risk-on' : score < 40 ? 'Bitcoin declining — risk-off' : 'BTC range-bound'
    case 'Crypto Market Breadth': return score > 60 ? 'Most top cryptos positive' : score < 40 ? 'Most top cryptos negative' : 'Mixed crypto breadth'
    default: return null
  }
}

// ─── Score gradient bar (banner) ─────────────────────────────────────────────
function ScoreGradientBar({ score }) {
  return (
    <div style={{ position: 'relative', width: 120, flexShrink: 0 }}>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: 'linear-gradient(to right, #a83232, #c9a84c, #2d8a50)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          left: `${Math.max(1, Math.min(99, score))}%`,
          transform: 'translateX(-50%)',
          top: -3,
          width: 2,
          height: 12,
          background: '#C9A84C',
          borderRadius: 1,
        }} />
      </div>
    </div>
  )
}

// ─── Radar background zones ───────────────────────────────────────────────────
function RadarZones({ cx, cy, outerRadius }) {
  if (!cx || !cy || !outerRadius) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={outerRadius}         fill="rgba(45,138,80,0.06)" />
      <circle cx={cx} cy={cy} r={outerRadius * 0.66}  fill="rgba(201,168,76,0.08)" />
      <circle cx={cx} cy={cy} r={outerRadius * 0.33}  fill="rgba(168,50,50,0.10)" />
      <circle cx={cx} cy={cy} r={outerRadius * 0.66}  fill="none" stroke="rgba(201,168,76,0.25)" strokeDasharray="3 3" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={outerRadius * 0.33}  fill="none" stroke="rgba(168,50,50,0.25)"  strokeDasharray="3 3" strokeWidth={1} />
    </g>
  )
}

// ─── Trend section ────────────────────────────────────────────────────────────
const TREND_TABS = ['1D', '1W', '1M', '1Y']

function TrendSection({ currentScore }) {
  const [tab, setTab]     = useState('1W')
  const [hist, setHist]   = useState(() => readHistory())

  useEffect(() => { setHist(readHistory()) }, [tab])

  const filtered  = filterHistory(hist, tab)
  const stats     = histStats(hist)
  const prev      = (() => { try { return JSON.parse(localStorage.getItem(PREV_SCORE_KEY)) } catch { return null } })()

  const chartData = filtered.map((h) => ({
    t:     h.timestamp,
    score: h.score,
    label: h.timestamp,
  }))

  const lineColor = currentScore >= 67 ? '#2d8a50' : currentScore >= 34 ? '#c9a84c' : '#a83232'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-dim, #8899aa)', letterSpacing: '0.08em', marginRight: 8 }}>TREND</span>
        {TREND_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 9, padding: '2px 7px', cursor: 'pointer', border: 'none',
              background: t === tab ? 'rgba(201,168,76,0.15)' : 'transparent',
              color: t === tab ? '#C9A84C' : 'var(--color-text-dim, #8899aa)',
              fontFamily: 'IBM Plex Mono, monospace', fontWeight: t === tab ? 700 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length < 2 ? (
        <div style={{ fontSize: 9, color: 'var(--color-text-dim, #8899aa)', fontStyle: 'italic', padding: '12px 0' }}>
          BUILDING HISTORY — scores recorded each session
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={90}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => fmtTimestamp(v, tab)}
              tick={{ fontSize: 8, fill: 'var(--color-text-dim, #8899aa)', fontFamily: 'IBM Plex Mono, monospace' }}
              tickCount={5}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 8, fill: 'var(--color-text-dim, #8899aa)', fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              ticks={[0, 33, 66, 100]}
            />
            <ReferenceLine y={33} stroke="rgba(168,50,50,0.3)"  strokeDasharray="3 3" />
            <ReferenceLine y={66} stroke="rgba(201,168,76,0.3)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ background: '#0a0e1a', border: '1px solid #C9A84C', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace' }}
              labelFormatter={(v) => fmtTimestamp(v, tab)}
              formatter={(v) => [`${v}/100`, 'Score']}
            />
            <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 9, color: 'var(--color-text-dim, #8899aa)' }}>
        <span>Current: <b style={{ color: lineColor }}>{currentScore}/100</b></span>
        {prev && (
          <span>
            Prev session: <b style={{ color: '#C9A84C' }}>{prev.score}/100</b>
            {' '}
            <span style={{ color: currentScore >= prev.score ? '#2d8a50' : '#a83232' }}>
              {currentScore >= prev.score ? '▲' : '▼'} {currentScore >= prev.score ? '+' : ''}{currentScore - prev.score}pts
            </span>
          </span>
        )}
        {stats?.avg7d  != null && <span>7D avg: <b style={{ color: '#C9A84C' }}>{stats.avg7d}/100</b></span>}
        {stats?.avg30d != null && <span>30D avg: <b style={{ color: '#C9A84C' }}>{stats.avg30d}/100</b></span>}
        {stats?.ath    && <span>ATH: <b style={{ color: '#2d8a50' }}>{stats.ath.score}/100</b> ({stats.ath.date})</span>}
        {stats?.atl    && <span>ATL: <b style={{ color: '#a83232' }}>{stats.atl.score}/100</b> ({stats.atl.date})</span>}
      </div>
    </div>
  )
}

// ─── Sentiment Modal ──────────────────────────────────────────────────────────
function SentimentModal({ sentiment, asxChanges, fearGreed, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleOverlay = useCallback((e) => {
    if (e.target === overlayRef.current) onClose()
  }, [onClose])

  const radarData  = sentiment.factors.map((f) => ({
    factor:   SHORT_NAMES[f.name] ?? f.name,
    score:    f.score,
    fullMark: 100,
  }))

  const rStroke = radarStroke(sentiment.score)
  const rFill   = radarFill(sentiment.score)

  return (
    <div
      ref={overlayRef}
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleOverlay}
    >
      <div
        className="modal-panel bg-terminal-panel border border-terminal-border"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw', maxWidth: 880,
          height: '85vh', maxHeight: '85vh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-2xs border border-terminal-gold/40 px-1.5 py-0.5 font-bold tracking-widest text-terminal-gold">SENTIMENT</span>
          <span className="text-sm font-bold text-terminal-gold tracking-wider">MADDENAI MARKET SENTIMENT</span>
          <span className="text-terminal-text-dim/40">◆</span>
          <span className="text-sm font-bold" style={{ color: scoreToColor(sentiment.score) }}>
            {sentiment.score}/100 {sentiment.label.toUpperCase()}
          </span>
          <div className="ml-auto">
            <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
          </div>
        </div>

        {/* ── Main content (two columns) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '45% 55%',
            overflow: 'hidden',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {/* Left: radar + signal summary */}
          <div
            style={{
              display: 'flex', flexDirection: 'column',
              borderRight: '1px solid var(--color-border)',
              overflow: 'hidden', padding: '10px 12px 8px',
              gap: 8,
            }}
          >
            {/* Radar chart */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-dim, #8899aa)', letterSpacing: '0.08em', marginBottom: 4 }}>COMPONENT SCORES</div>
              <ResponsiveContainer width="100%" height={210}>
                <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                  <Customized component={RadarZones} />
                  <PolarGrid stroke="rgba(30,70,140,0.35)" />
                  <PolarAngleAxis
                    dataKey="factor"
                    tick={{ fill: 'var(--color-text-dim, #8899aa)', fontSize: 8, fontFamily: 'IBM Plex Mono, monospace' }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke={rStroke}
                    fill={rFill}
                    fillOpacity={0.7}
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0a0e1a', border: '1px solid #C9A84C', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace' }}
                    formatter={(v) => [`${v}/100`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', fontSize: 8, color: 'var(--color-text-dim, #8899aa)' }}>
                <span style={{ color: '#a83232' }}>● 0–33 BEARISH</span>
                <span style={{ color: '#c9a84c' }}>● 34–66 NEUTRAL</span>
                <span style={{ color: '#2d8a50' }}>● 67–100 BULLISH</span>
              </div>
            </div>

            {/* Signal summary */}
            <div style={{ flex: '1 1 0', minHeight: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-dim, #8899aa)', letterSpacing: '0.08em', marginBottom: 4 }}>SIGNAL SUMMARY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {sentiment.factors.filter((f) => f.score >= 55).map((f) => (
                  <div key={f.name} style={{ fontSize: 9, color: '#2d8a50' }}>▲ {f.name}</div>
                ))}
                {sentiment.factors.filter((f) => f.score >= 45 && f.score < 55).map((f) => (
                  <div key={f.name} style={{ fontSize: 9, color: 'var(--color-text-dim, #8899aa)' }}>◆ {f.name}</div>
                ))}
                {sentiment.factors.filter((f) => f.score < 45).map((f) => (
                  <div key={f.name} style={{ fontSize: 9, color: '#a83232' }}>▼ {f.name}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: component breakdown */}
          <div style={{ overflow: 'hidden', padding: '10px 12px 8px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-dim, #8899aa)', letterSpacing: '0.08em', marginBottom: 6 }}>COMPONENT BREAKDOWN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {sentiment.factors.map((f) => {
                const desc = getFactorDescription(f.name, f.score, { asxChanges, fearGreed })
                const col  = factorBarColor(f.score)
                return (
                  <div key={f.name} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--color-text-bright, #e8ecf0)', fontWeight: 600 }}>{f.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: 'var(--color-text-dim, #8899aa)' }}>wt {f.weight}%</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{f.score}/100</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: desc ? 3 : 0 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${f.score}%`, height: '100%', background: col, borderRadius: 2, opacity: 0.85 }} />
                      </div>
                    </div>
                    {desc && <div style={{ fontSize: 9, color: 'var(--color-text-dim, #8899aa)', fontStyle: 'italic' }}>{desc}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Trend section (full-width footer) ── */}
        <div style={{ padding: '10px 14px 10px', overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}>
          <TrendSection currentScore={sentiment.score} />
        </div>
      </div>
    </div>
  )
}

// ─── Banner ───────────────────────────────────────────────────────────────────
export default function MarketSentimentBanner() {
  const [modalOpen, setModalOpen] = useState(false)
  const { currency } = useStore()
  const vsCurrency = currency.toLowerCase()

  const { data: asxQuotes } = useQuery({
    queryKey: ['yahooMoversBatch', 'asx'],
    queryFn:  () => fetchBatch(ASX_STOCKS),
    staleTime: 60_000, retry: 1,
  })
  const { data: indexQuotes } = useQuery({
    queryKey: ['yfBatch', 'indices'],
    queryFn:  () => fetchYFBatch(ALL_INDEX_SYMBOLS),
    staleTime: 60_000, retry: 1,
  })
  const { data: rawCrypto } = useQuery({
    queryKey: ['cryptoMarkets', vsCurrency],
    queryFn:  () => fetchCryptoMarkets(vsCurrency),
    staleTime: 60_000, retry: 1,
  })
  const { data: rawFearGreed } = useQuery({
    queryKey: ['fearGreed'],
    queryFn:  fetchFearGreed,
    staleTime: 5 * 60_000, retry: 1,
  })

  const asxChanges    = asxQuotes    ? Object.values(asxQuotes).map((q) => q.dayChangePct) : null
  const spxChange     = indexQuotes?.['^GSPC']?.pct ?? null
  const cryptoList    = rawCrypto?.data ?? null
  const cryptoChanges = cryptoList  ? cryptoList.map((c) => c.price_change_percentage_24h) : null
  const btc           = cryptoList?.find((c) => c.symbol?.toUpperCase() === 'BTC')
  const fearGreed     = rawFearGreed ? transformFearGreed(rawFearGreed) : null
  const haveAnyData   = asxChanges || spxChange != null || cryptoChanges || fearGreed

  const sentiment = haveAnyData ? calculateMarketSentimentScore({
    fearGreed, asxChanges, spxChange,
    btcChange: btc?.price_change_percentage_24h ?? null,
    cryptoChanges,
  }) : null

  const shortSummary = sentiment ? generateShortSummary({ marketSentimentScore: sentiment, asxChanges, fearGreed }) : ''
  const color        = sentiment ? scoreToColor(sentiment.score) : 'var(--color-neutral)'

  // Persist score to history + prev-session key
  useEffect(() => {
    if (sentiment?.score != null && sentiment?.label) {
      localStorage.setItem(PREV_SCORE_KEY, JSON.stringify({ score: sentiment.score, label: sentiment.label }))
      writeHistory(sentiment.score, sentiment.label)
    }
  }, [sentiment?.score, sentiment?.label])

  const handleOpen  = useCallback(() => setModalOpen(true),  [])
  const handleClose = useCallback(() => setModalOpen(false), [])

  if (!haveAnyData || !sentiment) return null

  return (
    <>
      <div
        className="border-b border-terminal-border bg-terminal-header flex-shrink-0 flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-terminal-accent/10 transition-colors"
        onClick={handleOpen}
      >
        <span className="text-2xs font-bold text-terminal-gold tracking-widest flex-shrink-0 whitespace-nowrap">MADDENAI</span>
        <span className="text-terminal-text-dim/40 text-2xs flex-shrink-0">◆</span>
        <span className="text-2xs font-bold flex-shrink-0 whitespace-nowrap" style={{ color }}>
          {sentiment.score}/100
        </span>
        <ScoreGradientBar score={sentiment.score} />
        <span className="text-2xs font-bold flex-shrink-0 whitespace-nowrap" style={{ color }}>
          {sentiment.label.toUpperCase()}
        </span>
        <span className="text-terminal-text-dim/40 text-2xs flex-shrink-0">·</span>
        <span className="text-2xs text-terminal-text-dim truncate min-w-0 flex-1">{shortSummary}</span>
        <span className="text-2xs text-terminal-text-dim/50 flex-shrink-0 hover:text-terminal-gold">[▼ DETAILS]</span>
      </div>

      {modalOpen && (
        <SentimentModal
          sentiment={sentiment}
          asxChanges={asxChanges}
          fearGreed={fearGreed}
          onClose={handleClose}
        />
      )}
    </>
  )
}
