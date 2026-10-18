import { useState } from 'react'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import { askMaddenAI } from '../../utils/askAI'

// The highlighted card at the top of Rates after an RBA decision. Built from
// VERIFIED_CONSTANTS.rba, so the next decision rewrites it with no edit here.
//
// Shown for 14 days after the decision — or after the minutes, which arrive
// two weeks later and are the RBA's next word on the same decision. Dismissing
// acknowledges that decision only (stored by its date), so the next one shows.

const SHOW_DAYS = 14
const ACK_KEY = 'maddex_rba_decision_acknowledged'
const PAST = { HIKE: 'HIKED', CUT: 'CUT', HOLD: 'HELD' }

const day = (iso) => new Date(`${iso}T00:00:00`).getTime()
const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }).toUpperCase()
const readAck = () => { try { return localStorage.getItem(ACK_KEY) } catch { return null } }

export default function RbaDecisionCard() {
  const rba = VERIFIED_CONSTANTS.rba
  const [now] = useState(() => Date.now())
  const [ack, setAck] = useState(readAck)
  const latest = Math.max(day(rba.lastDecision), rba.minutes?.meeting === rba.lastDecision ? day(rba.minutes.released) : 0)
  if (ack === rba.lastDecision || now - latest > SHOW_DAYS * 86_400_000 || now < day(rba.lastDecision)) return null

  const verb = rba.lastDecisionVerb
  const bp = rba.lastChange?.replace(/^[+-]/, '')
  const rate = `${rba.cashRate.toFixed(2)}%`
  const dismiss = () => {
    try { localStorage.setItem(ACK_KEY, rba.lastDecision) } catch { /* private mode */ }
    setAck(rba.lastDecision)
  }

  return (
    <div className="mx-2 mt-2 flex-shrink-0 border border-terminal-gold/50 px-3 py-2.5 flex items-start gap-3"
      style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.12), rgba(201,168,76,0.03))' }}>
      <span className="text-lg leading-none mt-0.5" aria-hidden="true">🏦</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold tracking-widest text-terminal-gold">
          RBA {PAST[verb] ?? verb}{verb !== 'HOLD' && bp ? ` ${bp}` : ''} ON {longDate(rba.lastDecision)}
        </div>
        <div className="text-2xs text-terminal-text mt-1 leading-relaxed">
          Cash rate is {verb === 'HOLD' ? 'unchanged at' : 'now'} {rate}{rba.levelContext && verb === 'HIKE' ? ` — ${rba.levelContext}` : ''}.
          {rba.minutes?.meeting === rba.lastDecision && (
            <> Minutes ({new Date(`${rba.minutes.released}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}): {rba.minutes.summary}</>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <button
          onClick={() => askMaddenAI(`The RBA ${(PAST[verb] ?? verb).toLowerCase()} the cash rate${verb !== 'HOLD' && bp ? ` by ${bp}` : ''} to ${rate} on ${rba.lastDecision}${rba.minutes?.meeting === rba.lastDecision ? `, and its minutes said: ${rba.minutes.summary}` : ''}. What does this mean for mortgages, savers, the AUD and ASX sectors — and what would make the board move again at the next meeting on ${rba.nextMeeting}?`)}
          className="px-2 py-1 text-2xs font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright whitespace-nowrap"
        >WHAT THIS MEANS ▶</button>
        <button onClick={dismiss} className="text-2xs text-terminal-text-dim hover:text-terminal-text tracking-widest">DISMISS</button>
      </div>
    </div>
  )
}
