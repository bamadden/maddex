// Applies a review-queue decision to the repo's graph files. Used by the
// dev-server endpoint in vite.config.js (POST /__graph/review) — the only
// path from a proposal into the live graph, and it runs on Ben's machine,
// never in production.
//
//   approve → the edge goes into src/data/graph/approved.json as DISCLOSED,
//             with its quote, page and source; the proposal is marked
//             approved and remembered in proposals/decisions.json.
//   reject  → remembered in decisions.json, so propose-edges never offers the
//             same proposal again.
//
// Every approval is re-checked here — the weight against the quote, the
// endpoints against the nodes, the whole edge against schema.js — so the
// review UI is a convenience, not a trust boundary.

import fs from 'node:fs'
import path from 'node:path'
import { weightInQuote } from '../src/data/graph/validate.js'
import { edgeProblems, nodeProblems } from '../src/data/graph/schema.js'
import { ALL_NODES } from '../src/data/graph/nodes.js'

const TYPE_MAP = { supplier: 'supplies', customer: 'customer_of', owns: 'owns', subsidiary: 'owns', joint_venture: 'joint_venture', director_of: 'director_of' }
const FILE_RE = /^[A-Z0-9]{2,6}-\d{4}-\d{2}-\d{2}\.json$/
const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback } }
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n')

export function applyReview(root, body, today = new Date().toISOString().slice(0, 10)) {
  const dir = path.join(root, 'src/data/graph/proposals')
  const approvedPath = path.join(root, 'src/data/graph/approved.json')
  const decisionsPath = path.join(dir, 'decisions.json')

  if (!FILE_RE.test(body?.file ?? '')) return { ok: false, error: 'bad proposal file name' }
  const filePath = path.join(dir, body.file)
  const doc = readJson(filePath, null)
  if (!doc) return { ok: false, error: 'proposal file not found' }
  const p = doc.proposals.find((x) => x.id === body.id)
  if (!p) return { ok: false, error: 'proposal not found' }
  if (p.status !== 'pending') return { ok: false, error: `already ${p.status}` }

  const decisions = readJson(decisionsPath, {})
  if (body.action === 'reject') {
    p.status = 'rejected'
    decisions[p.id] = { decision: 'rejected', reason: String(body.reason ?? '').slice(0, 300) || null, at: today, file: body.file }
    writeJson(filePath, doc); writeJson(decisionsPath, decisions)
    return { ok: true }
  }
  if (body.action !== 'approve') return { ok: false, error: 'unknown action' }

  const approved = readJson(approvedPath, { nodes: [], edges: [] })
  const edit = body.edit ?? {}
  const newNodes = (edit.newNodes ?? []).map((n) => ({ id: n.id, type: n.type ?? 'company', name: n.name, ticker: n.ticker ?? null, country: n.country ?? null }))
  for (const n of newNodes) {
    const probs = nodeProblems(n)
    if (probs.length) return { ok: false, error: `new node: ${probs.join('; ')}` }
  }
  const nodes = [...ALL_NODES, ...approved.nodes, ...newNodes]
  const ids = new Set(nodes.map((n) => n.id))
  for (const n of newNodes) if ([...ALL_NODES, ...approved.nodes].some((x) => x.id === n.id)) return { ok: false, error: `node ${n.id} already exists` }

  const type = edit.type ?? p.type
  const weight = edit.weight === undefined ? p.weight : edit.weight
  if (weight != null && !weightInQuote(weight, p.quote)) return { ok: false, error: `weight ${weight} does not appear in the quote` }
  const edge = {
    from: edit.fromId ?? p.from.id,
    to: edit.toId ?? p.to.id,
    type: TYPE_MAP[type],
    weight: weight ?? null,
    confidence: 'DISCLOSED',
    source: { label: `${doc.label} p${p.page}`, url: `${doc.sourceUrl.split('#')[0]}#page=${p.page}`, date: doc.asAt },
    page: p.page,
    quote: p.quote,
    note: [type === 'subsidiary' ? 'Subsidiary.' : null, edit.note ?? null].filter(Boolean).join(' ') || undefined,
    lastVerified: today,
    proposalId: p.id,
  }
  if (!edge.type) return { ok: false, error: `unknown type ${type}` }
  const names = new Map(nodes.map((n) => [n.id, n.name]))
  const probs = edgeProblems(edge, ids, names)
  if (probs.length) return { ok: false, error: probs.join('; ') }

  approved.nodes.push(...newNodes)
  approved.edges.push(edge)
  p.status = 'approved'
  decisions[p.id] = { decision: 'approved', at: today, file: body.file }
  writeJson(approvedPath, approved); writeJson(filePath, doc); writeJson(decisionsPath, decisions)
  return { ok: true, edge }
}
