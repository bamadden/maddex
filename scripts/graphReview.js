// Applies a review-queue decision to the repo's graph files. Used by the
// dev-server endpoint in vite.config.js (POST /__graph/review) — the only
// path from a proposal into the live graph, and it runs on Ben's machine,
// never in production.
//
//   approve        one proposal → src/data/graph/approved.json as DISCLOSED.
//                  `edit.type` fixes the type first.
//   reject         one proposal, remembered in proposals/decisions.json so
//                  propose-edges never offers it again.
//   approve-agreed every AGREED proposal at once, only after a spot-check of
//                  SPOT_CHECK_SIZE of them (all, when fewer) each marked
//                  correct by the reviewer.
//
// NOTHING PUBLISHES WITHOUT A RECORDED HUMAN APPROVAL. Every write needs a
// reviewer, which the dev server supplies (never the browser). The pipeline
// records are read from disk here, never taken from the request:
//   - a proposal must be triaged (proposals/triage.json), and never
//     AUTO_REJECTED;
//   - its Stage 1 record must pass and its Stage 2 reading must exist;
//   - the edge is re-checked — type, stake against the quote, endpoints,
//     duplicates, the whole edge against schema.js.
// Each published edge carries `review`: approver, timestamp, both passes'
// verdicts and the quote match record. docs/GRAPH_QUALITY.md is regenerated
// after every decision.

import fs from 'node:fs'
import path from 'node:path'
import { weightInQuote, PROPOSAL_TYPES } from '../src/data/graph/validate.js'
import { percentagesIn, STAKE_TYPES } from '../src/data/graph/verify.js'
import { EDGE_OF } from '../src/data/graph/secondPass.js'
import { edgeProblems, edgeId } from '../src/data/graph/schema.js'
import { ALL_NODES } from '../src/data/graph/nodes.js'
import { EDGES } from '../src/data/graph/edges.js'
import { SPOT_CHECK_SIZE } from '../src/data/graph/reviewConfig.js'
import { buildQualityReport } from './graph-report.mjs'

const FILE_RE = /^[A-Z0-9]{2,6}-\d{4}-\d{2}-\d{2}\.json$/
const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback } }
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n')

function context(root) {
  const dir = path.join(root, 'src/data/graph/proposals')
  return {
    dir,
    approvedPath: path.join(root, 'src/data/graph/approved.json'),
    decisionsPath: path.join(dir, 'decisions.json'),
    triage: readJson(path.join(dir, 'triage.json'), { items: [] }),
    verification: readJson(path.join(dir, 'verification.json'), { results: {} }).results,
    secondPass: readJson(path.join(dir, 'secondpass.json'), { results: {} }).results,
  }
}

// Builds the edge for one approval, or says why it cannot be published.
function buildEdge(ctx, doc, p, { reviewer, now, typeFix, bulk }) {
  const t = ctx.triage.items.find((i) => i.id === p.id)
  if (!t) return { error: 'not triaged — run npm run graph:triage' }
  if (t.bucket === 'AUTO_REJECTED') return { error: `auto-rejected: ${t.reasons.join('; ')}` }
  const v1 = ctx.verification[p.id]
  if (!v1?.ok || v1.match?.result !== 'verified') return { error: 'quote not verified (stage 1)' }
  const v2 = ctx.secondPass[p.id]
  if (!v2?.verdict) return { error: 'no second-pass reading (stage 2)' }

  const type = typeFix ?? p.type
  if (!PROPOSAL_TYPES.includes(type)) return { error: `unknown type ${type}` }
  if (p.weight != null && !weightInQuote(p.weight, p.quote)) return { error: `weight ${p.weight} does not appear in the quote` }
  if (STAKE_TYPES.includes(type)) {
    const stated = percentagesIn(p.quote)
    if (p.weight == null && stated.length) return { error: `quote states ${stated.join('%, ')}% but the edge has no stake` }
    if (p.weight != null && !stated.includes(p.weight)) return { error: `stake ${p.weight}% is not stated as a percentage in the quote` }
  }

  const approved = readJson(ctx.approvedPath, { nodes: [], edges: [] })
  const edge = {
    from: v1.resolved.from,
    to: v1.resolved.to,
    type: EDGE_OF[type],
    weight: p.weight ?? null,
    confidence: 'DISCLOSED',
    source: { label: `${doc.label} p${p.page}`, url: `${doc.sourceUrl.split('#')[0]}#page=${p.page}`, date: doc.asAt },
    page: p.page,
    quote: p.quote,
    note: type === 'subsidiary' ? 'Subsidiary.' : undefined,
    lastVerified: now.slice(0, 10),
    proposalId: p.id,
    review: {
      approver: reviewer,
      approvedAt: now,
      bucket: t.bucket,
      typeFixed: typeFix && typeFix !== p.type ? { from: p.type, to: typeFix } : null,
      firstPass: { model: doc.model ?? null, type: p.type, from: p.from.name, to: p.to.name, weight: p.weight ?? null, page: p.page },
      secondPass: { model: v2.model, relationship: v2.verdict.relationship, direction: v2.verdict.direction, confidence: v2.verdict.confidence,
        supportingQuote: v2.verdict.supporting_quote, outcome: v2.comparison.outcome, at: v2.at },
      quoteMatch: { result: v1.match.result, page: v1.match.page, start: v1.match.start, end: v1.match.end, sourceSha256: v1.match.sourceSha256 },
      ...(bulk ? { bulk } : {}),
    },
  }
  const all = [...EDGES, ...approved.edges]
  const dup = all.find((e) => edgeId(e) === edgeId(edge))
  if (dup) return { error: `the graph already has ${edgeId(edge)} (${dup.confidence})` }
  const nodes = [...ALL_NODES, ...approved.nodes]
  const probs = edgeProblems(edge, new Set(nodes.map((n) => n.id)), new Map(nodes.map((n) => [n.id, n.name])))
  if (probs.length) return { error: probs.join('; ') }
  return { edge, bucket: t.bucket }
}

function findProposal(ctx, file, id) {
  if (!FILE_RE.test(file ?? '')) return { error: 'bad proposal file name' }
  const filePath = path.join(ctx.dir, file)
  const doc = readJson(filePath, null)
  if (!doc) return { error: 'proposal file not found' }
  const p = doc.proposals.find((x) => x.id === id)
  if (!p) return { error: 'proposal not found' }
  if (p.status !== 'pending') return { error: `already ${p.status}` }
  return { filePath, doc, p }
}

// opts.reviewer: who is approving (supplied by the dev server, required).
// opts.now: ISO timestamp.
export function applyReview(root, body, opts = {}) {
  const r = decide(root, body, opts)
  if (r.ok) {
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs/GRAPH_QUALITY.md'), buildQualityReport(root))
  }
  return r
}

function decide(root, body, { reviewer, now = new Date().toISOString() } = {}) {
  if (!reviewer || !String(reviewer).trim()) return { ok: false, error: 'no reviewer recorded — every decision needs a named person' }
  const ctx = context(root)
  const decisions = readJson(ctx.decisionsPath, {})
  const approved = readJson(ctx.approvedPath, { nodes: [], edges: [] })

  if (body?.action === 'reject') {
    const f = findProposal(ctx, body.file, body.id)
    if (f.error) return { ok: false, error: f.error }
    f.p.status = 'rejected'
    decisions[f.p.id] = { decision: 'rejected', reason: String(body.reason ?? '').slice(0, 300) || null, at: now, by: reviewer, file: body.file,
      bucket: ctx.triage.items.find((i) => i.id === f.p.id)?.bucket ?? null }
    writeJson(f.filePath, f.doc); writeJson(ctx.decisionsPath, decisions)
    return { ok: true }
  }

  if (body?.action === 'approve') {
    const f = findProposal(ctx, body.file, body.id)
    if (f.error) return { ok: false, error: f.error }
    const typeFix = body.edit?.type && body.edit.type !== f.p.type ? body.edit.type : null
    const b = buildEdge(ctx, f.doc, f.p, { reviewer, now, typeFix })
    if (b.error) return { ok: false, error: b.error }
    approved.edges.push(b.edge)
    f.p.status = 'approved'
    decisions[f.p.id] = { decision: 'approved', at: now, by: reviewer, file: body.file, bucket: b.bucket, ...(typeFix ? { typeFixed: { from: f.p.type, to: typeFix } } : {}) }
    writeJson(ctx.approvedPath, approved); writeJson(f.filePath, f.doc); writeJson(ctx.decisionsPath, decisions)
    return { ok: true, edge: b.edge }
  }

  if (body?.action === 'approve-agreed') {
    const agreed = ctx.triage.items.filter((i) => i.bucket === 'AGREED' && !decisions[i.id])
    if (!agreed.length) return { ok: false, error: 'nothing in AGREED' }
    const want = new Set(agreed.map((i) => i.id))
    const ids = Array.isArray(body.ids) ? body.ids : []
    if (ids.length !== want.size || !ids.every((id) => want.has(id))) return { ok: false, error: 'the AGREED list has changed — reload the queue' }
    const needed = Math.min(SPOT_CHECK_SIZE, agreed.length)
    const checks = Array.isArray(body.spotCheck) ? body.spotCheck : []
    const checked = new Set(checks.filter((c) => want.has(c?.id)).map((c) => c.id))
    if (checked.size < needed) return { ok: false, error: `spot-check ${needed} agreed item${needed === 1 ? '' : 's'} first (${checked.size} checked)` }
    if (checks.some((c) => c?.verdict !== 'correct')) return { ok: false, error: 'a spot-checked item was marked wrong — review it individually' }

    // All or nothing: build every edge before writing any.
    const bulk = { spotChecked: [...checked], spotCheckSize: needed, batchSize: agreed.length }
    const built = []
    const docs = new Map()
    for (const item of agreed) {
      if (!docs.has(item.file)) {
        const filePath = path.join(ctx.dir, item.file)
        docs.set(item.file, { filePath, doc: readJson(filePath, null) })
      }
      const { doc } = docs.get(item.file)
      const p = doc?.proposals.find((x) => x.id === item.id)
      if (!p || p.status !== 'pending') return { ok: false, error: `${item.id}: not pending` }
      const b = buildEdge(ctx, doc, p, { reviewer, now, bulk })
      if (b.error) return { ok: false, error: `${item.id}: ${b.error}` }
      if (built.some((x) => edgeId(x.edge) === edgeId(b.edge))) return { ok: false, error: `${item.id}: duplicates another agreed item (${edgeId(b.edge)})` }
      built.push({ p, item, edge: b.edge })
    }
    for (const { p, item, edge } of built) {
      approved.edges.push(edge)
      p.status = 'approved'
      decisions[p.id] = { decision: 'approved', at: now, by: reviewer, file: item.file, bucket: 'AGREED', bulk: true }
    }
    writeJson(ctx.approvedPath, approved)
    for (const { filePath, doc } of docs.values()) writeJson(filePath, doc)
    writeJson(ctx.decisionsPath, decisions)
    return { ok: true, approved: built.length }
  }

  return { ok: false, error: 'unknown action' }
}
