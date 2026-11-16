import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { announcement, getNextMeeting, zonedInstant } from '../src/services/centralBankSchedule.js'

const syd = (ms) => new Date(ms).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', hour12: false, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

test('foreign decisions convert to Sydney with daylight saving on both sides', () => {
  assert.equal(syd(announcement('fed', '2026-12-09').at), '10 Dec, 06:00')
  assert.equal(announcement('fed', '2026-12-09').sydneyDate, '2026-12-10')
  assert.equal(syd(announcement('ecb', '2026-12-17').at), '18 Dec, 00:15')
  assert.equal(syd(announcement('snb', '2026-12-10').at), '10 Dec, 19:30')
  assert.equal(syd(announcement('rba', '2026-12-08').at), '8 Dec, 14:30')
  // Northern summer: FOMC 16 Sep 2026 at 14:00 EDT is 04:00 AEST on the 17th.
  assert.equal(syd(zonedInstant('2026-09-16', '14:00', 'America/New_York')), '17 Sept, 04:00')
  assert.deepEqual(announcement('boj', '2026-12-18'), { at: null, sydneyDate: '2026-12-18' })
})

test('the next meeting rolls over at Sydney midnight, not the browser\'s', () => {
  // 23:30 UTC on 7 Dec is 10:30 AEDT on 8 Dec: the 8 Dec RBA meeting is still next.
  const d = getNextMeeting(['2026-11-03', '2026-12-08', '2027-02-09'], Date.parse('2026-12-07T23:30:00Z'))
  assert.equal(d.getDate(), 8)
  const after = getNextMeeting(['2026-11-03', '2026-12-08', '2027-02-09'], Date.parse('2026-12-08T13:30:00Z'))
  assert.equal(after.getMonth(), 1)
})

test('the decisions table shows Sydney time, the reader\'s zone, and counts Sydney days', () => {
  const s = readFileSync(new URL('../src/modules/fx/UpcomingDecisions.jsx', import.meta.url), 'utf8')
  assert.match(s, /sydneyClock\(r\.at\)\.text/)
  assert.match(s, /your time \{localClock\(r\.at\)\.text\}/)
  assert.match(s, /daysBetweenDays\(today, sydneyDate\)/)
  assert.doesNotMatch(s, /Math\.ceil\(\(ts - now\)/)
  assert.doesNotMatch(readFileSync(new URL('../src/data/verifiedConstants.js', import.meta.url), 'utf8'), /09:30 CET \(snb/)
})

test('every announcement time has its source page and words; unread banks have none', async () => {
  const m = await import('../src/services/centralBankSchedule.js')
  for (const [k, v] of Object.entries(m.ANNOUNCE_AT)) {
    if (v) assert.ok(m.ANNOUNCE_SOURCE[k]?.[0] && m.ANNOUNCE_SOURCE[k]?.[1], `${k} has no source`)
  }
  assert.equal(m.ANNOUNCE_AT.boe, null)
  assert.equal(m.ANNOUNCE_AT.rbnz, undefined)
  assert.equal(m.RBNZ_MEETINGS_2026, undefined)
  assert.equal(m.PBOC_MEETINGS_2026, undefined)
  const { VERIFIED_CONSTANTS: V } = await import('../src/data/verifiedConstants.js')
  assert.equal(V.rbnz, undefined, 'RBNZ removed: rbnz.govt.nz could not be fetched to verify it')
  assert.equal(V.pboc.nextMeeting, null)
})
