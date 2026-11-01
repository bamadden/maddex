// Relationships review pipeline — Stage 1 (deterministic quote and fact
// checks). No AI, no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonical, matchOnPage, verifyQuote, percentagesIn, verifyProposal, nodeResolver, buildVerification } from '../src/data/graph/verify.js'

const NODES = [
  { id: 'WES', type: 'company', name: 'Wesfarmers Limited', ticker: 'WES' },
  { id: 'BWP', type: 'company', name: 'BWP Group', ticker: 'BWP' },
  { id: 'person:michael-chaney', type: 'person', name: 'Michael Chaney' },
]
const resolve = nodeResolver(NODES)
const DOC = { file: 'WES-2026-06-30.json', label: 'Wesfarmers 2026 Annual Report', sourceUrl: 'https://example.com/ar.pdf', asAt: '2026-06-30' }
const PAGES = [
  'Contents',
  'Following completion, Wesfarmers’ owner-\nship in BWP increased from 22.29 per cent to 23.44 per  cent of stapled\nsecurities.',
  'Wesfarmers holds 23.44 per cent of BWP and is its largest securityholder.',
]
const owns = (over = {}) => ({ id: 'p1', type: 'owns', from: { name: 'Wesfarmers', id: 'WES' }, to: { name: 'BWP Group', id: 'BWP' }, weight: 23.44,
  quote: "Following completion, Wesfarmers' ownership in BWP increased from 22.29 per cent to 23.44 per cent of stapled securities.", page: 2, ...over })

// ── Quote match and mismatch ────────────────────────────────────────────────
test('a quote on its cited page verifies, with the matched span recorded', () => {
  const m = verifyQuote(PAGES, owns().quote, 2)
  assert.equal(m.result, 'verified')
  assert.equal(m.page, 2)
  assert.ok(m.end > m.start)
  assert.match(m.text, /^Following completion, Wesfarmers' owner- ship in BWP/) // the page text as extracted, whitespace-normalised
})

test('a quote that is not in the source is not found', () => {
  assert.equal(verifyQuote(PAGES, 'Wesfarmers increased its ownership in BWP to 25 per cent.', 2).result, 'not_found')
})

test('one changed word is a mismatch', () => {
  assert.equal(verifyQuote(PAGES, owns().quote.replace('increased', 'rose'), 2).result, 'not_found')
})

test('a changed figure is a mismatch', () => {
  assert.equal(verifyQuote(PAGES, owns().quote.replace('23.44', '23.4'), 2).result, 'not_found')
})

test('a quote that is real but on another page is a wrong-page failure', () => {
  const m = verifyQuote(PAGES, 'Wesfarmers holds 23.44 per cent of BWP and is its largest securityholder.', 2)
  assert.equal(m.result, 'wrong_page')
  assert.equal(m.page, 3)
  const v = verifyProposal(owns({ quote: 'Wesfarmers holds 23.44 per cent of BWP and is its largest securityholder.' }), DOC, PAGES, resolve)
  assert.equal(v.ok, false)
  assert.match(v.reasons.join(), /on page 3, not the cited page 2/)
})

// ── Normalisation edge cases ────────────────────────────────────────────────
test('whitespace runs and line breaks compare equal', () => {
  assert.ok(matchOnPage('a  b\n\tc  d e f g h i j k l', 'a b c d'))
})

test('curly and straight quote marks compare equal', () => {
  assert.ok(matchOnPage('BWP’s “largest” securityholder', 'BWP\'s "largest" securityholder'))
  assert.ok(matchOnPage("BWP's largest", 'BWP’s largest'))
})

test('line-break hyphenation is undone on both sides', () => {
  assert.ok(matchOnPage('the sub-\nsidiary was sold', 'the subsidiary was sold'))
  assert.ok(matchOnPage('its pro-\nrata entitlement', 'its pro-rata entitlement'))
  assert.ok(matchOnPage('its pro-rata entitlement', 'its prorata entitlement'))
})

test('soft hyphens, ligatures and en dashes are folded', () => {
  assert.ok(matchOnPage('the ﬁnancial year', 'the financial year'))
  assert.ok(matchOnPage('owner­ship', 'ownership'))
  assert.ok(matchOnPage('2025–26 year', '2025-26 year'))
})

test('hyphens next to digits are kept, so number ranges are not merged', () => {
  assert.equal(canonical('2025-26').text, '2025-26')
  assert.equal(matchOnPage('the 2025-26 year', 'the 202526 year'), null)
})

test('letters, digits and case are never changed', () => {
  assert.equal(matchOnPage('Wesfarmers holds 23.44 per cent', 'wesfarmers holds 23.44 per cent'), null)
  assert.equal(matchOnPage('Wesfarmers holds 23.44 per cent', 'Wesfarmers holds 23,44 per cent'), null)
  assert.equal(matchOnPage('Wesfarmers holds 23.44 per cent', 'Wesfarmers holds 23.44 per cent.'), null)
})

test('the matched span maps back through dropped hyphens', () => {
  const page = 'Before. The sub-\nsidiary was sold. After.'
  const m = matchOnPage(page, 'The subsidiary was sold.')
  assert.equal(m.text, 'The sub- sidiary was sold.')
})

// ── The other Stage 1 checks ────────────────────────────────────────────────
test('a sound proposal passes every check', () => {
  const v = verifyProposal(owns(), DOC, PAGES, resolve)
  assert.equal(v.ok, true, v.reasons.join('; '))
  assert.deepEqual(Object.values(v.checks).map((c) => c.ok), [true, true, true, true, true])
  assert.deepEqual(v.resolved, { from: 'WES', to: 'BWP' })
})

test('a missing source date or url fails', () => {
  assert.match(verifyProposal(owns(), { ...DOC, asAt: undefined }, PAGES, resolve).reasons.join(), /source date missing/)
  assert.match(verifyProposal(owns(), { ...DOC, sourceUrl: 'http://example.com' }, PAGES, resolve).reasons.join(), /not https/)
})

test('a counterparty that is not a node fails; a name that is one resolves', () => {
  const v = verifyProposal(owns({ to: { name: 'Flybuys', id: null } }), DOC, PAGES, resolve)
  assert.match(v.reasons.join(), /to "Flybuys" does not resolve/)
  assert.equal(resolve({ name: 'Michael Chaney AO', id: null }), 'person:michael-chaney')
  assert.equal(resolve({ name: 'X', id: 'NOPE' }), null)
})

test('an edge type outside the allowed set fails', () => {
  assert.match(verifyProposal(owns({ type: 'partner' }), DOC, PAGES, resolve).reasons.join(), /type "partner" is not allowed/)
})

test('the stake must be a percentage the quote states', () => {
  assert.deepEqual(percentagesIn('from 22.29 per cent to 23.44 percent, or 50%'), [22.29, 23.44, 50])
  assert.match(verifyProposal(owns({ weight: 22.3 }), DOC, PAGES, resolve).reasons.join(), /weight 22.3 is not in the quote/)
  assert.match(verifyProposal(owns({ weight: null }), DOC, PAGES, resolve).reasons.join(), /quote states 22.29%, 23.44% but the edge has no stake/)
  // A bare table figure is not a stated percentage.
  const table = ['Australian Gold Reagents Pty Ltd 75 75']
  const agr = { ...owns(), type: 'subsidiary', weight: 75, quote: 'Australian Gold Reagents Pty Ltd 75 75', page: 1 }
  assert.match(verifyProposal(agr, DOC, table, resolve).reasons.join(), /stake 75% is not stated as a percentage/)
})

test('without the source text every quote fails', () => {
  const r = buildVerification([{ ...DOC, proposals: [owns()] }], {}, NODES)
  assert.equal(r.results.p1.ok, false)
  assert.match(r.results.p1.reasons.join(), /source text unavailable/)
})

test('the verification record names the source bytes it was checked against', () => {
  const r = buildVerification([{ ...DOC, proposals: [owns()] }], { 'https://example.com/ar.pdf': { sha256: 'abc', pages: PAGES } }, NODES, '2026-11-01T00:00:00Z')
  assert.equal(r.results.p1.ok, true)
  assert.equal(r.results.p1.match.sourceSha256, 'abc')
  assert.deepEqual(r.sources, { 'https://example.com/ar.pdf': { sha256: 'abc', pages: 3 } })
})

// ── Counterparty nodes (added 1 Nov 2026) ───────────────────────────────────
import fs from 'node:fs'
import { ALL_NODES } from '../src/data/graph/nodes.js'

const sourced = ALL_NODES.filter((n) => n.source)

test('every counterparty node carries a page, an https source and a quote; an ABN only beside the legal name it was matched on', () => {
  assert.ok(sourced.length >= 17)
  for (const n of sourced) {
    assert.equal(n.type, 'company', n.id)
    assert.match(n.source.url, /^https:\/\/.+#page=\d+$/, n.id)
    assert.ok(Number.isInteger(n.source.page) && n.source.quote.length >= 15, n.id)
    if (n.abn) {
      assert.match(n.abn, /^\d{2} \d{3} \d{3} \d{3}$/, n.id)
      assert.ok(n.legalName, `${n.id}: ABN without the legal name it belongs to`)
    }
  }
  assert.ok(!ALL_NODES.some((n) => n.type === 'person' && n.source?.label?.startsWith('Wesfarmers 2026')), 'no directors added')
})

test('a counterparty resolves by its name, legal name or alias', () => {
  const resolve = nodeResolver(ALL_NODES)
  assert.equal(resolve({ name: 'Bunnings Group', id: null }), 'co:bunnings')
  assert.equal(resolve({ name: 'Bunnings', id: null }), 'co:bunnings')
  assert.equal(resolve({ name: 'Kmart Group', id: null }), 'co:kmart')
  assert.equal(resolve({ name: 'Wespine Industries Pty Ltd', id: null }), 'co:wespine')
  assert.equal(resolve({ name: 'Sociedad Química y Minera', id: null }), 'co:sqm')
  assert.equal(resolve({ name: 'Wesfarmers Chemicals, Energy & Fertilisers', id: null }), 'co:wescef')
  assert.equal(resolve({ name: 'Aaron Hood', id: null }), null) // people were not added
})

// Runs where the source PDF has been downloaded (npm run graph:verify).
const AR = '.cache/graph-sources/announcements.asx.com.au_asxpdf_20260827_pdf_0738z357pt1vhl.pdf.pages.json'
test('each counterparty quote is verbatim on its cited page of the report', { skip: !fs.existsSync(AR) && 'source text not cached' }, () => {
  const pages = JSON.parse(fs.readFileSync(AR, 'utf8')).pages
  for (const n of sourced) assert.ok(matchOnPage(pages[n.source.page - 1], n.source.quote), `${n.id} p${n.source.page}`)
})
