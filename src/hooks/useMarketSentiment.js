import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { YF_INDICES, fetchFearGreed, transformFearGreed, USING_MOCK_DATA } from '../services/api'
import { fetchIndexQuotesUnified, fetchCryptoMarketsUnified } from '../services/dataService'
import { useAsxUniverseQuotes } from '../modules/markets/useAsxUniverse'
import { calculateMarketSentimentScore } from '../services/maddenAiScoring'

// THE market sentiment score — one number for every screen that shows one
// (top bar, Markets, dashboard header and gauge, News, Brief).
//
// Computed here, in code: ASX breadth and momentum over the 72-name universe,
// the S&P 500's daily move, BTC and crypto breadth (from the shared crypto
// snapshot), and the crypto Fear & Greed index. MaddenAI does not produce
// this number; its daily read of the headlines is shown beside it as words.
//
// While equity prices are DEMO (no licensed feed), the ASX and S&P inputs are
// simulated, so the score is a demo composite: `demo` is true and every
// screen that shows it carries a DEMO badge (components/ui/SentimentClass).
//
// Same query keys as the Markets screen, so every consumer shares the fetches.
const ALL_INDEX_SYMBOLS = YF_INDICES.map((i) => i.symbol)

export const SENTIMENT_METHOD = 'Computed by Maddex in code from ASX breadth and momentum (72 stocks), the S&P 500 daily move, BTC and crypto breadth, and the crypto Fear & Greed index. Not an AI estimate. A descriptive measure of what prices did — not a forecast and not a recommendation.'
export const SENTIMENT_DEMO_NOTE = 'DEMO composite: the ASX and S&P 500 inputs are simulated prices until a licensed equity feed is connected; only the crypto inputs are market data.'

export function useMarketSentiment() {
  const { data: asxResult, isLoading: asxLoading, dataUpdatedAt: asxAt } = useAsxUniverseQuotes()
  const { data: indexResult, isLoading: idxLoading, dataUpdatedAt: idxAt } = useQuery({
    queryKey: ['yfBatch', 'indices'],
    queryFn: () => fetchIndexQuotesUnified(ALL_INDEX_SYMBOLS),
    staleTime: 60_000, retry: 1,
  })
  // AUD, always: the 24h % differs slightly by quote currency, and one score
  // must not change with the display currency.
  const { data: crypto, isLoading: cryptoLoading, dataUpdatedAt: cryptoAt } = useQuery({
    queryKey: ['cryptoMarkets', 'aud'],
    queryFn: () => fetchCryptoMarketsUnified('aud'),
    staleTime: 60_000, retry: 1,
  })
  const { data: rawFearGreed, isLoading: fgLoading, dataUpdatedAt: fgAt } = useQuery({
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
      simulated: USING_MOCK_DATA ? ['asx', 'spx'] : [],
    }) : null
    const demo = (sentiment?.demoShare ?? 0) > 0
    const stale = [asxResult, indexResult, crypto].some((r) => r?.stale)
    return {
      sentiment,
      status: sentiment ? 'ready' : loading ? 'loading' : 'unavailable',
      asxChanges, fearGreed,
      // Inputs that are demo or cached copies, so a reader knows what the
      // number rests on. `demo` (alias demoInputs): the score is a demo
      // composite; demoShare is the weight resting on simulated inputs.
      demo, demoInputs: demo, demoShare: sentiment?.demoShare ?? 0,
      stale,
      method: demo ? `${SENTIMENT_DEMO_NOTE} ${SENTIMENT_METHOD}` : SENTIMENT_METHOD,
      // When the newest input was fetched, and the inputs used — for the
      // ScoreNote on every card that shows the score.
      asOf: Math.max(asxAt || 0, idxAt || 0, cryptoAt || 0, fgAt || 0) || null,
      inputs: sentiment?.factors?.map((f) => ({ name: f.demo ? `${f.name} (DEMO)` : f.name, value: `${Math.round(f.score)}/100` })) ?? [],
    }
  }, [asxResult, indexResult, crypto, rawFearGreed, asxLoading, idxLoading, cryptoLoading, fgLoading, asxAt, idxAt, cryptoAt, fgAt])
}

// One tooltip text for the score wherever it appears.
export function sentimentTooltip(s) {
  if (!s?.sentiment) return SENTIMENT_METHOD
  const f = s.sentiment.factors?.map((x) => `${x.name} ${x.score}`).join(' · ')
  return `${s.demo ? `${SENTIMENT_DEMO_NOTE} ` : ''}${SENTIMENT_METHOD}${s.stale ? ' Some inputs are cached copies (STALE).' : ''}${f ? `\n${f}` : ''}`
}
