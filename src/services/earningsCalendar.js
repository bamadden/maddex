// ASX results dates for the companies tracked elsewhere in the app, each from
// the company's own financial calendar (corporateActions.js carries the source
// and its URL).
//
// Removed 2026-11-15: the hand-typed August–October list. Its dates were
// approximate and several were wrong (AGL, Fortescue, REA, Goodman, Woodside
// and Santos report in August, not September or October), its EPS and revenue
// "estimates" had no source, and its AGM rows named a notice of meeting
// without citing one. Corrected 2026-10-29 before that: the banks, Macquarie
// and Aristocrat report in November (non-June year-ends).
import { CORPORATE_ACTIONS } from '../data/corporateActions'

// Sourced results dates from the company calendars in corporateActions.js.
const SOURCED = CORPORATE_ACTIONS
  .filter((a) => a.type === 'results')
  .map((a) => ({ ticker: a.ticker, company: a.company, date: a.date, type: 'Full Year', source: a.source, sourceUrl: a.sourceUrl }))

export const EARNINGS_2026 = [...SOURCED].sort((a, b) => a.date.localeCompare(b.date))

export function earningsFor(ticker) {
  // The NEXT report on or after today, never a past one — a reporting date
  // that has gone by is history, not "upcoming earnings".
  const today = new Date().toLocaleDateString('en-CA')
  return EARNINGS_2026
    .filter((e) => e.type !== 'AGM' && e.date >= today && (e.ticker === ticker || e.ticker === `${ticker}.AX`))
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

export function upcomingEarnings(fromDate = new Date()) {
  const from = fromDate.toLocaleDateString('en-CA')
  return EARNINGS_2026.filter((e) => e.date >= from).sort((a, b) => a.date.localeCompare(b.date))
}

export function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target - now) / 86400000)
}
