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
