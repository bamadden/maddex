import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toAUD, ASX_STOCKS, US_STOCKS, USING_MOCK_DATA } from '../../services/api'
import { fetchEquityQuotes } from '../../services/dataService'
import { fmt, formatMarketCap } from '../../utils/format'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { StaleBadge, DemoBadge } from '../../components/ui/ModuleStates'
import { SkeletonCard } from '../../components/ui/Skeleton'
import PriceChange from '../../components/ui/PriceChange'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { useLivePrice } from '../../hooks/useLivePrice'

// Live-ticking price + change cells for one mover row (ASX symbols only —
// their mock quote is already AUD-native, unlike US symbols which need the
// same toAUD conversion the rest of this table applies).
function LivePriceCells({ symbol, audPrice, dayChangePct }) {
  const isAsx = symbol.endsWith('.AX')
  const { quote, flash } = useLivePrice(isAsx ? symbol : null)
  const livePrice = isAsx && quote ? quote.regularMarketPrice : audPrice
  const livePct = isAsx && quote ? quote.regularMarketChangePercent : dayChangePct
  const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''
  return (
    <>
      <td className={`px-1.5 py-0.5 text-2xs text-right ${flashClass}`} style={{ width: 80, minWidth: 80 }}>
        {livePrice != null ? fmt.price(livePrice) : '—'}
      </td>
      <td className="px-1.5 py-0.5 text-right" style={{ width: 70, minWidth: 70 }}>
        <PriceChange pct={livePct} className="justify-end" />
      </td>
    </>
  )
}

function displaySym(yahoo) {
  return yahoo.replace(/\.AX$/, '')
}

function totalTrackedMktCap(quotes, audUsd) {
  if (!quotes) return null
  let total = 0
  for (const q of Object.values(quotes)) {
    if (!q?.marketCap) continue
    total += q.currency === 'USD' ? q.marketCap * (audUsd ?? 1.55) : q.marketCap
  }
  return total > 0 ? total : null
}

// Fixed widths so header cells line up exactly with the data below them —
// only NAME is flexible, everything else is a known-width number/ticker.
const COLUMNS = [
  { key: 'rank',       label: '#',        align: 'right', cell: 'always', width: 24, sortable: false },
  { key: 'symbol',     label: 'TICKER',   align: 'left',  cell: 'always', width: 60 },
  { key: 'name',       label: 'NAME',     align: 'left',  cell: 'lg' },
  { key: 'price',      label: 'A$ PRICE', align: 'right', cell: 'always', width: 80 },
  { key: 'dayChangePct', label: 'CHG%',   align: 'right', cell: 'always', width: 70 },
  { key: 'marketCap',  label: 'MKT CAP',  align: 'right', cell: 'lg', width: 80 },
  { key: 'trailingPE', label: 'P/E',      align: 'right', cell: 'xl', width: 50 },
  { key: 'vol',        label: 'VOLUME',   align: 'right', cell: 'xl', width: 70 },
]

function SortableTable({ items, audUsd, onRowClick }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const rows = items.map(q => ({
    q,
    audPrice:  toAUD(q.price, q.currency, audUsd),
    audMktCap: q.marketCap != null ? toAUD(q.marketCap, q.currency, audUsd) : null,
  }))

  const sortValue = (row, key) => {
    if (key === 'symbol') return displaySym(row.q.symbol)
    if (key === 'name') return row.q.name ?? ''
    if (key === 'price') return row.audPrice
    if (key === 'marketCap') return row.audMktCap
    if (key === 'trailingPE') return row.q.trailingPE
    if (key === 'vol') return row.q.vol
    return row.q.dayChangePct
  }

  const sorted = sortKey ? [...rows].sort((a, b) => {
    const av = sortValue(a, sortKey), bv = sortValue(b, sortKey)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortDir === 'asc' ? cmp : -cmp
  }) : rows

  return (
    <table className="terminal-table w-full">
      <thead>
        <tr>
          {COLUMNS.map(col => (
            <th
              key={col.key}
              onClick={() => col.sortable !== false && toggleSort(col.key)}
              style={col.width ? { width: col.width, minWidth: col.width } : undefined}
              className={`px-1.5 transition-colors select-none whitespace-nowrap ${col.sortable === false ? '' : 'cursor-pointer hover:text-terminal-gold'} ${
                col.align === 'left' ? 'text-left' : 'text-right'
              } ${col.cell === 'lg' ? 'hidden lg:table-cell' : col.cell === 'xl' ? 'hidden xl:table-cell' : ''}`}
            >
              {col.label}
              {sortKey === col.key && <span className="text-terminal-gold ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(({ q, audPrice, audMktCap }, i) => (
          <tr key={q.symbol}
            className="cursor-pointer hover:bg-terminal-accent/20 transition-colors row-fade-up"
            style={{ animationDelay: `${i * 35}ms` }}
            onClick={() => onRowClick(q)}>
            <td className="px-1.5 py-0.5 text-2xs text-right text-terminal-text-dim" style={{ width: 24, minWidth: 24 }}>{i + 1}</td>
            <td className="px-1.5 py-0.5 text-xs font-bold text-terminal-gold" style={{ width: 60, minWidth: 60 }}>{displaySym(q.symbol)}</td>
            <td className="px-1.5 py-0.5 text-2xs text-terminal-text-dim truncate max-w-[140px] hidden lg:table-cell">{q.name ?? '—'}</td>
            <LivePriceCells symbol={q.symbol} audPrice={audPrice} dayChangePct={q.dayChangePct} />
            <td className="px-1.5 py-0.5 text-2xs text-right text-terminal-text-dim hidden lg:table-cell" style={{ width: 80, minWidth: 80 }}>
              {formatMarketCap(audMktCap)}
            </td>
            <td className="px-1.5 py-0.5 text-2xs text-right text-terminal-text-dim hidden xl:table-cell" style={{ width: 50, minWidth: 50 }}>
              {q.trailingPE != null ? q.trailingPE.toFixed(1) : '—'}
            </td>
            <td className="px-1.5 py-0.5 text-2xs text-right text-terminal-text-dim hidden xl:table-cell" style={{ width: 70, minWidth: 70 }}>
              {q.vol != null ? fmt.large(q.vol) : '—'}
            </td>
          </tr>
        ))}
        {sorted.length === 0 && (
          <tr><td colSpan={COLUMNS.length} className="px-2 py-2 text-2xs text-terminal-text-dim">No data</td></tr>
        )}
      </tbody>
    </table>
  )
}

function MoverTable({ quotes, label, isLoading, isError, refetch, audUsd }) {
  const { openModal } = useStore()

  if (isLoading) return (
    <div className="p-2 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} rows={1} className="p-2" />)}
    </div>
  )
  if (isError || !quotes) return (
    <DataUnavailable label={`${label} UNAVAILABLE`} onRetry={refetch} />
  )

  const sorted  = Object.values(quotes)
    .filter(q => q && !isNaN(q.dayChangePct))
    .sort((a, b) => b.dayChangePct - a.dayChangePct)
  const gainers = sorted.filter(q => q.dayChangePct >= 0).slice(0, 5)
  const losers  = sorted.filter(q => q.dayChangePct  < 0).slice(-5).reverse()

  const handleClick = (q) => {
    const isAsx = q.symbol.endsWith('.AX')
    openModal({
      symbol: q.symbol,
      name:   q.name ?? displaySym(q.symbol),
      price:  toAUD(q.price, q.currency, audUsd),
      pct:    q.dayChangePct,
      change: toAUD(q.dayChange, q.currency, audUsd),
      type:   isAsx ? 'asx' : 'us',
      extra:  {
        week52High:  toAUD(q.week52High, q.currency, audUsd),
        week52Low:   toAUD(q.week52Low,  q.currency, audUsd),
        isOpen:      q.isOpen,
        exchange:    q.exchange,
        nativePrice: isAsx ? null : q.price,
        currency:    q.currency,
        marketCap:   q.marketCap != null ? toAUD(q.marketCap, q.currency, audUsd) : null,
      },
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-terminal-border">
      <div>
        <div className="px-2 py-1 text-2xs font-bold border-b border-terminal-border/50" style={{ color: 'var(--color-gain)', backgroundColor: 'var(--color-gain-bg)' }}>
          ▲ GAINERS
        </div>
        <div className="overflow-x-auto"><SortableTable items={gainers} audUsd={audUsd} onRowClick={handleClick} /></div>
      </div>
      <div>
        <div className="px-2 py-1 text-2xs font-bold border-b border-terminal-border/50" style={{ color: 'var(--color-loss)', backgroundColor: 'var(--color-loss-bg)' }}>
          ▼ LOSERS
        </div>
        <div className="overflow-x-auto"><SortableTable items={losers} audUsd={audUsd} onRowClick={handleClick} /></div>
      </div>
    </div>
  )
}

export default function TopMovers() {
  const { audUsd } = useAudRates()
  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const { data: asxResult, isError: asxError, isFetching: asxFetching, refetch: refetchASX } = useQuery({
    queryKey:  ['yahooMoversBatch', 'asx'],
    queryFn:   () => fetchEquityQuotes(ASX_STOCKS),
    staleTime: 60_000,
    retry: 1,
  })
  const asxQuotes  = asxResult?.data
  const asxDelayed = asxResult?.stale === true

  const { data: usResult, isError: usError, isFetching: usFetching, refetch: refetchUS } = useQuery({
    queryKey:  ['yahooMoversBatch', 'us'],
    queryFn:   () => fetchEquityQuotes(US_STOCKS),
    staleTime: 60_000,
    retry: 1,
  })
  const usQuotes  = usResult?.data
  const usDelayed = usResult?.stale === true

  const asxTrackedCap = totalTrackedMktCap(asxQuotes, audUsd)
  const usTrackedCap  = totalTrackedMktCap(usQuotes, audUsd)

  return (
    <div className="grid grid-cols-2 border-b border-terminal-border">
      <div className="border-r border-terminal-border">
        <div className="panel-header flex items-center gap-2">
          <span className="text-terminal-gold">ASX LEADERS</span>
          {asxFetching && <span className="text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>}
          {asxQuotes && !asxFetching && USING_MOCK_DATA && <DemoBadge />}
          {asxQuotes && !asxFetching && !USING_MOCK_DATA && asxDelayed && <StaleBadge cachedAt={asxResult?.cachedAt} />}
          {asxQuotes && !asxFetching && !USING_MOCK_DATA && !asxDelayed && <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE</span>}
          {asxError && !asxFetching && <span className="text-terminal-red text-2xs font-normal">⚠ ERROR</span>}
          <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case">
            {asxTrackedCap ? `${formatMarketCap(asxTrackedCap)} tracked · ` : ''}{updatedTime} · {ASX_STOCKS.length} stocks
          </span>
        </div>
        <MoverTable quotes={asxQuotes} label="ASX" isLoading={asxFetching && !asxQuotes}
          isError={asxError} refetch={refetchASX} audUsd={audUsd} />
      </div>
      <div>
        <div className="panel-header flex items-center gap-2">
          <span className="text-terminal-blue-bright">US LEADERS</span>
          {usFetching && <span className="text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>}
          {usQuotes && !usFetching && USING_MOCK_DATA && <DemoBadge />}
          {usQuotes && !usFetching && !USING_MOCK_DATA && usDelayed && <StaleBadge cachedAt={usResult?.cachedAt} />}
          {usQuotes && !usFetching && !USING_MOCK_DATA && !usDelayed && <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE</span>}
          {usError && !usFetching && <span className="text-terminal-red text-2xs font-normal">⚠ ERROR</span>}
          <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case">
            {usTrackedCap ? `${formatMarketCap(usTrackedCap)} tracked · ` : ''}{updatedTime} · {US_STOCKS.length} stocks
          </span>
        </div>
        <MoverTable quotes={usQuotes} label="US" isLoading={usFetching && !usQuotes}
          isError={usError} refetch={refetchUS} audUsd={audUsd} />
      </div>
    </div>
  )
}
