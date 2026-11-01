// Stage 1 of the review pipeline: deterministic checks on a proposed edge.
// No AI anywhere in this file.
//
// For each proposal, against the source document's own text:
//   quote        appears word for word on the cited page;
//   source       the document has a label, an https url and an ISO date, and
//                the proposal names a page;
//   identifiers  both ends resolve to nodes the graph already holds;
//   type         is one of the proposal types;
//   stake        an ownership-type edge carries the percentage its quote
//                states (and only that), and any weight is in the quote.
// Any failed check auto-rejects the proposal; the reasons are recorded.
//
// NORMALISATION — only whitespace, hyphenation and quote marks:
//   - whitespace runs become one space (PDF extraction breaks lines);
//   - typographic quotes and apostrophes fold to ' and "; dashes to -;
//     soft hyphens go; NFKC folds ligatures (ﬁ → fi) — see normaliseWs;
//   - a hyphen between two letters, with or without a line break after it,
//     is dropped on both sides ("sub- sidiary", "pro-rata" and "prorata" all
//     compare equal). Hyphens next to digits are kept: 2025-26 stays.
// Letters, digits, case and punctuation are never changed.

import { normaliseWs, PROPOSAL_TYPES, weightInQuote } from './validate.js'

const LETTER = /\p{L}/u

// The text used for matching, and for each of its characters the index in
// `base` it came from — so a match can be reported as a span of the readable
// (whitespace-normalised) page text.
export function canonical(s) {
  const base = normaliseWs(s)
  let text = ''
  const map = []
  for (let i = 0; i < base.length; i++) {
    if (base[i] === '-' && LETTER.test(base[i - 1] ?? '')) {
      const j = base[i + 1] === ' ' ? i + 2 : i + 1
      if (LETTER.test(base[j] ?? '')) { i = j - 1; continue }
    }
    text += base[i]
    map.push(i)
  }
  return { base, text, map }
}

// Where `quote` sits in `pageText`, as a span of the normalised page text.
export function matchOnPage(pageText, quote) {
  const q = canonical(quote).text
  if (!q) return null
  const c = canonical(pageText)
  const at = c.text.indexOf(q)
  if (at < 0) return null
  const start = c.map[at]
  const end = c.map[at + q.length - 1] + 1
  return { start, end, text: c.base.slice(start, end) }
}

// result: 'verified' (on the cited page) | 'wrong_page' (only elsewhere) |
// 'not_found'. pages[0] is page 1.
export function verifyQuote(pages, quote, citedPage) {
  const onCited = Number.isInteger(citedPage) ? matchOnPage(pages[citedPage - 1] ?? '', quote) : null
  if (onCited) return { result: 'verified', page: citedPage, citedPage, ...onCited }
  for (let i = 0; i < pages.length; i++) {
    const m = matchOnPage(pages[i], quote)
    if (m) return { result: 'wrong_page', page: i + 1, citedPage: citedPage ?? null, ...m }
  }
  return { result: 'not_found', page: null, citedPage: citedPage ?? null }
}

// Percentages the quote states as percentages ("23.4%", "50 per cent").
export function percentagesIn(text) {
  return [...normaliseWs(text).matchAll(/(\d+(?:\.\d+)?)\s?(?:%|per ?cent\b|percent\b)/gi)].map((m) => Number(m[1]))
}

// Name → node id, the same way for every stage: case, punctuation, company
// suffixes (Limited, Ltd, Group…) and post-nominals (AO, AC, AM…) ignored. A
// proposal's own id, when it has one, still has to be a node.
const SUFFIX = /\b(limited|ltd|plc|inc|group|holdings|corporation|pty|ao|ac|am|oam|psm)\b\.?/g
export const nameKey = (s) => normaliseWs(s).toLowerCase().replace(SUFFIX, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function nodeResolver(nodes) {
  const ids = new Set(nodes.map((n) => n.id))
  const byName = new Map()
  for (const n of nodes) {
    if (!byName.has(nameKey(n.name))) byName.set(nameKey(n.name), n.id)
    if (n.ticker && !byName.has(n.ticker.toLowerCase())) byName.set(n.ticker.toLowerCase(), n.id)
  }
  return (side) => {
    if (side?.id) return ids.has(side.id) ? side.id : null
    return byName.get(nameKey(side?.name)) ?? null
  }
}

export const STAKE_TYPES = ['owns', 'subsidiary', 'joint_venture']
const ISO = /^\d{4}-\d{2}-\d{2}$/

// p: a proposal; doc: its proposals file ({ label, sourceUrl, asAt });
// pages: the source's page texts; resolve: nodeResolver(nodes).
// Returns { ok, reasons, checks, match, resolved: { from, to } }.
export function verifyProposal(p, doc, pages, resolve) {
  const checks = {}
  const fail = (check, reason) => { checks[check] = { ok: false, reason }; return reason }
  const pass = (check, detail) => { if (!checks[check]) checks[check] = { ok: true, ...(detail ? { detail } : {}) } }
  const reasons = []

  const match = verifyQuote(pages ?? [], p?.quote ?? '', p?.page)
  if (!pages?.length) reasons.push(fail('quote', 'source text unavailable'))
  else if (normaliseWs(p?.quote).length < 20) reasons.push(fail('quote', 'quote shorter than 20 characters'))
  else if (match.result === 'not_found') reasons.push(fail('quote', 'quote not found word for word in the source'))
  else if (match.result === 'wrong_page') reasons.push(fail('quote', `quote is on page ${match.page}, not the cited page ${p.page}`))
  else pass('quote', `page ${match.page}, characters ${match.start}–${match.end}`)

  if (!doc?.label) reasons.push(fail('source', 'source has no label'))
  else if (!/^https:\/\//.test(doc?.sourceUrl ?? '')) reasons.push(fail('source', 'source url missing or not https'))
  else if (!ISO.test(doc?.asAt ?? '')) reasons.push(fail('source', 'source date missing'))
  else if (!Number.isInteger(p?.page) || p.page < 1) reasons.push(fail('source', 'no cited page'))
  else pass('source')

  const resolved = { from: resolve(p?.from), to: resolve(p?.to) }
  for (const side of ['from', 'to']) {
    if (resolved[side]) continue
    reasons.push(fail('identifiers', p?.[side]?.id
      ? `${side} id "${p[side].id}" is not a node`
      : `${side} "${p?.[side]?.name ?? '?'}" does not resolve to a known node`))
  }
  if (resolved.from && resolved.from === resolved.to) reasons.push(fail('identifiers', 'both ends are the same node'))
  pass('identifiers')

  if (!PROPOSAL_TYPES.includes(p?.type)) reasons.push(fail('type', `type "${p?.type}" is not allowed`))
  else pass('type')

  const stated = percentagesIn(p?.quote ?? '')
  if (p?.weight != null && !weightInQuote(p.weight, normaliseWs(p.quote))) reasons.push(fail('stake', `weight ${p.weight} is not in the quote`))
  else if (STAKE_TYPES.includes(p?.type)) {
    if (p.weight == null && stated.length) reasons.push(fail('stake', `quote states ${stated.map((n) => `${n}%`).join(', ')} but the edge has no stake`))
    else if (p.weight != null && !stated.some((n) => Math.abs(n - p.weight) < 1e-9)) reasons.push(fail('stake', `stake ${p.weight}% is not stated as a percentage in the quote`))
  }
  pass('stake', stated.length ? `quote states ${stated.map((n) => `${n}%`).join(', ')}` : null)

  return { ok: reasons.length === 0, reasons, checks, match, resolved }
}

// The Stage 1 record for every proposal in every proposals file.
// docs: [{ file, label, sourceUrl, asAt, proposals }]; sources: url → { sha256,
// pages } (missing → every quote check fails as "source text unavailable").
export function buildVerification(docs, sources, nodes, generatedAt = new Date().toISOString()) {
  const resolve = nodeResolver(nodes)
  const results = {}
  const used = {}
  for (const doc of docs) {
    const url = String(doc.sourceUrl ?? '').split('#')[0]
    const src = sources[url]
    if (src) used[url] = { sha256: src.sha256, pages: src.pages.length }
    for (const p of doc.proposals ?? []) {
      const v = verifyProposal(p, doc, src?.pages ?? null, resolve)
      results[p.id] = { file: doc.file, ok: v.ok, reasons: v.reasons, checks: v.checks, resolved: v.resolved, match: { ...v.match, sourceSha256: src?.sha256 ?? null } }
    }
  }
  return { stage: 1, generatedAt, sources: used, results }
}
