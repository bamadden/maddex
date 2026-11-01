// Stage 2 of the review pipeline: an independent second reading.
//
// A separate model call sees only the source passage and the two parties —
// not the first pass's type, direction, weight or quote — and says what
// relationship the passage states between them, which way, how sure it is,
// and the words that support it. Code then checks the reply and compares it
// with the proposal. The model is never asked for a number: its supporting
// words must be found verbatim in the passage, and any figure in its
// rationale must appear in the passage too.
//
// Dependency-free: used by scripts/graph-second-pass.mjs, triage and tests.

import { PROPOSAL_TYPES, numbersIn } from './validate.js'
import { matchOnPage, canonical } from './verify.js'

export const SECOND_PASS_MODEL = 'claude-opus-5-5'
export const RELATIONSHIPS = [...PROPOSAL_TYPES, 'none']
export const DIRECTIONS = ['a_to_b', 'b_to_a', 'mutual', 'not_applicable']
export const CONFIDENCES = ['high', 'medium', 'low']

// What publishes is the edge type, so subsidiary and owns (both an `owns`
// edge, parent → child) count as the same relationship.
export const EDGE_OF = { supplier: 'supplies', customer: 'customer_of', owns: 'owns', subsidiary: 'owns', joint_venture: 'joint_venture', director_of: 'director_of' }
const SYMMETRIC = new Set(['joint_venture'])

// The passage: the cited page around the verified quote, cut at word
// boundaries. No marker shows where the quote is.
export function passageFor(pageText, match, radius = 700) {
  const base = canonical(pageText).base
  let start = Math.max(0, match.start - radius)
  let end = Math.min(base.length, match.end + radius)
  if (start > 0) start = base.indexOf(' ', start) + 1 || start
  if (end < base.length) end = base.lastIndexOf(' ', end) > match.end ? base.lastIndexOf(' ', end) : end
  return base.slice(start, end).trim()
}

// The two parties in a fixed (alphabetical) order, so the order itself does
// not hint at the first pass's direction.
export function partiesOf(p) {
  const [a, b] = [p.from.name, p.to.name].sort((x, y) => x.localeCompare(y))
  return { a, b, fromIsA: p.from.name === a }
}

export const SECOND_PASS_SYSTEM = `You check one business relationship in a company document for a financial graph. You are given a passage from the document and two parties, A and B. Say what relationship the passage itself states between them. Use nothing outside the passage.

Relationship types:
- owns: one party holds an equity stake in the other.
- subsidiary: one party is the parent of the other (a controlled entity).
- joint_venture: the two are partners in a joint venture or jointly owned business.
- customer: one party buys from, rents from or is a tenant of the other.
- supplier: one party supplies goods or services to the other.
- director_of: a person is a director or chair of a company.
- none: the passage does not state a relationship between these two.

Direction:
- a_to_b: A owns B / A is B's parent / A is B's customer / A supplies B / A is a director of B.
- b_to_a: the same with B first.
- mutual: joint ventures.
- not_applicable: when the relationship is none.

Holding shares is ownership, never a customer relationship. A tenant is the customer of its landlord.

"supporting_quote" must be copied exactly from the passage: the words that state the relationship. "rationale" is one or two sentences in your own words. Do not state any number, percentage or amount in the rationale unless it is copied from the passage. Use "low" confidence when the passage only implies the relationship, and "none" when it does not state one.`

export const SECOND_PASS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['relationship', 'direction', 'confidence', 'supporting_quote', 'rationale'],
  properties: {
    relationship: { type: 'string', enum: RELATIONSHIPS },
    direction: { type: 'string', enum: DIRECTIONS },
    confidence: { type: 'string', enum: CONFIDENCES },
    supporting_quote: { type: 'string' },
    rationale: { type: 'string' },
  },
}

export function secondPassUser({ passage, a, b }) {
  return `Party A: ${a}\nParty B: ${b}\n\nPassage:\n"""\n${passage}\n"""`
}

// Problems with a verdict, checked in code. Empty means usable.
export function verdictProblems(v, passage) {
  const p = []
  if (!v || typeof v !== 'object') return ['no verdict']
  if (!RELATIONSHIPS.includes(v.relationship)) p.push(`unknown relationship "${v.relationship}"`)
  if (!DIRECTIONS.includes(v.direction)) p.push(`unknown direction "${v.direction}"`)
  if (!CONFIDENCES.includes(v.confidence)) p.push(`unknown confidence "${v.confidence}"`)
  if (v.relationship !== 'none') {
    if (String(v.supporting_quote ?? '').trim().length < 12) p.push('supporting quote too short')
    else if (!matchOnPage(passage, v.supporting_quote)) p.push('supporting quote is not in the passage')
  }
  const inPassage = new Set(numbersIn(passage))
  const invented = numbersIn(v.rationale ?? '').filter((n) => !inPassage.has(n))
  if (invented.length) p.push(`rationale states ${invented.join(', ')}, not in the passage`)
  return p
}

// → { outcome: 'agree' | 'type_disagree' | 'direction_disagree' | 'insufficient_evidence', detail }
export function compareVerdict(p, v, problems = []) {
  if (problems.length) return { outcome: 'insufficient_evidence', detail: problems.join('; ') }
  if (v.relationship === 'none') return { outcome: 'insufficient_evidence', detail: 'second pass found no relationship stated in the passage' }
  if (EDGE_OF[v.relationship] !== EDGE_OF[p.type]) return { outcome: 'type_disagree', detail: `proposal says ${p.type}; second pass says ${v.relationship}` }
  if (SYMMETRIC.has(EDGE_OF[p.type])) return { outcome: 'agree', detail: 'same type (symmetric)' }
  const { fromIsA } = partiesOf(p)
  const want = fromIsA ? 'a_to_b' : 'b_to_a'
  if (v.direction !== want) return { outcome: 'direction_disagree', detail: `proposal reads ${p.from.name} → ${p.to.name}; second pass reads ${v.direction === 'mutual' ? 'mutual' : v.direction === want ? 'same' : `${p.to.name} → ${p.from.name}`}` }
  return { outcome: 'agree', detail: v.relationship === p.type ? 'same type and direction' : `same edge (${p.type} / ${v.relationship}), same direction` }
}
