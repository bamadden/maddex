// The RBA's monetary policy decisions, exactly as the RBA published them.
// Nothing here is derived or inferred: every field is read off rba.gov.au.
//
//   announced  the date on the Board's statement (the decision day)
//   effective  the effective date in the RBA's cash rate target table
//              (rba.gov.au/statistics/cash-rate), the day after
//   rate       the cash rate target from that table, %
//   changeBp   the change from that table, in basis points (0 = held)
//   mr         the statement's media release number
//
// Newest first, with no gaps: holds are decisions too. After each meeting,
// add the new row at the top from the statement and the table, then run
// `npm run check-rba`, which re-reads both for every row and fails on any
// difference. Last checked against rba.gov.au: RBA_DECISIONS_CHECKED.
export const RBA_DECISIONS_CHECKED = '2026-11-03'

export const RBA_DECISIONS = [
  { announced: '2026-11-03', effective: '2026-11-04', rate: 4.85, changeBp: 25, mr: 'mr-26-30' },
  { announced: '2026-09-29', effective: '2026-09-30', rate: 4.60, changeBp: 25, mr: 'mr-26-27' },
  { announced: '2026-08-11', effective: '2026-08-12', rate: 4.35, changeBp: 0, mr: 'mr-26-19' },
  { announced: '2026-06-16', effective: '2026-06-17', rate: 4.35, changeBp: 0, mr: 'mr-26-15' },
  { announced: '2026-05-05', effective: '2026-05-06', rate: 4.35, changeBp: 25, mr: 'mr-26-12' },
  { announced: '2026-03-17', effective: '2026-03-18', rate: 4.10, changeBp: 25, mr: 'mr-26-08' },
  { announced: '2026-02-03', effective: '2026-02-04', rate: 3.85, changeBp: 25, mr: 'mr-26-03' },
  { announced: '2025-12-09', effective: '2025-12-10', rate: 3.60, changeBp: 0, mr: 'mr-25-33' },
  { announced: '2025-11-04', effective: '2025-11-05', rate: 3.60, changeBp: 0, mr: 'mr-25-31' },
  { announced: '2025-09-30', effective: '2025-10-01', rate: 3.60, changeBp: 0, mr: 'mr-25-27' },
  { announced: '2025-08-12', effective: '2025-08-13', rate: 3.60, changeBp: -25, mr: 'mr-25-22' },
  { announced: '2025-07-08', effective: '2025-07-09', rate: 3.85, changeBp: 0, mr: 'mr-25-17' },
  { announced: '2025-05-20', effective: '2025-05-21', rate: 3.85, changeBp: -25, mr: 'mr-25-13' },
]

export const decisionOf = (d) => (d.changeBp > 0 ? 'hike' : d.changeBp < 0 ? 'cut' : 'hold')

// mr-26-27 → https://www.rba.gov.au/media-releases/2026/mr-26-27.html
export const rbaStatementUrl = (mr) => `https://www.rba.gov.au/media-releases/20${mr.slice(3, 5)}/${mr}.html`
