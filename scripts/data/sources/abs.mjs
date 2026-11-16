// Australian Bureau of Statistics Data API (SDMX, keyless; CC BY 4.0): CPI,
// trimmed mean, unemployment and GDP.
import { fetchAuCpi, fetchAuUnemployment, fetchAuGdp } from '../../../src/services/officialStats.js'
import { row } from '../lib.mjs'

export const SOURCE = { id: 'abs', name: 'Australian Bureau of Statistics', base: 'https://data.api.abs.gov.au' }

export async function fetchRecord(fetchImpl) {
  const [cpi, lf, gdp] = await Promise.all([fetchAuCpi({ fetchImpl }), fetchAuUnemployment({ fetchImpl }), fetchAuGdp({ fetchImpl })])
  return { figures: { cpi: cpi.cpi, trimmedMean: cpi.trimmedMean, unemployment: { value: lf.value, period: lf.period }, gdpQoQ: gdp.qoq, gdpAnnual: gdp.annual } }
}

// Compared only when the record and the constant are for the same period;
// otherwise the row says which is newer.
// Month names are compared on their first three letters (the en-AU locale
// writes 'Sept').
const norm = (p) => String(p ?? '').replace(/ quarter$/, '').replace(/^([A-Za-z]{3})[a-z]*/, '$1')
const same = (a, b) => norm(a) === norm(b)
function periodRow(label, constant, ours, ourPeriod, fig) {
  if (!fig) return row(label, constant, ours, null, ourPeriod)
  if (same(fig.period, ourPeriod)) return row(label, constant, ours, fig.value, fig.period)
  return { ...row(label, constant, ours, null, ourPeriod), status: 'period', note: `official is for ${fig.period} (${fig.value}); ours is for ${ourPeriod}` }
}

export function verify(record, VC) {
  const f = record.figures, au = VC.au
  return [
    periodRow('AU CPI (annual)', 'au.cpi', au.cpi, au.cpiPeriod, f.cpi),
    periodRow('AU trimmed mean', 'au.cpiTrimmedMean', au.cpiTrimmedMean, au.cpiPeriod, f.trimmedMean),
    periodRow('AU unemployment', 'au.unemployment', au.unemployment, au.unemploymentPeriod, f.unemployment),
    periodRow('AU GDP (quarter)', 'au.gdpQoQ', au.gdpQoQ, au.gdpPeriod, f.gdpQoQ),
    periodRow('AU GDP (annual)', 'au.gdpAnnual', au.gdpAnnual, au.gdpPeriod, f.gdpAnnual),
  ]
}
