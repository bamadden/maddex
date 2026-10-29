import { useState } from 'react'
import { askMaddenAI } from '../../utils/askAI'
import { upcomingEarnings } from '../../services/earningsCalendar'
import { CORPORATE_ACTIONS } from '../../data/corporateActions'
import { rbaPortfolioImpact } from '../../services/smartNotifications'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import { sydneyOffset } from '../../utils/dateUtils'

// Two connections into the holdings tab:
//   UPCOMING EARNINGS — a held stock reporting (or holding its AGM, or going
//     ex-dividend) in the next three weeks, from the earnings calendar and
//     the sourced corporate-actions list, with a pre-filled MaddenAI question.
//   RBA DECISION — for three days after an RBA decision, what it means for
//     each rate-sensitive holding (the sector table in rateSensitivity).

const bare = (s) => String(s).toUpperCase().replace(/\.AX$/, '')
const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

export function PortfolioBanners({ holdings }) {
  const [now] = useState(() => Date.now())
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const until = new Date(now + 21 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

  // One position per symbol, units and cost summed across lots.
  const pos = new Map()
  for (const h of holdings) {
    if (h.type !== 'asx') continue
    const p = pos.get(h.symbol) ?? { symbol: h.symbol, name: h.name, units: 0, cost: 0 }
    p.units += h.shares; p.cost += h.shares * h.avgCost
    pos.set(h.symbol, p)
  }
  const events = [
    ...upcomingEarnings(new Date(now)).map((e) => ({ date: e.date, ticker: e.ticker, company: e.company, what: e.type === 'AGM' ? 'AGM' : 'results', sourced: !!e.source })),
    ...CORPORATE_ACTIONS.filter((a) => a.type === 'dividend').map((a) => ({ date: a.date, ticker: a.ticker, company: a.company, what: 'ex-dividend', sourced: true })),
  ].filter((e) => e.date >= today && e.date <= until && pos.has(bare(e.ticker)))
    .sort((a, b) => a.date.localeCompare(b.date))

  const rba = VERIFIED_CONSTANTS.rba
  const age = (now - Date.parse(`${rba.lastDecision}T14:30:00${sydneyOffset(rba.lastDecision)}`)) / 86_400_000
  const impact = age >= 0 && age <= 3 ? rbaPortfolioImpact(holdings) : null

  if (!events.length && !impact) return null
  return (
    <div className="flex-shrink-0 border-b border-terminal-border">
      {impact && (
        <div className="px-3 py-2 flex items-start gap-3 flex-wrap" style={{ background: 'rgba(232,163,61,0.06)' }}>
          <span className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 9 }}>
            RBA {impact.decision === 'HIKE' ? `HIKED ${impact.change ?? ''} TO` : impact.decision === 'CUT' ? `CUT ${impact.change ?? ''} TO` : 'HELD AT'} {impact.rate.toFixed(2)}% · {day(impact.date)}
          </span>
          <span className="text-2xs text-terminal-text flex-1 min-w-[240px]">
            {impact.rows.length
              ? impact.rows.slice(0, 5).map((r) => <span key={r.symbol} className="mr-3"><b>{r.symbol}</b> <span style={{ color: r.impact === 'POSITIVE' ? '#2D8A50' : '#D9773B' }}>{r.impact === 'POSITIVE' ? '+ NIM / income benefit' : '− rate pressure'}</span></span>)
              : 'None of your holdings is strongly rate-sensitive.'}
          </span>
          <button onClick={() => askMaddenAI('The RBA has just made a decision (figures in your context). Using my portfolio holdings, walk through the impact on each rate-sensitive position and what to watch next.')}
            className="text-2xs font-bold text-terminal-gold border border-terminal-gold/40 px-2 hover:bg-terminal-gold hover:text-terminal-bg">ANALYSE IMPACT ▶</button>
        </div>
      )}
      {events.length > 0 && (
        <div className="px-3 py-1.5 flex items-center gap-2 flex-wrap" style={{ background: 'rgba(201,168,76,0.04)' }}>
          <span className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 9 }}>UPCOMING</span>
          {events.slice(0, 4).map((e) => {
            const p = pos.get(bare(e.ticker))
            const prompt = `${e.company} (${e.ticker}) ${e.what === 'results' ? 'reports results' : e.what === 'AGM' ? 'holds its AGM' : 'goes ex-dividend'} on ${day(e.date)}. I hold ${p.units.toLocaleString('en-AU')} shares at an average cost of A$${(p.cost / p.units).toFixed(2)}. What should I know before then?`
            return (
              <button key={`${e.ticker}-${e.date}-${e.what}`} onClick={() => askMaddenAI(prompt)}
                title={`${e.sourced ? 'From the company\'s financial calendar' : 'Approximate date'} — click to ask MaddenAI`}
                className="text-2xs border border-terminal-gold/30 px-2 py-0.5 hover:border-terminal-gold hover:text-terminal-gold">
                <b>{bare(e.ticker)}</b> {e.what} {e.date === today ? 'today' : day(e.date)} ▶
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
