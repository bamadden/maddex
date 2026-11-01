// Privacy and security (legal-risk item 7): export and delete, no service key
// in the client, the Privacy Policy matches the data the code keeps.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { collectMyData, deleteMyAccount, localData, clearLocalData, OWN_TABLES } from '../src/services/accountData.js'
import { LEGAL_DOCS } from '../src/data/legalDocs.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const mem = (init = {}) => {
  const m = new Map(Object.entries(init))
  return { get length() { return m.size }, key: (i) => [...m.keys()][i], getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
// A Supabase-shaped fake that records calls.
const fakeClient = (rows = {}) => {
  const calls = []
  const from = (t) => ({
    select: () => ({ eq: async (col, v) => { calls.push(['select', t, col, v]); return { data: rows[t] ?? [], error: null } } }),
    delete: () => ({ eq: async (col, v) => { calls.push(['delete', t, col, v]); return { error: null } } }),
  })
  return { calls, from, auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }), signOut: async () => calls.push(['signOut']) } }
}
const USER = { id: 'u1', email: 'a@example.com', created_at: '2026-10-01', user_metadata: { maddex_terms: { terms: { version: 'v' } } } }

test('export: the account, every owned table and this browser\'s Maddex data', async () => {
  const client = fakeClient({ watchlist: [{ symbol: 'BHP.AX' }] })
  const storage = mem({ maddex_x: '{"a":1}', madden_portfolio_v2: '[]', other_site: 'x' })
  const d = await collectMyData(USER, { client, storage, now: new Date('2026-11-01T00:00:00Z') })
  assert.equal(d.account.email, 'a@example.com')
  assert.deepEqual(d.account.metadata, USER.user_metadata)
  for (const [t] of OWN_TABLES) assert.ok(t in d.tables, t)
  assert.deepEqual(d.tables.watchlist, [{ symbol: 'BHP.AX' }])
  assert.deepEqual(Object.keys(d.this_browser).sort(), ['madden_portfolio_v2', 'maddex_x'])
  assert.ok(client.calls.every(([op, , , v]) => op !== 'select' || v === 'u1'))
})

test('delete: rows, then the login on the server, then this browser', async () => {
  const client = fakeClient()
  const storage = mem({ maddex_a: '1', madden_b: '2', keep: '3' })
  const posts = []
  const r = await deleteMyAccount(USER, { client, storage, fetchImpl: async (url, opts) => { posts.push([url, opts.headers.authorization]); return { ok: true } } })
  assert.equal(r.login, 'deleted')
  assert.deepEqual(posts, [['/api/account-delete', 'Bearer tok']])
  for (const t of ['watchlist', 'portfolio_holdings', 'price_alerts', 'ai_notes', 'shared_links', 'profiles']) assert.ok(client.calls.some(([op, n]) => op === 'delete' && n === t), t)
  assert.equal(storage.getItem('maddex_a'), null)
  assert.equal(storage.getItem('keep'), '3')
  assert.ok(client.calls.some(([op]) => op === 'signOut'))
  const r2 = await deleteMyAccount(USER, { client: fakeClient(), storage: mem(), fetchImpl: async () => ({ ok: false }) })
  assert.equal(r2.login, 'pending')
  assert.equal(clearLocalData(mem({ maddex_q: '1' })), 1)
  assert.deepEqual(localData(mem()), {})
})

test('the server removes the login only for the caller, with the server-only service key', () => {
  const s = read('api/account-delete.js')
  assert.match(s, /\/auth\/v1\/user/)           // identifies the caller from their token
  assert.match(s, /admin\/users\/\$\{encodeURIComponent\(user\.id\)\}/)
  assert.match(s, /process\.env\.SUPABASE_SERVICE_KEY/)
  assert.doesNotMatch(s, /console\.log\([^)]*user\.(id|email)/)
})

test('no service key is read in the client, and none is logged', () => {
  const files = fs.readdirSync('src', { recursive: true }).filter((f) => /\.(jsx?)$/.test(f)).map((f) => `src/${f}`)
  for (const f of files) {
    const s = read(f)
    assert.doesNotMatch(s, /import\.meta\.env\.VITE_EXCHANGERATE_API_KEY|SERVICE_KEY|SERVICE_ROLE/, f)
  }
  assert.doesNotMatch(read('src/main.jsx'), /key\.slice\(0, 8\)/)
  assert.match(read('src/services/api.js'), /fetch\('\/api\/metals'\)/)
  assert.match(read('api/metals.js'), /process\.env\.EXCHANGERATE_API_KEY/)
  assert.ok(fs.existsSync('scripts/check-client-secrets.mjs'))
  assert.match(read('package.json'), /"check-secrets"/)
})

test('the Privacy Policy matches what the code keeps, and who receives it', () => {
  const text = JSON.stringify(LEGAL_DOCS.privacy)
  for (const re of [/Supabase/, /Vercel/, /Anthropic/, /Resend/, /holdings/, /watchlist/, /AI usage/, /does not store your questions/, /90 days/, /Export my data/, /Delete account/, /Notifiable Data Breaches/, /DRAFT, pending legal review/]) assert.match(text, re)
  assert.doesNotMatch(text, /That data stays in your browser's local storage/) // portfolio and watchlist sync to the account
  // Every table the app writes is in the inventory or the deletion list.
  const migrations = fs.readdirSync('supabase/migrations').map((f) => read(`supabase/migrations/${f}`)).join('\n')
  for (const t of ['profiles', 'watchlist', 'portfolio_holdings', 'price_alerts', 'ai_notes', 'shared_links', 'ai_usage']) {
    assert.match(migrations, new RegExp(`TABLE (IF NOT EXISTS )?public\\.${t}\\b`), t)
    assert.ok(OWN_TABLES.some(([n]) => n === t), t)
  }
  assert.match(read('supabase/migrations/010_retention.sql'), /INTERVAL '90 days'/)
  assert.ok(fs.existsSync('docs/DATA_BREACH_RESPONSE.md'))
})
