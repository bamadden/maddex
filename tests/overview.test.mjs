// Overview: "since your last visit" and where a new user lands. No network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { beginVisit, recordVisit, sinceLastVisit, VISIT_GAP_MS } from '../src/services/lastVisit.js'

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }
const constants = {
  rba: { decisions: [{ date: '2026-09-29', rate: 4.6, decision: 'HIKE' }, { date: '2026-11-03', rate: 4.85, decision: 'HIKE' }] },
  au: { cpi: 4.3, cpiPeriod: 'Sep 2026', cpiLastRelease: '2026-10-28', unemployment: 4.7, unemploymentPeriod: 'Sep 2026', unemploymentLastRelease: '2026-10-15', gdpQoQ: 0.4, gdpAnnual: 2.1, gdpPeriod: 'Jun 2026 quarter', gdpLastRelease: '2026-09-03' },
}

test('first visit: nothing to compare; a visit after a gap compares against the last one', () => {
  const storage = mem()
  assert.equal(beginVisit({ storage, now: 1000 }), null)
  recordVisit({ asx200: 8790.2, asx200Cls: 'LIVE', portfolioValue: 7900, portfolioKey: 'BHP:10' }, { storage, now: 2000 })
  const prev = beginVisit({ storage, now: 2000 + VISIT_GAP_MS + 1 })
  assert.deepEqual(prev, { at: 1000, lastSeen: 2000, asx200: 8790.2, asx200Cls: 'LIVE', portfolioValue: 7900, portfolioKey: 'BHP:10' })
})

test('a second tab, or a return within 30 minutes, continues the same visit (it used to reset per tab)', () => {
  const storage = mem()
  storage.setItem('maddex_last_visit', JSON.stringify({ at: 1000, lastSeen: 1000, asx200: 8000 }))
  const t0 = 1000 + VISIT_GAP_MS + 1
  const a = beginVisit({ storage, now: t0 })
  const b = beginVisit({ storage, now: t0 + 60_000 })            // another tab a minute later
  assert.deepEqual(a, b)
  assert.equal(a.asx200, 8000)
  recordVisit({}, { storage, now: t0 + 20 * 60_000 })           // still open 20 minutes in
  assert.deepEqual(beginVisit({ storage, now: t0 + 45 * 60_000 }), a, 'seen 25 minutes ago: the same visit')
})

test('lists decisions, releases, market and holdings moves, alerts and dated changes since then — computed, not estimated', () => {
  const prev = { at: Date.parse('2026-10-20T00:00:00Z'), lastSeen: Date.parse('2026-10-20T01:00:00Z'), asx200: 8790.2, asx200Cls: 'LIVE', portfolioValue: 7900, portfolioKey: 'BHP:10' }
  const now = { at: Date.parse('2026-11-04T00:00:00Z'), asx200: 8874.6, asx200Cls: 'LIVE', portfolioValue: 8230, portfolioKey: 'BHP:10' }
  const items = sinceLastVisit(prev, now, {
    constants,
    alerts: [{ at: '2026-10-25T01:00:00Z', symbol: 'BHP' }, { at: '2026-10-01T01:00:00Z', symbol: 'CBA' }],
    changes: [{ what: 'Michael Chaney leaves the Wesfarmers board', effective: '2026-10-29T13:00:00+08:00' }, { what: 'later', effective: '2026-12-01T00:00:00Z' }, { what: 'RBA decision, Tue 3 Nov 2026', effective: '2026-11-03T14:30:00+11:00' }],
  })
  const text = items.map((i) => i.text).join('\n')
  assert.match(text, /RBA hike to 4\.85% on 3 Nov 2026/)
  assert.equal(text.match(/RBA/g).length, 1, 'the decision is listed once, not again from the dated changes')
  assert.doesNotMatch(text, /2026-09-29/)
  assert.match(text, /CPI Sep 2026: 4\.3% y\/y \(ABS\), released 28 Oct 2026/)
  assert.doesNotMatch(text, /Unemployment/)
  assert.match(text, /ASX 200 \+0\.96% \(8790\.2 → 8874\.6\)/)
  assert.match(text, /Your holdings \+4\.18% \(A\$7,900 → A\$8,230\)/)
  assert.match(text, /1 alert triggered: BHP/)
  assert.match(text, /Michael Chaney leaves the Wesfarmers board/)
  assert.ok(items.some((i) => i.kind === 'change'), 'past dated changes are CHANGE, not SCHEDULED')
  assert.doesNotMatch(text, /later/)
})

test('a release later on the day of the last visit is listed (days were compared, so it was missed)', () => {
  const prev = { at: Date.parse('2026-11-25T09:00:00+11:00'), lastSeen: Date.parse('2026-11-25T09:30:00+11:00') }
  const items = sinceLastVisit(prev, { at: Date.parse('2026-11-26T08:00:00+11:00') }, { constants: { au: { cpi: 4.9, cpiPeriod: 'Oct 2026', cpiLastRelease: '2026-11-25' } } })
  assert.match(items.map((i) => i.text).join(), /CPI Oct 2026: 4\.9%/)
  const after = sinceLastVisit({ at: Date.parse('2026-11-25T12:00:00+11:00') }, { at: Date.parse('2026-11-26T08:00:00+11:00') }, { constants: { au: { cpi: 4.9, cpiPeriod: 'Oct 2026', cpiLastRelease: '2026-11-25' } } })
  assert.equal(after.length, 0, 'already public at the last visit (11:30)')
})

test('a DEMO index move is labelled and not coloured; a move whose class changed is not shown', () => {
  const base = { at: 1, lastSeen: 1, asx200: 8000, asx200Cls: 'DEMO' }
  const demo = sinceLastVisit(base, { at: 2, asx200: 8100, asx200Cls: 'DEMO' }, {})
  assert.match(demo[0].text, /DEMO, simulated/)
  assert.equal(demo[0].value, undefined)
  assert.equal(demo[0].cls, 'DEMO')
  assert.equal(sinceLastVisit(base, { at: 2, asx200: 8100, asx200Cls: 'LIVE' }, {}).length, 0)
})

test('holdings are compared only when the same holdings were fully priced both times', () => {
  const prev = { at: 1, lastSeen: 1, portfolioValue: 5000, portfolioKey: 'BHP:10' }
  assert.equal(sinceLastVisit(prev, { at: 2, portfolioValue: 9000, portfolioKey: 'BHP:10,CBA:5' }, {}).length, 0, 'a holding was added')
  assert.equal(sinceLastVisit(prev, { at: 2, portfolioValue: 9000, portfolioKey: null }, {}).length, 0, 'not all priced')
  const src = fs.readFileSync('src/modules/dashboard/OverviewSurface.jsx', 'utf8')
  assert.match(src, /h\.stats\.priced\} of \{h\.holdings\.length\} priced/)
  assert.match(src, /<ScoreNote method="regime"/)
  assert.match(src, /detectAssetType\(s\); return t === 'asx' \|\| t === 'us'/)
})

test('a first visit lists nothing', () => {
  assert.deepEqual(sinceLastVisit(null, { at: Date.now() }, { constants }), [])
})

test('new users land on the dashboard, which opens on the Overview', () => {
  assert.match(fs.readFileSync('src/store/useStore.jsx', 'utf8'), /useState\('dashboard'\)/)
  assert.match(fs.readFileSync('src/modules/dashboard/DashboardModule.jsx', 'utf8'), /=== 'custom' \? 'custom' : 'overview'/)
})
