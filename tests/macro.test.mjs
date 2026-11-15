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
