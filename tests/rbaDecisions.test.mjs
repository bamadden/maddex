// The "Last 10 RBA decisions" table (Rates) shows only what the RBA
// published: the statement date, the rate and change from the RBA's cash
// rate target table, and a link to the statement. `npm run check-rba`
// re-reads every row from rba.gov.au; these tests keep the list consistent
// offline and with the rest of the page.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RBA_DECISIONS, RBA_DECISIONS_CHECKED, decisionOf, rbaStatementUrl } from '../src/data/rbaDecisions.js'
import { VERIFIED_CONSTANTS } from '../src/data/verifiedConstants.js'

const nextDay = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }

test('every row has a statement, a statement date and the next-day effective date', () => {
  assert.ok(RBA_DECISIONS.length >= 10)
  for (const d of RBA_DECISIONS) {
    assert.match(d.mr, /^mr-\d\d-\d\d$/, d.announced)
    assert.equal(d.mr.slice(3, 5), d.announced.slice(2, 4), `${d.mr} is not from ${d.announced.slice(0, 4)}`)
    assert.equal(d.effective, nextDay(d.announced), d.announced)
    assert.equal(rbaStatementUrl(d.mr), `https://www.rba.gov.au/media-releases/${d.announced.slice(0, 4)}/${d.mr}.html`)
    assert.ok(Number.isFinite(d.rate) && Number.isInteger(d.changeBp), d.announced)
  }
  assert.match(RBA_DECISIONS_CHECKED, /^\d{4}-\d\d-\d\d$/)
})

test('newest first, no gaps: each rate is the previous rate plus the published change', () => {
  for (let i = 0; i < RBA_DECISIONS.length - 1; i++) {
    const cur = RBA_DECISIONS[i], prev = RBA_DECISIONS[i + 1]
    assert.ok(cur.announced > prev.announced, `${cur.announced} after ${prev.announced}`)
    assert.equal(Math.round((cur.rate - prev.rate) * 100), cur.changeBp, `${cur.announced}: ${prev.rate} → ${cur.rate} is not ${cur.changeBp}bp`)
  }
})

test('the decision is the published change, never inferred from the rate path', () => {
  assert.deepEqual(RBA_DECISIONS.map(decisionOf).slice(0, 10),
    ['hike', 'hike', 'hold', 'hold', 'hike', 'hike', 'hike', 'hold', 'hold', 'hold'])
})

test('the newest row is the decision the hero shows (update both on decision day)', () => {
  const { rba } = VERIFIED_CONSTANTS
  assert.equal(RBA_DECISIONS[0].announced, rba.lastDecision)
  assert.equal(RBA_DECISIONS[0].rate, rba.cashRate)
  for (const d of rba.decisions) {
    const row = RBA_DECISIONS.find((r) => r.announced === d.date)
    if (row) assert.equal(row.rate, d.rate, d.date)
  }
})

test('the table reads the published list, with a source link and the announcement date', () => {
  const fx = fs.readFileSync('src/modules/fx/FXModule.jsx', 'utf8')
  const table = fx.slice(fx.indexOf('function RbaDecisionHistory'), fx.indexOf('function RbaDecisionHistory') + 2200)
  assert.match(table, /RBA_DECISIONS\.slice\(0, 10\)/)
  assert.match(table, /href=\{rbaStatementUrl\(r\.mr\)\}/)
  assert.match(table, /formatDate\(r\.announced\)/)
  assert.match(table, />ANNOUNCED</)
  assert.doesNotMatch(table, /RBA_RATE_HISTORY|rows\[0\]\.rate/)
})
