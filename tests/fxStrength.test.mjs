// AUD strength vs majors (Rates page) and the AUD TWI card: an empty answer
// and a failed feed are different states. "No rates" means the feed replied
// with nothing usable; a failure shows the shared failure state, or the last
// good rows with a STALE badge. Before 3 Nov 2026 a total failure rendered as
// six rows of dashes and "No rates" could never appear.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { strengthRows, strengthState, STRENGTH_MAJORS } from '../src/modules/fx/useAudStrength.js'

const ok = (ccy, first, last) => ({ status: 'fulfilled', value: { rates: { '2026-10-01': { [ccy]: first }, '2026-10-31': { [ccy]: last } } } })
const noData = { status: 'fulfilled', value: { rates: {} } }
const down = { status: 'rejected', reason: new Error('Failed to fetch') }

test('rows: a failed fetch is marked failed; an answer without two rates is not', () => {
  const rows = strengthRows(['USD', 'EUR', 'GBP'], [ok('USD', 0.65, 0.66), noData, down])
  assert.deepEqual(rows.map((r) => [r.ccy, r.failed, typeof r.pct]), [['USD', false, 'number'], ['EUR', false, 'object'], ['GBP', true, 'object']])
})

test('rows: when every fetch fails the query errors, so React Query keeps the last good rows', () => {
  assert.throws(() => strengthRows(STRENGTH_MAJORS, STRENGTH_MAJORS.map(() => down)), /no history/)
})

test('state: a failed fetch is never "empty", in any combination', () => {
  const cell = [{ failed: true, pct: null }, { failed: false, pct: null }, { failed: false, pct: 0.4 }]
  const combos = []
  for (const a of cell) for (const b of cell) for (const c of cell) combos.push([a, b, c])
  for (const isError of [true, false]) {
    for (const rows of [undefined, ...combos]) {
      const state = strengthState({ data: rows, isError, isPending: false })
      const anyFailure = isError || !rows || rows.some((r) => r.failed)
      if (anyFailure) assert.notEqual(state, 'empty', JSON.stringify({ isError, rows, state }))
    }
  }
})

test('state: the five answers', () => {
  const good = [{ ccy: 'USD', pct: 1.2, failed: false }]
  assert.equal(strengthState({ data: undefined, isError: false, isPending: true }), 'loading')
  assert.equal(strengthState({ data: undefined, isError: true, isPending: false }), 'failed')
  assert.equal(strengthState({ data: good, isError: true, isPending: false }), 'stale')
  assert.equal(strengthState({ data: [{ ccy: 'USD', pct: null, failed: false }], isError: false, isPending: false }), 'empty')
  assert.equal(strengthState({ data: good, isError: false, isPending: false }), 'ok')
})

test('render: "No rates" only for the empty state; failure and STALE are drawn from the state', () => {
  const fx = fs.readFileSync('src/modules/fx/FXModule.jsx', 'utf8')
  assert.match(fx, /\{state === 'empty' && <NoData className="justify-start" label="No rates" \/>\}/)
  assert.match(fx, /\{state === 'failed' && !results\.isFetching && <Unavailable what="rates" \/>\}/)
  assert.match(fx, /\{state === 'stale' && <StaleBadge cachedAt=\{results\.dataUpdatedAt\} source="Frankfurter"/)
  const everywhere = fs.readdirSync('src', { recursive: true }).filter((f) => /\.jsx$/.test(f)).filter((f) => fs.readFileSync(`src/${f}`, 'utf8').includes('"No rates"'))
  assert.deepEqual(everywhere, ['modules/fx/FXModule.jsx'])
  const twi = fs.readFileSync('src/modules/fx/AudTwiCard.jsx', 'utf8')
  assert.match(twi, /stale \? 'the last Frankfurter history fetched' : 'live Frankfurter history'/)
})
