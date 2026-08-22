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

// Sparkline colour is gold-for-up/red-for-down (distinct from the price
// text's green/red) — a deliberate choice for this bar specifically, to make
// the trend line pop against the card gradient without competing visually
// with the green PriceChange text right next to it.
function sparkColor(pct) {
  if (pct > 0) return '#c8a84b'
  if (pct < 0) return 'var(--color-loss)'
  return '#6b7f99'
}

// Local, time-based open/closed check per index's home exchange — the FMP
// quote's own isOpen field is always null (not available on the free/basic
// endpoint), so this is computed client-side rather than left blank.
const INDEX_EXCHANGE_HOURS = {
  '^AXJO':     { tz: 'Australia/Sydney',   open: [10, 0],  close: [16, 0]  },
  '^AORD':     { tz: 'Australia/Sydney',   open: [10, 0],  close: [16, 0]  },
  '^GSPC':     { tz: 'America/New_York',   open: [9, 30],  close: [16, 0]  },
  '^IXIC':     { tz: 'America/New_York',   open: [9, 30],  close: [16, 0]  },
  '^DJI':      { tz: 'America/New_York',   open: [9, 30],  close: [16, 0]  },
  '^FTSE':     { tz: 'Europe/London',      open: [8, 0],   close: [16, 30] },
  '^N225':     { tz: 'Asia/Tokyo',         open: [9, 0],   close: [15, 30] },
  '^HSI':      { tz: 'Asia/Hong_Kong',     open: [9, 30],  close: [16, 0]  },
  '^GDAXI':    { tz: 'Europe/Berlin',      open: [9, 0],   close: [17, 30] },
  '000001.SS': { tz: 'Asia/Shanghai',      open: [9, 30],  close: [15, 0]  },
  '^NZ50':     { tz: 'Pacific/Auckland',   open: [10, 0],  close: [16, 45] },
}
function isIndexMarketOpen(symbol) {
  const cfg = INDEX_EXCHANGE_HOURS[symbol]
  if (!cfg) return null
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: cfg.tz }))
  const d = local.getDay()
  if (d === 0 || d === 6) return false
  const mins = local.getHours() * 60 + local.getMinutes()
  return mins >= cfg.open[0] * 60 + cfg.open[1] && mins < cfg.close[0] * 60 + cfg.close[1]
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

// Plain SVG polyline sparkline — no charting library needed.
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
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
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
      <div
        className="grid grid-flow-col auto-cols-[120px] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-5 lg:grid-cols-10 gap-0 overflow-x-auto sm:overflow-visible hide-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {indices.map(({ symbol, label, isAud }, idx) => {
          const q          = quotes?.[symbol]
          const dataDate   = q?.timestamp ? fmtDataDate(q.timestamp) : null
          const isStale    = !!dataDate
          const isSelected = symbol === selectedIndex
          const isOpen     = isIndexMarketOpen(symbol)

          const sparkRaw    = sparkResults[idx]?.data
          const sparkPoints = sparkRaw
            ? transformYFHistory(sparkRaw).filter(d => d && d.price != null && !isNaN(d.price))
            : []

          return (
            <div
              key={symbol}
              onClick={() => handleClick(symbol, q, isAud, label)}
              className={`min-w-0 cursor-pointer transition-all border-r border-b sm:border-b-0 border-terminal-border ${
                isSelected ? 'bg-terminal-surface2' : 'bg-terminal-surface hover:bg-terminal-surface2'
              }`}
              style={{
                padding: '9px 12px 8px',
                borderTop: isSelected ? '2px solid #C9A84C' : '2px solid transparent',
              }}
            >
              {/* Name is the only thing allowed to ellipsis — the level and
                  change % must always render in full, per design spec. */}
              <div className="flex items-center gap-1 text-[8px] font-mono tracking-wider text-terminal-muted uppercase overflow-hidden text-ellipsis whitespace-nowrap">
                {isOpen != null && (
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-muted/30'}`}
                    title={isOpen ? 'Market open' : 'Market closed'}
                  />
                )}
                <span className="truncate">{label}</span>
              </div>

              {isFetching && !q ? (
                <div className="text-[14px] font-mono font-semibold text-terminal-muted animate-pulse mt-1">···</div>
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
                    <div className="text-[13px] font-mono font-semibold text-white leading-tight whitespace-nowrap">
                      {fmt.price(q.last, 1)}
                    </div>
                    <PriceChange pct={q.pct} size="text-[10px]" />
                    {isStale && (
                      <div className="text-[8px] text-terminal-gold/70 leading-tight">{dataDate}</div>
                    )}
                  </div>
                  <Sparkline points={sparkPoints} color={sparkColor(q?.pct)} />
                </div>
              ) : (
                <div className="text-[14px] font-mono font-semibold text-terminal-muted/40 mt-1">—</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
