// MaddenAI experience (WS4, 19 Nov 2026): every answer shows the dated
// sources its figures were given from and how it was produced; failures name
// their kind (busy, too long, paused for credit, unavailable) without vendor
// wording; the panel shows what the plan allows today.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { answerSources, buildAnswerMeta, AI_CONTEXT_DATASETS } from '../src/services/answerMeta.js'
import { userFacingAiError, AI_PAUSED, AI_UNAVAILABLE, AI_MODEL } from '../src/services/api.js'
import { textHash } from '../src/utils/textHash.js'

test('each answer lists the dated datasets its figures were given from', () => {
  const s = answerSources()
  assert.equal(s.length, AI_CONTEXT_DATASETS.length)
  for (const r of s) {
    assert.ok(r.source && r.what, r.id)
    assert.match(r.asOf ?? '', /^\d{4}-\d{2}-\d{2}$/, `${r.id} has a date`)
  }
  assert.ok(answerSources({ pendingRba: true }).some((r) => r.id === 'vc:rbaNextDecision'))
})

test('the "how this was produced" record names the model, prompt versions and the advice check', () => {
  const m = buildAnswerMeta({ result: { guard: { flags: [{ rule: 'x', sentence: 'Buy it.' }, { rule: 'y', sentence: 'Buy it.' }], blocked: false }, elapsed: 2100, outputTokens: 300 }, model: AI_MODEL, prompts: [['persona:analyst', 'abc']], at: 1 })
  assert.equal(m.model, AI_MODEL)
  assert.deepEqual(m.versions, [`persona:analyst@${textHash('abc')}`])
  assert.deepEqual(m.guard, { checked: true, removed: 1, blocked: false }, 'two rules on one sentence count as one sentence removed')
  assert.equal(buildAnswerMeta({ result: {} }).guard.checked, false)
  const panel = fs.readFileSync('src/components/layout/AIPanel.jsx', 'utf8')
  assert.match(panel, /\{!streaming && msg\.meta && <AnswerMeta meta=\{msg\.meta\} \/>\}/)
  const comp = fs.readFileSync('src/components/ai/AnswerMeta.jsx', 'utf8')
  assert.match(comp, /HOW THIS WAS PRODUCED/)
  assert.match(comp, /FIGURES GIVEN TO MADDENAI/)
})

test('failures say what kind they are, without vendor wording', () => {
  assert.equal(userFacingAiError(402, ''), AI_PAUSED)
  assert.equal(userFacingAiError(400, 'Your credit balance is too low to access the API'), AI_PAUSED)
  assert.match(userFacingAiError(429, 'rate limit'), /busy/)
  assert.match(userFacingAiError(400, 'prompt is too long'), /too long/)
  assert.equal(userFacingAiError(500, 'boom'), AI_UNAVAILABLE)
  for (const m of [AI_PAUSED, AI_UNAVAILABLE]) assert.doesNotMatch(m, /anthropic|claude|credit balance|API/i)
  assert.match(AI_PAUSED, /not yours/)
})

test('the panel shows how many questions the plan allows today', () => {
  const panel = fs.readFileSync('src/components/layout/AIPanel.jsx', 'utf8')
  assert.match(panel, /data-ai-usage/)
  assert.match(panel, /questions left today on your \{plan\.toUpperCase\(\)\} plan \(counted on this device\)/)
})
