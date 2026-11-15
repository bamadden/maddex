// Bond curves (15 Nov 2026): every curve is its publisher's end-of-day
// reading, dated and sourced; only published maturities are held; nothing
// ticks on top and no change is invented.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { BOND_MARKETS, BOND_CURVES, BOND_CURVES_AS_OF, BOND_CURVE_SOURCES } from '../src/data/bondCurves.js'

test('each curve is dated and names its official source', () => {
  const host = { AU: 'rba.gov.au', US: 'treasury.gov', UK: 'bankofengland.co.uk', DE: 'bundesbank.de', JP: 'mof.go.jp' }
  for (const m of BOND_MARKETS) {
    assert.match(BOND_CURVES_AS_OF[m.key], /^\d{4}-\d{2}-\d{2}$/, m.key)
    assert.ok(new URL(BOND_CURVE_SOURCES[m.key].url).hostname.endsWith(host[m.key]), m.key)
    assert.ok(BOND_CURVES[m.key].length >= 4, m.key)
    for (const r of BOND_CURVES[m.key]) assert.ok(Number.isFinite(r.yield) && Number.isFinite(r.years) && !r.indicative, `${m.key} ${r.maturity}`)
  }
  assert.deepEqual(BOND_CURVES.AU.map((r) => r.maturity), ['2Y', '3Y', '5Y', '10Y'], 'AU: the tenors RBA F2 publishes')
})

test('yields do not tick and no change is shown that was not measured', () => {
  const hook = fs.readFileSync('src/modules/bonds/useBondYields.js', 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  assert.doesNotMatch(hook, /priceStream|subscribeSeries|setInterval|random/)
  assert.match(hook, /changeBp: null/)
  const mod = fs.readFileSync('src/modules/bonds/BondsModule.jsx', 'utf8')
  assert.doesNotMatch(mod, /simulated ticks|are illustrative|session seed/)
  assert.match(mod, /const bp = \(v\) => \(v == null \? '—'/)
})
