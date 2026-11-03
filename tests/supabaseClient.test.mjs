// src/lib/supabase.js builds only Supabase auth and the database client
// (first paint −24.6KB). It must send exactly the requests
// @supabase/supabase-js's createClient sent for the same calls: same URL,
// method, body and headers, signed out and signed in. Those requests were
// recorded with supabase-js 2.110.2 (scripts/record-supabase-requests.mjs)
// before the package was removed. fetch is stubbed; nothing leaves the
// machine.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { QUERIES, SESSION } from './fixtures/supabaseCalls.mjs'

const RECORDED = JSON.parse(fs.readFileSync('tests/fixtures/supabaseRequests.json', 'utf8'))

// A minimal browser, so the client uses localStorage as it does in Chrome
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

const record = async (client, run) => { calls.length = 0; await run(client); return calls.filter((c) => !/\/auth\/v1\/user$/.test(c.url)) }
const clients = []
after(async () => { for (const c of clients) { await c.auth.stopAutoRefresh?.(); c.auth.broadcastChannel?.close?.() } })

test('the recording is from supabase-js createClient', () => {
  assert.match(RECORDED.recordedWith, /^@supabase\/supabase-js 2\.\d+\.\d+$/)
})

test('signed out: database requests and sign-in match createClient\'s', async () => {
  const { supabase } = await import('../src/lib/supabase.js?signed-out')
  clients.push(supabase)
  for (const [name, q] of QUERIES) assert.deepEqual(await record(supabase, q), RECORDED.signedOut[name], name)
  const signIn = (c) => c.auth.signInWithPassword({ email: 'test@example.invalid', password: 'not-a-real-password' }).catch(() => {})
  assert.deepEqual(await record(supabase, signIn), RECORDED.signIn)
})

test('signed in: a session already on the device is used, as createClient used it', async () => {
  store.set('maddex-auth', JSON.stringify(SESSION))
  const { supabase } = await import('../src/lib/supabase.js?signed-in')
  clients.push(supabase)
  for (const [name, q] of QUERIES) {
    const sent = await record(supabase, q)
    assert.deepEqual(sent, RECORDED.signedIn[name], name)
    assert.equal(sent[0].headers.authorization, 'Bearer user-token-123', name)
  }
  store.clear()
})

test('the slim client exposes only what the app uses', async () => {
  const { supabase } = await import('../src/lib/supabase.js?shape')
  clients.push(supabase)
  assert.deepEqual(Object.keys(supabase).sort(), ['auth', 'from', 'rpc'])
})
