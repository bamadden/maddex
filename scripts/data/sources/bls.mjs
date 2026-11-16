// US Bureau of Labor Statistics public API v1 (keyless; about 25 queries a
// day per address, so the nightly run makes one). CPI-U all items and core,
// not seasonally adjusted, as BLS headlines the 12-month change; the
// unemployment rate, seasonally adjusted.
import { row } from '../lib.mjs'

export const SOURCE = { id: 'bls', name: 'US Bureau of Labor Statistics', base: 'https://api.bls.gov/publicAPI/v1/timeseries/data/' }
const SERIES = { cpi: 'CUUR0000SA0', core: 'CUUR0000SA0L1E', unemployment: 'LNS14000000' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (o) => `${MONTHS[+o.period.slice(1) - 1]} ${o.year}`

export async function fetchRecord(fetchImpl) {
  const year = +new Date().getFullYear()
  const res = await fetchImpl(SOURCE.base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesid: Object.values(SERIES), startyear: String(year - 1), endyear: String(year) }) })
  const j = await res.json()
  if (j.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${j.status} ${(j.message ?? []).join(' ')}`)
  const byId = Object.fromEntries(j.Results.series.map((s) => [s.seriesID, s.data.filter((o) => /^M(0[1-9]|1[0-2])$/.test(o.period) && o.value !== '-')]))
  // 12-month change for each month that has a year-earlier index.
  const yoy = (data) => data.map((o) => {
    const prior = data.find((p) => p.period === o.period && +p.year === +o.year - 1)
    return prior ? { period: label(o), value: Math.round((o.value / prior.value - 1) * 1000) / 10 } : null
  }).filter(Boolean)
  return {
    figures: {
      cpi: yoy(byId[SERIES.cpi]),
      core: yoy(byId[SERIES.core]),
      unemployment: byId[SERIES.unemployment].map((o) => ({ period: label(o), value: +o.value })),
      latestIndexMonth: byId[SERIES.cpi][0] ? label(byId[SERIES.cpi][0]) : null,
    },
  }
}

export function verify(record, VC) {
  const f = record.figures, us = VC.us
  const at = (list, period) => list.find((o) => o.period === period)?.value ?? null
  const newest = (list) => list[0]
  const note = (list, period) => (newest(list) && newest(list).period !== period ? `newest 12-month figure: ${newest(list).value} for ${newest(list).period}` : null)
  return [
    row('US CPI (12 months)', 'us.cpi', us.cpi, at(f.cpi, us.cpiPeriod), us.cpiPeriod, { tolerance: 0.05, note: note(f.cpi, us.cpiPeriod) }),
    row('US core CPI (12 months)', 'us.cpiCore', us.cpiCore, at(f.core, us.cpiPeriod), us.cpiPeriod, { tolerance: 0.05, note: note(f.core, us.cpiPeriod) }),
    row('US unemployment', 'us.unemployment', us.unemployment, at(f.unemployment, us.unemploymentPeriod), us.unemploymentPeriod, { note: note(f.unemployment, us.unemploymentPeriod) }),
  ]
}
