// A newsletter edition, from draft to sendable — with a person in between.
//
// Nothing sends a newsletter yet (no sender is connected). This module is the
// gate any sender must go through, so the rule exists before the sender does:
//
//   draftEdition(review)        builds the edition from the weekly review: the
//                               content, the standard disclaimer, the data-as-
//                               at date and the AI-assisted note, and runs the
//                               content check (no recommendations, ratings or
//                               price targets).
//   approveEdition(draft, who)  records a named person's approval of that exact
//                               copy, with the time and a hash of the text.
//                               Refuses a draft that fails the content check.
//   assertSendable(edition)     throws unless the edition was approved and its
//                               text is byte-for-byte what was approved.
//
// Approved copies are kept as files by scripts/newsletter.mjs
// (data/newsletter/approved/), so the record is in the repository's history.

import { guardText } from './adviceGuard.js'
import { reportFooter, DISCLAIMER_VERSION } from './disclosures.js'

export const EDITION_RULES = 'Describe and explain; do not recommend. No stock picks, no ratings, no price targets.'

// Ratings and targets in newsletter copy, on top of the advice guard.
const EXTRA = [
  { rule: 'rating', re: /\b(strong\s+)?(buy|sell|hold|accumulate|reduce|overweight|underweight|outperform|underperform)\s+(rating|call|recommendation)\b|\brated\s+(a\s+)?(buy|sell|hold)\b|\bstance\s*:/i },
  { rule: 'price-target', re: /\b(price\s+target|target\s+price|valuation\s+of\s+(A|US)?\$|fair\s+value)\b/i },
  { rule: 'picks', re: /\b(stock|top|our|my)\s+picks?\b|\bstocks?\s+to\s+(buy|watch\s+and\s+buy)\b/i },
]

// FNV-1a, 32-bit, hex: enough to show the sent text is the approved text.
export function textHash(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

export function checkEditionContent(body) {
  const flags = guardText(body).flags.map((f) => ({ rule: f.rule, sentence: f.sentence }))
  for (const line of String(body).split('\n')) {
    for (const r of EXTRA) if (r.re.test(line)) flags.push({ rule: r.rule, sentence: line.trim().slice(0, 240) })
  }
  return flags
}

// review: a weekly review ({ headline, sections: [{ title, content }], generatedAt })
// week:   { key, friday } (weeklyReviewService.reviewWeek)
export function draftEdition(review, week, { name = 'THE MADDEX INTELLIGENCE BRIEF' } = {}) {
  const asOf = Date.parse(review?.generatedAt ?? '') || Date.parse(`${week.friday}T06:00:00Z`)
  const body = [
    `${name} — week ending ${week.friday}`,
    '',
    review?.headline ?? '',
    '',
    ...(review?.sections ?? []).flatMap((s) => [String(s.title ?? '').toUpperCase(), String(s.content ?? ''), '']),
    ...reportFooter({ asOf, ai: true }),
  ].join('\n').trim()
  return {
    id: week.key,
    status: 'draft',
    subject: `${name}: week ending ${week.friday}`,
    body,
    asOf: new Date(asOf).toISOString(),
    aiAssisted: true,
    rules: EDITION_RULES,
    disclaimerVersion: DISCLAIMER_VERSION,
    flags: checkEditionContent(body),
    hash: textHash(body),
  }
}

export function approveEdition(draft, approver, now = new Date()) {
  const who = String(approver ?? '').trim()
  if (!who) throw new Error('An edition needs a named approver.')
  const flags = checkEditionContent(draft.body)
  if (flags.length) throw new Error(`Edition fails the content rules (${flags.map((f) => f.rule).join(', ')}): fix the copy and draft again.`)
  return { ...draft, status: 'approved', flags, approvedBy: who, approvedAt: now.toISOString(), approvedHash: textHash(draft.body) }
}

export function assertSendable(edition) {
  if (edition?.status !== 'approved' || !edition.approvedBy || !edition.approvedAt) throw new Error('Not sendable: no recorded human approval.')
  if (textHash(edition.body) !== edition.approvedHash) throw new Error('Not sendable: the text has changed since it was approved.')
  return true
}
