import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../../services/dataService'
import {WidgetBody, WidgetFigure, WidgetEmpty, WidgetRows, WidgetRow} from './_shared'
import { goModule } from './navigate'

const PORTFOLIO_KEY = 'madden_portfolio_v2'

export default function PortfolioSnapshotWidget() {
  const [holdings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]') } catch { return [] }
  })
  const symbols = useMemo(() => holdings.map((h) => h.symbol).filter(Boolean), [holdings])
  const { data } = useQuery({
    queryKey: ['dashPortfolio', symbols],
    queryFn: () => fetchEquityQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  const stats = useMemo(() => {
    if (!holdings.length) return null
    const rows = data?.data ?? {}
    let value = 0, cost = 0, best = null, worst = null
    for (const h of holdings) {
      const q = rows[h.symbol]
      const price = q?.last ?? h.avgPrice ?? 0
      value += price * (h.units ?? 0)
      cost += (h.avgPrice ?? 0) * (h.units ?? 0)
      const pct = q?.pct
      if (pct != null) {
        if (!best || pct > best.pct) best = { sym: h.symbol, pct }
        if (!worst || pct < worst.pct) worst = { sym: h.symbol, pct }
      }
    }
    return { value, pnl: value - cost, pnlPct: cost ? ((value - cost) / cost) * 100 : 0, best, worst }
  }, [holdings, data])

  if (!stats) {
    return <WidgetEmpty action="ADD HOLDINGS" onAction={() => goModule('portfolio')}>No holdings yet</WidgetEmpty>
  }

  const up = stats.pnl >= 0
  return (
    <WidgetBody>
      <WidgetFigure
        value={`A$${Math.round(stats.value).toLocaleString()}`}
        sub={`${up ? '▲' : '▼'} A$${Math.abs(Math.round(stats.pnl)).toLocaleString()} (${stats.pnlPct.toFixed(2)}%)`}
        tone={up ? '#2D8A50' : '#A83232'}
      />
      <WidgetRows>
        {stats.best && <WidgetRow label={`BEST · ${stats.best.sym}`} value="" change={stats.best.pct} />}
        {stats.worst && <WidgetRow label={`WORST · ${stats.worst.sym}`} value="" change={stats.worst.pct} />}
      </WidgetRows>
    </WidgetBody>
  )
}
