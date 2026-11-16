// Typed figures moved into registered datasets (WS1, 16 Nov 2026). Each was
// found outside any dataset by an audit of components, services and prompts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { cgt } from '../src/modules/calculators/calcMath.js'
import { CGT, COMPANY_TAX_RATE, heldTwelveMonths } from '../src/data/auTaxRates.js'
import { TAX_RATES } from '../src/services/performanceMath.js'
import VERIFIED_CONSTANTS from '../src/data/verifiedConstants.js'
import { CPI_REFERENCE } from '../src/services/marketRegime.js'

// Source without comments, so a note about a removed figure does not count.
const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => { const p = path.join(d, e.name); return e.isDirectory() ? walk(p) : /\.(js|jsx)$/.test(e.name) ? [p] : [] })
const HELD = /Rba(HeroCard|DecisionCard|DecisionPreview|HikeImpact)|ReleaseWatchBanner/

test('CGT: the discount starts the day after the first anniversary, leap years included', () => {
  assert.equal(heldTwelveMonths('2026-01-14', '2027-01-14'), false)
  assert.equal(heldTwelveMonths('2026-01-14', '2027-01-15'), true)
  // 366 days, but on the anniversary: no discount (365-day counting said yes).
  const onAnniversary = cgt({ buy: 100, sell: 200, buyDate: '2027-03-01', sellDate: '2028-03-01', marginalPct: 30 })
  assert.equal(onAnniversary.discounted, false)
  const after = cgt({ buy: 100, sell: 200, buyDate: '2027-03-01', sellDate: '2028-03-02', marginalPct: 30 })
  assert.equal(after.discounted, true)
  assert.equal(after.taxable, 100 * (1 - CGT.discount))
})

test('tax rules have one home: no typed CGT discount, company rate, brackets or contributions tax elsewhere', () => {
  assert.deepEqual(TAX_RATES, [0, 15, 30, 37, 45])
  assert.equal(COMPANY_TAX_RATE, 0.30)
  const files = ['src/modules/calculators/calcMath.js', 'src/modules/calculators/CalculatorsModule.jsx', 'src/services/performanceMath.js', 'src/services/dividendSchedule.js', 'src/modules/portfolio/performanceModel.js', 'src/modules/portfolio/PortfolioAnalytics.jsx', 'src/services/systemPrompt.js']
  for (const f of files) {
    const s = code(f)
    assert.doesNotMatch(s, /50% (CGT|of the gain|applied)|\* 0\.5\b|gain \/ 2|30% company|30 \/ 70|15% contributions|contributionsTax = 0\.15|held > 365/, f)
  }
  assert.doesNotMatch(code('src/modules/calculators/CalculatorsModule.jsx'), /value: '37', label: '37%'/)
})

test("the RBA's 2-3% target is read from verifiedConstants, not typed", () => {
  const { rbaTargetLow, rbaTargetHigh, rbaTargetBand } = VERIFIED_CONSTANTS.au
  assert.deepEqual([rbaTargetLow, rbaTargetHigh, rbaTargetBand], [2, 3, '2–3%'])
  assert.equal(CPI_REFERENCE, rbaTargetHigh)
  for (const f of walk('src').filter((x) => !HELD.test(x) && !x.endsWith('verifiedConstants.js'))) {
    const s = code(f)
    assert.doesNotMatch(s, /2[–-]3%|midpoint 2\.5|refLine=\{2\.5\}|v > 3\)|latestCPI > 3/, f)
  }
})

test('no typed growth reference, release timing or survey average in Macro text', () => {
  for (const f of ['src/services/marketRegime.js', 'src/modules/macro/MacroDeepDive.jsx', 'src/components/macro/IndicatorForecaster.jsx', 'src/components/ui/RegimeBadge.jsx']) {
    const s = code(f).replace(/export const GROWTH_REFERENCE = 2\.25/, '')
    assert.doesNotMatch(s, /2\.25%|~2\.25|trend ~|early Dec|late Jan|mid-November|long-run average/, f)
  }
})

test('coin descriptions carry no unsourced counts or speeds', () => {
  const s = code('src/components/ui/DetailModal.jsx')
  const block = s.slice(s.indexOf('const COIN_DESCRIPTIONS'), s.indexOf('function coinDescription'))
  assert.doesNotMatch(block, /\d[\d,]*\+|\d+M\+|transactions per second|leading|store of value/i)
})

test('circuit-breaker levels are dated and sourced; stress scenarios say what the code applies', () => {
  const vb = code('src/modules/markets/VolatilityBanner.jsx')
  assert.match(vb, /MWCB_CHECKED = '\d{4}-\d{2}-\d{2}'/)
  assert.match(vb, /NYSE Rule 7\.12/)
  const st = code('src/modules/portfolio/StressTest.jsx')
  assert.doesNotMatch(st, /REITs down ~5%|Banks up ~2%/)
  assert.match(st, /not a forecast/)
})
