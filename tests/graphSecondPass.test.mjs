// Relationships review pipeline — Stage 2 (independent second pass). The
// model is a test double: no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { passageFor, partiesOf, verdictProblems, compareVerdict, SECOND_PASS_MODEL } from '../src/data/graph/secondPass.js'
import { matchOnPage } from '../src/data/graph/verify.js'
import { runSecondPass } from '../scripts/graph-second-pass.mjs'

const PAGE = 'BWP Trust. Wesfarmers, BWP\'s largest securityholder with 23.4% of BWP securities, has committed to take up its full entitlement. Bunnings comprise approximately 76.7% of the gross income of BWP.'
const owns = { id: 'p1', type: 'owns', from: { name: 'Wesfarmers', id: 'WES' }, to: { name: 'BWP', id: 'BWP' }, weight: 23.4, quote: "Wesfarmers, BWP's largest securityholder with 23.4% of BWP securities", page: 1 }
const verdict = (over = {}) => ({ relationship: 'owns', direction: 'b_to_a', confidence: 'high', supporting_quote: "Wesfarmers, BWP's largest securityholder", rationale: 'Wesfarmers is the largest securityholder in BWP.', ...over })

function fakeClient(reply) {
  const calls = []
  return {
    calls,
    messages: { create: async (req) => { calls.push(req); return { stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify(typeof reply === 'function' ? reply(req) : reply) }] } } },
  }
}

test('parties are given in alphabetical order, not the proposal\'s order', () => {
  assert.deepEqual(partiesOf(owns), { a: 'BWP', b: 'Wesfarmers', fromIsA: false })
})

test('the passage surrounds the quote, cut at word boundaries, with no marker', () => {
  const m = matchOnPage(PAGE, owns.quote)
  const passage = passageFor(PAGE, m, 20)
  assert.ok(passage.includes(owns.quote))
  assert.ok(!/[«»<>]|\[QUOTE/.test(passage))
  assert.ok(!passage.startsWith('rust')) // not cut mid-word
})

test('the second pass sees only the passage and the two parties', async () => {
  const client = fakeClient(verdict())
  await runSecondPass(client, [{ proposal: owns, passage: PAGE }])
  const req = client.calls[0]
  assert.equal(req.model, SECOND_PASS_MODEL)
  const user = req.messages[0].content
  assert.match(user, /Party A: BWP\nParty B: Wesfarmers/)
  // Nothing from the first pass beyond what the passage itself says.
  assert.ok(!/\bowns\b|proposal|first pass|weight/i.test(user))
  assert.equal(req.messages.length, 1)
})

test('agreement on type and direction', () => {
  assert.equal(compareVerdict(owns, verdict(), verdictProblems(verdict(), PAGE)).outcome, 'agree')
})

test('subsidiary and owns publish the same edge, so they agree', () => {
  assert.equal(compareVerdict(owns, verdict({ relationship: 'subsidiary' }), []).outcome, 'agree')
})

test('disagreement on type is recorded', () => {
  const c = compareVerdict(owns, verdict({ relationship: 'customer' }), [])
  assert.equal(c.outcome, 'type_disagree')
  assert.match(c.detail, /proposal says owns; second pass says customer/)
})

test('disagreement on direction is recorded', () => {
  assert.equal(compareVerdict(owns, verdict({ direction: 'a_to_b' }), []).outcome, 'direction_disagree')
})

test('joint ventures are symmetric: either direction agrees', () => {
  const jv = { ...owns, type: 'joint_venture' }
  assert.equal(compareVerdict(jv, verdict({ relationship: 'joint_venture', direction: 'mutual' }), []).outcome, 'agree')
})

test('"none" is insufficient evidence', () => {
  assert.equal(compareVerdict(owns, verdict({ relationship: 'none', direction: 'not_applicable', supporting_quote: '' }), []).outcome, 'insufficient_evidence')
})

test('a supporting quote that is not in the passage makes the verdict unusable', () => {
  const v = verdict({ supporting_quote: 'Wesfarmers controls BWP outright' })
  const problems = verdictProblems(v, PAGE)
  assert.match(problems.join(), /supporting quote is not in the passage/)
  assert.equal(compareVerdict(owns, v, problems).outcome, 'insufficient_evidence')
})

test('a figure the model wrote that is not in the passage makes the verdict unusable', () => {
  const problems = verdictProblems(verdict({ rationale: 'Wesfarmers holds about 25% of BWP.' }), PAGE)
  assert.match(problems.join(), /rationale states 25, not in the passage/)
  assert.deepEqual(verdictProblems(verdict({ rationale: 'Wesfarmers holds 23.4% of BWP securities.' }), PAGE), [])
})

test('a reply that is not JSON is recorded as insufficient evidence', async () => {
  const client = { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'I think they are related.' }] }) } }
  const r = await runSecondPass(client, [{ proposal: owns, passage: PAGE }])
  assert.equal(r.p1.comparison.outcome, 'insufficient_evidence')
  assert.equal(r.p1.error, 'reply was not JSON')
})

test('a reading is reused while its passage is unchanged, and redone when it changes', async () => {
  const client = fakeClient(verdict())
  const first = await runSecondPass(client, [{ proposal: owns, passage: PAGE }])
  assert.equal(client.calls.length, 1)
  await runSecondPass(client, [{ proposal: owns, passage: PAGE }], first)
  assert.equal(client.calls.length, 1)
  await runSecondPass(client, [{ proposal: owns, passage: PAGE + ' More text.' }], first)
  assert.equal(client.calls.length, 2)
})
