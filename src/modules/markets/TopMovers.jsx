import { useQuery } from '@tanstack/react-query'
import { toAUD, ASX_STOCKS, US_STOCKS } from '../../services/api'
import { fetchEquityQuotes } from '../../services/dataService'
import { fmt, formatMarketCap } from '../../utils/format'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { StaleBadge } from '../../components/ui/ModuleStates'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'

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

function MoverTable({ quotes, label, isLoading, isError, refetch, audUsd }) {
  const { openModal } = useStore()

  if (isLoading) return (
    <div className="p-3 text-2xs text-terminal-text-dim animate-pulse">LOADING {label} DATA...</div>
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
      name:   displaySym(q.symbol),
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

  const renderTable = (items, pctColor) => (
    <table className="terminal-table w-full">
      <thead>
        <tr>
          <th className="px-2 text-left">TICKER</th>
          <th className="px-1 text-right">A$ PRICE</th>
          <th className="px-1 text-right">CHG%</th>
          <th className="px-1 text-right hidden lg:table-cell">MKT CAP</th>
        </tr>
      </thead>
      <tbody>
        {items.map((q) => {
          const audPrice  = toAUD(q.price, q.currency, audUsd)
          const audMktCap = q.marketCap != null ? toAUD(q.marketCap, q.currency, audUsd) : null
          return (
            <tr key={q.symbol}
              className="cursor-pointer hover:bg-terminal-accent/20 transition-colors"
              onClick={() => handleClick(q)}>
              <td className="px-2 py-0.5 text-xs font-bold text-terminal-text-bright">{displaySym(q.symbol)}</td>
              <td className="px-1 py-0.5 text-2xs text-right">
                {audPrice != null ? fmt.price(audPrice) : '—'}
              </td>
              <td className="px-1 py-0.5 text-2xs text-right font-semibold" style={{ color: pctColor }}>
                {q.dayChangePct >= 0 ? '+' : ''}{q.dayChangePct.toFixed(2)}%
              </td>
              <td className="px-1 py-0.5 text-2xs text-right text-terminal-text-dim hidden lg:table-cell">
                {formatMarketCap(audMktCap)}
              </td>
            </tr>
          )
        })}
        {items.length === 0 && (
          <tr><td colSpan={4} className="px-2 py-2 text-2xs text-terminal-text-dim">No data</td></tr>
        )}
      </tbody>
    </table>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-terminal-border">
      <div>
        <div className="px-2 py-1 text-2xs font-bold border-b border-terminal-border/50" style={{ color: 'var(--color-gain)' }}>
          ▲ GAINERS
        </div>
        <div className="overflow-x-auto">{renderTable(gainers, 'var(--color-gain)')}</div>
      </div>
      <div>
        <div className="px-2 py-1 text-2xs font-bold border-b border-terminal-border/50" style={{ color: 'var(--color-loss)' }}>
          ▼ LOSERS
        </div>
        <div className="overflow-x-auto">{renderTable(losers, 'var(--color-loss)')}</div>
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
          {asxQuotes && !asxFetching && asxDelayed && <StaleBadge cachedAt={asxResult?.cachedAt} />}
          {asxQuotes && !asxFetching && !asxDelayed && <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE</span>}
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
          {usQuotes && !usFetching && usDelayed && <StaleBadge cachedAt={usResult?.cachedAt} />}
          {usQuotes && !usFetching && !usDelayed && <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE</span>}
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
