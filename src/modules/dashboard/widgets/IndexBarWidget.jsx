import { useQuery } from '@tanstack/react-query'
import { fetchIndexQuotesUnified } from '../../../services/dataService'
import { USING_MOCK_DATA, EQUITY_SOURCE } from '../../../services/api'
import { WidgetBody, WidgetRows, WidgetRow, WidgetSource } from './_shared'
import { goModule } from './navigate'

// The Asian session first after the ASX and Wall St — it is what an
// Australian investor reads next. Ten rows fill a standard tile; five left
// half of it blank.
const INDICES = [
  ['^AXJO', 'ASX 200'], ['^AORD', 'ALL ORDS'], ['^GSPC', 'S&P 500'], ['^IXIC', 'NASDAQ'],
  ['^DJI', 'DOW JONES'], ['^N225', 'NIKKEI 225'], ['^HSI', 'HANG SENG'], ['000001.SS', 'SHANGHAI'],
  ['^FTSE', 'FTSE 100'], ['^GDAXI', 'DAX'],
]

export default function IndexBarWidget() {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['yfBatch', 'indices'],
    queryFn: () => fetchIndexQuotesUnified(INDICES.map(([s]) => s)),
    staleTime: 60_000,
    retry: 1,
  })
  const rows = data?.data ?? {}

  return (
    <WidgetBody>
      <WidgetRows>
        {INDICES.map(([sym, label]) => {
          const q = rows[sym]
          return (
            <WidgetRow
              key={sym}
              label={label}
              value={q?.last != null ? q.last.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
              change={q?.pct ?? null}
              onClick={() => goModule('markets')}
            />
          )
        })}
      </WidgetRows>
      <WidgetSource result={data} demo={USING_MOCK_DATA} source={EQUITY_SOURCE} fetchedAt={dataUpdatedAt} />
    </WidgetBody>
  )
}
