// FX on Rates and the Dashboard: the ECB's daily reference rate is DELAYED,
// never "LIVE", and is dated by the ECB's own rate date. It publishes no
// change, so a pair's change is unavailable ("—"), never "▲0.00%".

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { transformFxRates } from '../src/services/api.js'

const read = (f) => fs.readFileSync(f, 'utf8')

test('a pair from the reference rates has no change and no invented bid/ask', () => {
  const pairs = transformFxRates({ USD: 0.7008, EUR: 0.6248, GBP: 0.5222, JPY: 110.66 })
  assert.ok(pairs.length >= 4)
  for (const p of pairs) {
    assert.equal(p.pct, null, p.pair)
    assert.equal(p.change, null, p.pair)
    assert.ok(!('bid' in p) && !('ask' in p), `${p.pair} carries a bid/ask the ECB never published`)
  }
})

test('a missing change renders as "—", never as zero', () => {
  const fx = read('src/modules/fx/FXModule.jsx')
  const grid = fx.slice(fx.indexOf('function FxRatesGrid'), fx.indexOf('function CurrencyStrengthIndex'))
  assert.match(grid, /pct == null \? \(/)
  assert.doesNotMatch(grid, /pct \?\? 0/)
})

test('FX is DELAYED with the ECB rate date, not LIVE with a render time', () => {
  const fx = read('src/modules/fx/FXModule.jsx')
  assert.doesNotMatch(fx, /AUD\/USD · LIVE/)
  assert.match(fx, /cls=\{fxDelayed \? 'STALE' : 'DELAYED'\} source="ECB reference rate, via Frankfurter" at=\{fxDelayed \? fxResult\?\.cachedAt \?\? null : rawRates\?\.asOf \?\? null\}/)
  assert.match(fx, /cls=\{stale \? 'STALE' : 'DELAYED'\} source="ECB reference rate, via Frankfurter"/)
  const ov = read('src/modules/dashboard/OverviewSurface.jsx')
  assert.match(ov, /classOfResult\(fx, \{ delayed: true \}\)\} source="FX · ECB reference rate" at=\{fx\?\.stale \? fx\.cachedAt : fx\?\.data\?\.asOf \?\? null\}/)
})
