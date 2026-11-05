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
