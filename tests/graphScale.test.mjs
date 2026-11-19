// Relationships at scale (WS5, 19 Nov 2026): a synthetic graph of 3,000
// nodes and 6,000 edges goes through the canvas's own layout and the query
// functions within a budget. The data is synthetic test data only; it never
// reaches the app.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSimulation, settle, labelled, LARGE_GRAPH, LARGE_TICKS } from '../src/modules/relationships/graphLayout.js'
import { neighbourhood, searchNodes } from '../src/services/graphQuery.js'

function synthetic(n = 3000, m = 6000) {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, type: i % 10 === 0 ? 'person' : 'company', name: `Company ${i}`, ticker: `T${i}`, top20: i < 20 }))
  const edges = Array.from({ length: m }, (_, i) => ({ id: `e${i}`, from: `n${Math.floor(rnd() * n)}`, to: `n${Math.floor(rnd() * n)}`, type: i % 3 ? 'competes_with' : 'owns', confidence: 'DISCLOSED' })).filter((e) => e.from !== e.to)
  return { nodes, edges, byId: new Map(nodes.map((x) => [x.id, x])) }
}

test('a 3,000-node view lays out to rest within the budget', () => {
  const g = synthetic()
  const nodes = g.nodes.map((n) => ({ ...n, x: Math.random() * 1000, y: Math.random() * 700 }))
  const links = g.edges.map((e) => ({ ...e, source: e.from, target: e.to }))
  const t0 = performance.now()
  const sim = buildSimulation(nodes, links, { width: 1000, height: 700 })
  const ticks = settle(sim)
  const ms = performance.now() - t0
  assert.ok(ticks <= LARGE_TICKS, `${ticks} ticks`)
  assert.ok(nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), 'every node placed')
  assert.ok(ms < 8000, `layout took ${Math.round(ms)}ms`)
  console.log(`# 3,000 nodes / ${links.length} edges laid out in ${Math.round(ms)}ms over ${ticks} ticks`)
})

test('queries stay fast on a large graph', () => {
  const g = synthetic()
  const filters = { types: new Set(['owns', 'competes_with']), confidence: new Set(['DISCLOSED']) }
  let t0 = performance.now()
  const all = neighbourhood(g, filters)
  const two = neighbourhood(g, { focus: 'n1', depth: 2, ...filters })
  assert.ok(performance.now() - t0 < 200, 'neighbourhood')
  assert.ok(all.nodes.length > LARGE_GRAPH && two.nodes.length > 1)
  t0 = performance.now()
  for (let i = 0; i < 50; i++) searchNodes(g, `Company ${i * 37}`, 8)
  assert.ok(performance.now() - t0 < 500, 'search')
})

test('a large view shows minor labels only when zoomed in; the tick no longer scans every element', () => {
  const minor = { id: 'x', type: 'company' }
  assert.equal(labelled(minor, { large: false }), true)
  assert.equal(labelled(minor, { large: true, zoom: 1 }), false)
  assert.equal(labelled(minor, { large: true, zoom: 2 }), true)
  assert.equal(labelled({ id: 'y', type: 'company', top20: true }, { large: true }), true)
  assert.equal(labelled(minor, { large: true, selected: 'x' }), true)
  const src = fs.readFileSync('src/modules/relationships/RelationshipsModule.jsx', 'utf8')
  assert.doesNotMatch(src, /sim\.nodes\(\)\.find|links\.find\(/, 'per-element linear search in the tick')
  assert.match(src, /settle\(sim\)/)
})
