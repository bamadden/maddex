// "The highest since …" on the RBA decision card is worked out from the
// RBA's record of the cash rate target, not typed in. Checked against the
// RBA's cash rate target table, 3 Nov 2026.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RBA_TARGET_PATH, highestSinceYear, levelContextFor } from '../src/data/rbaCashRatePath.js'
import { VERIFIED_CONSTANTS } from '../src/data/verifiedConstants.js'
import { RBA_RATE_HISTORY } from '../src/data/placeholders.js'

test('the derived wording matches the record at the levels that matter today', () => {
  // The record as it stood after each decision.
  const upTo = (iso) => RBA_TARGET_PATH.filter((p) => p.effective <= iso)
  assert.equal(highestSinceYear(4.60, { asOf: '2026-09-29', path: upTo('2026-09-30') }), 2011)   // 4.75% until the 2 Nov 2011 cut
  assert.equal(levelContextFor(4.60, { asOf: '2026-09-29', path: upTo('2026-09-30') }), 'the highest since 2011')
  assert.equal(highestSinceYear(4.85, { asOf: '2026-11-03' }), 2008)   // 5.25% until the 3 Dec 2008 cut
  assert.equal(levelContextFor(4.85, { asOf: '2026-11-03' }), 'the highest since 2008')
  const at = (rate) => [...upTo('2026-09-30'), { effective: '2026-11-04', rate }]
  assert.equal(highestSinceYear(5.00, { asOf: '2026-11-03', path: at(5.00) }), 2008)
  assert.equal(highestSinceYear(4.75, { asOf: '2026-11-03', path: at(4.75) }), 2008) // 4.75% was the 2010–11 level, not above it
})

test('no "highest since" after a cut, or when the record never shows it higher', () => {
  const cut = [...RBA_TARGET_PATH.filter((p) => p.effective <= '2026-09-30'), { effective: '2026-11-04', rate: 4.35 }]
  assert.equal(levelContextFor(4.35, { asOf: '2026-11-03', path: cut }), null) // 4.60% the day before
  assert.equal(highestSinceYear(4.60, { asOf: '2026-11-03' }), null)   // 4.85% is in force: not today's rate
  assert.equal(highestSinceYear(7.50), null)                           // above everything recorded since 2008

})

test('the record is in order, consistent with the cash-rate path, and ends at today\'s rate', () => {
  for (let i = 1; i < RBA_TARGET_PATH.length; i++) {
    assert.ok(RBA_TARGET_PATH[i].effective > RBA_TARGET_PATH[i - 1].effective)
    assert.notEqual(RBA_TARGET_PATH[i].rate, RBA_TARGET_PATH[i - 1].rate, `${RBA_TARGET_PATH[i].effective} is not a change`)
  }
  const changes = RBA_RATE_HISTORY.filter((r, i, a) => i === 0 || r.rate !== a[i - 1].rate)
  for (const c of changes) {
    const row = RBA_TARGET_PATH.find((p) => p.effective === c.date)
    assert.ok(row, `cash-rate path change ${c.date} is not in the RBA record`)
    assert.equal(row.rate, c.rate, c.date)
  }
  assert.equal(RBA_TARGET_PATH.at(-1).rate, VERIFIED_CONSTANTS.rba.cashRate)
})

test('the decision card reads the derived wording (the card itself is unchanged)', () => {
  const { rba } = VERIFIED_CONSTANTS
  assert.equal(rba.levelContext, levelContextFor(rba.cashRate, { asOf: rba.lastDecision }))
  assert.equal(JSON.parse(JSON.stringify(rba)).levelContext, rba.levelContext, 'survives serialisation (AI context)')
})
