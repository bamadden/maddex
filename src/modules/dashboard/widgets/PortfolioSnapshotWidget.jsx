import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../../services/dataService'
import { requireYFSym } from '../../../utils/tickerGuard'
import { useAudRates } from '../../../hooks/useAudRates'
import { recordPortfolioValue, getPortfolioHistory, marketDayKey } from '../../../services/portfolioHistory'
import { WidgetBody, WidgetEmpty, Sparkline, ChangePill } from './_shared'
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
    let value = 0, cost = 0, dayPnl = 0, dayBase = 0, priced = 0, best = null, worst = null

    for (const h of priceable) {
      const q = rows[requireYFSym(h)]
      const isAsx = h.type === 'asx'
      const conv = (v) => (v == null ? null : (isAsx ? v : usdToAud(v)))
      const last = conv(q?.last)
      if (last == null) continue

      const avgCostAud = h.costCurrency === 'USD' ? usdToAud(h.avgCost) : h.avgCost
      value += last * h.shares
      cost += avgCostAud * h.shares
      priced += 1

      // The day's move, in dollars, from the previous close — a different
      // question from total P&L and the one a reader checks most mornings.
      // Only holdings whose quote carries a previous close contribute, to
      // both the numerator and the base, so the percentage stays honest when
      // some positions lack one.
      const prev = conv(q?.prevClose)
      if (prev != null) {
        dayPnl += (last - prev) * h.shares
        dayBase += prev * h.shares
      }

      const pct = q?.pct
      if (pct != null) {
        if (!best || pct > best.pct) best = { sym: h.symbol, pct }
        if (!worst || pct < worst.pct) worst = { sym: h.symbol, pct }
      }
    }

    if (!priced) return null
    return {
      value,
      pnl: value - cost,
      pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
      dayPnl: dayBase ? dayPnl : null,
      dayPct: dayBase ? (dayPnl / dayBase) * 100 : null,
      best,
      worst,
      priced,
    }
  }, [priceable, data, usdToAud])

  const value = stats?.value ?? null

  // Recording is a side effect of having priced the portfolio, so it belongs
  // in an effect rather than in the memo above — a memo that writes to storage
  // runs during render and would fire again on any unrelated re-render that
  // invalidated it.
  useEffect(() => {
    if (value == null) return
    recordPortfolioValue(value)
  }, [value])

  // The series is derived rather than held in state, so it does not have to be
  // re-read after the effect above writes. Today's stored point is dropped and
  // replaced with the live value: they are the same number by the time the
  // effect runs, but deriving it means the sparkline never lags a render
  // behind the figure printed beside it.
  const series = useMemo(() => {
    const today = marketDayKey()
    const past = getPortfolioHistory(7).filter((h) => h.day !== today).map((h) => h.value)
    return value != null ? [...past, Math.round(value)] : past
  }, [value])

  if (!stats) {
    return <WidgetEmpty action="ADD HOLDINGS" onAction={() => goModule('portfolio')}>No holdings yet</WidgetEmpty>
  }

  const up = stats.pnl >= 0

  return (
    <WidgetBody>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="font-mono tabular-nums truncate" style={{ fontSize: 22, lineHeight: 1.15, color: '#E8EDF5' }}>
            A${Math.round(stats.value).toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <ChangePill value={stats.dayPct} suffix="%" />
            <span className="font-mono text-[8px]" style={{ color: '#4A6080', letterSpacing: '0.08em' }}>
              {stats.dayPnl == null
                ? 'TODAY UNAVAILABLE'
                : `TODAY ${stats.dayPnl >= 0 ? '+' : '−'}A$${Math.abs(Math.round(stats.dayPnl)).toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {series.length >= 2
            ? <Sparkline values={series} tone={up ? '#2D8A50' : '#A83232'} />
            : (
              // Not a placeholder shape — saying "collecting" is the honest
              // answer on day one, and a flat line would not be.
              <span className="font-mono text-[8px]" style={{ color: '#3A4E68' }}>
                {series.length === 1 ? '7D · 1 day so far' : '7D · collecting'}
              </span>
            )}
          {series.length >= 2 && (
            <span className="font-mono text-[8px]" style={{ color: '#3A4E68' }}>{series.length}D OBSERVED</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px]" style={{ color: '#4A6080' }}>TOTAL P&L</span>
          <span className="font-mono text-[10px] tabular-nums" style={{ color: up ? '#2D8A50' : '#A83232' }}>
            {up ? '+' : '−'}A${Math.abs(Math.round(stats.pnl)).toLocaleString()} ({stats.pnlPct.toFixed(2)}%)
          </span>
        </div>
        {stats.best && (
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] truncate" style={{ color: '#4A6080' }}>BEST · {stats.best.sym}</span>
            <ChangePill value={stats.best.pct} suffix="%" />
          </div>
        )}
        {stats.worst && stats.worst.sym !== stats.best?.sym && (
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] truncate" style={{ color: '#4A6080' }}>WORST · {stats.worst.sym}</span>
            <ChangePill value={stats.worst.pct} suffix="%" />
          </div>
        )}
      </div>
    </WidgetBody>
  )
}
