// One muted line of macro context for a scanner signal, from the stock's
// sector and the signal type. Computed here from verifiedConstants — no model
// call, nothing generated. Every figure it quotes is a dated constant; the
// rest is the textbook mechanism, worded as a tendency.
//
// ASX names only: these are Australian-macro lines (RBA, iron ore, the AUD),
// and attaching "RBA hike pricing" to Apple would be noise.

import VERIFIED_CONSTANTS from '../data/verifiedConstants'
import { sydneyOffset } from '../utils/dateUtils'

const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '')

// The pending RBA decision's pricing, while it is pending.
function hikePricing(now = Date.now()) {
  const nd = VERIFIED_CONSTANTS.rbaNextDecision
  if (!nd?.marketHikePct) return null
  const at = new Date(`${nd.date}T${nd.time}:00${sydneyOffset(nd.date)}`).getTime()
  return now < at ? `~${nd.marketHikePct}% hike pricing for ${day(nd.date)}` : null
}

const BULLISH = new Set(['BREAKOUT', 'OVERSOLD', 'GAP ▲', 'MOMENTUM'])

export function macroContext(symbol, signal, now = Date.now()) {
  if (!/\.AX$/i.test(symbol ?? '')) return null
  const sector = signal.sector
  if (!sector) return null
  const C = VERIFIED_CONSTANTS
  const hp = hikePricing(now)
  const env = hp ?? `cash rate ${C.rba.cashRate.toFixed(2)}%`
  const up = BULLISH.has(signal.type) || !!signal.up
  const c = C.commodities ?? {}

  switch (sector) {
    case 'Materials':
      return `Iron ore US$${c.ironOreUSD?.toFixed(2)}/t (${day(c.asOfBy?.ironOreUSD)}) — miners track China demand more than the RBA`
    case 'Energy':
      return `Brent US$${c.brentUSD?.toFixed(2)} (${day(c.asOfBy?.brentUSD)}) — energy tracks oil and LNG more than local rates`
    case 'Financials':
      return signal.type === 'OVERSOLD'
        ? `${env}: hikes usually widen bank margins — check whether the selling is about credit quality`
        : `${env}: hikes usually widen bank margins, partly offset by credit risk`
    case 'Real Est':
      return up
        ? `${env}: REITs are among the most rate-sensitive — strength here runs against the backdrop`
        : `${env}: REITs are among the most rate-sensitive — higher rates weigh on valuations`
    case 'Utilities':
      return `${env}: bond-like utilities tend to lag as yields rise`
    case 'Cons Disc':
      return `${env}: mortgaged households have less to spend — rate-sensitive demand`
    case 'IT':
      return `${env}: long-dated growth earnings are the most discount-rate sensitive`
    case 'Health':
      return 'Defensive demand, largely USD-earning — limited direct rate sensitivity'
    case 'Staples':
      return 'Defensive — essential spending tends to hold up through tightening'
    case 'Comms':
      return 'Mostly domestic, subscription-style revenue — moderate rate sensitivity'
    case 'Industrials':
      return `${env}: financing costs and slower activity — varies by business`
    default:
      return null
  }
}

// Today's rate event in Sydney, if there is one: the CPI release or an RBA
// decision recorded in verifiedConstants. Keyed on the recorded dates, so it
// never claims an event the constants do not hold.
export function rateEventToday(now = Date.now()) {
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const C = VERIFIED_CONSTANTS
  if (C.rba?.lastDecision === today) return { kind: 'RBA DAY', label: `RBA decision: ${C.rba.lastDecisionVerb} to ${C.rba.cashRate.toFixed(2)}%`, date: today }
  if (C.au?.cpiLastRelease === today) {
    const hot = C.au.cpiQuarterTrimmedQoQ != null && C.au.cpiQuarterRbaForecast != null && C.au.cpiQuarterTrimmedQoQ > C.au.cpiQuarterRbaForecast
    return {
      kind: 'CPI DAY', date: today, hot,
      label: hot
        ? `CPI: trimmed mean ${C.au.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q, above the RBA's ${C.au.cpiQuarterRbaForecast.toFixed(1)}% forecast`
        : `CPI released: ${C.au.cpi.toFixed(1)}% y/y`,
    }
  }
  return null
}

// The next scheduled rate event, for the empty state.
export function nextRateEvent() {
  const C = VERIFIED_CONSTANTS
  const opts = [
    C.rba?.nextMeeting && { label: 'RBA decision', date: C.rba.nextMeeting },
    C.au?.cpiNextRelease && { label: 'CPI release', date: C.au.cpiNextRelease },
  ].filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))
  return opts[0] ?? null
}
