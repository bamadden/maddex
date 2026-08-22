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

// Most recently confirmed decision per bank — hand-updated once a result is
// known. Everything else (next meeting, countdown) is computed from today.
export const LAST_DECISIONS = {
  RBA:  { date: '2026-08-12', decision: 'HOLD', rate: '4.35%',      note: 'Softer June-quarter CPI (3.8%) cited' },
  FOMC: { date: '2026-07-30', decision: 'HOLD', rate: '4.25–4.50%' },
  ECB:  { date: '2026-06-12', decision: 'CUT',  rate: '2.00%' },
  BOE:  { date: '2026-05-08', decision: 'CUT',  rate: '4.25%' },
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
