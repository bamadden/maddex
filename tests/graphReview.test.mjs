// Relationships review pipeline — Stage 4 (the write path). No edge reaches
// the graph without a recorded human approval. No AI, no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyReview } from '../scripts/graphReview.js'
import { loadGraph, reviewProblems } from '../src/data/graph/schema.js'
import { ALL_NODES } from '../src/data/graph/nodes.js'
import { SPOT_CHECK_SIZE } from '../src/data/graph/reviewConfig.js'

const NOW = '2026-11-01T03:00:00.000Z'
const FILE = 'WES-2026-06-30.json'
const QUOTE = (n) => `Wesfarmers holds ${n} per cent of the ordinary shares of the company at year end.`

// A proposal that went through Stages 1–3 as `bucket`, in a scratch repo.
function repo(proposals) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-review-'))
  const dir = path.join(root, 'src/data/graph/proposals')
  fs.mkdirSync(dir, { recursive: true })
  const w = (f, v) => fs.writeFileSync(path.join(dir, f), JSON.stringify(v))
  fs.writeFileSync(path.join(root, 'src/data/graph/approved.json'), JSON.stringify({ nodes: [], edges: [] }))
  w(FILE, { label: 'Wesfarmers 2026 Annual Report', sourceUrl: 'https://example.com/ar.pdf', asAt: '2026-06-30', model: 'claude-sonnet-4-6',
    proposals: proposals.map(({ id, to, weight }) => ({ id, status: 'pending', type: 'owns', from: { name: 'Wesfarmers', id: 'WES' }, to: { name: to, id: to }, weight, quote: QUOTE(weight), page: 9 })) })
  w('decisions.json', {})
  w('verification.json', { results: Object.fromEntries(proposals.map(({ id, to, v1ok = true }) => [id, { ok: v1ok, reasons: v1ok ? [] : ['quote not found word for word in the source'],
    resolved: { from: 'WES', to }, match: { result: v1ok ? 'verified' : 'not_found', page: 9, start: 0, end: 70, sourceSha256: 'abc123' } }])) })
  w('secondpass.json', { results: Object.fromEntries(proposals.filter((x) => !x.noSecondPass).map(({ id }) => [id, { model: 'claude-opus-5-5', at: NOW,
    verdict: { relationship: 'owns', direction: 'b_to_a', confidence: 'high', supporting_quote: 'Wesfarmers holds', rationale: 'Holds shares.' },
    comparison: { outcome: 'agree', detail: 'same type and direction' }, problems: [] }])) })
  w('triage.json', { items: proposals.map(({ id, bucket }) => ({ id, file: FILE, bucket, reasons: ['test'] })) })
  const read = (f) => JSON.parse(fs.readFileSync(f.startsWith('approved') ? path.join(root, 'src/data/graph', f) : path.join(dir, f), 'utf8'))
  return { root, read }
}
const as = { reviewer: 'Test Reviewer', now: NOW }

test('approve writes one DISCLOSED edge carrying approver, time, both verdicts and the quote match', () => {
  const { root, read } = repo([{ id: 'a', to: 'CBA', weight: 5.1, bucket: 'NEEDS_HUMAN' }])
  const r = applyReview(root, { file: FILE, id: 'a', action: 'approve' }, as)
  assert.equal(r.ok, true, r.error)
  const e = read('approved.json').edges[0]
  assert.equal(e.confidence, 'DISCLOSED')
  assert.equal(e.review.approver, 'Test Reviewer')
  assert.equal(e.review.approvedAt, NOW)
  assert.equal(e.review.firstPass.type, 'owns')
  assert.equal(e.review.secondPass.confidence, 'high')
  assert.deepEqual(e.review.quoteMatch, { result: 'verified', page: 9, start: 0, end: 70, sourceSha256: 'abc123' })
  assert.deepEqual(reviewProblems(e), [])
  assert.equal(read('decisions.json').a.by, 'Test Reviewer')
  assert.equal(applyReview(root, { file: FILE, id: 'a', action: 'approve' }, as).ok, false) // not twice
})

test('no reviewer, no write — for every action', () => {
  const { root, read } = repo([{ id: 'a', to: 'CBA', weight: 5.1, bucket: 'AGREED' }])
  for (const body of [{ file: FILE, id: 'a', action: 'approve' }, { file: FILE, id: 'a', action: 'reject' }, { action: 'approve-agreed', ids: ['a'], spotCheck: [{ id: 'a', verdict: 'correct' }] }]) {
    for (const reviewer of [undefined, '', '   ']) {
      const r = applyReview(root, body, { reviewer, now: NOW })
      assert.equal(r.ok, false)
      assert.match(r.error, /no reviewer recorded/)
    }
  }
  assert.deepEqual(read('approved.json').edges, [])
  assert.deepEqual(read('decisions.json'), {})
})

test('an auto-rejected proposal cannot be approved', () => {
  const { root, read } = repo([{ id: 'a', to: 'CBA', weight: 5.1, bucket: 'AUTO_REJECTED', v1ok: false }])
  const r = applyReview(root, { file: FILE, id: 'a', action: 'approve' }, as)
  assert.equal(r.ok, false)
  assert.match(r.error, /auto-rejected/)
  assert.deepEqual(read('approved.json').edges, [])
})

test('an untriaged proposal, or one without a second pass, cannot be approved', () => {
  const { root } = repo([{ id: 'a', to: 'CBA', weight: 5.1, bucket: 'NEEDS_HUMAN', noSecondPass: true }])
  assert.match(applyReview(root, { file: FILE, id: 'a', action: 'approve' }, as).error, /no second-pass reading/)
  const t = repo([{ id: 'b', to: 'CBA', weight: 5.1, bucket: 'NEEDS_HUMAN' }])
  fs.writeFileSync(path.join(t.root, 'src/data/graph/proposals/triage.json'), JSON.stringify({ items: [] }))
  assert.match(applyReview(t.root, { file: FILE, id: 'b', action: 'approve' }, as).error, /not triaged/)
})

test('fix type records the change; a fixed type is re-checked', () => {
  const { root, read } = repo([{ id: 'a', to: 'CBA', weight: 5.1, bucket: 'NEEDS_HUMAN' }])
  const r = applyReview(root, { file: FILE, id: 'a', action: 'approve', edit: { type: 'subsidiary' } }, as)
  assert.equal(r.ok, true, r.error)
  assert.deepEqual(read('approved.json').edges[0].review.typeFixed, { from: 'owns', to: 'subsidiary' })
  assert.deepEqual(read('decisions.json').a.typeFixed, { from: 'owns', to: 'subsidiary' })
  const bad = repo([{ id: 'b', to: 'CBA', weight: 5.1, bucket: 'NEEDS_HUMAN' }])
  assert.match(applyReview(bad.root, { file: FILE, id: 'b', action: 'approve', edit: { type: 'partner' } }, as).error, /unknown type/)
})

test('an edge the graph already holds is refused', () => {
  const { root } = repo([{ id: 'a', to: 'BWP', weight: 23.44, bucket: 'NEEDS_HUMAN' }]) // WES owns BWP is a seed edge
  assert.match(applyReview(root, { file: FILE, id: 'a', action: 'approve' }, as).error, /already has WES\|owns\|BWP/)
})

test('approve all agreed needs the spot-check, every item correct, and the current list', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const tos = ['CBA', 'NAB', 'ANZ', 'MQG', 'CSL', 'TLS', 'WOW']
  const { root, read } = repo(ids.map((id, i) => ({ id, to: tos[i], weight: 1 + i, bucket: 'AGREED' })))
  const n = Math.min(SPOT_CHECK_SIZE, ids.length)
  const spot = (k, verdict = 'correct') => ids.slice(0, k).map((id) => ({ id, verdict }))

  assert.match(applyReview(root, { action: 'approve-agreed', ids }, as).error, new RegExp(`spot-check ${n} agreed items first \\(0 checked\\)`))
  assert.match(applyReview(root, { action: 'approve-agreed', ids, spotCheck: spot(n - 1) }, as).error, /spot-check/)
  assert.match(applyReview(root, { action: 'approve-agreed', ids, spotCheck: [...spot(n - 1), { id: ids[n - 1], verdict: 'wrong' }] }, as).error, /marked wrong/)
  assert.match(applyReview(root, { action: 'approve-agreed', ids: ids.slice(1), spotCheck: spot(n) }, as).error, /list has changed/)
  // Spot-checks of items outside AGREED do not count.
  assert.match(applyReview(root, { action: 'approve-agreed', ids, spotCheck: Array.from({ length: n }, (_, i) => ({ id: `x${i}`, verdict: 'correct' })) }, as).error, /spot-check/)
  assert.deepEqual(read('approved.json').edges, [])

  const ok = applyReview(root, { action: 'approve-agreed', ids, spotCheck: spot(n) }, as)
  assert.equal(ok.ok, true, ok.error)
  assert.equal(ok.approved, ids.length)
  const edges = read('approved.json').edges
  assert.equal(edges.length, ids.length)
  assert.ok(edges.every((e) => e.review.approver === 'Test Reviewer' && e.review.bulk.spotCheckSize === n && e.review.bulk.spotChecked.length === n))
})

test('approve all agreed never touches NEEDS_HUMAN items', () => {
  const { root, read } = repo([{ id: 'a', to: 'CBA', weight: 5.1, bucket: 'AGREED' }, { id: 'h', to: 'NAB', weight: 2, bucket: 'NEEDS_HUMAN' }])
  assert.match(applyReview(root, { action: 'approve-agreed', ids: ['a', 'h'], spotCheck: [{ id: 'a', verdict: 'correct' }] }, as).error, /list has changed/)
  assert.equal(applyReview(root, { action: 'approve-agreed', ids: ['a'], spotCheck: [{ id: 'a', verdict: 'correct' }] }, as).ok, true)
  assert.deepEqual(read('approved.json').edges.map((e) => e.proposalId), ['a'])
})

test('the graph will not load an approved edge without a recorded approval', () => {
  const base = { from: 'WES', to: 'CBA', type: 'owns', weight: 5.1, confidence: 'DISCLOSED', source: { label: 'AR p9', url: 'https://example.com/ar.pdf#page=9', date: '2026-06-30' }, lastVerified: '2026-11-01', quote: QUOTE(5.1) }
  const review = { approver: 'Test Reviewer', approvedAt: NOW, firstPass: { type: 'owns' }, secondPass: { relationship: 'owns' }, quoteMatch: { result: 'verified', sourceSha256: 'abc' } }
  // As index.js loads approved.json: every approved edge is a review-queue edge.
  const asApproved = (e) => ({ proposalId: null, ...e })
  assert.throws(() => loadGraph(ALL_NODES, [asApproved(base)], { dev: true }), /no recorded approver/)
  assert.throws(() => loadGraph(ALL_NODES, [asApproved({ ...base, proposalId: 'a', review: { ...review, approver: '' } })], { dev: true }), /no recorded approver/)
  assert.throws(() => loadGraph(ALL_NODES, [asApproved({ ...base, proposalId: 'a', review: { ...review, quoteMatch: { result: 'not_found' } } })], { dev: true }), /no verified quote match/)
  assert.throws(() => loadGraph(ALL_NODES, [asApproved({ ...base, proposalId: 'a', review: { ...review, secondPass: null } })], { dev: true }), /no second-pass verdict/)
  const dropped = loadGraph(ALL_NODES, [asApproved(base)], { dev: false, log: () => {} })
  assert.equal(dropped.edges.length, 0)
  assert.equal(loadGraph(ALL_NODES, [asApproved({ ...base, proposalId: 'a', review })], { dev: true }).edges.length, 1)
})

test('the committed approved.json: every edge has a recorded approval', () => {
  const approved = JSON.parse(fs.readFileSync('src/data/graph/approved.json', 'utf8'))
  for (const e of approved.edges) assert.deepEqual(reviewProblems(e), [], JSON.stringify(e).slice(0, 120))
})

test('only the review writer writes approved.json, and only the dev server calls it', () => {
  const files = (dir) => fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => /\.(m?js|jsx)$/.test(f))
  // A write call whose target names approved.json (directly or via a path variable).
  const writers = [...files('scripts'), ...files('src'), ...files('api')].filter((f) =>
    fs.readFileSync(f, 'utf8').split('\n').some((line) => /(writeFileSync|writeJson|appendFileSync|fs\.write)\s*\(\s*[^,]*approved/i.test(line)))
  assert.deepEqual(writers, ['scripts/graphReview.js'])
  const callers = [...files('scripts'), ...files('src'), ...files('api'), 'vite.config.js'].filter((f) => /\bapplyReview\(/.test(fs.readFileSync(f, 'utf8')) && f !== 'scripts/graphReview.js')
  assert.deepEqual(callers, ['vite.config.js'])
  const vite = fs.readFileSync('vite.config.js', 'utf8')
  const block = vite.slice(vite.indexOf('graphReviewDevMiddleware = {'), vite.indexOf('aiDailyDevMiddleware = {'))
  assert.match(block, /configureServer\(/)          // dev server only
  assert.doesNotMatch(block, /configurePreviewServer/) // never the production preview
  assert.match(block, /reviewer: graphReviewer\(\)/)  // reviewer from the server, not the request
})
