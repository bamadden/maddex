import { upcomingEarnings, daysUntil } from '../../services/earningsCalendar'

export default function EarningsCalendar() {
  const earnings = upcomingEarnings().slice(0, 10)
  if (!earnings.length) return null

  const timelineDates = [...new Set(earnings.map((e) => e.date))].slice(0, 6)

  return (
    <div className="flex-shrink-0 border-b border-terminal-border">
      <div className="panel-header">EARNINGS · UPCOMING ASX REPORTING</div>

      {/* Horizontal timeline of the next reporting dates */}
      <div className="px-3 py-2 border-b border-terminal-border/50 overflow-x-auto">
        <div className="flex items-start gap-0 min-w-max">
          {timelineDates.map((date, i) => {
            const dayEarnings = earnings.filter((e) => e.date === date)
            const d = new Date(`${date}T00:00:00`)
            const label = d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
            return (
              <div key={date} className="flex items-center">
                {i > 0 && <div className="w-10 h-px bg-terminal-border/60 mx-1 mt-2.5" />}
                <div className="flex flex-col items-center gap-1 min-w-[90px]">
                  <span className="text-2xs text-terminal-gold font-bold">[{label}]</span>
                  <span className="w-2 h-2 rounded-full bg-terminal-gold" />
                  <span className="text-2xs text-terminal-text-bright font-semibold text-center">
                    {dayEarnings.map((e) => e.ticker.replace('.AX', '')).join(', ')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-52">
        <table className="w-full text-2xs">
          <thead className="sticky top-0 bg-terminal-header">
            <tr className="text-terminal-text-dim">
              <th className="text-left px-3 py-1.5">DATE</th>
              <th className="text-left px-3 py-1.5">COMPANY</th>
              <th className="text-left px-3 py-1.5">TICKER</th>
              <th className="text-left px-3 py-1.5">TYPE</th>
              <th className="text-right px-3 py-1.5">EPS EST</th>
              <th className="text-right px-3 py-1.5">REV EST</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((e) => {
              const d = daysUntil(e.date)
              return (
                <tr key={e.ticker + e.date} className="border-t border-terminal-border/40">
                  <td className="px-3 py-1 text-terminal-text-bright">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    <span className="text-terminal-text-dim ml-1">({d}d)</span>
                  </td>
                  <td className="px-3 py-1 text-terminal-text">{e.company}</td>
                  <td className="px-3 py-1 font-bold text-terminal-gold">{e.ticker}</td>
                  <td className="px-3 py-1 text-terminal-text-dim">{e.type}</td>
                  <td className="px-3 py-1 text-right">{e.epsEst != null ? `A$${e.epsEst.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-1 text-right">{e.revEst != null ? `A$${e.revEst.toLocaleString()}M` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
