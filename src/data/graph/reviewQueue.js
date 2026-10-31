// The review queue's data: every proposals file written by
// `npm run propose-edges`, minus anything already decided. Loaded only by the
// review module and the reviewer's nav badge, both lazily.

import DECISIONS from './proposals/decisions.json'

const FILES = import.meta.glob('./proposals/*-*.json', { eager: true, import: 'default' })

export function proposalDocs() {
  return Object.entries(FILES)
    .map(([p, doc]) => ({ file: p.split('/').pop(), ...doc }))
    .sort((a, b) => b.asAt.localeCompare(a.asAt))
}

export function pendingProposals() {
  return proposalDocs().flatMap((doc) => (doc.proposals ?? [])
    .filter((p) => p.status === 'pending' && !DECISIONS[p.id])
    .map((p) => ({ ...p, doc })))
}

export const pendingCount = () => pendingProposals().length
export const decisions = () => DECISIONS
