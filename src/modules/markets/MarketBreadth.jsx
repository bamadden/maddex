import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASX_STOCKS, US_STOCKS } from '../../services/api'
import { fetchEquityQuotes } from '../../services/dataService'
import { GICS_SECTORS, SECTOR_ABBR, ASX_SECTOR_STOCKS } from './SectorHeatmap'
import { getMockFMPRow } from '../../services/mockData'
import Tooltip from '../../components/ui/Tooltip'

function SectorBreakdownModal({ onClose }) {
  const bySector = GICS_SECTORS.map((sector) => {
    const stocks = ASX_SECTOR_STOCKS[sector] ?? []
    let adv = 0, dec = 0
    for (const [sym] of stocks) {
      const pct = getMockFMPRow(sym)?.regularMarketChangePercent
      if (pct == null) continue
      if (pct > 0) adv++
      else if (pct < 0) dec++
    }
    const total = adv + dec
    return { sector, abbr: SECTOR_ABBR[sector] ?? sector, adv, dec, total, advPct: total ? (adv / total) * 100 : 0 }
  }).sort((a, b) => b.advPct - a.advPct)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border-gold p-4 w-[420px] max-w-[92vw] shadow-2xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">BREADTH BY SECTOR</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>
        <div className="space-y-2">
          {bySector.map((s) => (
            <div key={s.sector} className="flex items-center gap-2 text-2xs">
              <span className="w-24 flex-shrink-0 text-terminal-text-dim truncate">{s.abbr}</span>
              <div className="flex-1 h-2.5 bg-terminal-red/40 rounded-sm overflow-hidden flex">
                <div className="h-full bg-terminal-green" style={{ width: `${s.advPct}%` }} />
              </div>
              <span className="w-16 flex-shrink-0 text-right text-terminal-green">▲{s.adv}</span>
              <span className="w-16 flex-shrink-0 text-right text-terminal-red">▼{s.dec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Shares TopMovers'/MarketSentimentBanner's exact queryKeys — one cached
// fetch serves all three rather than issuing its own duplicate requests.
export default function MarketBreadth() {
  const [showBreakdown, setShowBreakdown] = useState(false)
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

  const bar = (
    <div
      onClick={() => setShowBreakdown(true)}
      title="Click for breadth by sector"
      className="flex-shrink-0 border-b border-terminal-border px-3 py-1.5 flex items-center gap-4 flex-wrap cursor-pointer hover:bg-terminal-surface2 transition-colors"
      style={{ minHeight: 32 }}
    >
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
      {/* The bar itself carries no labels, so the full breakdown lives in a
          hover — useful at narrow widths where the inline stats wrap away. */}
      <Tooltip
        className="flex-1 min-w-[80px]"
        content={
          `Advancing:     ${advances} stocks\n` +
          `Declining:     ${declines} stocks\n` +
          `Unchanged:     ${unchanged}\n` +
          `A/D Ratio:     ${adRatio.toFixed(2)}\n` +
          `New 52W Highs: ${newHighs}\n` +
          `New 52W Lows:  ${newLows}`
        }
      >
        <div className="flex-1 min-w-[80px] h-1.5 bg-terminal-red/40 rounded-sm overflow-hidden flex self-center">
          <div className="h-full bg-terminal-green" style={{ width: `${advPct}%` }} />
        </div>
      </Tooltip>
    </div>
  )

  return (
    <>
      {bar}
      {showBreakdown && <SectorBreakdownModal onClose={() => setShowBreakdown(false)} />}
    </>
  )
}
