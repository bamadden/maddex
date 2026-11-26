// Dashboard (Phase 5, docs/audit/dashboard.md).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { byMove } from '../src/modules/dashboard/portfolioSnapshot.js'

const read = (f) => fs.readFileSync(f, 'utf8')

test('holdings and watchlist lead with the day\'s biggest moves, either way', () => {
  const rows = [{ s: 'A', pct: 0.2 }, { s: 'B', pct: -3.1 }, { s: 'C', pct: null }, { s: 'D', pct: 1.4 }, { s: 'E', pct: -0.2 }]
  assert.deepEqual(byMove(rows).map((r) => r.s), ['B', 'D', 'A', 'E', 'C'], 'ties keep list order; no move yet goes last')
  assert.deepEqual(byMove(['X', 'Y'], () => null), ['X', 'Y'])
  const ov = read('src/modules/dashboard/OverviewSurface.jsx')
  assert.match(ov, /byMove\(holdingRows\(/)
  assert.match(ov, /const ranked = byMove\(all, /)
  assert.match(ov, /more on the list/, 'a cut watchlist says how many more')
})

test('data health: stale and not-loaded feeds are told apart; licensed-off sources are not faults', async () => {
  const { feedHealth, healthSummary, FEEDS } = await import('../src/services/dataHealth.js')
  const now = Date.parse('2026-11-05T00:00:00Z')
  const store = { maddex_live_fx_rates: { timestamp: now - 10 * 60_000 }, maddex_live_crypto_prices: { timestamp: now - 5 * 3600_000 } }
  const feeds = feedHealth({ now, read: (k) => store[k] ?? null })
  assert.ok(!feeds.some((f) => f.label === 'DeFi TVL'), 'DefiLlama is switched off for licensing')
  assert.equal(feeds.length, FEEDS.length - 1)
  const h = healthSummary(feeds, { fetchedAt: now, rows: [{ status: 'match' }, { status: 'match' }, { status: 'drift' }, { status: 'unavailable' }] })
  assert.deepEqual([h.fresh, h.stale, h.notLoaded], [1, ['Crypto'], feeds.length - 2])
  assert.deepEqual([h.stats.match, h.stats.drift, h.stats.unavailable, h.stats.total], [2, 1, 1, 4])
  assert.equal(h.ok, false)
  assert.equal(healthSummary(feeds.map((f) => ({ ...f, at: null })), null).ok, true, 'nothing loaded is not a fault')
  assert.match(read('src/components/settings/DataHealthPanel.jsx'), /feedHealth\(\{ now \}\)/, 'Settings reads the same feeds')
})

test('the Overview health line reads the queries its panels show', async () => {
  const { queryHealth, healthSummary } = await import('../src/services/dataHealth.js')
  const rows = queryHealth([
    { label: 'Indices', state: { status: 'success', dataUpdatedAt: 1, data: { data: {}, stale: false } } },
    { label: 'FX (ECB)', state: { status: 'success', dataUpdatedAt: 2, data: { data: {}, stale: true } } },
    { label: 'Calendar', state: { status: 'success', dataUpdatedAt: 3, data: { source: 'fallback' } } },
    { label: 'News', state: { status: 'error', dataUpdatedAt: 4 } },
    { label: 'Crypto', state: undefined },
  ])
  const h = healthSummary(rows, null)
  assert.deepEqual([h.fresh, h.stale, h.notLoaded], [1, ['FX (ECB)', 'Calendar', 'News'], 1])
  assert.match(read('src/modules/dashboard/OverviewSurface.jsx'), /queryHealth\(SCREEN_FEEDS\.map/)
})

test("today's brief: read from the Brief cache, zones named, no outlook score", async () => {
  const { briefHourLabel } = await import('../src/services/morningBriefService.js')
  assert.equal(briefHourLabel(new Date('2026-11-05T00:00:00Z')), '7am AEST (8am AEDT)')
  assert.equal(briefHourLabel(new Date('2026-06-04T00:00:00Z')), '7am AEST')
  const ov = read('src/modules/dashboard/OverviewSurface.jsx')
  const panel = ov.slice(ov.indexOf('function BriefSummary'), ov.indexOf('// ── Coming up'))
  assert.match(panel, /getCachedBrief\(\)/)
  assert.doesNotMatch(panel, /generateMorningBrief|askClaude|scoreLabel|OUTLOOK/, 'no AI call and no tone score from the Overview')
  assert.match(panel, /Written by MaddenAI from the data shown/)
  assert.match(ov, /brief: <BriefSummary key=\{id\} goTo=\{setActiveModule\}/)
})

test('coming up: every time carries its zone; the hand-entered schedule is DELAYED with its checked date, never STALE', () => {
  const ov = read('src/modules/dashboard/OverviewSurface.jsx')
  const panel = ov.slice(ov.indexOf('function ComingUp'), ov.indexOf('export default function OverviewSurface'))
  assert.match(panel, /sydneyClock\(t\)\.text/)
  assert.doesNotMatch(panel, /sydneyClock\(t\)\.time/)
  // STALE means a feed failed just now; the calendar feed is licensed off, so
  // the schedule is a dated hand-entered record (15 Nov 2026).
  assert.match(panel, /<DataBadge cls="DELAYED" source="agency release calendars" at=\{ECON_SCHEDULE_CHECKED\} manual \/>/)
  assert.doesNotMatch(panel, /cls="STALE"|cls="LIVE"/)
})

test('panel order: moves, survives a reload, ignores stale entries, resets', async () => {
  const { normaliseOrder, moveId, readOrder, saveOrder, clearOrder, OVERVIEW_PANELS } = await import('../src/modules/dashboard/overviewOrder.js')
  assert.deepEqual(moveId(OVERVIEW_PANELS, 'holdings', -1).slice(0, 2), ['holdings', 'rba'])
  assert.deepEqual(moveId(OVERVIEW_PANELS, 'rba', -1), OVERVIEW_PANELS, 'the first cannot move earlier')
  assert.deepEqual(moveId(OVERVIEW_PANELS, 'coming', 1), OVERVIEW_PANELS, 'the last cannot move later')
  assert.deepEqual(normaliseOrder(['coming', 'gone', 'coming', 'rba']), ['coming', 'rba', 'holdings', 'watch', 'since', 'brief'], 'unknown and repeated ids dropped, new panels appended')
  assert.deepEqual(normaliseOrder('junk'), OVERVIEW_PANELS)
  const m = new Map(); const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }
  saveOrder(['brief', 'rba'], storage)
  assert.deepEqual(readOrder(storage).slice(0, 2), ['brief', 'rba'])
  clearOrder(storage)
  assert.deepEqual(readOrder(storage), OVERVIEW_PANELS)
})

// WS2 re-audit, 26 Nov 2026: ten CUSTOM widgets showed figures with no class.
test('every Dashboard widget that shows data carries the shared badge; the rest say why not', () => {
  const dir = 'src/modules/dashboard/widgets'
  const EXEMPT = {
    'ActivityFeedWidget.jsx': "the reader's own activity in Maddex, not sourced data",
    'CalcQuickWidget.jsx': "results calculated from the reader's own inputs",
    'QuickActionsWidget.jsx': 'navigation buttons only',
  }
  const BADGE = /<DataBadge |<WidgetSource |<AIContentBadge |<HandEnteredBadge |<VerifiedBadge /
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('Widget.jsx'))) {
    const src = fs.readFileSync(`${dir}/${f}`, 'utf8')
    if (EXEMPT[f]) { assert.doesNotMatch(src, /useQuery|VERIFIED_CONSTANTS|getMock/, `${f} is exempt but reads data`); continue }
    assert.match(src, BADGE, `${f}: no data badge`)
  }
  const div = fs.readFileSync(`${dir}/DividendScheduleWidget.jsx`, 'utf8')
  assert.doesNotMatch(div, /> \/yr</)
  assert.match(div, /not a forecast of income/)
})

test('CUSTOM: a swap never puts one widget on top of another (WS2 re-audit H1)', async () => {
  const { swapPlacement } = await import('../src/modules/dashboard/gridPlacement.js')
  const W = (id, col, row, w = 1, h = 1) => ({ widgetId: id, col, row, w, h })
  // The default 3-column layout: row 0 three singles; row 1 a 2-wide index bar and a single.
  const layout = [W('portfolio', 0, 0), W('score', 1, 0), W('next', 2, 0), W('index', 0, 1, 2), W('watch', 2, 1)]
  assert.equal(swapPlacement(layout, 2, 3, 3), null, 'index (2 wide) into next\'s slot would cover score')
  const ok = swapPlacement(layout, 0, 1, 3)
  assert.deepEqual(ok.slice(0, 2).map((w) => [w.widgetId, w.col, w.row]), [['portfolio', 1, 0], ['score', 0, 0]])
  assert.equal(swapPlacement(layout, 1, 1, 3), null)
  const cells = (ws) => ws.flatMap((w) => Array.from({ length: w.w * w.h }, (_, k) => `${w.col + (k % w.w)},${w.row + Math.floor(k / w.w)}`))
  for (let i = 0; i < layout.length; i++) for (let j = 0; j < layout.length; j++) {
    const n = swapPlacement(layout, i, j, 3)
    if (n) assert.equal(new Set(cells(n)).size, cells(n).length, `swap ${i}↔${j} overlaps`)
  }
})
