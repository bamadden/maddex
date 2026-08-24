import { useQuery } from '@tanstack/react-query'
import { ASX_STOCKS, US_STOCKS } from '../../services/api'
import { fetchEquityQuotes } from '../../services/dataService'

// Shares TopMovers'/MarketSentimentBanner's exact queryKeys — one cached
// fetch serves all three rather than issuing its own duplicate requests.
export default function MarketBreadth() {
  const { data: asxResult } = useQuery({
    queryKey:  ['yahooMoversBatch', 'asx'],
    queryFn:   () => fetchEquityQuotes(ASX_STOCKS),
    staleTime: 60_000,
    retry: 1,
  })
  const { data: usResult } = useQuery({
    queryKey:  ['yahooMoversBatch', 'us'],
    queryFn:   () => fetchEquityQuotes(US_STOCKS),
    staleTime: 60_000,
    retry: 1,
  })

  const quotes = [
    ...Object.values(asxResult?.data ?? {}),
    ...Object.values(usResult?.data ?? {}),
  ].filter((q) => q && !isNaN(q.dayChangePct))
  if (!quotes.length) return null

  let advances = 0, declines = 0, unchanged = 0, newHighs = 0, newLows = 0
  for (const q of quotes) {
    if (q.dayChangePct > 0) advances++
    else if (q.dayChangePct < 0) declines++
    else unchanged++
    if (q.week52High != null && q.price >= q.week52High * 0.99) newHighs++
    if (q.week52Low != null && q.price <= q.week52Low * 1.01) newLows++
  }
  const adRatio = declines > 0 ? advances / declines : advances
  const sentiment = adRatio >= 1.5 ? 'BULLISH' : adRatio >= 0.8 ? 'NEUTRAL' : 'BEARISH'
  const sentimentCls = adRatio >= 1.5 ? 'text-terminal-green' : adRatio >= 0.8 ? 'text-terminal-gold' : 'text-terminal-red'
  const advPct = (advances / (advances + declines + unchanged)) * 100

  return (
    <div className="flex-shrink-0 border-b border-terminal-border px-3 py-1.5 flex items-center gap-4 flex-wrap" style={{ minHeight: 32 }}>
      <span className="text-2xs text-terminal-gold font-bold tracking-widest flex-shrink-0">MARKET BREADTH · TRACKED UNIVERSE</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-2xs text-terminal-green font-bold">Advances: {advances} ▲</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-2xs text-terminal-red font-bold">Declines: {declines} ▼</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim">Unchanged: {unchanged}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim">New Highs: <span className="text-terminal-green">{newHighs}</span></span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim">New Lows: <span className="text-terminal-red">{newLows}</span></span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim">A/D Ratio:</span>
        <span className={`text-2xs font-bold ${sentimentCls}`}>{adRatio.toFixed(2)} — {sentiment}</span>
      </div>
      <div className="flex-1 min-w-[80px] h-1.5 bg-terminal-red/40 rounded-sm overflow-hidden flex">
        <div className="h-full bg-terminal-green" style={{ width: `${advPct}%` }} />
      </div>
    </div>
  )
}
