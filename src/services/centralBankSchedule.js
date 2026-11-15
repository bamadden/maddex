// ─── Central bank meeting schedule ──────────────────────────────────────────
// Central banks publish their meeting calendars roughly a year ahead, so the
// dates below are fixed facts, not guesses. "Next meeting" and "days until"
// are derived from today's date at render time — this file never needs a
// manual bump as the year progresses, only a yearly top-up once each bank
// publishes its following year's calendar.

import VERIFIED_CONSTANTS from '../data/verifiedConstants'

// Decision (announcement) dates, each read from the bank's own published
// calendar on MEETINGS_CHECKED (docs/DATA_SOURCES.md lists the pages). Past
// 2026 dates are kept for the history views; the lists run to June 2027.
// The names say 2026 for the callers that import them.
export const MEETINGS_CHECKED = '2026-11-15'
export const RBA_MEETINGS_2026      = ['2026-09-29', '2026-11-03', '2026-12-08', '2027-02-09', '2027-03-23', '2027-05-04', '2027-06-22']
export const FOMC_MEETINGS_2026     = ['2026-09-16', '2026-10-28', '2026-12-09', '2027-01-27', '2027-03-17', '2027-04-28', '2027-06-09']
export const ECB_MEETINGS_2026      = ['2026-09-10', '2026-10-29', '2026-12-17', '2027-02-04', '2027-03-18', '2027-04-29', '2027-06-10']
export const BOE_MEETINGS_2026      = ['2026-09-17', '2026-11-05', '2026-12-17', '2027-02-04', '2027-03-18', '2027-04-29', '2027-06-17']
export const BOJ_MEETINGS_2026      = ['2026-09-18', '2026-10-30', '2026-12-18', '2027-01-22', '2027-03-18', '2027-04-28', '2027-06-11']
export const BOC_MEETINGS_2026      = ['2026-09-02', '2026-10-28', '2026-12-09', '2027-01-27', '2027-03-03', '2027-04-28', '2027-06-02']
export const SNB_MEETINGS_2026      = ['2026-09-24', '2026-12-10', '2027-03-18', '2027-06-24']
export const RIKSBANK_MEETINGS_2026 = ['2026-09-24', '2026-11-04', '2026-12-16', '2027-02-03', '2027-03-24', '2027-05-05', '2027-06-22']

// Not read from a published calendar on 15 Nov: rbnz.govt.nz refused every
// automated request, and the PBoC publishes no forward LPR dates (the 20 Nov
// date follows its monthly LPR rule). The freshness guard flags both.
export const MEETINGS_UNVERIFIED_CHECKED = null
export const PBOC_MEETINGS_2026     = ['2026-09-21', '2026-10-20', '2026-11-20']
export const RBNZ_MEETINGS_2026     = ['2026-10-28', '2026-12-09']

// Most recently confirmed decision per bank. Derived from verifiedConstants —
// the one place a decision gets hand-updated — keeping the original row shape.
const pct = (v) => `${v.toFixed(2)}%`
const fromVC = (k, extra = {}) => {
  const c = VERIFIED_CONSTANTS[k]
  return { date: c.lastDecision, decision: c.lastDecisionVerb, rate: c.rateRange ?? pct(c.cashRate), source: c.source ?? null, checked: c.lastVerified ?? null, ...(c.note ? { note: c.note } : {}), ...extra }
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
