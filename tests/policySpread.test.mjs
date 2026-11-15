import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spreadInForce, spreadSince, sydneyToday } from '../src/data/policySpread.js'

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

test('the spread in force is dated by the day it took effect, not today', () => {
  // 3 Nov 2026 hike announced; in force from 4 Nov.
  assert.deepEqual(spreadInForce('2026-11-03'), { bp: 60, since: '2026-09-30', au: 4.6, us: 4 })
  assert.equal(spreadInForce('2026-11-16').since, '2026-11-04')
  assert.equal(spreadSince('2026-11-16'), '2026-11-04')
  assert.equal(spreadInForce('2010-01-01'), null)
})

test('Sydney day, not the UTC day', () => {
  // 07:00 on 16 Nov in Sydney (AEDT) is still 15 Nov in UTC.
  assert.equal(sydneyToday(Date.parse('2026-11-15T20:00:00Z')), '2026-11-16')
})

test('both spread panels read the one computation, with a badge and descriptive wording', () => {
  const mon = src('modules/fx/PolicySpreadMonitor.jsx')
  const fx = src('modules/fx/FXModule.jsx')
  for (const s of [mon, fx]) {
    assert.match(s, /spreadInForce\(/); assert.match(s, /sydneyToday\(now\)/)
    assert.match(s, /as at effective date \$?\{formatDate\((day|sydneyToday\(now\))\)\}[^\n]*this level since \$?\{formatDate\((inForce|spread)\.since\)/)
  }
  assert.match(mon, /<HandEnteredBadge dataKey="rba"/)
  assert.doesNotMatch(fx, /rba\.cashRate - fed\.cashRate/)
  assert.doesNotMatch(mon + fx, /supportive for the AUD|toLocaleDateString\('en-AU', \{ day/)
})

test('Rates wording describes levels; no currency or stance calls', () => {
  const all = ['modules/fx/CentralBankTracker.jsx', 'modules/fx/FXModule.jsx', 'modules/fx/PolicySpreadMonitor.jsx', 'modules/fx/UpcomingDecisions.jsx', 'modules/fx/CentralBankCards.jsx'].map(src).join('\n')
  assert.doesNotMatch(all, /weigh on the currency|supportive for the AUD|policy is restrictive|still accommodative|rewards holding/i)
})
