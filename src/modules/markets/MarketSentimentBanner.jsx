import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  fetchYFBatch, YF_INDICES, fetchCryptoMarkets, fetchFearGreed, transformFearGreed,
  ASX_STOCKS, fetchBatch,
} from '../../services/api'
import { useStore } from '../../store/useStore'
import {
  calculateMarketSentimentScore, generateShortSummary, scoreToColor,
} from '../../services/maddenAiScoring'

const ALL_INDEX_SYMBOLS = YF_INDICES.map((i) => i.symbol)
const PREV_SCORE_KEY = 'maddex_sentiment_prev'

const SHORT_NAMES = {
  'Crypto Fear & Greed':  'F&G Index',
  'ASX Market Breadth':   'ASX Breadth',
  'ASX Price Momentum':   'ASX Momentum',
  'S&P 500 Momentum':     'S&P 500',
  'BTC Risk Appetite':    'BTC',
  'Crypto Market Breadth':'Crypto Breadth',
}

function barColor(score) {
  if (score >= 65) return 'var(--color-gain)'
  if (score >= 45) return 'var(--color-neutral)'
  return 'var(--color-loss)'
}

function getFactorDescription(name, score, { asxChanges, fearGreed }) {
  const gainers = asxChanges?.filter((c) => (c ?? 0) > 0).length ?? 0
  const total   = asxChanges?.length ?? 0
  const fgLbl   = fearGreed?.label ?? null
  switch (name) {
    case 'Crypto Fear & Greed':   return fgLbl ? `${fgLbl} — crypto ${score < 40 ? 'risk-off' : score > 60 ? 'risk-on' : 'cautious'}` : null
    case 'ASX Market Breadth':    return total > 0 ? `${gainers} of ${total} tracked stocks advancing` : null
    case 'ASX Price Momentum':    return score > 55 ? 'ASX avg daily gain positive' : score < 45 ? 'ASX avg daily loss negative' : 'ASX broadly flat'
    case 'S&P 500 Momentum':      return score > 55 ? 'S&P 500 in positive territory' : score < 45 ? 'S&P 500 under pressure' : 'S&P 500 broadly flat'
    case 'BTC Risk Appetite':     return score > 60 ? 'Bitcoin advancing — risk-on' : score < 40 ? 'Bitcoin declining — risk-off' : 'Bitcoin range-bound'
    case 'Crypto Market Breadth': return score > 60 ? 'Majority of top cryptos positive' : score < 40 ? 'Majority of top cryptos negative' : 'Mixed crypto breadth'
    default: return null
  }
}

// ─── Sentiment Modal — same overlay/panel style as DetailModal ────────────────
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

  const prev = (() => {
    try { return JSON.parse(localStorage.getItem(PREV_SCORE_KEY)) } catch { return null }
  })()
  const delta = prev != null ? sentiment.score - prev.score : null

  const radarData = sentiment.factors.map((f) => ({
    factor:   SHORT_NAMES[f.name] ?? f.name,
    score:    f.score,
    fullMark: 100,
  }))

  return (
    <div
      ref={overlayRef}
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleOverlay}
    >
      <div
        className="modal-panel bg-terminal-panel border border-terminal-border flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 820, maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-2xs border border-terminal-gold/40 px-1.5 py-0.5 font-bold tracking-widest text-terminal-gold">
            SENTIMENT
          </span>
          <span className="text-base font-bold text-terminal-gold tracking-wider">MADDEX AI MARKET SENTIMENT</span>
          <span className="text-terminal-text-dim/40 text-sm">◆</span>
          <span className="text-sm font-bold" style={{ color: scoreToColor(sentiment.score) }}>
            {sentiment.score}/100 {sentiment.label.toUpperCase()}
          </span>
          <div className="ml-auto">
            <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Two-column: radar + breakdown */}
          <div className="flex gap-0 border-b border-terminal-border">
            {/* Left — radar chart */}
            <div className="w-1/2 border-r border-terminal-border px-3 py-3 flex flex-col">
              <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-2">COMPONENT SCORES</div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="rgba(30,70,140,0.4)" />
                  <PolarAngleAxis
                    dataKey="factor"
                    tick={{ fill: 'var(--color-text-dim, #8899aa)', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace' }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="var(--mt-blue, #3b82f6)"
                    fill="rgba(201,168,76,0.15)"
                    fillOpacity={0.6}
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-panel, #0a0e1a)',
                      border: '1px solid var(--mt-gold, #C9A84C)',
                      fontSize: 10,
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}
                    formatter={(value) => [`${value}/100`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Right — component breakdown */}
            <div className="w-1/2 px-3 py-3 overflow-y-auto" style={{ maxHeight: 290 }}>
              <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-2">COMPONENT BREAKDOWN</div>
              <div className="flex flex-col gap-2.5">
                {sentiment.factors.map((f) => {
                  const desc = getFactorDescription(f.name, f.score, { asxChanges, fearGreed })
                  return (
                    <div key={f.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-2xs text-terminal-text-bright font-semibold">{f.name}</span>
                        <span className="text-2xs font-bold ml-2 flex-shrink-0" style={{ color: barColor(f.score) }}>
                          {f.score}/100
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div
                          className="rounded-sm overflow-hidden flex-shrink-0"
                          style={{ width: 100, height: 3, background: 'rgba(255,255,255,0.1)' }}
                        >
                          <div style={{ width: `${f.score}%`, height: '100%', background: barColor(f.score), opacity: 0.8 }} />
                        </div>
                        <span className="text-2xs text-terminal-text-dim">Weight: {f.weight}%</span>
                      </div>
                      {desc && <div className="text-2xs text-terminal-text-dim/60 italic">{desc}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Signal summary + trend — full width */}
          <div className="flex gap-0 border-b border-terminal-border">
            {/* Signal summary */}
            <div className="w-1/2 border-r border-terminal-border px-3 py-3">
              <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-2">SIGNAL SUMMARY</div>
              <div className="flex flex-col gap-1">
                {sentiment.factors.filter((f) => f.score >= 55).map((f) => (
                  <div key={f.name} className="text-2xs" style={{ color: 'var(--color-gain)' }}>▲ {f.name}</div>
                ))}
                {sentiment.factors.filter((f) => f.score >= 45 && f.score < 55).map((f) => (
                  <div key={f.name} className="text-2xs text-terminal-text-dim">◆ {f.name}</div>
                ))}
                {sentiment.factors.filter((f) => f.score < 45).map((f) => (
                  <div key={f.name} className="text-2xs" style={{ color: 'var(--color-loss)' }}>▼ {f.name}</div>
                ))}
              </div>
            </div>

            {/* Trend */}
            <div className="w-1/2 px-3 py-3">
              <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-2">TREND</div>
              {prev ? (
                <div className="flex flex-col gap-1 text-2xs text-terminal-text-dim">
                  <div className="flex gap-4">
                    <span>Previous: <span className="text-terminal-text-bright">{prev.score}/100</span></span>
                    <span>Current: <span className="text-terminal-text-bright">{sentiment.score}/100</span></span>
                  </div>
                  {delta != null && (
                    <div>
                      Change:{' '}
                      <span style={{ color: delta >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                        {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{delta}pts
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-2xs text-terminal-text-dim/50 italic">No previous session data</div>
              )}
            </div>
          </div>
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
    staleTime: 60_000,
    retry: 1,
  })
  const { data: indexQuotes } = useQuery({
    queryKey: ['yfBatch', 'indices'],
    queryFn:  () => fetchYFBatch(ALL_INDEX_SYMBOLS),
    staleTime: 60_000,
    retry: 1,
  })
  const { data: rawCrypto } = useQuery({
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

  const asxChanges   = asxQuotes   ? Object.values(asxQuotes).map((q) => q.dayChangePct) : null
  const spxChange    = indexQuotes?.['^GSPC']?.pct ?? null
  const cryptoList   = rawCrypto?.data ?? null
  const cryptoChanges = cryptoList ? cryptoList.map((c) => c.price_change_percentage_24h) : null
  const btc          = cryptoList?.find((c) => c.symbol?.toUpperCase() === 'BTC')
  const fearGreed    = rawFearGreed ? transformFearGreed(rawFearGreed) : null
  const haveAnyData  = asxChanges || spxChange != null || cryptoChanges || fearGreed

  const sentiment = haveAnyData ? calculateMarketSentimentScore({
    fearGreed,
    asxChanges,
    spxChange,
    btcChange:    btc?.price_change_percentage_24h ?? null,
    cryptoChanges,
  }) : null

  const shortSummary = sentiment ? generateShortSummary({
    marketSentimentScore: sentiment,
    asxChanges,
    fearGreed,
  }) : ''

  const color = sentiment ? scoreToColor(sentiment.score) : 'var(--color-neutral)'

  useEffect(() => {
    if (sentiment?.score != null && sentiment?.label) {
      localStorage.setItem(PREV_SCORE_KEY, JSON.stringify({ score: sentiment.score, label: sentiment.label }))
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
        <span className="text-2xs font-bold text-terminal-gold tracking-widest flex-shrink-0 whitespace-nowrap">
          MADDEX AI
        </span>
        <span className="text-terminal-text-dim/40 text-2xs flex-shrink-0">◆</span>
        <span className="text-2xs font-bold flex-shrink-0 whitespace-nowrap" style={{ color }}>
          {sentiment.score}/100 {sentiment.label.toUpperCase()}
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
