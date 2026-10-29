// ASX reporting-season dates and AGMs, Aug-Oct 2026, for the companies tracked
// elsewhere in the app — eps/rev estimates are illustrative, not sourced.
//
// Corrected 2026-10-29: Westpac, NAB and ANZ were listed with August
// full-year results and Macquarie and Aristocrat with September ones. All five
// have non-June year-ends (banks and Aristocrat to 30 Sep, Macquarie a half to
// 30 Sep) and report in November. Those rows were removed; the banks' November
// dates come from corporateActions.js, which carries each company's own
// financial calendar as the source. The August-season dates for the rest are
// approximate and are labelled so in the calendar.
import { CORPORATE_ACTIONS } from '../data/corporateActions'

const LISTED = [
  { ticker: 'CBA.AX', company: 'Commonwealth Bank',   date: '2026-08-13', type: 'Full Year',    epsEst: 6.20, revEst: 27800 },
  { ticker: 'CSL.AX', company: 'CSL Limited',         date: '2026-08-18', type: 'Full Year',    epsEst: 7.85, revEst: 16400 },
  { ticker: 'WES.AX', company: 'Wesfarmers',          date: '2026-08-19', type: 'Full Year',    epsEst: 2.42, revEst: 44200 },
  { ticker: 'WOW.AX', company: 'Woolworths Group',    date: '2026-08-20', type: 'Full Year',    epsEst: 1.38, revEst: 67500 },
  { ticker: 'BHP.AX', company: 'BHP Group',           date: '2026-08-26', type: 'Full Year',    epsEst: 2.84, revEst: 53200 },
  { ticker: 'RIO.AX', company: 'Rio Tinto',           date: '2026-08-27', type: 'Half Year',    epsEst: 4.62, revEst: 26800 },
  { ticker: 'TLS.AX', company: 'Telstra Group',       date: '2026-09-04', type: 'Full Year',    epsEst: 0.18, revEst: 23400 },
  { ticker: 'FMG.AX', company: 'Fortescue',           date: '2026-09-08', type: 'Full Year',    epsEst: 1.72, revEst: 17600 },
  { ticker: 'WDS.AX', company: 'Woodside Energy',     date: '2026-09-10', type: 'Half Year',    epsEst: 1.24, revEst: 6100 },
  { ticker: 'GMG.AX', company: 'Goodman Group',       date: '2026-09-15', type: 'Full Year',    epsEst: 1.02, revEst: 2600 },
  { ticker: 'STO.AX', company: 'Santos Limited',      date: '2026-09-17', type: 'Half Year',    epsEst: 0.38, revEst: 3200 },
  { ticker: 'MIN.AX', company: 'Mineral Resources',   date: '2026-09-24', type: 'Full Year',    epsEst: 1.15, revEst: 5300 },
  { ticker: 'REA.AX', company: 'REA Group',           date: '2026-09-29', type: 'Full Year',    epsEst: 3.94, revEst: 1650 },
  { ticker: 'AGL.AX', company: 'AGL Energy',          date: '2026-10-01', type: 'Full Year',    epsEst: 0.96, revEst: 14200 },
  { ticker: 'QBE.AX', company: 'QBE Insurance Group', date: '2026-10-06', type: 'Q3 Trading Update', epsEst: null, revEst: null },
  // AGM dates from each company's 2026 notice of meeting.
  { ticker: 'CBA.AX', company: 'Commonwealth Bank',   date: '2026-10-14', type: 'AGM',          epsEst: null, revEst: null },
  { ticker: 'WES.AX', company: 'Wesfarmers',          date: '2026-10-29', type: 'AGM',          epsEst: null, revEst: null },
]

// Sourced results dates from the company calendars in corporateActions.js.
const SOURCED = CORPORATE_ACTIONS
  .filter((a) => a.type === 'results')
  .map((a) => ({ ticker: a.ticker, company: a.company, date: a.date, type: 'Full Year', epsEst: null, revEst: null, source: a.source, sourceUrl: a.sourceUrl }))

export const EARNINGS_2026 = [...LISTED, ...SOURCED].sort((a, b) => a.date.localeCompare(b.date))

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
