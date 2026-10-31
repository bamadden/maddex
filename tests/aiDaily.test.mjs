// The shared daily MaddenAI endpoint and its prompts — no network: the guard
// would refuse any model call, and these tests make none.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DAILY_KINDS, sydneyDay, secondsToSydneyMidnight } from '../src/services/aiDaily.js'
import handler from '../api/ai-daily.js'

function fakeRes() {
  const r = { statusCode: null, headers: {}, body: null }
  r.status = (c) => { r.statusCode = c; return r }
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r }
  r.json = (b) => { r.body = b; return r }
  return r
}

test('every shared kind builds its prompt offline, with no reader input', () => {
  for (const [kind, spec] of Object.entries(DAILY_KINDS)) {
    const { system, user } = spec.build({ headlines: ['RBA holds', 'Iron ore falls'] })
    assert.ok(system.length > 20 && user.length > 20, kind)
    assert.ok(spec.maxTokens > 0 && typeof spec.parse === 'function', kind)
  }
  assert.match(DAILY_KINDS.policy_bias.build().user, /- rba: RBA/)
})

test('Sydney day and cache lifetime', () => {
  assert.equal(sydneyDay(new Date('2026-10-31T13:30:00Z')), '2026-11-01') // 00:30 AEDT
  assert.equal(secondsToSydneyMidnight(new Date('2026-10-31T12:59:00Z')), 60) // 23:59 AEDT → floor 60
  const s = secondsToSydneyMidnight(new Date('2026-10-31T01:00:00Z')) // 12:00 AEDT
  assert.equal(s, 12 * 3600)
})

test('the endpoint refuses anything but ?kind=<known>&day=<today>, before any model call', async () => {
  const today = sydneyDay()
  for (const url of [
    `/api/ai-daily?kind=bogus&day=${today}`,
    '/api/ai-daily?kind=sentiment&day=2020-01-01',
    `/api/ai-daily?kind=sentiment&day=${today}&bust=1`,
    '/api/ai-daily',
  ]) {
    const res = fakeRes()
    await handler({ method: 'GET', url }, res)
    assert.equal(res.statusCode, 400, url)
    assert.equal(res.headers['cache-control'], 'no-store', url)
  }
  const post = fakeRes()
  await handler({ method: 'POST', url: `/api/ai-daily?kind=sentiment&day=${today}` }, post)
  assert.equal(post.statusCode, 405)
})

test('without a key it answers 503 and calls nothing', async () => {
  const saved = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  try {
    const res = fakeRes()
    await handler({ method: 'GET', url: `/api/ai-daily?kind=macro-themes&day=${sydneyDay()}` }, res)
    assert.equal(res.statusCode, 503)
  } finally { if (saved) process.env.ANTHROPIC_API_KEY = saved }
  assert.equal(globalThis.__networkGuard.attempts.length, 0)
})
