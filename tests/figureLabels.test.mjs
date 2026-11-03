// Figures on the Rates page say what they are, for when, and where from.
// The 4.3% CPI was printed as "AU CPI YoY" beside a 3.9% headline CPI with
// nothing to tell the two apart. Checked against the ABS Data API on
// 3 Nov 2026: monthly CPI 3.10001.10.50.M, Sep 2026 = 4.3; quarterly index
// 1.10001.10.50.Q, 2026-Q3 = 103.64 and 2025-Q3 = 99.73 (+3.92%).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { VERIFIED_CONSTANTS } from '../src/data/verifiedConstants.js'

const fx = fs.readFileSync('src/modules/fx/FXModule.jsx', 'utf8')
const panel = fx.slice(fx.indexOf('function RbaRateComparisonBar'), fx.indexOf('function RbaDecisionHistory'))

test('the two CPI figures are different measures, and both are as the ABS published them', () => {
  const { au } = VERIFIED_CONSTANTS
  assert.equal(au.cpi, 4.3)
  assert.equal(au.cpiPeriod, 'Sep 2026')
  assert.equal(au.cpiQuarterPeriod, 'Sep 2026 quarter')
  assert.equal(au.cpiQuarterYoY, Math.round((103.64 / 99.73 - 1) * 1000) / 10)
})

test('the real-rates panel labels each figure with measure, period and source', () => {
  assert.doesNotMatch(panel, /'AU CPI YoY'/)
  assert.match(panel, /label: 'AU CPI · MONTHLY, ANNUAL CHANGE'/)
  assert.match(panel, /12 months to \$\{au\.cpiPeriod\} · ABS monthly CPI, released \$\{formatDate\(au\.cpiLastRelease\)\}/)
  assert.match(panel, /Market close \$\{asAtLabel\(BOND_CURVES_AS_OF\.AU\)\}/)
  assert.match(panel, /As at the \$\{formatDate\(rba\.lastDecision\)\} decision · RBA/)
  assert.match(panel, /data-cpi-reconcile/)
  assert.match(panel, /au\.cpiQuarterYoY/)
})
