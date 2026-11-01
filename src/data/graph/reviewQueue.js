// The review queue's data: every proposals file written by
// `npm run propose-edges`, joined with the pipeline's records — Stage 1
// verification, Stage 2 second pass and Stage 3 triage. Loaded only by the
// review module and the reviewer's nav badge, both lazily.

import DECISIONS from './proposals/decisions.json'
import TRIAGE from './proposals/triage.json'
import VERIFICATION from './proposals/verification.json'
import SECOND_PASS from './proposals/secondpass.json'

const FILES = import.meta.glob('./proposals/*-*.json', { eager: true, import: 'default' })

export function proposalDocs() {
  return Object.entries(FILES)
    .map(([p, doc]) => ({ file: p.split('/').pop(), ...doc }))
    .sort((a, b) => b.asAt.localeCompare(a.asAt))
}

// Every triaged, undecided proposal with everything the card shows.
// → [{ ...proposal, doc, bucket, reasons, v1, v2 }]
export function queueItems() {
  const docs = new Map(proposalDocs().map((d) => [d.file, d]))
  return TRIAGE.items
    .filter((t) => !DECISIONS[t.id])
    .map((t) => {
      const doc = docs.get(t.file)
      const p = doc?.proposals.find((x) => x.id === t.id)
      if (!p || p.status !== 'pending') return null
      return { ...p, doc, bucket: t.bucket, reasons: t.reasons, v1: VERIFICATION.results[t.id] ?? null, v2: SECOND_PASS.results?.[t.id] ?? null }
    })
    .filter(Boolean)
}

// What needs a person: NEEDS_HUMAN and AGREED (auto-rejected items are a log).
export const pendingCount = () => queueItems().filter((i) => i.bucket !== 'AUTO_REJECTED').length
export const decisions = () => DECISIONS
export const triageMeta = () => ({ generatedAt: TRIAGE.generatedAt, counts: TRIAGE.counts })
