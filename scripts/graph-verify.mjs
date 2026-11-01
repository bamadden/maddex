// npm run graph:verify — Stage 1 of the Relationships review pipeline.
//
// Deterministic, no AI. Checks every proposal in src/data/graph/proposals/
// against the text of the document it cites (downloaded once and cached in
// .cache/graph-sources/, identified by SHA-256) — see src/data/graph/verify.js
// for the checks. Writes proposals/verification.json. A proposal that fails
// any check is auto-rejected at triage (npm run graph:triage); nothing here
// touches the live graph.

import fs from 'node:fs'
import path from 'node:path'
import { buildVerification } from '../src/data/graph/verify.js'
import { ALL_NODES } from '../src/data/graph/nodes.js'
import { sourcePages } from './lib/sourceText.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'src/data/graph/proposals')
const PROPOSAL_FILE = /^[A-Z0-9]{2,6}-\d{4}-\d{2}-\d{2}\.json$/

export function loadProposalDocs(dir = DIR) {
  return fs.readdirSync(dir).filter((f) => PROPOSAL_FILE.test(f)).sort()
    .map((file) => ({ file, ...JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) }))
}

export function knownNodes(root = ROOT) {
  const approved = JSON.parse(fs.readFileSync(path.join(root, 'src/data/graph/approved.json'), 'utf8'))
  return [...ALL_NODES, ...approved.nodes]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const docs = loadProposalDocs()
  const sources = {}
  for (const url of new Set(docs.map((d) => String(d.sourceUrl).split('#')[0]))) {
    try {
      sources[url] = await sourcePages(url)
      console.log(`source ${url}: ${sources[url].pages.length} pages, sha256 ${sources[url].sha256.slice(0, 12)}…`)
    } catch (err) { console.error(`source ${url}: ${err.message} — its proposals fail the quote check`) }
  }
  const out = buildVerification(docs, sources, knownNodes())
  fs.writeFileSync(path.join(DIR, 'verification.json'), JSON.stringify(out, null, 2) + '\n')
  const rows = Object.entries(out.results)
  for (const [id, r] of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${r.file}${r.ok ? ` p${r.match.page}` : ` — ${r.reasons.join('; ')}`}`)
  console.log(`\n${rows.filter(([, r]) => r.ok).length} passed, ${rows.filter(([, r]) => !r.ok).length} failed → src/data/graph/proposals/verification.json`)
}
