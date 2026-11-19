// MaddenAI's prompts (WS4, 19 Nov 2026): versioned, descriptive only, and the
// voice and reading-level controls change tone only.
//
// THE VERSION TEST FAILS ON ANY PROMPT CHANGE. That is the point: a prompt
// change must come with its tests. Update the tests that pin the changed
// wording (here, promptsDescribe, adviceBoundary), then run
// `npm run prompts:accept` to record the new version.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { prompts, promptVersions } from '../src/services/promptRegistry.js'
import { PERSONAS, TONE_ONLY } from '../src/services/aiPrompts.js'
import { EXPERIENCE_CONTEXT } from '../src/lib/profileUtils.js'
import { textHash as serverHash } from '../api/_aiRecords.js'
import { textHash } from '../src/utils/textHash.js'

const ACCEPTED = JSON.parse(fs.readFileSync('tests/fixtures/promptVersions.json', 'utf8'))

test('every prompt is at its accepted version (changes need their tests updated, then npm run prompts:accept)', () => {
  const now = promptVersions()
  const changed = Object.keys({ ...now, ...ACCEPTED }).filter((k) => now[k] !== ACCEPTED[k]).map((k) => `${k}: accepted ${ACCEPTED[k] ?? 'none'}, now ${now[k] ?? 'removed'}`)
  assert.deepEqual(changed, [], 'a prompt changed: update the tests that pin its wording, then run npm run prompts:accept')
})

test('the server records replies with the same hash the registry versions prompts with', () => {
  assert.equal(serverHash('MaddenAI'), textHash('MaddenAI'))
  assert.equal(textHash('abc'), '1a47e90b')
})

// Content-changing or forecasting asks; negated forms ("no forecast", "never
// a question asking what will happen") are allowed.
const ASKS = /what (they|it) means? for (positioning|an? (everyday )?investor)|focus on technical analysis|likelihood \((low|medium)|tailwinds|headwinds|risk scenario|\bwhat if\b|(?<!no |never |not )\bprice targets?\b(?! or)|(?<!no |never |not |without )\bforecast (the|of|for)\b|what to (buy|sell|watch)(?! —)|\bpositioning\b/i

test('every prompt describes: no ask for a forecast, scenario, rating or view on what to do', () => {
  const bad = []
  for (const [name, text] of prompts()) {
    for (const sentence of text.split(/(?<=[.:!?])\s+/)) {
      if (/^(Never|Do not|no |Describe only)/i.test(sentence.trim())) continue
      if (ASKS.test(sentence) && !/\b(no|never|not|without)\b[^.]*\b(forecast|price targets?|scenario|what to)/i.test(sentence)) bad.push(`${name}: ${sentence.trim().slice(0, 120)}`)
    }
  }
  assert.deepEqual(bad, [])
})

test('voice (persona) and reading level change tone only', () => {
  for (const [id, label, desc] of PERSONAS) {
    assert.doesNotMatch(desc, /positioning|everyday investor|recommend|outlook|what to watch|portfolio-focused/i, `${id} (${label})`)
  }
  for (const [name, text] of prompts().filter(([n]) => n.startsWith('persona:'))) assert.ok(text.includes(TONE_ONLY), name)
  for (const [level, text] of Object.entries(EXPERIENCE_CONTEXT)) {
    assert.doesNotMatch(text, /focus on|analysis|outlook|recommend/i, `${level}: reading level sets vocabulary and explanation, not content`)
  }
})
