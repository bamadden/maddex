// ─── Central bank meeting schedule ──────────────────────────────────────────
// Central banks publish their meeting calendars roughly a year ahead, so the
// dates below are fixed facts, not guesses. "Next meeting" and "days until"
// are derived from today's date at render time — this file never needs a
// manual bump as the year progresses, only a yearly top-up once each bank
// publishes its following year's calendar.

import VERIFIED_CONSTANTS from '../data/verifiedConstants'

export const RBA_MEETINGS_2026  = ['2026-09-29', '2026-11-03', '2026-12-08']
export const FOMC_MEETINGS_2026 = ['2026-09-16', '2026-10-28', '2026-12-09']
export const ECB_MEETINGS_2026  = ['2026-09-10', '2026-10-29', '2026-12-17']
export const BOE_MEETINGS_2026  = ['2026-09-17', '2026-11-05', '2026-12-17']

// The four above are each bank's officially published calendar (RBA and FOMC
// dates are the decision day — day two of a two-day meeting — checked against
// rba.gov.au and federalreserve.gov on 2026-10-01). BOJ and RBNZ below were
// checked the same day; the remaining four follow each bank's well-known meeting cadence (BOJ ~7wk, PBOC LPR on
// the 20th, RBNZ ~7x/yr, BOC 8x/yr, SNB quarterly, Riksbank ~5x/yr) rather
// than a copy of a confirmed published calendar — treat as "next meeting is
// approximately" rather than exact.
export const BOJ_MEETINGS_2026      = ['2026-09-18', '2026-10-30', '2026-12-18']
export const PBOC_MEETINGS_2026     = ['2026-09-21', '2026-10-20', '2026-11-20']
export const RBNZ_MEETINGS_2026     = ['2026-10-28', '2026-11-25']
export const BOC_MEETINGS_2026      = ['2026-09-02', '2026-10-28', '2026-12-09']
export const SNB_MEETINGS_2026      = ['2026-09-24', '2026-12-17']
export const RIKSBANK_MEETINGS_2026 = ['2026-09-24', '2026-11-19']

// Most recently confirmed decision per bank. Derived from verifiedConstants —
// the one place a decision gets hand-updated — keeping the original row shape.
const pct = (v) => `${v.toFixed(2)}%`
const fromVC = (k, extra = {}) => {
  const c = VERIFIED_CONSTANTS[k]
  return { date: c.lastDecision, decision: c.lastDecisionVerb, rate: c.rateRange ?? pct(c.cashRate), ...(c.note ? { note: c.note } : {}), ...extra }
}
export const LAST_DECISIONS = {
  RBA:      fromVC('rba'),
  FOMC:     fromVC('fed'),
  ECB:      fromVC('ecb'),
  BOE:      fromVC('boe'),
  BOJ:      fromVC('boj'),
  PBOC:     fromVC('pboc'),
  RBNZ:     fromVC('rbnz'),
  BOC:      fromVC('boc'),
  SNB:      fromVC('snb'),
  RIKSBANK: fromVC('riksbank'),
}

// Nearest future date in a meeting-date array, or null if none remain.
export function getNextMeeting(meetingDates) {
  const now = Date.now()
  const future = meetingDates
    .map((d) => new Date(`${d}T00:00:00`))
    .filter((d) => d.getTime() > now)
    .sort((a, b) => a - b)
  return future[0] ?? null
}

export function getDaysUntil(date) {
  if (!date) return null
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}
