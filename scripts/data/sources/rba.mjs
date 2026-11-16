// Reserve Bank of Australia: cash rate target (table A2), the 10-year
// government bond yield (table F2) and the average variable rate on
// outstanding owner-occupier home loans (table F6, series FLRHOOVA). Keyless CSV; commercial use permitted
// with "Source: Reserve Bank of Australia".
import { fetchRbaCashRate } from '../../../src/services/officialStats.js'
import { cells, row } from '../lib.mjs'
import { HOUSING_VARIABLE_RATE } from '../../../src/data/rbaLendingRates.js'

export const SOURCE = { id: 'rba', name: 'Reserve Bank of Australia', base: 'https://www.rba.gov.au' }

const DATE = /^\d{2}-[A-Za-z]{3}-\d{4}$/
const iso = (d) => new Date(`${d} 00:00:00 UTC`).toISOString().slice(0, 10)

export async function fetchRecord(fetchImpl) {
  const cash = await fetchRbaCashRate({ base: SOURCE.base, fetchImpl })
  const f2 = (await (await fetchImpl(`${SOURCE.base}/statistics/tables/csv/f2-data.csv`)).text()).split(/\r?\n/).map(cells)
  const col = (f2.find((c) => c[0] === 'Title') ?? []).indexOf('Australian Government 10 year bond')
  if (col < 0) throw new Error('F2: no "Australian Government 10 year bond" column')
  const tenYear = f2.filter((c) => DATE.test(c[0]) && c[col] !== '').map((c) => ({ date: iso(c[0]), value: parseFloat(c[col]) }))
  const f6res = await fetchImpl(`${SOURCE.base}/statistics/tables/csv/f6-data.csv`)
  if (!f6res.ok) throw new Error(`RBA F6 HTTP ${f6res.status}`)
  const f6 = (await f6res.text()).split(/\r?\n/).map(cells)
  const c6 = (f6.find((c) => c[0] === 'Series ID') ?? []).indexOf('FLRHOOVA')
  if (c6 < 0) throw new Error('F6: no FLRHOOVA series')
  const housing = f6.filter((c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c[0]) && c[c6] !== '').map((c) => ({ date: c[0].split('/').reverse().join('-'), value: parseFloat(c[c6]) }))
  return { figures: { cashRate: { value: cash.value, period: cash.effectiveIso }, au10y: { latest: tenYear.at(-1), recent: tenYear.slice(-30) }, housingVariable: { latest: housing.at(-1), recent: housing.slice(-12) } } }
}

export function verify(record, VC) {
  const f = record.figures
  const atOurDate = f.au10y.recent.find((p) => p.date === VC.bonds.au10yAsOf)
  const latest = f.au10y.latest
  return [
    row('RBA cash rate target', 'rba.cashRate', VC.rba.cashRate, f.cashRate.value, `effective ${f.cashRate.period}`),
    row('AU 10-year yield', 'bonds.au10y', VC.bonds.au10y, atOurDate?.value ?? null, VC.bonds.au10yAsOf, {
      tolerance: 0.006, note: latest && latest.date > VC.bonds.au10yAsOf ? `newer reading: ${latest.value} on ${latest.date}` : null,
    }),
    housingRow(f.housingVariable),
  ]
}

// The F6 rate behind the mortgage margin (src/data/rbaLendingRates.js).
function housingRow(h) {
  const ours = HOUSING_VARIABLE_RATE
  const at = h?.recent.find((p) => p.date === ours.periodEnd)
  return row('Housing variable rate (F6)', 'rbaLendingRates.HOUSING_VARIABLE_RATE', ours.value, at?.value ?? null, ours.period, {
    tolerance: 0.05, note: h?.latest && h.latest.date > ours.periodEnd ? `newer month: ${h.latest.value} for ${h.latest.date}` : null,
  })
}
