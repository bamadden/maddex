// The quote validator for proposed edges.
//
// A proposed edge is only as good as the sentence under it. A model asked to
// read an annual report will, now and then, write a plausible sentence that
// is not in the report, or attach a percentage the sentence does not contain.
// Both are checked here, in code, against the document text — the model's
// word is never taken for either.
//
//   - the quote must appear verbatim in the source, after whitespace is
//     normalised (PDF text extraction breaks lines and doubles spaces; it
//     does not change words);
//   - a weight must appear, as a number, in the quote itself;
//   - the page is the page the quote is actually on — corrected, and
//     flagged, when the proposal named another.
//
// Dependency-free: imported by scripts/propose-edges.mjs, the review queue
// and the tests.

export const PROPOSAL_TYPES = ['supplier', 'customer', 'owns', 'subsidiary', 'joint_venture', 'director_of']
export const MIN_QUOTE_CHARS = 20

// NFKC folds PDF ligatures (ﬁ → fi) and full-width forms; soft hyphens go;
// typographic quotes and dashes fold to their plain forms (a PDF's "BWP’s"
// and a model's "BWP's" are the same word); every run of whitespace becomes
// one space. Letters and digits are never touched.
export const normaliseWs = (s) => String(s ?? '').normalize('NFKC')
  .replace(/­/g, '')
  .replace(/[‘’‚‛′]/g, "'")
  .replace(/[“”„‟″]/g, '"')
  .replace(/[‐-―−]/g, '-')
  .replace(/\s+/g, ' ').trim()

// pages: array of page texts, pages[0] is page 1. Returns the 1-based page
// the quote is on, or null.
export function findQuotePage(pages, quote) {
  const q = normaliseWs(quote)
  if (!q) return null
  for (let i = 0; i < pages.length; i++) if (normaliseWs(pages[i]).includes(q)) return i + 1
  return null
}

// Every number written in the text, thousands separators removed.
export function numbersIn(text) {
  return (normaliseWs(text).match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, '')))
}

export const weightInQuote = (weight, quote) => numbersIn(quote).some((n) => Math.abs(n - weight) < 1e-9)

// Returns { ok, reasons, page, pageCorrected }.
export function validateProposal(p, pages) {
  const reasons = []
  if (!PROPOSAL_TYPES.includes(p?.type)) reasons.push(`unknown type "${p?.type}"`)
  if (!p?.from || !p?.to) reasons.push('missing a counterparty')
  if (p?.from && p?.to && normaliseWs(p.from).toLowerCase() === normaliseWs(p.to).toLowerCase()) reasons.push('both sides are the same party')
  const q = normaliseWs(p?.quote)
  if (q.length < MIN_QUOTE_CHARS) reasons.push(`quote shorter than ${MIN_QUOTE_CHARS} characters`)
  const page = q.length >= MIN_QUOTE_CHARS ? findQuotePage(pages, q) : null
  if (q.length >= MIN_QUOTE_CHARS && page == null) reasons.push('quote not found verbatim in the source text')
  if (p?.weight != null) {
    if (!(Number.isFinite(p.weight) && p.weight > 0 && p.weight <= 100)) reasons.push('weight is not a percentage in (0, 100]')
    else if (!weightInQuote(p.weight, q)) reasons.push(`weight ${p.weight} does not appear in the quote`)
  }
  return { ok: reasons.length === 0, reasons, page, pageCorrected: page != null && p?.page != null && page !== p.page }
}

// ±radius characters of normalised source around the quote, for the review
// queue to show the sentence in context.
export function quoteContext(pageText, quote, radius = 280) {
  const t = normaliseWs(pageText), q = normaliseWs(quote)
  const i = t.indexOf(q)
  if (i < 0) return null
  return { before: t.slice(Math.max(0, i - radius), i), quote: q, after: t.slice(i + q.length, i + q.length + radius) }
}
