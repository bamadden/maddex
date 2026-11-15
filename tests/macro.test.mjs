// Macro (Phase B, 15 Nov 2026): series read from their publishers and dated;
// no licensed or typed iron-ore history, no typed China panel; no default
// figure for a missing value; facts, not judgements, in the fallback text.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as PH from '../src/data/placeholders.js'
import { VERIFIED_CONSTANTS as V } from '../src/data/verifiedConstants.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const code = (f) => read(f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')

test('survey and trade series are the publishers\' 2026 readings', () => {
  assert.equal(PH.MACRO_SERIES_AS_OF, '2026-11-15')
  assert.deepEqual(PH.AU_CONSUMER_SENTIMENT.at(-1), { date: 'Nov-26', value: 78.2 })
  assert.equal(PH.AU_CONSUMER_SENTIMENT[0].value, 92.9)
  assert.deepEqual(PH.AU_BUSINESS_CONFIDENCE.find((r) => r.date === 'Mar-26'), { date: 'Mar-26', value: -29 })
  assert.equal(V.au.nabConfidence, -15); assert.equal(V.au.nabPeriod, 'Oct 2026')
  assert.equal(V.au.tradeBalancePeriod, 'Sep 2026'); assert.equal(PH.AU_TRADE_BALANCE.at(-1).value, V.au.tradeBalanceBn)
  assert.ok(!('IRON_ORE_HISTORY' in PH) && !('CHINA_WATCH' in PH))
})

test('Macro shows no typed judgement, default figure or support line', () => {
  const mm = code('src/modules/macro/MacroModule.jsx')
  assert.doesNotMatch(mm, /\$90 support|'SLOWING'|'RESTRICTIVE'|both tightening above neutral|PMI readings below 50|IMPROVING|DECLINING|\?\? (2\.4|4\.1|4\.0|0\.6|0\.3)\b|\?\.value \?\? 0\b|China ≈ 32%|Forward-looking signals/)
  assert.match(mm, /COUNTRY_STATS\.CN/)
})

test('Rates: no EXPECTED stance per bank', () => {
  assert.doesNotMatch(read('src/data/placeholders.js'), /CB_EXPECTATION\s*=/)
  assert.doesNotMatch(code('src/modules/fx/UpcomingDecisions.jsx'), />EXPECTED</)
})

test('AU macro cards name the period measured and the release date; no typed priors or hand-set beat arrows', async () => {
  const P = await import('../src/data/placeholders.js')
  assert.equal(P.GLOBAL_MACRO, undefined)
  for (const r of P.AU_MACRO) {
    assert.ok(r.period, `${r.name} has no period`)
    assert.ok(!('beat' in r), `${r.name} carries a beat flag`)
    assert.ok(r.prev == null || /\d/.test(r.prev))
  }
  const src = fs.readFileSync('src/data/placeholders.js', 'utf8')
  assert.doesNotMatch(src, /prev: '[-+]?\d/, 'no typed previous reading')
  const mod = fs.readFileSync('src/modules/macro/MacroModule.jsx', 'utf8')
  assert.match(mod, /\{ind\.period\}<\/span> · released \{formatDate\(ind\.date/)
  assert.doesNotMatch(mod, /ind\.beat|as at \{monthYear\(ind\.date\)\}/)
  assert.doesNotMatch(fs.readFileSync('src/components/macro/IndicatorForecaster.jsx', 'utf8'), /preferred underlying measure/)
})

test('US CPI is compared with the Fed goal and says the goal is for PCE; inflation notes state the gap only', () => {
  const s = fs.readFileSync('src/data/recessionRisk.js', 'utf8')
  assert.match(s, /which the Fed sets for PCE inflation, not CPI/)
  assert.doesNotMatch(s, /room to cut|constrains any policy response/)
})

test('no stale market comparators: ASX P/E, dividend yield and CoreLogic are null until re-sourced', async () => {
  const { VERIFIED_CONSTANTS: V } = await import('../src/data/verifiedConstants.js')
  for (const k of ['asx200PE', 'asx200DivYield', 'corelogicHpiMoM']) assert.equal(V.au[k], null, k)
  assert.doesNotMatch(fs.readFileSync('src/modules/portfolio/PortfolioAnalytics.jsx', 'utf8'), /historically done better|has to come from price/)
})
