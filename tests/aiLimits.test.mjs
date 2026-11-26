// The server-side MaddenAI limits (api/_aiGuard.js), against a fake Supabase
// (26 Nov 2026, live testing: the limits had no test of their own). Usage is
// recorded before it is counted, so a burst of parallel requests can never
// let more than the plan's limit through.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guard, CHAT_LIMITS, DAILY_CEILING, MAX_TOKENS } from '../api/_aiGuard.js'

process.env.SUPABASE_URL = 'https://db.test'
process.env.SUPABASE_ANON_KEY = 'anon-test'
delete process.env.SUPABASE_SERVICE_KEY
delete process.env.SUPABASE_SERVICE_ROLE_KEY

// profile: the profiles row; usage: false when the ai_usage table is missing.
function fakeSupabase({ profile = { subscription_tier: 'core' }, usage = true } = {}) {
  const rows = []
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 4))
  const fetchImpl = async (url, init = {}) => {
    await tick()
    const u = new URL(url)
    if (u.pathname === '/auth/v1/user') return init.headers.Authorization === 'Bearer good' ? Response.json({ id: 'u1' }) : new Response('', { status: 401 })
    if (u.pathname === '/rest/v1/profiles') return Response.json(profile ? [profile] : [])
    if (u.pathname === '/rest/v1/ai_usage') {
      if (!usage) return new Response('relation "ai_usage" does not exist', { status: 404 })
      if (init.method === 'POST') { const row = { id: rows.length + 1, ...JSON.parse(init.body) }; rows.push(row); return Response.json([row], { status: 201 }) }
      const chatOnly = u.searchParams.get('purpose') === 'eq.chat'
      const n = rows.filter((r) => !chatOnly || r.purpose === 'chat').length
      return new Response(null, { status: 200, headers: { 'content-range': `0-${Math.max(n - 1, 0)}/${n}` } })
    }
    return new Response('', { status: 404 })
  }
  return { fetchImpl, rows }
}
const req = (purpose = 'chat', token = 'good') => ({ headers: { authorization: `Bearer ${token}`, 'x-maddex-purpose': purpose } })
const body = (extra = {}) => ({ model: 'claude-sonnet-4-6', max_tokens: 900, ...extra })

test('sign-in is required, and a bad token is refused before anything is counted', async () => {
  const sb = fakeSupabase()
  assert.equal((await guard({ headers: {} }, body(), sb)).body.code, 'AUTH_REQUIRED')
  assert.equal((await guard(req('chat', 'forged'), body(), sb)).body.code, 'AUTH_INVALID')
  assert.equal(sb.rows.length, 0)
})

test('Core gets its chat limit, then a 429 naming the tier and the limit', async () => {
  const sb = fakeSupabase()
  for (let i = 0; i < CHAT_LIMITS.core; i++) assert.equal((await guard(req(), body(), sb)).ok, true, `question ${i + 1}`)
  const over = await guard(req(), body(), sb)
  assert.equal(over.status, 429)
  assert.deepEqual([over.body.code, over.body.tier, over.body.limit, over.body.upgradeRequired], ['DAILY_LIMIT', 'core', CHAT_LIMITS.core, true])
})

test('a parallel burst never gets more than the limit through', async () => {
  for (let run = 0; run < 5; run++) {
    const sb = fakeSupabase()
    const results = await Promise.all(Array.from({ length: 40 }, () => guard(req(), body(), sb)))
    const passed = results.filter((r) => r.ok).length
    assert.ok(passed <= CHAT_LIMITS.core, `run ${run}: ${passed} passed`)
    assert.equal(sb.rows.length, 40, 'every attempt is recorded')
  }
})

test('features count against the daily ceiling, not the chat limit', async () => {
  const sb = fakeSupabase()
  for (let i = 0; i < CHAT_LIMITS.core + 5; i++) assert.equal((await guard(req('feature'), body(), sb)).ok, true)
  for (let i = CHAT_LIMITS.core + 5; i < DAILY_CEILING.core; i++) await guard(req('feature'), body(), sb)
  assert.equal((await guard(req('feature'), body(), sb)).body.code, 'DAILY_LIMIT')
})

test('an expired trial is Core; the token cap and the model list hold', async () => {
  const expired = fakeSupabase({ profile: { subscription_tier: 'trial', trial_ends_at: '2026-01-01T00:00:00Z' } })
  const g = await guard(req(), body({ max_tokens: 99_999 }), expired)
  assert.equal(g.tier, 'core')
  assert.equal(g.maxTokens, MAX_TOKENS.chat.core)
  assert.equal((await guard(req(), body({ model: 'claude-opus-5-5' }), expired)).body.code, 'MODEL_NOT_PERMITTED')
  assert.equal((await guard(req(), body({ model: 'gpt-4' }), fakeSupabase({ profile: { subscription_tier: 'apex' } }))).body.code, 'MODEL_NOT_PERMITTED')
  assert.equal((await guard(req(), body({ model: 'claude-opus-5-5' }), fakeSupabase({ profile: { subscription_tier: 'apex' } }))).ok, true)
})

test('without the usage table the guard still requires sign-in and caps tokens (limits logged as off)', async () => {
  const sb = fakeSupabase({ usage: false })
  const warn = console.warn
  const said = []
  console.warn = (...a) => said.push(a.join(' '))
  try {
    const g = await guard(req(), body({ max_tokens: 99_999 }), sb)
    assert.equal(g.ok, true)
    assert.equal(g.maxTokens, MAX_TOKENS.chat.core)
  } finally { console.warn = warn }
  assert.ok(said.some((s) => /limits not enforced/.test(s)))
})
