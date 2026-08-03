import { useRef, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { fetchYFHistory, transformYFHistory, YF_INDICES, USING_MOCK_DATA } from '../../services/api'
import { fetchIndexQuotesUnified } from '../../services/dataService'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt } from '../../utils/format'
import { StaleBadge, DemoBadge } from '../../components/ui/ModuleStates'
import PriceChange from '../../components/ui/PriceChange'

// The benchmark indices shown in this bar, in display order. Sourced from the
// shared YF_INDICES list (also used by TickerTape/MarketSentimentBanner) — a
// local order/subset here so this bar can differ from what those show without
// forking the underlying quote data.
const BENCHMARK_ORDER = [
  '^AXJO', '^AORD', '^GSPC', '^IXIC', '^DJI', '^FTSE', '^N225', '^HSI', '^GDAXI', '000001.SS',
]

function pctColor(pct) {
  if (pct > 0) return 'var(--color-gain)'
  if (pct < 0) return 'var(--color-loss)'
  return '#6b7f99'
}

// Format a quote's data-date (YYYY-MM-DD) to a compact display — only shows
// when the quote isn't from today (e.g. a stale cache), otherwise null.
function fmtDataDate(ts) {
  if (!ts) return null
  const d = new Date(ts + 'T00:00:00')
  if (isNaN(d)) return null
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return null  // today's data — no label needed
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// Plain SVG polyline sparkline — 40x20, no charting library needed.
function Sparkline({ points, color }) {
  const w = 40, h = 20, pad = 2
  if (!points || points.length < 2) {
    return <svg width={w} height={h} aria-hidden="true" />
  }
  const prices = points.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - pad * 2) + pad
    const y = h - pad - ((p.price - min) / range) * (h - pad * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function IndicesTable({ openModal, selectedIndex, onSelectIndex }) {
  const { usdToAud } = useAudRates()
  const lastClickTime   = useRef(0)
  const lastClickSymbol = useRef(null)

  const indices = useMemo(
    () => BENCHMARK_ORDER.map(sym => YF_INDICES.find(i => i.symbol === sym)).filter(Boolean),
    []
  )

  const handleClick = (symbol, q, isAud, label) => {
    const now = Date.now()
    const isDouble = (now - lastClickTime.current) < 400 && lastClickSymbol.current === symbol
    lastClickTime.current   = now
    lastClickSymbol.current = symbol

    if (isDouble) {
      if (q) openModal?.({
        symbol: symbol.replace('^', ''),
        name:   label,
        price:  isAud ? q.last : usdToAud(q.last),
        pct:    q.pct,
        change: isAud ? q.change : usdToAud(q.change),
        type:   'index',
      })
    } else {
      onSelectIndex?.(symbol)
    }
  }

  // Shared queryKey with TickerTape/MarketSentimentBanner (same cached fetch)
  // and read passively by AIPanel via queryClient.getQueryData — all three
  // fetchers must return the same dataService-wrapped shape.
  const { data: quotesResult, isError, isFetching, refetch } = useQuery({
    queryKey:  ['yfBatch', 'indices'],
    queryFn:   () => fetchIndexQuotesUnified(indices.map(i => i.symbol)),
    staleTime: 60_000,
    retry: 1,
  })
  const quotes     = quotesResult?.data
  const isDelayed  = quotesResult?.stale === true

  // 7-day sparkline history, straight from each index's own Yahoo symbol —
  // Yahoo's chart endpoint handles ^-symbols the same as stock tickers, so no
  // stock-proxy stand-in is needed now that Stooq is out of the index flow.
  const sparkResults = useQueries({
    queries: indices.map(({ symbol }) => ({
      queryKey:  ['sparkline', symbol],
      queryFn:   () => fetchYFHistory(symbol, { range: '7d', interval: '1h' }),
      staleTime: 5 * 60_000,
      retry: 1,
    })),
  })

  return (
    <div className="bg-terminal-panel border-b border-terminal-border font-mono relative">
      {USING_MOCK_DATA ? (
        <div className="absolute top-1 right-2 z-10">
          <DemoBadge />
        </div>
      ) : isDelayed && (
        <div className="absolute top-1 right-2 z-10">
          <StaleBadge cachedAt={quotesResult?.cachedAt} />
        </div>
      )}
      <div className="flex flex-nowrap overflow-x-auto gap-0 hide-scrollbar">
        {indices.map(({ symbol, label, isAud }, idx) => {
          const q          = quotes?.[symbol]
          const dataDate   = q?.timestamp ? fmtDataDate(q.timestamp) : null
          const isStale    = !!dataDate
          const isSelected = symbol === selectedIndex
          const color      = pctColor(q?.pct)

          const sparkRaw    = sparkResults[idx]?.data
          const sparkPoints = sparkRaw
            ? transformYFHistory(sparkRaw).filter(d => d && d.price != null && !isNaN(d.price))
            : []

          return (
            <div
              key={symbol}
              onClick={() => handleClick(symbol, q, isAud, label)}
              className="flex-shrink-0 min-w-[140px] cursor-pointer hover:bg-terminal-accent/10 transition-colors border-r border-terminal-border"
              style={{
                width: 152,
                padding: '8px 12px',
                borderLeft: isSelected ? '2px solid #c8a84b' : '2px solid transparent',
              }}
            >
              {/* Name is the only thing allowed to ellipsis — the level and
                  change % must always render in full, per design spec. */}
              <div className="text-[9px] tracking-wider text-terminal-text-dim uppercase overflow-hidden text-ellipsis whitespace-nowrap">
                {label}
              </div>

              {isFetching && !q ? (
                <div className="text-[15px] font-semibold text-terminal-text-dim animate-pulse mt-1">···</div>
              ) : !q && isError ? (
                <button
                  className="text-2xs text-terminal-red hover:text-terminal-gold cursor-pointer mt-1"
                  onClick={(e) => { e.stopPropagation(); refetch() }}
                >
                  ⚠ RETRY
                </button>
              ) : q ? (
                <div className="flex items-end justify-between gap-1.5 mt-0.5">
                  <div>
                    <div className="text-[15px] font-semibold text-terminal-text leading-tight whitespace-nowrap">
                      {fmt.price(q.last, 1)}
                    </div>
                    <PriceChange pct={q.pct} size="text-[10px]" />
                    {isStale && (
                      <div className="text-[8px] text-terminal-gold/70 leading-tight">{dataDate}</div>
                    )}
                  </div>
                  <Sparkline points={sparkPoints} color={color} />
                </div>
              ) : (
                <div className="text-[15px] font-semibold text-terminal-text-dim/40 mt-1">—</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
