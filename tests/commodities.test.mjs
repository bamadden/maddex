// Commodity prices and index closes (Ben's decision, 16 Nov 2026): re-read
// from a sourced feed or removed. Brent and WTI are the EIA's spot prices; no
// other commodity price and no index close is held, and no screen or prompt
// shows one, or a zero, in its place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import VC from '../src/data/verifiedConstants.js'
import { DATASETS } from '../src/data/registry.js'

const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
const C = VC.commodities

test('only crude is held, from the EIA, dated; the rest are null', () => {
  for (const k of ['ironOreUSD', 'thermalCoalUSD', 'lngUSDPerMMBtu', 'copperUSDPerLb', 'copperUSDPerTonne', 'wheatUSDPerBu', 'lithiumCNYPerTonne', 'lithiumUSDPerTonne']) assert.equal(C[k], null, k)
  for (const k of ['brentUSD', 'wtiUSD']) {
    assert.ok(typeof C[k] === 'number', k)
    assert.match(C.sourceBy[k], /^US EIA/)
    assert.match(C.sourceUrlBy[k], /^https:\/\/www\.eia\.gov\//)
    assert.match(C.asOfBy[k], /^\d{4}-\d{2}-\d{2}$/)
  }
  assert.equal(C.previous, null)
  const ds = DATASETS.find((d) => d.asOf?.vc === 'commodities')
  assert.equal(ds.fetch.verify, 'npm run data:verify -- eia')
  assert.ok(!('indices' in VC), 'index closes removed')
  assert.ok(!DATASETS.some((d) => d.id === 'vc:indices'))
})

test('no screen or prompt formats a missing commodity price', () => {
  const files = ['src/modules/dashboard/widgets/CommodityWidget.jsx', 'src/modules/markets/sectorDrivers.js', 'src/modules/global/IntelPanel.jsx', 'src/modules/macro/MacroModule.jsx',
    'src/services/aiDaily.js', 'src/services/researchNoteService.js', 'src/services/macroContext.js', 'src/services/personalDigest.js', 'src/data/futuresData.js']
  for (const f of files) {
    // A field is only formatted on a line that checks it for null first, or
    // through a helper that does.
    const lines = code(f).split('\n')
    const unguarded = lines.filter((l, i) => /(commodities|\bC|\bcm|\bc|CMD)\.(ironOreUSD|thermalCoalUSD|lngUSDPerMMBtu|copperUSDPerLb|lithiumCNYPerTonne)\??\.(toFixed|toLocaleString)|\$\{(commodities|C|cm|c)\.(ironOreUSD|thermalCoalUSD|lngUSDPerMMBtu|copperUSDPerLb)\}/.test(l)
      && !/(ironOreUSD|thermalCoalUSD|lngUSDPerMMBtu|copperUSDPerLb|lithiumCNYPerTonne) [!=]= null/.test(`${lines[i - 1] ?? ''} ${l}`))
    assert.deepEqual(unguarded, [], f)
  }
  assert.match(code('src/modules/dashboard/widgets/CommodityWidget.jsx'), /C\.notShown/)
  assert.match(code('src/services/aiDaily.js'), /Do not state a level/)
})

test('the Rates yield curve draws no RBA hike or hold scenario', () => {
  const fx = code('src/modules/fx/FXModule.jsx')
  assert.doesNotMatch(fx, /HIKE SCENARIO|HOLD SCENARIO|AU if RBA (hikes|holds)|scenarioShift|AUscenario/)
})
