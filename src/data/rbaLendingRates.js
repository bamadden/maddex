// RBA table F6, housing lending rates: the one source for the mortgage margin
// over the cash rate that the calculators and the Rates mortgage figures use
// (16 Nov 2026; until then a typed 2.14 with no source). Typed by a person
// from the RBA's CSV; the rba fetcher checks it against the table
// (`npm run data:verify -- rba`, and the nightly format check).
// No imports: calcMath re-exports the margin, and verifiedConstants imports
// calcMath.

export const F6_READ = '2026-11-16'
// The table's own data file (a CSV download) is the link: the RBA has no
// separate page per table.
export const F6_CSV = 'https://www.rba.gov.au/statistics/tables/csv/f6-data.csv'
export const F6_URL = F6_CSV

// Series FLRHOOVA: lending rates, housing credit, outstanding, owner-occupied,
// variable rate, all institutions. The CSV gives it to one decimal place.
export const HOUSING_VARIABLE_RATE = {
  value: 6.2,
  series: 'FLRHOOVA',
  what: 'Average variable rate on outstanding owner-occupier home loans, all institutions',
  period: 'Sep 2026',
  periodEnd: '2026-09-30',
  published: '2026-11-06',
  // The cash rate target in force for that month: 4.35% from 6 May, 4.60%
  // only from 30 Sep (RBA table A2).
  cashRateThen: 4.35,
}

// The margin, in percentage points: the F6 average rate on outstanding
// owner-occupier variable loans less the cash rate in force that month. A
// derived spread, not any lender's margin; F6 publishes the rate to one
// decimal place, so the margin is good to about ±0.05 points.
export const MORTGAGE_MARGIN = Math.round((HOUSING_VARIABLE_RATE.value - HOUSING_VARIABLE_RATE.cashRateThen) * 100) / 100

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}` }

export const MARGIN_SOURCE = `RBA table F6, ${HOUSING_VARIABLE_RATE.period}: the ${HOUSING_VARIABLE_RATE.value.toFixed(1)}% average rate on outstanding owner-occupier variable loans (published to one decimal place) less the ${HOUSING_VARIABLE_RATE.cashRateThen.toFixed(2)}% cash rate then; manually checked ${day(F6_READ)}`
