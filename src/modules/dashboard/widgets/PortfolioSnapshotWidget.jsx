import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../../services/dataService'
import { requireYFSym } from '../../../utils/tickerGuard'
import { useAudRates } from '../../../hooks/useAudRates'
import {WidgetBody, WidgetFigure, WidgetEmpty, WidgetRows, WidgetRow} from './_shared'
import { goModule } from './navigate'

const PORTFOLIO_KEY = 'madden_portfolio_v2'

export default function PortfolioSnapshotWidget() {
  const [holdings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]') } catch { return [] }
  })
  // Equities only. PortfolioModule prices crypto through the Crypto module,
  // not this quote path, and its own totals count "5/5" for six positions.
  //
  // Including BTC here did not just add a row — its quote comes back already
  // in AUD, so the usdToAud applied to every non-ASX holding converted it a
  // second time and inflated half a bitcoin by about A$88,500. The dashboard
  // read A$136,103 against the portfolio page's A$47,543 for the same
  // holdings, and both looked like plausible totals.
  const priceable = useMemo(() => holdings.filter((h) => h.type === 'asx' || h.type === 'us'), [holdings])
  // yfSym, not symbol. This passed the bare ticker — 'BHP' rather than
  // 'BHP.AX' — and the quote API answered with a DIFFERENT SECURITY: BHP's
  // US-listed ADR at US$299 in place of BHP.AX at A$68. The holding is typed
  // 'asx', so no conversion was applied either. Three of five positions were
  // priced off the wrong listing and the total still looked like a portfolio.
  // requireYFSym rather than `h.yfSym ?? h.symbol` — the `?? h.symbol` half is
  // exactly the bug above, written as a fallback.
  const symbols = useMemo(
    () => priceable.map(requireYFSym).filter(Boolean),
    [priceable],
  )
  const { data } = useQuery({
    queryKey: ['dashPortfolio', symbols],
    queryFn: () => fetchEquityQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  const { usdToAud } = useAudRates()

  // Mirrors PortfolioModule's own calculation deliberately, field for field.
  //
  // Two things it got wrong before and both produced a plausible number
  // rather than an error, which is why the dashboard and the portfolio page
  // disagreed by tens of thousands of dollars:
  //
  //   1. US quotes come back in USD and need converting; ASX ones do not.
  //   2. A holding with no quote has no market value. Falling back to its
  //      cost as if it were the price counts an unpriced position at book —
  //      which for a crypto holding at A$90,000 average was most of the gap.
  //
  // Unpriced holdings are excluded from both sides of the P&L, so the ratio
  // stays honest even when some positions have not loaded.
  const stats = useMemo(() => {
    if (!priceable.length) return null
    const rows = data?.data ?? {}
    let value = 0, cost = 0, priced = 0, best = null, worst = null

    for (const h of priceable) {
      const q = rows[requireYFSym(h)]
      const isAsx = h.type === 'asx'
      const last = q?.last == null ? null : (isAsx ? q.last : usdToAud(q.last))
      if (last == null) continue

      const avgCostAud = h.costCurrency === 'USD' ? usdToAud(h.avgCost) : h.avgCost
      value += last * h.shares
      cost += avgCostAud * h.shares
      priced += 1

      const pct = q?.pct
      if (pct != null) {
        if (!best || pct > best.pct) best = { sym: h.symbol, pct }
        if (!worst || pct < worst.pct) worst = { sym: h.symbol, pct }
      }
    }

    if (!priced) return null
    return { value, pnl: value - cost, pnlPct: cost ? ((value - cost) / cost) * 100 : 0, best, worst, priced }
  }, [priceable, data, usdToAud])

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
