// src/lib/supabase.js builds only Supabase auth and the database client
// (first paint −24.6KB). It must send exactly the requests createClient
// would: same URL, method, body and headers, signed out and signed in.
// fetch is stubbed; nothing leaves the machine.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'

// A minimal browser, so both clients use localStorage as they do in Chrome
// (in Node, auth-js otherwise keeps the session in memory).
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
globalThis.window = globalThis
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
globalThis.location = new URL('http://localhost:5173/')
globalThis.addEventListener ??= () => {}
globalThis.removeEventListener ??= () => {}
const calls = []
globalThis.fetch = async (input, init = {}) => {
  const h = new Headers(init.headers)
  calls.push({ url: String(input?.url ?? input), method: init.method ?? 'GET', body: init.body ?? null, headers: Object.fromEntries([...h.entries()].filter(([k]) => k !== 'x-client-info')) })
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
}

const URL_ = 'https://test.invalid', KEY = 'test-anon-key' // the test loader's env
const { createClient } = await import('@supabase/supabase-js')
const full = createClient(URL_, KEY, { auth: { storageKey: 'maddex-auth', persistSession: true, autoRefreshToken: false, detectSessionInUrl: true } })
const { supabase: slim } = await import('../src/lib/supabase.js')
// In a browser the slim client refreshes tokens on a timer, as the app
// should; stop every client's timer when the tests finish.
const clients = [full, slim]
after(async () => { for (const c of clients) { await c.auth.stopAutoRefresh?.(); c.auth.broadcastChannel?.close?.() } })

async function requestOf(client, run) {
  calls.length = 0
  await run(client)
  return calls.filter((c) => !/\/auth\/v1\/user$/.test(c.url))
}

const QUERIES = [
  ['select', (c) => c.from('profiles').select('id, plan').eq('id', 'u-1')],
  ['insert', (c) => c.from('watchlist').insert({ user_id: 'u-1', symbol: 'CBA' })],
  ['delete', (c) => c.from('price_alerts').delete().eq('user_id', 'u-1')],
  ['rpc', (c) => c.rpc('get_shared_link', { p_id: 'abc', p_kind: 'watchlist' })],
]

test('signed out: database requests are identical to createClient\'s', async () => {
  for (const [name, q] of QUERIES) {
    assert.deepEqual(await requestOf(slim, q), await requestOf(full, q), name)
  }
})

test('signed in: the stored session\'s token is sent, as createClient sends it', async () => {
  // A session already on the device when the app starts (fresh clients).
  const session = { access_token: 'user-token-123', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u-1', aud: 'authenticated' } }
  store.set('maddex-auth', JSON.stringify(session))
  const fullIn = createClient(URL_, KEY, { auth: { storageKey: 'maddex-auth', persistSession: true, autoRefreshToken: false, detectSessionInUrl: true } })
  const { supabase: slimIn } = await import('../src/lib/supabase.js?signed-in')
  clients.push(fullIn, slimIn)
  for (const [name, q] of QUERIES) {
    const a = await requestOf(slimIn, q), b = await requestOf(fullIn, q)
    assert.deepEqual(a, b, name)
    assert.equal(a[0].headers.authorization, 'Bearer user-token-123', name)
  }
  store.clear()
})

test('sign-in and sign-out requests match', async () => {
  const signIn = (c) => c.auth.signInWithPassword({ email: 'test@example.invalid', password: 'not-a-real-password' }).catch(() => {})
  assert.deepEqual(await requestOf(slim, signIn), await requestOf(full, signIn))
})

test('the slim client exposes only what the app uses', async () => {
  assert.deepEqual(Object.keys(slim).sort(), ['auth', 'from', 'rpc'])
})
