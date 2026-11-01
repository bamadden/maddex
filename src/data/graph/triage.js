// Stage 3 of the review pipeline: sort every pending proposal into one of
// three buckets, with every reason recorded.
//
//   AUTO_REJECTED  failed a Stage 1 check (or was never verified).
//   NEEDS_HUMAN    the two passes disagree; the second pass is not highly
//                  confident or its reply failed the code checks; there is
//                  no second pass; or the type is customer, supplier or
//                  joint venture — the types where past proposals went wrong
//                  (a 23.4% holder called a customer, a tenant a supplier);
//                  or the graph already holds the same edge.
//   AGREED         quote verified and both passes agree with high confidence.
//
// Triage only routes. Nothing here approves or publishes: every bucket,
// AGREED included, still needs a person's approval in the review queue.

export const BUCKETS = ['NEEDS_HUMAN', 'AGREED', 'AUTO_REJECTED']
export const ALWAYS_HUMAN_TYPES = ['customer', 'supplier', 'joint_venture']

import { EDGE_OF } from './secondPass.js'

// existing: Map of `${from}|${type}|${to}` → the edge already in the graph.
export function triageOne(p, v1, v2, existing = new Map()) {
  if (!v1) return { bucket: 'AUTO_REJECTED', reasons: ['not verified (run npm run graph:verify)'] }
  if (!v1.ok) return { bucket: 'AUTO_REJECTED', reasons: v1.reasons.map((r) => `stage 1: ${r}`) }
  const human = []
  if (!v2) human.push('no second pass yet (run npm run graph:second-pass)')
  else {
    const { outcome, detail } = v2.comparison ?? {}
    if (outcome !== 'agree') human.push(`second pass: ${outcome?.replace(/_/g, ' ') ?? 'no comparison'} — ${detail ?? ''}`.trim())
    if (v2.verdict && v2.verdict.confidence !== 'high') human.push(`second pass confidence is ${v2.verdict.confidence}`)
  }
  if (ALWAYS_HUMAN_TYPES.includes(p.type)) human.push(`type ${p.type.replace('_', ' ')} is always reviewed by a person (past errors)`)
  const dup = existing.get(`${v1.resolved?.from}|${EDGE_OF[p.type]}|${v1.resolved?.to}`)
  if (dup) human.push(`the graph already has this edge (${dup.confidence}, ${dup.source?.label ?? 'no source label'})`)
  if (human.length) return { bucket: 'NEEDS_HUMAN', reasons: human }
  return { bucket: 'AGREED', reasons: [`quote verified on page ${v1.match.page}`, `second pass agrees with high confidence — ${v2.comparison.detail}`] }
}

// docs: proposals files; verification / secondPass: the Stage 1 and 2
// results maps; edges: the graph's current edges. Only pending proposals are
// triaged.
export function buildTriage(docs, verification, secondPass, edges = [], generatedAt = new Date().toISOString()) {
  const existing = new Map(edges.map((e) => [`${e.from}|${e.type}|${e.to}`, e]))
  const items = []
  for (const doc of docs) {
    for (const p of doc.proposals ?? []) {
      if (p.status !== 'pending') continue
      const t = triageOne(p, verification[p.id], secondPass[p.id], existing)
      items.push({ id: p.id, file: doc.file, bucket: t.bucket, reasons: t.reasons,
        claim: { type: p.type, from: p.from.name, to: p.to.name, weight: p.weight ?? null, page: p.page } })
    }
  }
  const order = (b) => BUCKETS.indexOf(b)
  items.sort((x, y) => order(x.bucket) - order(y.bucket) || x.file.localeCompare(y.file) || x.id.localeCompare(y.id))
  const counts = Object.fromEntries(BUCKETS.map((b) => [b, items.filter((i) => i.bucket === b).length]))
  return { stage: 3, generatedAt, counts, items }
}
