// Holders that can never be the "from" of an ownership edge.
//
// Custodians and nominee companies are the registered holders of shares they
// hold for someone else — every top-20 register is led by HSBC Custody
// Nominees, J P Morgan Nominees and Citicorp Nominees, which between them
// "own" over half of most large ASX companies and own none of it. A graph
// that drew those lines would put three back offices at the centre of the
// market. loadGraph (schema.js) rejects any owns edge from a name that
// matches here, so they cannot come back by accident.
//
// Kept dependency-free so the tests and the proposal script can import it.

// Whole-word patterns: a name that calls itself a nominee or custodian.
export const NOMINEE_PATTERNS = [
  /\bnominees?\b/i,
  /\bcustod(y|ian|ians)\b/i,
  /\bdepositary\b/i,
]

// Named platforms and trustees that appear on top-20 registers holding for
// clients, whose names do not say so.
export const NOMINEE_NAMES = [
  'Netwealth Investments Limited',
  'Australian Executor Trustees Limited',
  'IOOF Investment Services Ltd',
  'Invia Custodian Pty Limited',
  'Mutual Trust Pty Ltd',
  'Bond Street Custodians Limited',
]

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const NAMES = new Set(NOMINEE_NAMES.map(norm))

export function isNomineeHolder(name) {
  if (!name) return false
  return NOMINEE_PATTERNS.some((re) => re.test(name)) || NAMES.has(norm(name))
}
