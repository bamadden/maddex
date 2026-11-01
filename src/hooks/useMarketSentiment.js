import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { YF_INDICES, fetchFearGreed, transformFearGreed, USING_MOCK_DATA } from '../services/api'
import { fetchIndexQuotesUnified, fetchCryptoMarketsUnified } from '../services/dataService'
import { useAsxUniverseQuotes } from '../modules/markets/useAsxUniverse'
import { calculateMarketSentimentScore } from '../services/maddenAiScoring'

// THE market sentiment score — one number for every screen that shows one
// (top bar, Markets, dashboard header and gauge, News, Brief).
//
// Computed here, in code, from market data: ASX breadth and momentum over the
// 72-name universe, S&P 500, BTC and crypto breadth (from the shared crypto
// snapshot), and the crypto Fear & Greed index. MaddenAI does not produce
// this number; its daily read of the headlines is shown beside it as words.
//
// Same query keys as the Markets screen, so every consumer shares the fetches.
const ALL_INDEX_SYMBOLS = YF_INDICES.map((i) => i.symbol)

export const SENTIMENT_METHOD = 'Computed by Maddex from market data: ASX breadth and momentum (72 stocks), S&P 500, BTC and crypto breadth, and the crypto Fear & Greed index. Not an AI estimate.'

export function useMarketSentiment() {
  const { data: asxResult, isLoading: asxLoading } = useAsxUniverseQuotes()
  const { data: indexResult, isLoading: idxLoading } = useQuery({
    queryKey: ['yfBatch', 'indices'],
    queryFn: () => fetchIndexQuotesUnified(ALL_INDEX_SYMBOLS),
    staleTime: 60_000, retry: 1,
  })
  // AUD, always: the 24h % differs slightly by quote currency, and one score
  // must not change with the display currency.
  const { data: crypto, isLoading: cryptoLoading } = useQuery({
    queryKey: ['cryptoMarkets', 'aud'],
    queryFn: () => fetchCryptoMarketsUnified('aud'),
    staleTime: 60_000, retry: 1,
  })
  const { data: rawFearGreed, isLoading: fgLoading } = useQuery({
    queryKey: ['fearGreed'],
    queryFn: fetchFearGreed,
    staleTime: 5 * 60_000, retry: 1,
  })

  return useMemo(() => {
    const asxQuotes = asxResult?.data
    const asxChanges = asxQuotes ? Object.values(asxQuotes).map((q) => q?.dayChangePct).filter((v) => v != null) : null
    const spxChange = indexResult?.data?.['^GSPC']?.pct ?? null
    const cryptoList = crypto?.data ?? null
    const cryptoChanges = cryptoList ? cryptoList.map((c) => c.price_change_percentage_24h).filter((v) => v != null) : null
    const btc = cryptoList?.find((c) => c.symbol?.toUpperCase() === 'BTC')
    const fearGreed = rawFearGreed ? transformFearGreed(rawFearGreed) : null
    const haveAny = !!(asxChanges?.length || spxChange != null || cryptoChanges?.length || fearGreed)
    const loading = asxLoading || idxLoading || cryptoLoading || fgLoading
    const sentiment = haveAny ? calculateMarketSentimentScore({
      fearGreed, asxChanges, spxChange, btcChange: btc?.price_change_percentage_24h ?? null, cryptoChanges,
    }) : null
    const stale = [asxResult, indexResult, crypto].some((r) => r?.stale)
    return {
      sentiment,
      status: sentiment ? 'ready' : loading ? 'loading' : 'unavailable',
      asxChanges, fearGreed,
      // Inputs that are demo or cached copies, so a reader knows what the
      // number rests on.
      demoInputs: USING_MOCK_DATA && !!asxChanges?.length,
      stale,
      method: SENTIMENT_METHOD,
    }
  }, [asxResult, indexResult, crypto, rawFearGreed, asxLoading, idxLoading, cryptoLoading, fgLoading])
}

// One tooltip text for the score wherever it appears.
export function sentimentTooltip(s) {
  if (!s?.sentiment) return SENTIMENT_METHOD
  const f = s.sentiment.factors?.map((x) => `${x.name} ${x.score}`).join(' · ')
  return `${SENTIMENT_METHOD}${s.demoInputs ? ' ASX inputs are DEMO data.' : ''}${s.stale ? ' Some inputs are cached copies (STALE).' : ''}${f ? `\n${f}` : ''}`
}
