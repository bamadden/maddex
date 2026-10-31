// Relationships graph — the rules that keep unsourced or misleading edges out.
// Run with `npm test` (node's built-in runner; no extra dependencies).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validateProposal, findQuotePage, weightInQuote, normaliseWs, quoteContext } from '../src/data/graph/validate.js'
import { isNomineeHolder } from '../src/data/graph/denylist.js'
import { isStale, edgeAsAt, STALE_DAYS } from '../src/data/graph/staleness.js'
import { loadGraph } from '../src/data/graph/schema.js'
import { ALL_NODES } from '../src/data/graph/nodes.js'
import { EDGES } from '../src/data/graph/edges.js'
import { findPaths, weakestConfidence, completeness } from '../src/services/graphQuery.js'
import { applyReview } from '../scripts/graphReview.js'

const PAGES = [
  'Annual report 2026\nOverview of the year.',
  'Substantial shareholders\nWesfarmers, BWP’s largest securityholder with 23.4 per  cent of BWP securities,\nhas committed to take up its entitlement.',
  'Bunnings comprise approximately 76.7% of the gross income of BWP as at 31 December 2025.',
]
const base = { type: 'owns', from: 'Wesfarmers', to: 'BWP', page: 2 }

// ── Quote validator ─────────────────────────────────────────────────────────
test('quote found verbatim after whitespace normalisation', () => {
  const v = validateProposal({ ...base, quote: 'Wesfarmers, BWP’s largest securityholder with 23.4 per cent of BWP securities,', weight: 23.4 }, PAGES)
  assert.equal(v.ok, true, v.reasons.join('; '))
  assert.equal(v.page, 2)
})

test('typographic quotes and dashes fold, words do not', () => {
  const v = validateProposal({ ...base, quote: "Wesfarmers, BWP's largest securityholder with 23.4 per cent of BWP securities,", weight: 23.4 }, PAGES)
  assert.equal(v.ok, true, v.reasons.join('; '))
  assert.equal(normaliseWs('a—b “q”'), 'a-b "q"')
  assert.equal(validateProposal({ ...base, quote: "Wesfarmers, BWP's biggest securityholder with 23.4 per cent of BWP securities,", weight: 23.4 }, PAGES).ok, false)
})

test('paraphrased quote is rejected', () => {
  const v = validateProposal({ ...base, quote: 'Wesfarmers owns 23.4 per cent of BWP securities as its largest holder', weight: 23.4 }, PAGES)
  assert.equal(v.ok, false)
  assert.match(v.reasons.join(), /not found verbatim/)
})

test('a weight not stated in the quote is rejected', () => {
  const v = validateProposal({ ...base, quote: 'Wesfarmers, BWP’s largest securityholder with 23.4 per cent of BWP securities,', weight: 25 }, PAGES)
  assert.equal(v.ok, false)
  assert.match(v.reasons.join(), /weight 25 does not appear/)
})

test('a weight elsewhere on the page but not in the quote is rejected', () => {
  const v = validateProposal({ type: 'customer', from: 'Wesfarmers', to: 'BWP', quote: 'has committed to take up its entitlement.', weight: 23.4, page: 2 }, PAGES)
  assert.equal(v.ok, false)
})

test('wrong page is corrected and flagged, not rejected', () => {
  const v = validateProposal({ type: 'customer', from: 'Wesfarmers', to: 'BWP', quote: 'Bunnings comprise approximately 76.7% of the gross income of BWP', weight: 76.7, page: 1 }, PAGES)
  assert.equal(v.ok, true)
  assert.equal(v.page, 3)
  assert.equal(v.pageCorrected, true)
})

test('short quotes, unknown types and self-edges are rejected', () => {
  assert.equal(validateProposal({ ...base, quote: '23.4 per cent', weight: null }, PAGES).ok, false)
  assert.equal(validateProposal({ ...base, type: 'friend_of', quote: 'Bunnings comprise approximately 76.7% of the gross income' }, PAGES).ok, false)
  assert.equal(validateProposal({ ...base, to: 'Wesfarmers', quote: 'Bunnings comprise approximately 76.7% of the gross income' }, PAGES).ok, false)
})

test('number parsing handles separators and decimals', () => {
  assert.equal(weightInQuote(5.2988, 'holds 268,965,425.83 shares, 5.2988% of votes'), true)
  assert.equal(weightInQuote(52, 'holds 5.2% of votes'), false)
  assert.equal(normaliseWs('a\n\n  b­c'), 'a bc')
  assert.equal(findQuotePage(PAGES, 'not there at all, nowhere'), null)
  assert.equal(quoteContext(PAGES[2], '76.7% of the gross income').quote, '76.7% of the gross income')
})

// ── Nominee denylist ────────────────────────────────────────────────────────
test('custodians and nominees are recognised', () => {
  for (const n of ['HSBC Custody Nominees (Australia) Limited', 'J P Morgan Nominees Australia Pty Limited', 'Citicorp Nominees Pty Limited',
    'BNP Paribas Noms Pty Ltd <DRP>'.replace('Noms', 'Nominees'), 'National Nominees Limited', 'Netwealth Investments Limited', 'Citibank NY ADR Depositary']) {
    assert.equal(isNomineeHolder(n), true, n)
  }
  for (const n of ['BlackRock Group', 'State Street Corporation', 'AustralianSuper', 'Citigroup Global Markets Australia', 'Wesfarmers']) {
    assert.equal(isNomineeHolder(n), false, n)
  }
})

test('loadGraph rejects an owns edge from a nominee', () => {
  const nodes = [...ALL_NODES, { id: 'co:hsbc-nominees', type: 'company', name: 'HSBC Custody Nominees (Australia) Limited' }]
  const bad = { from: 'co:hsbc-nominees', to: 'BHP', type: 'owns', weight: 29.92, confidence: 'DISCLOSED', lastVerified: '2026-10-31',
    source: { label: 'register', url: 'https://example.com/r.pdf', date: '2026-07-09' } }
  assert.throws(() => loadGraph(nodes, [...EDGES, bad], { dev: true }), /custodian or nominee/)
  const logs = []
  const g = loadGraph(nodes, [...EDGES, bad], { dev: false, log: (m) => logs.push(m) })
  assert.equal(g.dropped.length, 1)
  assert.equal(logs.length, 1)
})

test('the live seed has no nominee holders and loads cleanly', () => {
  const g = loadGraph(ALL_NODES, EDGES, { dev: true })
  const names = new Map(g.nodes.map((n) => [n.id, n.name]))
  assert.equal(g.edges.filter((e) => e.type === 'owns' && isNomineeHolder(names.get(e.from))).length, 0)
})

// ── Staleness ───────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-10-31T00:00:00Z')
const src = (date) => ({ source: { label: 'x', url: 'https://x', date } })

test('staleness uses asAt over the document date', () => {
  assert.equal(edgeAsAt({ ...src('2026-08-11'), asAt: '2020-03-06' }), '2020-03-06')
  assert.equal(isStale({ ...src('2026-08-11'), asAt: '2020-03-06' }, NOW), true)
  assert.equal(isStale(src('2026-08-11'), NOW), false)
})

test('the 12-month boundary', () => {
  const day = (n) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10)
  assert.equal(isStale(src(day(STALE_DAYS)), NOW), false)
  assert.equal(isStale(src(day(STALE_DAYS + 1)), NOW), true)
  assert.equal(isStale({ source: {} }, NOW), false)
})

test('stale sourced edges do not lift completeness', () => {
  const g = loadGraph(ALL_NODES, EDGES, { dev: true })
  const c = completeness(g, 'CBA', NOW)
  assert.ok(c.stale >= 1, 'CBA has at least one stale holder edge (BlackRock, 2020)')
})

// ── Path finder ─────────────────────────────────────────────────────────────
test('paths are shortest first, with the weakest confidence', () => {
  const g = loadGraph(ALL_NODES, EDGES, { dev: true })
  const paths = findPaths(g, 'fund:blackrock', 'BWP', { includeTypes: new Set(['owns', 'customer_of']) })
  assert.ok(paths.length >= 1)
  assert.equal(paths[0].length, 2) // BlackRock → WES → BWP
  assert.equal(weakestConfidence(paths[0]), 'DISCLOSED')
  assert.deepEqual(findPaths(g, 'cmd:lithium', 'fund:cppib', { includeTypes: new Set(['owns']) }), [])
})

// ── Review queue writer ─────────────────────────────────────────────────────
test('approval re-checks the weight against the quote and writes DISCLOSED', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-review-'))
  const dir = path.join(root, 'src/data/graph/proposals')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(root, 'src/data/graph/approved.json'), JSON.stringify({ nodes: [], edges: [] }))
  const proposal = { id: 'abc123', status: 'pending', type: 'customer', from: { name: 'Wesfarmers', id: 'WES' }, to: { name: 'BWP', id: 'BWP' },
    weight: 76.7, quote: 'Bunnings comprise approximately 76.7% of the gross income of BWP as at 31 December 2025.', page: 24 }
  fs.writeFileSync(path.join(dir, 'BWP-2026-05-06.json'), JSON.stringify({ label: 'BWP presentation', sourceUrl: 'https://example.com/b.pdf', asAt: '2026-05-06', proposals: [proposal] }))

  const bad = applyReview(root, { file: 'BWP-2026-05-06.json', id: 'abc123', action: 'approve', edit: { weight: 80 } }, '2026-10-31')
  assert.equal(bad.ok, false)
  assert.match(bad.error, /does not appear in the quote/)

  const good = applyReview(root, { file: 'BWP-2026-05-06.json', id: 'abc123', action: 'approve' }, '2026-10-31')
  assert.equal(good.ok, true, good.error)
  const approved = JSON.parse(fs.readFileSync(path.join(root, 'src/data/graph/approved.json'), 'utf8'))
  assert.equal(approved.edges[0].confidence, 'DISCLOSED')
  assert.equal(approved.edges[0].quote, proposal.quote)
  assert.equal(approved.edges[0].lastVerified, '2026-10-31')
  assert.equal(applyReview(root, { file: 'BWP-2026-05-06.json', id: 'abc123', action: 'approve' }).ok, false) // not twice
  assert.equal(applyReview(root, { file: '../../etc/passwd', id: 'x', action: 'reject' }).ok, false)
})

// ── Dated changes (check-stats warning) ─────────────────────────────────────
import { overdueChanges, fieldUpdated, DATED_CHANGES } from '../src/data/datedChanges.js'
import { TOP20 } from '../src/data/graph/nodes.js'
import { COMPANY_FACTS } from '../src/data/graph/companyFacts.js'

const before = { rba: { lastDecision: '2026-09-29', nextMeeting: '2026-11-03', decisions: [{ date: '2026-09-29' }], latestStatement: { date: '2026-09-29' } },
  fed: { lastDecision: '2026-10-28', nextMeeting: '2026-12-09' }, boj: { lastDecision: '2026-10-30', nextMeeting: '2026-12-18' },
  graph: { ceo: { MQG: 'Shemara Wikramanayake' } } }

test('nothing is overdue before its moment', () => {
  const ids = overdueChanges(before, Date.parse('2026-11-03T14:29:00+11:00')).map((c) => c.id)
  assert.ok(!ids.includes('rba-2026-11-03'))
  assert.ok(!ids.includes('mqg-auditor-2027-04-01'))
})

test('the RBA change is overdue after 2:30pm until every field moves', () => {
  const t = Date.parse('2026-11-03T15:00:00+11:00')
  const o = overdueChanges(before, t).filter((c) => c.id.startsWith('rba-'))
  assert.deepEqual(o.map((c) => c.id), ['rba-2026-11-03'])
  assert.equal(o[0].stale.length, 4)
  const after = { ...before, rba: { lastDecision: '2026-11-03', nextMeeting: '2026-12-08', decisions: [{ date: '2026-11-03' }], latestStatement: { date: '2026-11-03' } } }
  assert.deepEqual(overdueChanges(after, t).filter((c) => c.id.startsWith('rba-')), [])
})

test('the Macquarie CEO change is caught from 7 Nov', () => {
  const o = overdueChanges(before, Date.parse('2026-11-07T09:00:00+11:00'))
  assert.ok(o.some((c) => c.id === 'mqg-ceo-2026-11-07'))
  assert.equal(fieldUpdated({ graph: { ceo: { MQG: 'Greg Ward' } } }, { path: 'graph.ceo.MQG', expect: { eq: 'Greg Ward' } }), true)
  assert.ok(DATED_CHANGES.every((c) => Number.isFinite(Date.parse(c.effective))))
})

// ── S&P/ASX 20 from ASX profiles ─────────────────────────────────────────────
test('TOP20 is exactly the companies ASX lists in the S&P/ASX 20', () => {
  const inXtl = Object.entries(COMPANY_FACTS).filter(([, f]) => f.indices.includes('XTL')).map(([t]) => t).sort()
  assert.equal(inXtl.length, 20)
  assert.deepEqual([...TOP20].sort(), inXtl)
})

// ── Key facts from annual reports ───────────────────────────────────────────
import { KEY_FACTS } from '../src/data/graph/keyFacts.js'

test('every key-fact number appears in its quote, with a page and a source', () => {
  const nums = (s) => s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []
  let n = 0
  for (const [t, fields] of Object.entries(KEY_FACTS)) {
    for (const [f, v] of Object.entries(fields)) {
      n++
      for (const x of nums(v.value)) assert.ok(v.quote.includes(x), `${t}.${f}: ${x} not in quote`)
      assert.ok(Number.isInteger(v.page) && v.page > 0, `${t}.${f}: page`)
      assert.match(v.source.url, /^https:\/\/.+#page=\d+$/, `${t}.${f}: url`)
      assert.match(v.source.date, /^\d{4}-\d{2}-\d{2}$/)
    }
  }
  assert.equal(n, 50)
})

// ── Commodity weights and the WES chair ─────────────────────────────────────
import { COMMODITY_WEIGHTS } from '../src/data/graph/commodityWeights.js'

test('commodity weights: inputs are inside their quotes and the weight is their ratio', () => {
  const fmt = (v) => v.toLocaleString('en-US', { maximumFractionDigits: 1 })
  for (const [k, w] of Object.entries(COMMODITY_WEIGHTS)) {
    for (const part of ['numerator', 'denominator']) {
      assert.ok(w[part].quote.includes(fmt(w[part].value)), `${k} ${part}: ${w[part].value} not in quote`)
      assert.ok(Number.isInteger(w[part].page) && w[part].page > 0)
    }
    assert.equal(w.weight, Math.round((w.numerator.value / w.denominator.value) * 1000) / 10, k)
  }
  const g = loadGraph(ALL_NODES, EDGES, { dev: true })
  const weighted = g.edges.filter((e) => e.type === 'exposed_to' && e.calc)
  assert.equal(weighted.length, Object.keys(COMMODITY_WEIGHTS).length)
  assert.ok(weighted.every((e) => e.confidence === 'DISCLOSED' && e.weight > 0))
  assert.ok(g.edges.filter((e) => e.type === 'exposed_to' && e.to.startsWith('cmd:') && !e.calc).every((e) => e.confidence === 'INFERRED' && e.weight == null))
})

test('a calc weight that does not match its inputs is rejected', () => {
  const w = COMMODITY_WEIGHTS['BHP|cmd:copper']
  const bad = { from: 'BHP', to: 'cmd:copper', type: 'exposed_to', confidence: 'DISCLOSED', weight: 55, lastVerified: '2026-10-31', source: w.source, calc: { numerator: w.numerator, denominator: w.denominator } }
  assert.throws(() => loadGraph(ALL_NODES, [...EDGES.filter((e) => !(e.from === 'BHP' && e.to === 'cmd:copper')), bad], { dev: true }), /is not/)
})

test('Wesfarmers chair is Ken MacKenzie, sourced from the company with a quote', () => {
  const g = loadGraph(ALL_NODES, EDGES, { dev: true })
  const e = g.edges.find((x) => x.type === 'director_of' && x.to === 'WES' && x.note === 'Chair')
  assert.equal(g.byId.get(e.from).name, 'Ken MacKenzie')
  assert.match(e.quote, /became Chairman in October 2026/)
  assert.match(e.source.url, /wesfarmers\.com\.au/)
})
