import { useMemo, useState } from 'react'
import { buildSchedule } from '../../../services/dividendSchedule'
import { getMockFMPRow } from '../../../services/mockData'
import { WidgetBody, WidgetEmpty } from './_shared'
import { goModule } from './navigate'

// When the portfolio's income arrives — the same schedule the Portfolio
// Analytics tab builds (services/dividendSchedule), valued at the demo prices
// the rest of the terminal uses. ASX holdings only: the schedule's payment
// months and franking are an ASX table.
export default function DividendScheduleWidget() {
  const [holdings] = useState(() => { try { return JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]') } catch { return [] } })
  const sched = useMemo(() => {
    const priced = holdings.filter((h) => h.type === 'asx').map((h) => {
      const q = getMockFMPRow(h.yfSym ?? `${h.symbol}.AX`)
      const price = q?.regularMarketPrice
      return price ? { ...h, price, qty: h.shares, mktVal: price * h.shares } : null
    }).filter(Boolean)
    return priced.length ? buildSchedule(priced) : null
  }, [holdings])

  if (!sched || !sched.rows.length) {
    return <WidgetEmpty action="ADD HOLDINGS" onAction={() => goModule('portfolio')}>No dividend-paying ASX holdings</WidgetEmpty>
  }
  const months = sched.calendar.slice(0, 6)
  const max = Math.max(...months.map((m) => m.total), 1)
  const money = (v) => `A$${Math.round(v).toLocaleString('en-AU')}`
  return (
    <WidgetBody>
      <div className="flex items-baseline justify-between gap-2 flex-shrink-0 font-mono">
        <span className="tabular-nums" style={{ fontSize: 18, color: '#E8EDF5' }}>{money(sched.totalAnnual)}<span style={{ fontSize: 9, color: '#4A6080' }}> /yr</span></span>
        <span style={{ fontSize: 9, color: '#C9A84C' }}>+{money(sched.totalCredits)} franking</span>
      </div>
      <div className="flex-1 min-h-0 flex items-end gap-1.5 mt-2">
        {months.map((m) => (
          <button key={m.month} onClick={() => goModule('portfolio')} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${m.label}: ${money(m.total)}${m.payers.length ? ` — ${m.payers.map((p) => p.symbol).join(', ')}` : ''}`}>
            <div className="w-full rounded-sm" style={{ height: `${Math.max(4, (m.total / max) * 100)}%`, background: m.total ? '#C9A84C' : 'rgba(74,96,128,0.25)' }} />
            <span className="font-mono mt-1" style={{ fontSize: 8, color: '#4A6080' }}>{m.label}</span>
          </button>
        ))}
      </div>
      <span className="font-mono text-[8px] flex-shrink-0 mt-1" style={{ color: '#4A6080' }}>
        {sched.next ? `Next: ${sched.next.label} · ` : ''}estimated from demo yields
      </span>
    </WidgetBody>
  )
}
