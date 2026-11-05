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

test('route status has one dated source; route notes and map zones carry no unsourced figures', async () => {
  const { SHIPPING_ROUTES, routeFor, brentReading } = await import('../src/data/shippingRoutes.js')
  for (const r of SHIPPING_ROUTES) {
    assert.match(r.asOf, /^\d{4}-\d{2}-\d{2}$/, `${r.name} has an entry date`)
    assert.ok(['OPEN', 'MONITORED', 'DISRUPTED'].includes(r.status), r.name)
    for (const t of [r.note, r.history, r.asxNote]) assert.doesNotMatch(t, /%|\$|\d+\s*(day|Mt|mb|bn|B\b|T\b)|surged|\+\d/i, `${r.name}: ${t}`)
    assert.ok(!('cargoValue' in r) && !('impact' in r), `${r.name}: no hand-typed cargo values`)
  }
  assert.equal(routeFor('hormuz').status, 'DISRUPTED', 'Hormuz reads the same everywhere')
  const intel = read('src/modules/global/intelMapData.js')
  const zones = intel.slice(intel.indexOf('export const SHIPPING_DISRUPTIONS'), intel.indexOf('export const COMMODITY_SITES'))
  for (const line of zones.split('\n').filter((l) => /^\s+(detail|impact):/.test(l))) {
    assert.doesNotMatch(line, /%|US\$|A\$|\d{2,}\s*(vessels|ships|days)|\+\d|quarter|fifth|half of/i, line.trim())
  }
  const b = brentReading()
  assert.equal(typeof b.value, 'number'); assert.match(b.asOf, /^\d{4}-\d{2}-\d{2}$/); assert.ok(b.source)
  assert.equal(brentReading({ commodities: {} }), null, 'no Brent held: nothing shown, never 0')
  const mod = read('src/modules/global/GlobalModule.jsx')
  assert.doesNotMatch(mod, /\$25\.4T|price:76\.50|Monitor AU energy\/commodity exposure|freight cost outlook/)
  assert.match(mod, /\.\.\.held\('brentUSD'\)/, 'Commodity Flows Brent is the dated constant')
})

test('AI map narrative cannot carry a figure', async () => {
  const { overlayNarrative } = await import('../src/modules/global/intelMapData.js')
  const rows = [{ id: 'hormuz', name: 'Strait of Hormuz', detail: 'base', impact: 'base' }]
  const out = overlayNarrative(rows, [{ id: 'hormuz', name: 'Strait of Hormuz', detail: 'Tankers diverted.', impact: 'Freight rates +340%' }], ['detail', 'impact'])
  assert.equal(out[0].detail, 'Tankers diverted.')
  assert.equal(out[0].impact, 'base', 'a model string with a digit is dropped')
})

test('bilateral trade: ABS values for Australia\'s pairs only; nothing generated for other pairs', async () => {
  const { partnerTrade, auTradeWith } = await import('../src/services/bilateralTrade.js')
  const cn = partnerTrade('Australia', 'China')
  assert.equal(cn.exportsBn, 188.7); assert.equal(cn.importsBn, 120.0); assert.match(cn.source, /^ABS/); assert.equal(cn.period, '2024-25')
  assert.deepEqual(partnerTrade('China', 'Australia'), cn, 'the same pair read from either side')
  assert.equal(partnerTrade('Australia', 'USA').importsBn, 96.8, 'aliases resolve')
  assert.equal(partnerTrade('Australia', 'India').importsBn, null, 'outside the ABS top five: null, shown as —, never 0')
  assert.equal(partnerTrade('Germany', 'France'), null)
  assert.equal(auTradeWith('China', { auTrade: undefined }), null)
  const mod = read('src/modules/global/GlobalModule.jsx')
  assert.doesNotMatch(mod, /seededHash|partnerTradeStats|Illustrative bilateral estimates/)
})
