// The Global map's editorial content (Ben's decision, 16 Nov 2026): re-read
// from a sourced feed or removed. Shipping zones take their status, text and
// sources from the dated chokepoint table; nothing else on the map carries an
// unsourced claim, rating or figure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as M from '../src/modules/global/intelMapData.js'
import { routeFor } from '../src/data/shippingRoutes.js'

test('shipping zones come from the dated, sourced route table', () => {
  assert.ok(M.SHIPPING_DISRUPTIONS.length >= 4)
  for (const z of M.SHIPPING_DISRUPTIONS) {
    const r = routeFor(z.id)
    assert.ok(r, z.id)
    assert.equal(z.detail, r.note)
    assert.ok(z.sources.length > 0 && z.sources.every((s) => s.url && s.date), `${z.id} sources`)
    assert.ok(!('startDate' in z) && !('asxImpact' in z), z.id)
  }
  assert.equal(M.INTEL_MAP_REVIEWED, '2026-11-16')
})

test('no unsourced narrative, rating, capacity or figure remains', () => {
  assert.deepEqual(M.GEOPOLITICAL_EVENTS, [])
  for (const c of M.UNDERSEA_CABLES) assert.ok(!('capacity' in c) && !('owner' in c))
  for (const b of M.MILITARY_BASES) assert.ok(!('significance' in b))
  for (const n of Object.values(M.ROUTE_NOTES)) assert.ok(!('risks' in n))
  for (const x of Object.values(M.SITE_EXTRAS)) assert.ok(!('risks' in x))
  for (const t of M.TRADE_ROUTES) {
    assert.ok(!('exports' in t), t.id)
    if (!t.id.startsWith('AU-')) assert.equal(t.value, null, `${t.id}: no illustrative value`)
  }
  assert.doesNotMatch(JSON.stringify(M.AU_KEY_SITES), /A\$\d/)
  assert.ok(!('NZ' in M.CENTRAL_BANK_SITES))
})
