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

// RBNZ and PBoC: no dates (removed 16 Nov 2026). rbnz.govt.nz refuses
// automated requests (403), so its calendar could not be read, and the PBoC
// publishes no forward LPR calendar. Both banks' last decisions stay, from
// their own announcements; their next dates are not shown.

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
  BOC:      fromVC('boc'),
  SNB:      fromVC('snb'),
  RIKSBANK: fromVC('riksbank'),
}

// Announcement time in each bank's own zone, read by fetch from the bank's
// own page on ANNOUNCE_AT_CHECKED (the page and its words in ANNOUNCE_SOURCE;
// also docs/DATA_SOURCES.md). The freshness guard holds the date. Null where
// the bank's pages state no time: the BoJ announces when its meeting ends,
// and the Bank of England's pages, read the same day, give dates only. Those
// rows show the date with "time not stated".
export const ANNOUNCE_AT_CHECKED = '2026-11-16'
export const ANNOUNCE_AT = {
  rba:      ['14:30', 'Australia/Sydney'],
  fed:      ['14:00', 'America/New_York'],
  ecb:      ['14:15', 'Europe/Berlin'],
  boe:      null,
  boc:      ['09:45', 'America/Toronto'],
  snb:      ['09:30', 'Europe/Zurich'],
  riksbank: ['09:30', 'Europe/Stockholm'],
  boj:      null,
}
export const ANNOUNCE_SOURCE = {
  rba:      ['rba.gov.au/monetary-policy/int-rate-decisions/', 'a media release announcing the decision at 2.30 pm after each Board meeting'],
  fed:      ['federalreserve.gov FOMC statement, 28 Oct 2026', 'For release at 2:00 p.m. EDT'],
  ecb:      ['ecb.europa.eu/press/govcdec/mopo/', 'published in a press release at 14:15 CET on the day of the Governing Council monetary policy meeting'],
  boc:      ['bankofcanada.ca/press/upcoming-events/', 'December 9, 2026 Interest Rate Announcement 09:45 (ET)'],
  snb:      ['snb.ch event schedule', '10.12.2026 09:30 Monetary policy assessment'],
  riksbank: ['riksbank.se calendar', 'Publication of monetary policy decision, including the policy rate … 09:30'],
}

// Minutes east of UTC for `zone` at instant `t`.
function offsetMinutes(zone, t) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(t)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}

// The instant (ms) a wall-clock time on a date in `zone` falls on.
export function zonedInstant(date, time, zone) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  let t = wall
  for (let i = 0; i < 2; i++) t = wall - offsetMinutes(zone, t) * 60_000
  return t
}

// When a bank's decision on `date` (its own calendar date) is announced:
// { at: ms, sydneyDate } or, with no fixed time, { at: null, sydneyDate: date }.
export function announcement(key, date) {
  const a = ANNOUNCE_AT[key]
  if (!a) return { at: null, sydneyDate: date }
  const at = zonedInstant(date, a[0], a[1])
  return { at, sydneyDate: new Date(at).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) }
}

// Sydney calendar days from `fromDay` to `toDay` (both YYYY-MM-DD).
export const daysBetweenDays = (fromDay, toDay) => Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000)

// Nearest meeting date that has not yet passed in Sydney, or null. (It used
// to roll over at the browser's midnight.)
export function getNextMeeting(meetingDates, now = Date.now()) {
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const next = [...meetingDates].sort().find((d) => d >= today)
  return next ? new Date(`${next}T00:00:00`) : null
}

export function getDaysUntil(date) {
  if (!date) return null
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}
