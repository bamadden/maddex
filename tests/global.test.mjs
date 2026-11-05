// Global (Phase 5, docs/audit/global.md).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { portfolioExposure, costChannels, EXPOSURE_LABEL } from '../src/services/geopoliticalImpactService.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const store = (v) => ({ getItem: () => JSON.stringify(v) })

test('route exposure describes links; it never estimates a gain or loss', () => {
  const hormuz = { name: 'Strait of Hormuz', asxStocks: ['WDS.AX'], asxNote: 'Woodside sells LNG into Asia.', commodity: 'Crude oil' }
  const rows = portfolioExposure(hormuz, store([{ symbol: 'WDS', type: 'asx', shares: 100 }, { symbol: 'STO', type: 'asx', shares: 50 }, { symbol: 'CSL', type: 'asx', shares: 5 }, { symbol: 'AAPL', type: 'us', shares: 1 }]))
  assert.deepEqual(rows.map((r) => [r.symbol, EXPOSURE_LABEL[r.exposure]]), [['WDS', 'NAMED FOR THIS ROUTE'], ['STO', 'SECTOR LINK'], ['CSL', 'NO DIRECT LINK FOUND']])
  for (const r of rows) { assert.ok(!('impactValue' in r) && !('shockPct' in r) && !('value' in r)); assert.doesNotMatch(r.reason, /\d+(\.\d+)?%|A\$|\$\d/) }
  const svc = read('src/services/geopoliticalImpactService.js')
  assert.doesNotMatch(svc.slice(svc.indexOf('export')), /mulberry32|getMockFMPRow|Math\.random|shock/i, 'no seeded randomness, no prices')
})

test('cost channels carry no sizes, probabilities or forecasts', () => {
  for (const name of ['Strait of Hormuz', 'Taiwan Strait']) {
    for (const c of costChannels({ name })) assert.doesNotMatch(c.text, /\d|probab|likely|will |expect|estimate|outlook|cut/i, `${name}: ${c.text}`)
  }
  const ui = read('src/components/global/GeopoliticalImpact.jsx')
  assert.doesNotMatch(ui, /ESTIMATED IMPACT|Estimated portfolio impact|RBA IMPLICATIONS|what to watch/i)
  assert.match(ui, /not an estimate of gains or losses, and not a recommendation/)
  assert.match(ui, /do not forecast prices or suggest any action/)
})
