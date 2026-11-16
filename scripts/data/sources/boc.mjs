// Bank of Canada Valet API (keyless; bankofcanada.ca/terms): the target for
// the overnight rate.
import { row } from '../lib.mjs'

export const SOURCE = { id: 'boc', name: 'Bank of Canada', base: 'https://www.bankofcanada.ca/valet/observations/V39079/json' }

export async function fetchRecord(fetchImpl) {
  const j = await (await fetchImpl(`${SOURCE.base}?recent=1`)).json()
  const o = j.observations?.at(-1)
  const v = parseFloat(o?.V39079?.v)
  if (!Number.isFinite(v)) throw new Error('BoC: no V39079 observation')
  return { figures: { target: { value: v, period: o.d } } }
}

export function verify(record, VC) {
  const f = record.figures.target
  return [row('BoC overnight rate target', 'boc.cashRate', VC.boc.cashRate, f.value, `as at ${f.period}`)]
}
