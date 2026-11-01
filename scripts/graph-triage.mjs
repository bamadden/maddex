// npm run graph:triage — Stage 3 of the Relationships review pipeline.
//
// Reads proposals/verification.json (Stage 1) and proposals/secondpass.json
// (Stage 2) and writes proposals/triage.json: every pending proposal in
// AUTO_REJECTED, NEEDS_HUMAN or AGREED, with every reason. Routing only —
// see src/data/graph/triage.js. No AI, no approval.

import fs from 'node:fs'
import path from 'node:path'
import { buildTriage } from '../src/data/graph/triage.js'
import { loadProposalDocs } from './graph-verify.mjs'
import { EDGES } from '../src/data/graph/edges.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'src/data/graph/proposals')
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { return null } }

export function triageFromDisk(dir = DIR, generatedAt, root = ROOT) {
  const approved = JSON.parse(fs.readFileSync(path.join(root, 'src/data/graph/approved.json'), 'utf8'))
  const v = JSON.parse(fs.readFileSync(path.join(dir, 'verification.json'), 'utf8'))
  let s = { results: {} }
  try { s = JSON.parse(fs.readFileSync(path.join(dir, 'secondpass.json'), 'utf8')) } catch { /* stage 2 not run */ }
  return buildTriage(loadProposalDocs(dir), v.results, s.results, [...EDGES, ...approved.edges], generatedAt)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!read('verification.json')) { console.error('graph:triage: run npm run graph:verify first'); process.exit(1) }
  const out = triageFromDisk()
  fs.writeFileSync(path.join(DIR, 'triage.json'), JSON.stringify(out, null, 2) + '\n')
  for (const i of out.items) console.log(`${i.bucket.padEnd(13)} ${i.id} ${i.claim.type} ${i.claim.from} → ${i.claim.to} — ${i.reasons.join('; ')}`)
  console.log(`\n${Object.entries(out.counts).map(([b, n]) => `${n} ${b}`).join(', ')} → src/data/graph/proposals/triage.json`)
}
