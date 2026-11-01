import { useStore } from '../../../store/useStore'
import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../../services/dataService'
import { USING_MOCK_DATA, EQUITY_SOURCE } from '../../../services/api'
import { useAudRates } from '../../../hooks/useAudRates'
import { WidgetBody, WidgetRows, WidgetRow, WidgetEmpty, WidgetSource } from './_shared'
import { goModule } from './navigate'

export default function WatchlistPreviewWidget() {
  const { watchlist } = useStore()
  const { usdToAud } = useAudRates()
  const symbols = (watchlist ?? []).map((w) => w.symbol ?? w).slice(0, 6)
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['dashWatchlist', symbols],
    queryFn: () => fetchEquityQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  if (!symbols.length) {
    return <WidgetEmpty action="OPEN WATCHLIST" onAction={() => goModule('watchlist')}>Watchlist is empty</WidgetEmpty>
  }

  const rows = data?.data ?? {}
  return (
    <WidgetBody>
      <WidgetRows>
        {symbols.map((s) => {
          const q = rows[s]
          // Quotes arrive in their listing currency. US names used to show
          // their USD price with an A$ prefix — AAPL at "A$307" here and
          // A$439 on the Watchlist module.
          const aud = q?.last == null ? null : q.currency === 'USD' ? usdToAud(q.last) : q.last
          return (
            <WidgetRow
              key={s}
              label={String(s).replace('.AX', '')}
              value={aud != null ? `A$${aud.toFixed(2)}` : '—'}
              change={q?.pct ?? null}
              onClick={() => goModule('watchlist')}
            />
          )
        })}
      </WidgetRows>
      <WidgetSource result={data} demo={USING_MOCK_DATA} source={EQUITY_SOURCE} fetchedAt={dataUpdatedAt} />
    </WidgetBody>
  )
}
