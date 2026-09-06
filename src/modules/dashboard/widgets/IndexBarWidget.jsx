import { useQuery } from '@tanstack/react-query'
import { fetchIndexQuotesUnified } from '../../../services/dataService'
import {WidgetBody, WidgetRows, WidgetRow} from './_shared'
import { goModule } from './navigate'

const INDICES = [
  ['^AXJO', 'ASX 200'], ['^GSPC', 'S&P 500'], ['^IXIC', 'NASDAQ'],
  ['^FTSE', 'FTSE 100'], ['^N225', 'NIKKEI 225'],
]

export default function IndexBarWidget() {
  const { data } = useQuery({
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
    </WidgetBody>
  )
}
