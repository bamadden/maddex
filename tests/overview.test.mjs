// Overview: "since your last visit" and where a new user lands. No network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { beginVisit, recordVisit, sinceLastVisit } from '../src/services/lastVisit.js'

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }
const constants = {
  rba: { decisions: [{ date: '2026-09-29', rate: 4.6, decision: 'HIKE' }, { date: '2026-11-03', rate: 4.85, decision: 'HIKE' }] },
  au: { cpi: 4.3, cpiPeriod: 'Sep 2026', cpiLastRelease: '2026-10-28', unemployment: 4.7, unemploymentPeriod: 'Sep 2026', unemploymentLastRelease: '2026-10-15', gdpQoQ: 0.4, gdpAnnual: 2.1, gdpPeriod: 'Jun 2026 quarter', gdpLastRelease: '2026-09-03' },
}

test('first visit: nothing to compare; the next visit compares against this one', () => {
  const storage = mem()
  assert.equal(beginVisit({ storage, session: mem(), now: 1000 }), null)
  recordVisit({ asx200: 8790.2, portfolioValue: 7900 }, { storage })
  const prev = beginVisit({ storage, session: mem(), now: 2000 })
  assert.deepEqual(prev, { at: 1000, asx200: 8790.2, portfolioValue: 7900 })
})

test('within one session the comparison does not reset', () => {
  const storage = mem(), session = mem()
  storage.setItem('maddex_last_visit', JSON.stringify({ at: 1000, asx200: 8000 }))
  const a = beginVisit({ storage, session, now: 5000 })
  const b = beginVisit({ storage, session, now: 6000 })
  assert.deepEqual(a, b)
  assert.equal(a.asx200, 8000)
})

test('lists decisions, releases, market and holdings moves, alerts and scheduled changes since then — computed, not estimated', () => {
  const prev = { at: Date.parse('2026-10-20T00:00:00Z'), asx200: 8790.2, portfolioValue: 7900 }
  const now = { at: Date.parse('2026-11-04T00:00:00Z'), asx200: 8874.6, portfolioValue: 8230 }
  const items = sinceLastVisit(prev, now, {
    constants,
    alerts: [{ at: '2026-10-25T01:00:00Z', symbol: 'BHP' }, { at: '2026-10-01T01:00:00Z', symbol: 'CBA' }],
    changes: [{ what: 'Michael Chaney leaves the Wesfarmers board', effective: '2026-10-29T13:00:00+08:00' }, { what: 'later', effective: '2026-12-01T00:00:00Z' }],
  })
  const text = items.map((i) => i.text).join('\n')
  assert.match(text, /RBA hike to 4\.85% on 3 Nov 2026/)
  assert.doesNotMatch(text, /2026-09-29/)                          // before the last visit
  assert.match(text, /CPI Sep 2026: 4\.3% y\/y \(ABS\), released 28 Oct 2026/)
  assert.doesNotMatch(text, /Unemployment/)                         // released before the last visit
  assert.match(text, /ASX 200 \+0\.96% \(8790\.2 → 8874\.6\)/)
  assert.match(text, /Your holdings \+4\.18% \(A\$7,900 → A\$8,230\)/)
  assert.match(text, /1 alert triggered: BHP/)
  assert.match(text, /Michael Chaney leaves the Wesfarmers board/)
  assert.doesNotMatch(text, /later/)
})

test('a first visit lists nothing', () => {
  assert.deepEqual(sinceLastVisit(null, { at: Date.now() }, { constants }), [])
})

test('new users land on the dashboard, which opens on the Overview', () => {
  assert.match(fs.readFileSync('src/store/useStore.jsx', 'utf8'), /useState\('dashboard'\)/)
  assert.match(fs.readFileSync('src/modules/dashboard/DashboardModule.jsx', 'utf8'), /=== 'custom' \? 'custom' : 'overview'/)
})
