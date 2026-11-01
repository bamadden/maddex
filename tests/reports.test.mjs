// Newsletters and AI reports (legal-risk item 3): content rules, the standard
// disclaimer with the data date and the AI-assisted note on every edition and
// export, and a recorded human approval before any newsletter can send.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { draftEdition, approveEdition, assertSendable, checkEditionContent } from '../src/services/newsletterEdition.js'
import { reportFooter, STANDARD_DISCLAIMER, NOT_LICENSED } from '../src/services/disclosures.js'
import { noteToShareText, normaliseNote, NOTE_DISCLAIMER } from '../src/services/researchNoteService.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const WEEK = { key: '2026-W44', friday: '2026-10-30' }
const REVIEW = {
  headline: 'Hot CPI put a November hike back in play.',
  generatedAt: '2026-10-30T07:00:00Z',
  sections: [
    { title: 'WEEK IN REVIEW', content: 'September quarter trimmed mean CPI rose 1.0% q/q. Banks fell as rate expectations rose.' },
    { title: 'WEEK AHEAD', content: 'RBA decision (Tue) — the statement and the press conference.' },
  ],
}

test('the standard footer: data date, AI note, disclaimer, not licensed', () => {
  const f = reportFooter({ asOf: '2026-10-30' })
  assert.equal(f[0], 'Data as at 30 Oct 2026.')
  assert.match(f[1], /assistance of AI/)
  assert.ok(f.includes(STANDARD_DISCLAIMER))
  assert.match(STANDARD_DISCLAIMER, /objectives, financial situation or needs/)
  assert.match(STANDARD_DISCLAIMER, /Past performance is not a reliable indicator/)
  assert.match(STANDARD_DISCLAIMER, /AI can make mistakes/)
  assert.doesNotMatch(NOT_LICENSED, /\b(is|are)\s+(licensed|regulated|approved)/i)
})

test('an edition carries the footer and passes the content rules', () => {
  const d = draftEdition(REVIEW, WEEK)
  assert.equal(d.status, 'draft')
  assert.match(d.body, /Data as at 30 Oct 2026\./)
  assert.match(d.body, /assistance of AI/)
  assert.ok(d.body.includes(STANDARD_DISCLAIMER))
  assert.deepEqual(d.flags, [])
})

test('picks, ratings and targets fail the content check', () => {
  for (const bad of ['Our top picks this week: BHP and CSL.', 'We rate WES a buy.', 'Price target for CBA: A$150.', 'You should buy the banks before Tuesday.', 'Stance: CONSTRUCTIVE']) {
    assert.ok(checkEditionContent(bad).length > 0, bad)
  }
})

test('nothing sends without a recorded human approval of that exact text', () => {
  const d = draftEdition(REVIEW, WEEK)
  assert.throws(() => assertSendable(d), /no recorded human approval/)
  assert.throws(() => approveEdition(d, ''), /named approver/)
  const a = approveEdition(d, 'maddex-review', new Date('2026-10-31T00:00:00Z'))
  assert.equal(a.approvedBy, 'maddex-review')
  assert.equal(a.approvedAt, '2026-10-31T00:00:00.000Z')
  assert.equal(assertSendable(a), true)
  assert.throws(() => assertSendable({ ...a, body: `${a.body}\nBuy BHP.` }), /changed since it was approved/)
  const bad = draftEdition({ ...REVIEW, headline: 'Top picks: BHP and RIO.' }, WEEK)
  assert.throws(() => approveEdition(bad, 'maddex-review'), /fails the content rules/)
})

test('research notes carry no stance or rating, and their exports carry the footer', () => {
  const n = normaliseNote({ stance: 'CONSTRUCTIVE', stanceRationale: 'x', asset: { symbol: 'BHP.AX', name: 'BHP' }, executiveSummary: 'Iron ore.', generatedAt: '2026-10-30T00:00:00Z' })
  assert.equal(n.stance, undefined)
  const t = noteToShareText(n)
  assert.doesNotMatch(t, /\bStance\b/i)
  assert.match(t, /Data as at 30 Oct 2026/)
  assert.match(NOTE_DISCLAIMER, /assistance of AI/)
  assert.doesNotMatch(NOTE_DISCLAIMER, /author may hold positions/)
  const svc = read('src/services/researchNoteService.js')
  assert.doesNotMatch(svc, /"stance":/)
  for (const f of ['src/components/researchNote/PrintableNote.jsx', 'src/components/researchNote/notePdf.js']) assert.doesNotMatch(read(f), /STANCE_TONE|'STANCE'|>STANCE</, f)
  assert.ok(!fs.existsSync('src/services/aiStance.js'))
  assert.doesNotMatch(read('src/components/markets/AnalystCoverage.jsx'), /stance\.|assessStance/)
  assert.doesNotMatch(read('src/components/ui/DetailModal.jsx'), /Strong Buy|Target Mean|AnalystBar/)
})

test('every export path carries the disclaimer and data date', () => {
  assert.match(read('src/modules/brief/MorningBriefModule.jsx'), /reportFooter\(\{ asOf:/)
  assert.match(read('src/modules/brief/briefImage.js'), /assistance of AI · data as at/)
  assert.match(read('src/components/portfolio/PortfolioSnapshot.jsx'), /Data as at .*Past performance is not a reliable indicator/s)
  assert.match(read('src/modules/portfolio/performanceModel.js'), /Data as at \$\{today\}\. \$\{STANDARD_DISCLAIMER\}/)
  assert.match(read('src/modules/screener/ScreenerModule.jsx'), /reportFooter\(\{ asOf: Date\.now\(\), ai: false \}\)/)
  for (const f of ['src/services/morningBriefService.js', 'src/services/weeklyReviewService.js']) assert.match(read(f), /Describe and explain; do not recommend/, f)
})
