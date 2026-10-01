import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { YF_INDICES, USING_MOCK_DATA } from '../../services/api'
import { fetchIndexQuotesUnified } from '../../services/dataService'
import { BENCHMARK_ORDER } from './benchmarks'

// Elevated-volatility banner. Hidden in normal conditions; amber when any
// benchmark is down more than 2% on the day, red past 5%.
//
// ON CIRCUIT BREAKERS: the request was for "circuit breakers may activate at
// −10%" on the ASX 200. The ASX has no index-level circuit breaker — its
// controls work per security. Market-wide circuit breakers are a US
// mechanism, set on the S&P 500 at −7%, −13% and −20%, so that is the only
// place the banner mentions them.
const US_MWCB = new Set(['^GSPC', '^IXIC', '^DJI'])

export default function VolatilityBanner() {
  const indices = useMemo(() => BENCHMARK_ORDER.map((s) => YF_INDICES.find((i) => i.symbol === s)).filter(Boolean), [])
  const { data } = useQuery({
    queryKey: ['yfBatch', 'indices'],
    queryFn: () => fetchIndexQuotesUnified(indices.map((i) => i.symbol)),
    staleTime: 60_000,
    retry: 1,
  })
  const quotes = data?.data
  const worst = useMemo(() => {
    if (!quotes) return null
    return indices
      .map((i) => ({ ...i, pct: quotes[i.symbol]?.pct }))
      .filter((i) => Number.isFinite(i.pct))
      .sort((a, b) => a.pct - b.pct)[0] ?? null
  }, [quotes, indices])

  if (!worst || worst.pct > -2) return null
  const severe = worst.pct <= -5
  const colour = severe ? '#A83232' : '#C9A84C'
  const fallers = indices.filter((i) => (quotes[i.symbol]?.pct ?? 0) <= -2)
  return (
    <div className="flex items-center gap-3 px-3 py-2 flex-shrink-0 font-mono"
      style={{ background: `${colour}1F`, borderBottom: `1px solid ${colour}66` }}>
      <span className="font-bold tracking-widest text-[10px]" style={{ color: colour }}>
        ⚠ {severe ? 'SEVERE MARKET STRESS' : 'ELEVATED VOLATILITY'}
      </span>
      <span className="text-[10px] text-terminal-text-bright">
        {fallers.map((i) => `${i.label ?? i.name ?? i.symbol} ${quotes[i.symbol].pct.toFixed(1)}%`).join(' · ')}
      </span>
      <span className="ml-auto text-[9px] text-terminal-text-dim">
        {fallers.some((i) => US_MWCB.has(i.symbol)) ? 'US market-wide circuit breakers halt trading at −7%, −13% and −20% on the S&P 500' : 'Moves of this size are uncommon — check news before acting'}
        {USING_MOCK_DATA ? ' · DEMO DATA' : ''}
      </span>
    </div>
  )
}
