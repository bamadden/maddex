// Data-honesty guards: claims the product must not make about data it does
// not have. Each test names the screen and the claim it removed.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { FEATURE_COPY, PLAN_CARDS } from '../src/services/plans.js'

const read = (f) => fs.readFileSync(f, 'utf8')

test('Portfolio does not count demo prices as live', () => {
  const src = read('src/modules/portfolio/PortfolioModule.jsx')
  assert.doesNotMatch(src, /label="LIVE PRICES"/)
  assert.match(src, /USING_MOCK_DATA \? 'DEMO'/)
})

test('upgrade and plan copy does not promise live P&L or live ASX prices while equities are demo', () => {
  const copy = JSON.stringify({ FEATURE_COPY, PLAN_CARDS })
  assert.doesNotMatch(copy, /live P&L/i)
  // Live ASX prices are listed as coming, not included.
  assert.doesNotMatch(copy, /\["Live ASX prices",true\]/)
})
