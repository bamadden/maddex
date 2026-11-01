// Relationships review pipeline — Stage 5 (the quality report).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildQualityReport } from '../scripts/graph-report.mjs'

function repo({ decisions = {}, edges = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-report-'))
  const dir = path.join(root, 'src/data/graph/proposals')
  fs.mkdirSync(dir, { recursive: true })
  const w = (f, v) => fs.writeFileSync(path.join(dir, f), JSON.stringify(v))
  fs.writeFileSync(path.join(root, 'src/data/graph/approved.json'), JSON.stringify({ nodes: [], edges }))
  w('triage.json', { generatedAt: '2026-11-01T00:00:00Z', counts: { NEEDS_HUMAN: 1, AGREED: 2, AUTO_REJECTED: 1 }, items: [
    { id: 'h', bucket: 'NEEDS_HUMAN', reasons: ['second pass confidence is low', 'type customer is always reviewed by a person (past errors)'] },
  ] })
  w('verification.json', { results: {
    x: { ok: false, reasons: ['from "A" does not resolve to a known node', 'to "B" does not resolve to a known node'], match: { result: 'verified' } },
    y: { ok: true, reasons: [], match: { result: 'verified' } },
  } })
  w('secondpass.json', { results: { y: { verdict: { confidence: 'high' }, comparison: { outcome: 'agree' }, problems: [] } } })
  w('decisions.json', decisions)
  return root
}

test('counts per bucket, and each proposal is counted once per error type', () => {
  const md = buildQualityReport(repo())
  assert.match(md, /\| NEEDS_HUMAN \| 1 \|\n\| AGREED \| 2 \|\n\| AUTO_REJECTED \| 1 \|/)
  assert.match(md, /\| counterparty is not a node \| 1 \|/)
  assert.match(md, /\| second pass confidence low \| 1 \|/)
  assert.match(md, /\| type customer \/ supplier \/ joint venture \| 1 \|/)
  assert.match(md, /No AGREED item has been decided yet/)
})

test('override rate on AGREED counts rejections and type fixes', () => {
  const md = buildQualityReport(repo({ decisions: {
    a: { decision: 'approved', bucket: 'AGREED' }, b: { decision: 'approved', bucket: 'AGREED' },
    c: { decision: 'rejected', bucket: 'AGREED', reason: 'tenant, not supplier' },
    d: { decision: 'approved', bucket: 'AGREED', typeFixed: { from: 'supplier', to: 'customer' } },
    e: { decision: 'approved', bucket: 'NEEDS_HUMAN' },
  } }))
  assert.match(md, /2 of 4 decided AGREED items overridden \(50\.0%\)/)
  assert.match(md, /\| supplier → customer \| 1 \|/)
  assert.match(md, /\| tenant, not supplier \| 1 \|/)
})

test('with no overrides, the report gives the 95% upper bound', () => {
  const decisions = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`a${i}`, { decision: 'approved', bucket: 'AGREED' }]))
  assert.match(buildQualityReport(repo({ decisions })), /0 of 30 decided AGREED items overridden \(0\.0%\)\.\nWith none overridden in 30, the true override rate is below 9\.5% at 95% confidence/)
})

test('the committed docs/GRAPH_QUALITY.md is current', () => {
  assert.equal(fs.readFileSync('docs/GRAPH_QUALITY.md', 'utf8'), buildQualityReport(path.resolve('.')))
})
