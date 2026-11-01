// Relationships review pipeline — Stage 3 (triage). Routing only; no AI.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { triageOne, buildTriage, BUCKETS } from '../src/data/graph/triage.js'
import { triageFromDisk } from '../scripts/graph-triage.mjs'

const p = (over = {}) => ({ id: 'p1', status: 'pending', type: 'owns', from: { name: 'Wesfarmers', id: 'WES' }, to: { name: 'Flybuys', id: 'co:flybuys' }, weight: 50, page: 57, ...over })
const v1ok = { ok: true, reasons: [], match: { page: 57 }, resolved: { from: 'WES', to: 'co:flybuys' } }
const v2 = (outcome = 'agree', confidence = 'high', detail = 'same type and direction') => ({ verdict: { relationship: 'owns', confidence }, comparison: { outcome, detail }, problems: [] })

test('a Stage 1 failure is auto-rejected with its reasons', () => {
  const t = triageOne(p(), { ok: false, reasons: ['quote not found word for word in the source'] }, v2())
  assert.equal(t.bucket, 'AUTO_REJECTED')
  assert.deepEqual(t.reasons, ['stage 1: quote not found word for word in the source'])
})

test('an unverified proposal is auto-rejected', () => {
  assert.equal(triageOne(p(), undefined, v2()).bucket, 'AUTO_REJECTED')
})

test('both passes agreeing with high confidence on a quote-verified owns edge is AGREED', () => {
  const t = triageOne(p(), v1ok, v2())
  assert.equal(t.bucket, 'AGREED')
  assert.match(t.reasons.join(), /quote verified on page 57/)
})

test('disagreement on type routes to a person', () => {
  const t = triageOne(p(), v1ok, v2('type_disagree', 'high', 'proposal says owns; second pass says customer'))
  assert.equal(t.bucket, 'NEEDS_HUMAN')
  assert.match(t.reasons.join(), /type disagree — proposal says owns; second pass says customer/)
})

test('disagreement on direction routes to a person', () => {
  assert.equal(triageOne(p(), v1ok, v2('direction_disagree')).bucket, 'NEEDS_HUMAN')
})

test('insufficient evidence routes to a person', () => {
  assert.equal(triageOne(p(), v1ok, v2('insufficient_evidence', 'high', 'supporting quote is not in the passage')).bucket, 'NEEDS_HUMAN')
})

test('low or medium second-pass confidence routes to a person', () => {
  assert.match(triageOne(p(), v1ok, v2('agree', 'low')).reasons.join(), /confidence is low/)
  assert.equal(triageOne(p(), v1ok, v2('agree', 'medium')).bucket, 'NEEDS_HUMAN')
})

test('no second pass routes to a person', () => {
  assert.match(triageOne(p(), v1ok, undefined).reasons.join(), /no second pass yet/)
})

test('customer, supplier and joint venture always go to a person, even when both passes agree', () => {
  for (const type of ['customer', 'supplier', 'joint_venture']) {
    const t = triageOne(p({ type }), v1ok, v2())
    assert.equal(t.bucket, 'NEEDS_HUMAN', type)
    assert.match(t.reasons.join(), /always reviewed by a person/)
  }
})

test('an edge the graph already holds goes to a person, naming the existing edge', () => {
  const existing = new Map([['WES|owns|co:flybuys', { confidence: 'VERIFIED', source: { label: 'Annual report' } }]])
  const t = triageOne(p(), v1ok, v2(), existing)
  assert.equal(t.bucket, 'NEEDS_HUMAN')
  assert.match(t.reasons.join(), /already has this edge \(VERIFIED, Annual report\)/)
})

test('triage output: only pending proposals, every reason kept, buckets in order, counts add up', () => {
  const docs = [{ file: 'WES-2026-06-30.json', proposals: [
    p({ id: 'a' }), p({ id: 'b', type: 'customer' }), p({ id: 'c' }), p({ id: 'd', status: 'approved' }),
  ] }]
  const out = buildTriage(docs, { a: v1ok, b: v1ok, c: { ok: false, reasons: ['type "x" is not allowed'] } }, { a: v2(), b: v2() }, [], '2026-11-01T00:00:00Z')
  assert.deepEqual(out.items.map((i) => [i.id, i.bucket]), [['b', 'NEEDS_HUMAN'], ['a', 'AGREED'], ['c', 'AUTO_REJECTED']])
  assert.deepEqual(out.counts, { NEEDS_HUMAN: 1, AGREED: 1, AUTO_REJECTED: 1 })
  assert.ok(out.items.every((i) => i.reasons.length > 0))
  assert.deepEqual(out.items[1].claim, { type: 'owns', from: 'Wesfarmers', to: 'Flybuys', weight: 50, page: 57 })
  assert.deepEqual(Object.keys(out.counts), BUCKETS)
})

test('the committed triage.json is what the committed Stage 1 and 2 records produce', () => {
  const dir = path.resolve('src/data/graph/proposals')
  const committed = JSON.parse(fs.readFileSync(path.join(dir, 'triage.json'), 'utf8'))
  const recomputed = triageFromDisk(dir, committed.generatedAt)
  assert.deepEqual(recomputed, committed)
})
