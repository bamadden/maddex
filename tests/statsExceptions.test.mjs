// The stats check's exceptions excuse one exact drift until a hard expiry
// (Sydney date); after it the drift fails again (scripts/statsExceptions).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STATS_EXCEPTIONS, excuseRow, excuseMisses, staleExceptions } from '../scripts/statsExceptions.mjs'

const row = { label: 'RBA cash rate', constant: 4.85, official: 4.6, status: 'drift' }
const before = Date.parse('2026-11-04T23:59:00+11:00')   // 4 Nov, 11:59pm AEDT
const after = Date.parse('2026-11-05T00:00:00+11:00')    // 5 Nov, midnight AEDT

test('the cash-rate drift is excused until 5 Nov 2026 (Sydney), then fails again', () => {
  assert.ok(excuseRow(row, { now: before }))
  assert.equal(excuseRow(row, { now: after }), null)
  const brisbane = Date.parse('2026-11-04T23:30:00+10:00') // 5 Nov 00:30 in Sydney
  assert.equal(excuseRow(row, { now: brisbane }), null, 'the expiry is a Sydney date, not Brisbane')
})

test('only the exact figure and values are excused', () => {
  assert.equal(excuseRow({ ...row, constant: 5.10 }, { now: before }), null)
  assert.equal(excuseRow({ ...row, official: 4.35 }, { now: before }), null)
  assert.equal(excuseRow({ ...row, label: 'AU CPI (annual)' }, { now: before }), null)
  assert.equal(excuseRow({ ...row, status: 'match' }, { now: before }), null)
})

test('history misses: only the named period is excused', () => {
  const misses = [{ period: '2026-11-03', ours: 'HIKE 4.85' }, { period: '2026-09-29', ours: 'HIKE 4.60' }]
  const { excused, failing } = excuseMisses('RBA decisions', misses, { now: before })
  assert.deepEqual(excused.map((m) => m.period), ['2026-11-03'])
  assert.deepEqual(failing.map((m) => m.period), ['2026-09-29'])
  assert.equal(excuseMisses('RBA decisions', misses, { now: after }).failing.length, 2)
})

test('expired or unneeded exceptions are flagged for removal', () => {
  const hist = [{ label: 'RBA decisions', misses: [{ period: '2026-11-03' }] }]
  assert.deepEqual(staleExceptions({ rows: [row], hist, now: before }), [])
  assert.equal(staleExceptions({ rows: [row], hist, now: after }).length, STATS_EXCEPTIONS.length)
  assert.equal(staleExceptions({ rows: [{ ...row, status: 'match' }], hist: [], now: before }).length, STATS_EXCEPTIONS.length)
  for (const e of STATS_EXCEPTIONS) assert.ok(e.until <= '2026-11-05' && e.reason.length > 20, 'every exception is short-lived and says why')
})
