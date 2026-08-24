// Hardcoded ASX reporting-season earnings dates, Aug-Oct 2026. Real dates for
// the companies already tracked elsewhere in the app (ASX_STOCKS,
// MOCK_ASX_STOCKS) — eps/rev estimates are illustrative, not sourced.
export const EARNINGS_2026 = [
  { ticker: 'CBA.AX', company: 'Commonwealth Bank',   date: '2026-08-13', type: 'Full Year',    epsEst: 6.20, revEst: 27800 },
  { ticker: 'CSL.AX', company: 'CSL Limited',         date: '2026-08-18', type: 'Full Year',    epsEst: 7.85, revEst: 16400 },
  { ticker: 'WES.AX', company: 'Wesfarmers',          date: '2026-08-19', type: 'Full Year',    epsEst: 2.42, revEst: 44200 },
  { ticker: 'WOW.AX', company: 'Woolworths Group',    date: '2026-08-20', type: 'Full Year',    epsEst: 1.38, revEst: 67500 },
  { ticker: 'ANZ.AX', company: 'ANZ Group Holdings',  date: '2026-08-21', type: 'Full Year',    epsEst: 2.28, revEst: 21100 },
  { ticker: 'NAB.AX', company: 'National Australia Bank', date: '2026-08-24', type: 'Full Year', epsEst: 2.35, revEst: 20300 },
  { ticker: 'BHP.AX', company: 'BHP Group',           date: '2026-08-26', type: 'Full Year',    epsEst: 2.84, revEst: 53200 },
  { ticker: 'RIO.AX', company: 'Rio Tinto',           date: '2026-08-27', type: 'Half Year',    epsEst: 4.62, revEst: 26800 },
  { ticker: 'WBC.AX', company: 'Westpac Banking Corp', date: '2026-08-28', type: 'Full Year',   epsEst: 2.05, revEst: 19700 },
  { ticker: 'MQG.AX', company: 'Macquarie Group',     date: '2026-09-02', type: 'Half Year',    epsEst: 5.10, revEst: 8900 },
  { ticker: 'TLS.AX', company: 'Telstra Group',       date: '2026-09-04', type: 'Full Year',    epsEst: 0.18, revEst: 23400 },
  { ticker: 'FMG.AX', company: 'Fortescue',           date: '2026-09-08', type: 'Full Year',    epsEst: 1.72, revEst: 17600 },
  { ticker: 'WDS.AX', company: 'Woodside Energy',     date: '2026-09-10', type: 'Half Year',    epsEst: 1.24, revEst: 6100 },
  { ticker: 'GMG.AX', company: 'Goodman Group',       date: '2026-09-15', type: 'Full Year',    epsEst: 1.02, revEst: 2600 },
  { ticker: 'STO.AX', company: 'Santos Limited',      date: '2026-09-17', type: 'Half Year',    epsEst: 0.38, revEst: 3200 },
  { ticker: 'ALL.AX', company: 'Aristocrat Leisure',  date: '2026-09-22', type: 'Full Year',    epsEst: 2.68, revEst: 7100 },
  { ticker: 'MIN.AX', company: 'Mineral Resources',   date: '2026-09-24', type: 'Full Year',    epsEst: 1.15, revEst: 5300 },
  { ticker: 'REA.AX', company: 'REA Group',           date: '2026-09-29', type: 'Full Year',    epsEst: 3.94, revEst: 1650 },
  { ticker: 'AGL.AX', company: 'AGL Energy',          date: '2026-10-01', type: 'Full Year',    epsEst: 0.96, revEst: 14200 },
  { ticker: 'QBE.AX', company: 'QBE Insurance Group', date: '2026-10-06', type: 'Q3 Trading Update', epsEst: null, revEst: null },
]

export function earningsFor(ticker) {
  return EARNINGS_2026.find((e) => e.ticker === ticker || e.ticker === `${ticker}.AX`) ?? null
}

export function upcomingEarnings(fromDate = new Date()) {
  const from = fromDate.toISOString().slice(0, 10)
  return EARNINGS_2026.filter((e) => e.date >= from).sort((a, b) => a.date.localeCompare(b.date))
}

export function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target - now) / 86400000)
}
