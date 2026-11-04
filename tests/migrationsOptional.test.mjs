// The app must keep working while migrations 010 (retention) and 011 (AI
// records) are not applied in production. Each path that touches what they
// create is run here against Supabase's real answer for a missing table
// (PostgREST 404, code PGRST205). Nothing leaves the machine.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { saveRecord, buildRecord } from '../api/_aiRecords.js'
import { collectMyData } from '../src/services/accountData.js'

const MISSING = new Set(['ai_records'])   // 011's table; 010 creates no table
const missingBody = (t) => JSON.stringify({ code: 'PGRST205', message: `Could not find the table 'public.${t}' in the schema cache` })
const tableOf = (path) => String(path).replace(/^.*\/rest\/v1\//, '').split('?')[0]

test('011 not applied: saving an AI record fails quietly, so the reply is unaffected', async () => {
  const db = async (path) => new Response(missingBody(tableOf(path)), { status: 404 })
  const record = buildRecord({ userId: 'u1', model: 'm', purpose: 'chat', template: 't', system: 's', messages: [], outputText: 'x' })
  const warn = console.warn; console.warn = () => {}
  try {
    assert.equal(await saveRecord(db, record), false)
    assert.equal(await saveRecord(async () => { throw new Error('network down') }, record), false, 'a thrown error is caught too')
    assert.equal(await saveRecord(null, record), false, 'no service key: nothing recorded, nothing thrown')
  } finally { console.warn = warn }
  // In both handlers the record is saved after the reply is built, and saveRecord never throws.
  for (const f of ['api/claude.js', 'api/ai-daily.js']) assert.match(fs.readFileSync(f, 'utf8'), /await saveRecord\(/, f)
})

test('011 not applied: Export my data still exports, marking AI records unavailable', async () => {
  const client = {
    from: (t) => ({ select: () => ({ eq: async () => MISSING.has(t)
      ? { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${t}' in the schema cache` } }
      : { data: [{ table: t }], error: null } }) }),
  }
  const storage = { length: 0, key: () => null, getItem: () => null }
  const out = await collectMyData({ id: 'u1', email: 'test@example.invalid' }, { client, storage, now: new Date('2026-11-05T00:00:00Z') })
  assert.match(out.tables.ai_records.unavailable, /Could not find the table/)
  assert.deepEqual(out.tables.watchlist, [{ table: 'watchlist' }])
  assert.deepEqual(out.tables.ai_usage, [{ table: 'ai_usage' }])
})

test('011 not applied: Delete account still deletes everything else and the login', async () => {
  const env = { ...process.env }
  Object.assign(process.env, { SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'anon-test', SUPABASE_SERVICE_KEY: 'service-test' })
  const realFetch = globalThis.fetch
  const deleted = []
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u1', email: 'test@example.invalid' }), { status: 200 })
    if (u.includes('/auth/v1/admin/users/')) { deleted.push('login'); return new Response('{}', { status: 200 }) }
    const t = tableOf(u)
    if (MISSING.has(t)) return new Response(missingBody(t), { status: 404 })
    deleted.push(t); return new Response('', { status: 204 })
  }
  try {
    const { default: handler } = await import('../api/account-delete.js')
    let status, body
    const res = { setHeader() {}, status(c) { status = c; return this }, json(b) { body = b; return this } }
    const log = console.log; console.log = () => {}
    try { await handler({ method: 'POST', headers: { authorization: 'Bearer user-token' } }, res) } finally { console.log = log }
    assert.equal(status, 200, JSON.stringify(body))
    for (const t of ['ai_usage', 'watchlist', 'portfolio_holdings', 'profiles', 'waitlist', 'login']) assert.ok(deleted.includes(t), t)
  } finally {
    globalThis.fetch = realFetch
    for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY']) { if (k in env) process.env[k] = env[k]; else delete process.env[k] }
  }
})

test('010 not applied: nothing in the app calls the purge functions it creates', () => {
  const files = ['src', 'api'].flatMap((d) => fs.readdirSync(d, { recursive: true }).filter((f) => /\.(m?js|jsx)$/.test(f)).map((f) => `${d}/${f}`))
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /purge_old_(usage|ai_records)/, f)
  assert.doesNotMatch(fs.readFileSync('supabase/migrations/010_retention.sql', 'utf8'), /CREATE TABLE|ALTER TABLE/, '010 changes no table')
})
