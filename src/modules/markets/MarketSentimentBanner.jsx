import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchYFBatch, YF_INDICES, fetchCryptoMarkets, fetchFearGreed, transformFearGreed,
  ASX_STOCKS, fetchBatch,
} from '../../services/api'
import { useStore } from '../../store/useStore'
import {
  calculateMarketSentimentScore, generateSnapshotText, explainScore, scoreToColor,
} from '../../services/maddenAiScoring'

const ALL_INDEX_SYMBOLS = YF_INDICES.map((i) => i.symbol)

function BreakdownBar({ breakdown }) {
  if (!breakdown) return null
  const { bullish, neutral, bearish } = breakdown
  return (
    <div className="flex h-1.5 w-32 overflow-hidden flex-shrink-0">
      <div style={{ width: `${bullish}%`, backgroundColor: 'var(--color-gain)' }} title={`Bull ${bullish}%`} />
      <div style={{ width: `${neutral}%`, backgroundColor: 'var(--color-neutral)' }} title={`Neutral ${neutral}%`} />
      <div style={{ width: `${bearish}%`, backgroundColor: 'var(--color-loss)' }} title={`Bear ${bearish}%`} />
    </div>
  )
}

export default function MarketSentimentBanner() {
  const [expanded, setExpanded] = useState(false)
  const { currency } = useStore()
  const vsCurrency = currency.toLowerCase()

  // Shares its query cache with TopMovers / IndicesTable / CryptoModule — no extra network calls.
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
  if (!haveAnyData) return null

  const sentiment = calculateMarketSentimentScore({
    fearGreed,
    asxChanges,
    spxChange,
    btcChange: btc?.price_change_percentage_24h ?? null,
    cryptoChanges,
  })

  const snapshot = generateSnapshotText({
    marketSentimentScore: sentiment,
    cryptoMomentumIndex: null,
    asxChanges,
    fearGreed,
  })

  const color = scoreToColor(sentiment.score)

  return (
    <div className="border-b border-terminal-border bg-terminal-header flex-shrink-0">
      <div
        className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-2xs font-bold text-terminal-gold tracking-widest flex-shrink-0">MADDENAI SENTIMENT</span>
        <span className="text-sm font-bold flex-shrink-0" style={{ color }}>{sentiment.score}</span>
        <span className="text-2xs font-semibold flex-shrink-0" style={{ color }}>{sentiment.label.toUpperCase()}</span>
        <BreakdownBar breakdown={sentiment.breakdown} />
        <span className="text-2xs text-terminal-text-dim truncate min-w-0 flex-1">{snapshot}</span>
        <span className="text-2xs text-terminal-text-dim/50 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="px-3 pb-2 text-2xs text-terminal-text-dim border-t border-terminal-border/50 pt-1.5">
          {explainScore(sentiment)}
        </div>
      )}
    </div>
  )
}
