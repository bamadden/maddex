import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
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

function scoreBarColor(score) {
  if (score >= 65) return 'var(--color-gain)'
  if (score >= 45) return 'var(--color-neutral)'
  return 'var(--color-loss)'
}

function ScoreBar({ score, width = 80 }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className="rounded-sm overflow-hidden flex-shrink-0"
        style={{ width, height: 4, background: 'rgba(255,255,255,0.1)' }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: scoreBarColor(score),
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  )
}

function SentimentModal({ sentiment, asxChanges, fearGreed, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const prev = (() => {
    try { return JSON.parse(localStorage.getItem(PREV_SCORE_KEY)) } catch { return null }
  })()
  const delta = prev ? sentiment.score - prev.score : null

  const totalWeight = sentiment.factors.reduce((s, f) => s + f.weight, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', animation: 'fadeIn 150ms ease' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-h-[85vh] overflow-y-auto"
        style={{
          background: 'var(--mt-bg-dark, #0a0e1a)',
          border: '1px solid var(--mt-gold, #C9A84C)',
          borderRadius: 4,
          minWidth: 420,
          maxWidth: 520,
          boxShadow: '0 0 40px rgba(201,168,76,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start px-4 py-3 border-b border-terminal-border">
          <div>
            <div className="text-xs font-bold text-terminal-gold tracking-widest">MADDEX AI SENTIMENT ANALYSIS</div>
            <div className="text-2xs text-terminal-text-dim mt-0.5">
              Overall Score: <span className="font-bold" style={{ color: scoreToColor(sentiment.score) }}>{sentiment.score}/100 — {sentiment.label}</span>
            </div>
          </div>
          <button
            className="text-2xs text-terminal-text-dim hover:text-terminal-gold ml-4 flex-shrink-0"
            onClick={onClose}
          >
            CLOSE ×
          </button>
        </div>

        {/* Component Breakdown */}
        <div className="px-4 py-3 border-b border-terminal-border">
          <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-2">COMPONENT BREAKDOWN</div>
          <div className="flex flex-col gap-3">
            {sentiment.factors.map((f) => {
              const contribution = ((f.score * f.weight) / totalWeight)
              const desc = getFactorDescription(f.name, f.score, { asxChanges, fearGreed })
              return (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-2xs text-terminal-text-bright font-semibold">{f.name}</span>
                    <span className="text-2xs font-bold ml-2" style={{ color: scoreBarColor(f.score) }}>
                      {f.score}/100
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <ScoreBar score={f.score} width={120} />
                    <span className="text-2xs text-terminal-text-dim">
                      Weight: {f.weight}%  →  Contribution: +{contribution.toFixed(1)}pts
                    </span>
                  </div>
                  {desc && <div className="text-2xs text-terminal-text-dim/70 italic">{desc}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Calculation */}
        <div className="px-4 py-3 border-b border-terminal-border">
          <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-1.5">CALCULATION</div>
          <div className="text-2xs text-terminal-text-dim space-y-0.5">
            <div>Sum of (score × weight) for all factors</div>
            <div>= {(sentiment.factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight).toFixed(1)} → rounded to {sentiment.score}/100</div>
            <div>Data confidence: {sentiment.confidence}% ({sentiment.factors.length} of 6 factors live)</div>
          </div>
        </div>

        {/* Trend */}
        {prev && (
          <div className="px-4 py-3 border-b border-terminal-border">
            <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-1.5">TREND</div>
            <div className="text-2xs text-terminal-text-dim space-y-0.5">
              <div>Previous session: <span className="text-terminal-text-bright">{prev.score}/100 ({prev.label})</span></div>
              <div>Change: <span style={{ color: delta >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{delta}pts
              </span></div>
            </div>
          </div>
        )}

        {/* Signal Summary */}
        <div className="px-4 py-3">
          <div className="text-2xs font-bold text-terminal-text-dim tracking-widest mb-1.5">SIGNAL SUMMARY</div>
          <div className="text-2xs space-y-0.5">
            {sentiment.factors.filter(f => f.score >= 55).map(f => (
              <div key={f.name} style={{ color: 'var(--color-gain)' }}>▲ Positive: {f.name}</div>
            ))}
            {sentiment.factors.filter(f => f.score >= 45 && f.score < 55).map(f => (
              <div key={f.name} className="text-terminal-text-dim">◆ Neutral: {f.name}</div>
            ))}
            {sentiment.factors.filter(f => f.score < 45).map(f => (
              <div key={f.name} style={{ color: 'var(--color-loss)' }}>▼ Negative: {f.name}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getFactorDescription(name, score, { asxChanges, fearGreed }) {
  const gainers = asxChanges?.filter(c => (c ?? 0) > 0).length ?? 0
  const total = asxChanges?.length ?? 0
  const fgVal = fearGreed?.value ?? null
  const fgLbl = fearGreed?.label ?? null

  switch (name) {
    case 'Crypto Fear & Greed':
      return fgVal != null ? `${fgLbl ?? ''} — crypto investors ${score < 40 ? 'risk-off' : score > 60 ? 'risk-on' : 'cautious'}` : null
    case 'ASX Market Breadth':
      return total > 0 ? `${gainers} of ${total} tracked stocks advancing today` : null
    case 'ASX Price Momentum':
      return score > 55 ? 'ASX average daily gain positive' : score < 45 ? 'ASX average daily loss negative' : 'ASX broadly flat'
    case 'S&P 500 Momentum':
      return score > 55 ? 'S&P 500 in positive territory' : score < 45 ? 'S&P 500 under pressure' : 'S&P 500 broadly flat'
    case 'BTC Risk Appetite':
      return score > 60 ? 'Bitcoin advancing — risk appetite elevated' : score < 40 ? 'Bitcoin declining — risk-off signal' : 'Bitcoin range-bound'
    case 'Crypto Market Breadth':
      return score > 60 ? 'Majority of top cryptos in positive territory' : score < 40 ? 'Majority of top 20 cryptos in negative territory' : 'Mixed crypto breadth'
    default:
      return null
  }
}

export default function MarketSentimentBanner() {
  const [modalOpen, setModalOpen] = useState(false)
  const { currency } = useStore()
  const vsCurrency = currency.toLowerCase()

  const { data: asxQuotes } = useQuery({
    queryKey: ['yahooMoversBatch', 'asx'],
    queryFn: () => fetchBatch(ASX_STOCKS),
    staleTime: 60_000,
    retry: 1,
  })
  const { data: indexQuotes } = useQuery({
    queryKey: ['yfBatch', 'indices'],
    queryFn: () => fetchYFBatch(ALL_INDEX_SYMBOLS),
    staleTime: 60_000,
    retry: 1,
  })
  const { data: rawCrypto } = useQuery({
    queryKey: ['cryptoMarkets', vsCurrency],
    queryFn: () => fetchCryptoMarkets(vsCurrency),
    staleTime: 60_000,
    retry: 1,
  })
  const { data: rawFearGreed } = useQuery({
    queryKey: ['fearGreed'],
    queryFn: fetchFearGreed,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const asxChanges = asxQuotes ? Object.values(asxQuotes).map((q) => q.dayChangePct) : null
  const spxChange = indexQuotes?.['^GSPC']?.pct ?? null
  const cryptoList = rawCrypto?.data ?? null
  const cryptoChanges = cryptoList ? cryptoList.map((c) => c.price_change_percentage_24h) : null
  const btc = cryptoList?.find((c) => c.symbol?.toUpperCase() === 'BTC')
  const fearGreed = rawFearGreed ? transformFearGreed(rawFearGreed) : null

  const haveAnyData = asxChanges || spxChange != null || cryptoChanges || fearGreed

  const sentiment = haveAnyData ? calculateMarketSentimentScore({
    fearGreed,
    asxChanges,
    spxChange,
    btcChange: btc?.price_change_percentage_24h ?? null,
    cryptoChanges,
  }) : null

  const shortSummary = sentiment ? generateShortSummary({
    marketSentimentScore: sentiment,
    asxChanges,
    fearGreed,
  }) : ''

  const color = sentiment ? scoreToColor(sentiment.score) : 'var(--color-neutral)'

  // Store current score so next session can show trend — only when we have data
  useEffect(() => {
    if (sentiment?.score != null && sentiment?.label) {
      localStorage.setItem(PREV_SCORE_KEY, JSON.stringify({ score: sentiment.score, label: sentiment.label }))
    }
  }, [sentiment?.score, sentiment?.label])

  const handleOpen = useCallback(() => setModalOpen(true), [])
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
