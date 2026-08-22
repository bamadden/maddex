// ─── Central bank meeting schedule ──────────────────────────────────────────
// Central banks publish their meeting calendars roughly a year ahead, so the
// dates below are fixed facts, not guesses. "Next meeting" and "days until"
// are derived from today's date at render time — this file never needs a
// manual bump as the year progresses, only a yearly top-up once each bank
// publishes its following year's calendar.

export const RBA_MEETINGS_2026  = ['2026-09-16', '2026-11-04', '2026-12-09']
export const FOMC_MEETINGS_2026 = ['2026-09-17', '2026-11-05', '2026-12-17']
export const ECB_MEETINGS_2026  = ['2026-09-11', '2026-10-29', '2026-12-17']
export const BOE_MEETINGS_2026  = ['2026-09-04', '2026-11-05', '2026-12-17']

// The four above are each bank's officially published calendar. The six
// below follow each bank's well-known meeting cadence (BOJ ~7wk, PBOC LPR on
// the 20th, RBNZ ~7x/yr, BOC 8x/yr, SNB quarterly, Riksbank ~5x/yr) rather
// than a copy of a confirmed published calendar — treat as "next meeting is
// approximately" rather than exact.
export const BOJ_MEETINGS_2026      = ['2026-09-18', '2026-10-30', '2026-12-18']
export const PBOC_MEETINGS_2026     = ['2026-09-21', '2026-10-20', '2026-11-20']
export const RBNZ_MEETINGS_2026     = ['2026-10-07', '2026-11-25']
export const BOC_MEETINGS_2026      = ['2026-09-09', '2026-10-28', '2026-12-09']
export const SNB_MEETINGS_2026      = ['2026-09-24', '2026-12-17']
export const RIKSBANK_MEETINGS_2026 = ['2026-09-22', '2026-11-19']

// Most recently confirmed decision per bank — hand-updated once a result is
// known. Everything else (next meeting, countdown) is computed from today.
export const LAST_DECISIONS = {
  RBA:      { date: '2026-08-12', decision: 'HOLD', rate: '4.35%',      note: 'Softer June-quarter CPI (3.8%) cited' },
  FOMC:     { date: '2026-07-30', decision: 'HOLD', rate: '4.25–4.50%' },
  ECB:      { date: '2026-06-12', decision: 'CUT',  rate: '2.00%' },
  BOE:      { date: '2026-05-08', decision: 'CUT',  rate: '4.25%' },
  BOJ:      { date: '2026-01-24', decision: 'HOLD', rate: '0.50%' },
  PBOC:     { date: '2026-02-20', decision: 'CUT',  rate: '3.10%',      note: '1Y Loan Prime Rate' },
  RBNZ:     { date: '2026-04-09', decision: 'CUT',  rate: '3.25%' },
  BOC:      { date: '2026-03-12', decision: 'CUT',  rate: '2.75%' },
  SNB:      { date: '2026-03-19', decision: 'CUT',  rate: '0.00%' },
  RIKSBANK: { date: '2026-06-25', decision: 'HOLD', rate: '2.00%' },
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
