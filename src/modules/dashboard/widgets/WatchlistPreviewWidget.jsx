import { useStore } from '../../../store/useStore'
import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../../services/dataService'
import {WidgetBody, WidgetRows, WidgetRow, WidgetEmpty} from './_shared'
import { goModule } from './navigate'

export default function WatchlistPreviewWidget() {
  const { watchlist } = useStore()
  const symbols = (watchlist ?? []).map((w) => w.symbol ?? w).slice(0, 6)
  const { data } = useQuery({
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
          return (
            <WidgetRow
              key={s}
              label={String(s).replace('.AX', '')}
              value={q?.last != null ? `A$${q.last.toFixed(2)}` : '—'}
              change={q?.pct ?? null}
              onClick={() => goModule('watchlist')}
            />
          )
        })}
      </WidgetRows>
    </WidgetBody>
  )
}
