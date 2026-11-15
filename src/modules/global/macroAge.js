// Age of a hand-entered country figure (Global country panel). Each label is
// "PERIOD, SOURCE": "Apr 2026, BLS", "Q1 2026, Eurostat", "FY25, PBS",
// "2025, INDEC", "2026-11-03, RBA" or "Jun 2026 quarter, ABS". A figure older
// than its publishing cycle has very likely been superseded, so the panel
// says so instead of showing it as current.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const endOfMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0))

// The last day of the period a label names, or null when it is not a period.
export function periodEnd(label) {
  const p = String(label ?? '').split(',')[0].trim()
  let m
  if ((m = p.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if ((m = p.match(/^Q([1-4]) (\d{4})$/))) return endOfMonth(+m[2], +m[1] * 3 - 1)
  if ((m = p.match(/^([A-Za-z]{3})\w* (\d{4})(?: quarter)?$/)) && MONTHS.includes(m[1].toLowerCase())) return endOfMonth(+m[2], MONTHS.indexOf(m[1].toLowerCase()))
  if ((m = p.match(/^FY(\d{2})$/))) return new Date(Date.UTC(2000 + +m[1], 5, 30))
  if ((m = p.match(/^(\d{4})$/))) return new Date(Date.UTC(+m[1], 11, 31))
  return null
}

const quarterly = (label) => /^(Q[1-4] |\w+ \d{4} quarter)/.test(String(label ?? ''))
const annual = (label) => /^(FY\d{2}|\d{4})\s*(,|$)/.test(String(label ?? ''))

// Days a figure stays current after its period ends. A policy rate stands
// until the next meeting (most banks meet every six to eight weeks); a
// monthly CPI is replaced about a month after the next month ends; quarterly
// and annual figures likewise one cycle on.
export const CYCLE_DAYS = { rate: 60, monthly: 75, quarterly: 150, annual: 450 }

export function pastCycle(label, kind, now = Date.now()) {
  const end = periodEnd(label)
  if (!end) return false
  const days = kind === 'rate' ? CYCLE_DAYS.rate
    : annual(label) ? CYCLE_DAYS.annual
    : quarterly(label) ? CYCLE_DAYS.quarterly
    : CYCLE_DAYS.monthly
  return (now - end.getTime()) / 86400000 > days
}
