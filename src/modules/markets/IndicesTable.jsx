import { useRef, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { fetchYFBatch, fetchYFHistory, transformYFHistory, YF_INDICES } from '../../services/api'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt } from '../../utils/format'

// The benchmark indices shown in this bar, in display order. Sourced from the
// shared YF_INDICES list (also used by TickerTape/MarketSentimentBanner) — a
// local order/subset here so this bar can differ from what those show without
// forking the underlying quote data.
const BENCHMARK_ORDER = [
  '^AXJO', '^AORD', '^GSPC', '^IXIC', '^DJI', '^FTSE', '^N225', '^HSI', '^GDAXI', '^SSEC',
]

// One representative large-cap stock per index, used only to shape the
// sparkline — a rough visual proxy for the index's recent trend, never used
// for the level/change numbers (those come from the real index quote above).
// All Ords tracks the ASX 200 closely enough to reuse its proxy.
const SPARKLINE_PROXY = {
  '^AXJO':  'XRO.AX',
  '^AORD':  'XRO.AX',
  '^GSPC':  'AAPL',
  '^IXIC':  'NVDA',
  '^DJI':   'MSFT',
  '^FTSE':  'SAGE.L',
  '^N225':  '9984.T',
  '^HSI':   '0700.HK',
  '^GDAXI': 'SAP.DE',
  '^SSEC':  '688981.SS',
}

function pctColor(pct) {
  if (pct > 0) return 'var(--color-gain)'
  if (pct < 0) return 'var(--color-loss)'
  return '#6b7f99'
}

// Format stooq timestamp (YYYY-MM-DD) to a compact display
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

  const { data: quotes, isError, isFetching, refetch } = useQuery({
    queryKey:  ['yfBatch', 'indices'],
    queryFn:   () => fetchYFBatch(indices.map(i => i.symbol)),
    staleTime: 60_000,
    retry: 1,
  })

  // 7-day sparkline history — one proxy stock per index, fetched in parallel.
  const sparkResults = useQueries({
    queries: indices.map(({ symbol }) => {
      const proxySym = SPARKLINE_PROXY[symbol]
      return {
        queryKey:  ['sparkline', symbol, proxySym],
        queryFn:   () => fetchYFHistory(proxySym, { range: '5d' }),
        enabled:   !!proxySym,
        staleTime: 5 * 60_000,
        retry: 1,
      }
    }),
  })

  return (
    <div className="bg-terminal-panel border-b border-terminal-border font-mono">
      <div className="flex overflow-x-auto hide-scrollbar">
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
              className="flex-shrink-0 cursor-pointer hover:bg-terminal-accent/10 transition-colors border-r border-terminal-border"
              style={{
                width: 140,
                padding: '8px 12px',
                borderLeft: isSelected ? '2px solid #c8a84b' : '2px solid transparent',
              }}
            >
              <div className="text-[9px] tracking-wider text-terminal-text-dim uppercase truncate">
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
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-terminal-text leading-tight truncate">
                      {fmt.price(q.last, 1)}
                    </div>
                    <div className="text-[10px] font-semibold leading-tight" style={{ color }}>
                      {q.pct >= 0 ? '▲' : '▼'} {q.pct >= 0 ? '+' : ''}{q.pct.toFixed(2)}%
                    </div>
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
