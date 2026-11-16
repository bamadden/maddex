// European Central Bank Data Portal (keyless; free use citing the ECB): the
// deposit facility rate, the rate the ECB steers policy with.
import { cells, row } from '../lib.mjs'

export const SOURCE = { id: 'ecb', name: 'European Central Bank', base: 'https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV' }

export async function fetchRecord(fetchImpl) {
  const lines = (await (await fetchImpl(`${SOURCE.base}?lastNObservations=1&format=csvdata`)).text()).trim().split(/\r?\n/)
  const head = cells(lines[0]), last = cells(lines.at(-1))
  const v = parseFloat(last[head.indexOf('OBS_VALUE')])
  if (!Number.isFinite(v)) throw new Error('ECB: no OBS_VALUE')
  return { figures: { depositRate: { value: v, period: last[head.indexOf('TIME_PERIOD')] } } }
}

export function verify(record, VC) {
  const f = record.figures.depositRate
  return [row('ECB deposit facility rate', 'ecb.cashRate', VC.ecb.cashRate, f.value, `in force ${f.period}`)]
}
