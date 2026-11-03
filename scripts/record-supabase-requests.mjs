// Records the exact requests @supabase/supabase-js's createClient sends for
// the calls this app makes, as tests/fixtures/supabaseRequests.json — the
// reference the slim client (src/lib/supabase.js) is tested against once
// supabase-js is no longer installed. It is not a dependency any more; to
// re-record (e.g. after bumping auth-js / postgrest-js), install the
// matching version for that run only, then remove it again:
//   npm i --no-save @supabase/supabase-js@<auth-js version>
//   node scripts/record-supabase-requests.mjs
import fs from 'node:fs'

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
const { createClient } = await import('@supabase/supabase-js')
const pkg = JSON.parse(fs.readFileSync('node_modules/@supabase/supabase-js/package.json', 'utf8'))
const URL_ = 'https://test.invalid', KEY = 'test-anon-key'
const make = () => createClient(URL_, KEY, { auth: { storageKey: 'maddex-auth', persistSession: true, autoRefreshToken: false, detectSessionInUrl: true } })
const { QUERIES, SESSION } = await import('../tests/fixtures/supabaseCalls.mjs')
const record = async (client, run) => { calls.length = 0; await run(client); return calls.filter((c) => !/\/auth\/v1\/user$/.test(c.url)) }

const out = { recordedWith: `@supabase/supabase-js ${pkg.version}`, signedOut: {}, signedIn: {}, signIn: null }
const out1 = make()
for (const [name, q] of QUERIES) out.signedOut[name] = await record(out1, q)
out.signIn = await record(out1, (c) => c.auth.signInWithPassword({ email: 'test@example.invalid', password: 'not-a-real-password' }).catch(() => {}))
store.set('maddex-auth', JSON.stringify(SESSION))
const in1 = make()
for (const [name, q] of QUERIES) out.signedIn[name] = await record(in1, q)
for (const c of [out1, in1]) { await c.auth.stopAutoRefresh?.(); c.auth.broadcastChannel?.close?.() }
fs.writeFileSync('tests/fixtures/supabaseRequests.json', JSON.stringify(out, null, 1) + '\n')
console.log(`recorded ${Object.keys(out.signedOut).length * 2 + 1} request sets with ${out.recordedWith}`)
process.exit(0)
