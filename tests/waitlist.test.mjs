// The launch site's waitlist endpoint (WS1, 26 Nov 2026; docs/WAITLIST_API.md).
// Mocks only: the mailer records messages, the database is a fake fetch, and
// the clock is fixed. Nothing here sends an email or touches Supabase.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHandler, readConfig } from '../api/waitlist.js'
import {
  normaliseEmail, readSubscribe, makeToken, readToken, memoryStore, counter, allow, clientIp, parseOrigins, LIMITS, CONSENT, SOURCE, confirmEmail,
} from '../api/_waitlist.js'
import { mockMailer, configuredMailer } from '../api/_mailer.js'

const SECRET = 's'.repeat(40)
const SITE = 'https://maddex.com.au'
const ENV = {
  WAITLIST_TOKEN_SECRET: SECRET,
  WAITLIST_ALLOWED_ORIGINS: `${SITE}, https://www.maddex.com.au`,
  WAITLIST_PUBLIC_URL: 'https://maddex.vercel.app',
  WAITLIST_SITE_URL: SITE,
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_KEY: 'service-key-for-tests',
}
const T0 = Date.UTC(2026, 10, 26, 0, 0, 0)

function fakeRes() {
  const r = { statusCode: null, headers: {}, body: null, text: null }
  r.status = (c) => { r.statusCode = c; return r }
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r }
  r.json = (b) => { r.body = b; return r }
  r.send = (t) => { r.text = t; return r }
  r.end = () => r
  return r
}

function setup({ env = ENV, mailer = mockMailer(), dbOk = true, clock = { t: T0 } } = {}) {
  const calls = []
  const fetchImpl = async (url, init) => { calls.push({ url, ...init }); return { ok: dbOk, status: dbOk ? 201 : 500 } }
  const handler = createHandler({ env, mailer, store: memoryStore(), fetchImpl, now: () => clock.t })
  const call = async ({ method = 'POST', query = {}, body, origin = SITE, type = 'application/json', ip = '203.0.113.9', accept } = {}) => {
    const res = fakeRes()
    const headers = { 'x-real-ip': ip }
    if (origin) headers.origin = origin
    if (type) headers['content-type'] = type
    if (accept) headers.accept = accept
    await handler({ method, query, body, headers }, res)
    return res
  }
  return { call, calls, mailer, clock }
}

const subscribe = (s, email = 'Pat@Example.com', extra = {}) => s.call({ body: { email, consent: true, website: '', ...extra } })
const linkFrom = (msg, action) => new URL(msg.text.match(new RegExp(`https://\\S+action=${action}\\S+`))[0])

// ── Input ──

test('addresses are trimmed, lower-cased, and checked; tags and dots are kept', () => {
  assert.equal(normaliseEmail('  Pat.Lee+maddex@Example.COM '), 'pat.lee+maddex@example.com')
  assert.equal(normaliseEmail('a@bücher.de'), 'a@xn--bcher-kva.de')
  for (const bad of ['', 'pat', 'pat@', '@x.com', 'pat@x', 'pat@x.c', 'a b@x.com', 'pat..lee@x.com', '.pat@x.com', 'pat@-x.com', 'pät@x.com', `${'a'.repeat(65)}@x.com`, `a@${'b'.repeat(250)}.com`, null, 42, ['a@x.com']]) {
    assert.equal(normaliseEmail(bad), null, String(bad))
  }
})

test('a sign-up takes the email, consent and the honeypot, and nothing else', () => {
  assert.deepEqual(readSubscribe({ email: 'a@x.com', consent: true }), { email: 'a@x.com', honeypot: false })
  assert.equal(readSubscribe({ email: 'a@x.com', consent: 'true' }).error, 'consent_required')
  assert.equal(readSubscribe({ email: 'a@x.com', consent: 1 }).error, 'consent_required')
  assert.equal(readSubscribe({ email: 'a@x.com' }).error, 'consent_required')
  assert.equal(readSubscribe({ email: 'a@x.com', consent: true, name: 'Pat' }).error, 'unexpected_field')
  assert.equal(readSubscribe({ email: 'a@x.com', consent: true, website: 'http://spam' }).honeypot, true)
  assert.equal(readSubscribe({ email: 'x'.repeat(3000), consent: true }).error, 'too_large')
  assert.equal(readSubscribe([]).error, 'invalid_body')
  assert.equal(readSubscribe(null).error, 'invalid_body')
})

// ── Tokens ──

test('a token does not show the address it carries, and each one is different', () => {
  const a = makeToken(SECRET, 'unsubscribe', 'pat@example.com', { now: T0 })
  const b = makeToken(SECRET, 'unsubscribe', 'pat@example.com', { now: T0 })
  assert.notEqual(a, b)
  for (const t of [a, b]) {
    assert.doesNotMatch(Buffer.from(t, 'base64url').toString('latin1'), /pat|example/)
    assert.doesNotMatch(t, /pat|example/i)
  }
})

test('a confirmation issued under earlier consent wording counts as expired', () => {
  const raw = makeToken(SECRET, 'confirm', 'a@x.com', { now: T0, ttlHours: 48 })
  assert.equal(readToken(SECRET, 'confirm', raw, { now: T0 }).v, CONSENT.version)
  const saved = CONSENT.version
  CONSENT.version = 'waitlist-consent-2099-01-01'
  try { assert.equal(readToken(SECRET, 'confirm', raw, { now: T0 }).error, 'expired_token') } finally { CONSENT.version = saved }
})

test('tokens are sealed, carry their purpose, and confirmation links expire after 48 hours', () => {
  const c = makeToken(SECRET, 'confirm', 'a@x.com', { now: T0, ttlHours: 48 })
  assert.equal(readToken(SECRET, 'confirm', c, { now: T0 }).e, 'a@x.com')
  assert.equal(readToken(SECRET, 'confirm', c, { now: T0 }).v, CONSENT.version)
  assert.equal(readToken(SECRET, 'confirm', c, { now: T0 + 47 * 3600e3 }).e, 'a@x.com')
  assert.equal(readToken(SECRET, 'confirm', c, { now: T0 + 49 * 3600e3 }).error, 'expired_token')
  assert.equal(readToken(SECRET, 'unsubscribe', c, { now: T0 }).error, 'invalid_token')   // wrong purpose
  assert.equal(readToken('t'.repeat(40), 'confirm', c, { now: T0 }).error, 'invalid_token') // wrong secret
  const raw = Buffer.from(c, 'base64url')
  for (const i of [0, 12, 20, raw.length - 1]) {          // any changed byte: IV, ciphertext or tag
    const t = Buffer.from(raw); t[i] ^= 1
    assert.equal(readToken(SECRET, 'confirm', t.toString('base64url'), { now: T0 }).error, 'invalid_token', `byte ${i}`)
  }
  for (const junk of [undefined, '', 'abc', 'a.b.c', c.slice(0, 20), 'x'.repeat(2000)]) assert.equal(readToken(SECRET, 'confirm', junk).error, 'invalid_token')
  const u = makeToken(SECRET, 'unsubscribe', 'a@x.com', { now: T0 })
  assert.equal(readToken(SECRET, 'unsubscribe', u, { now: T0 + 3650 * 86400e3 }).e, 'a@x.com') // unsubscribe links do not expire
})

// ── CORS ──

test('allowed origins are exact; a wildcard, a path or plain http elsewhere is dropped', () => {
  assert.deepEqual(parseOrigins(' https://maddex.com.au,https://www.maddex.com.au '), ['https://maddex.com.au', 'https://www.maddex.com.au'])
  assert.deepEqual(parseOrigins('*,https://*.maddex.com.au,https://maddex.com.au/,https://maddex.com.au/x,http://maddex.com.au,nonsense'), [])
  assert.deepEqual(parseOrigins('http://localhost:4321'), ['http://localhost:4321'])
  assert.deepEqual(parseOrigins(undefined), [])
})

test('preflight answers only an allowed origin, and never with a wildcard', async () => {
  const s = setup()
  const ok = await s.call({ method: 'OPTIONS', type: null })
  assert.equal(ok.statusCode, 204)
  assert.equal(ok.headers['access-control-allow-origin'], SITE)
  assert.equal(ok.headers.vary, 'Origin')
  assert.match(ok.headers['access-control-allow-methods'], /POST/)
  const bad = await s.call({ method: 'OPTIONS', origin: 'https://evil.example', type: null })
  assert.equal(bad.statusCode, 403)
  assert.equal(bad.headers['access-control-allow-origin'], undefined)
  const src = fs.readFileSync('api/waitlist.js', 'utf8') + fs.readFileSync('api/_waitlist.js', 'utf8')
  assert.doesNotMatch(src, /Allow-Origin', '\*'/)
})

test('a sign-up from another origin, or with no origin, is refused before anything is sent', async () => {
  const s = setup()
  assert.equal((await s.call({ body: { email: 'a@x.com', consent: true }, origin: 'https://evil.example' })).statusCode, 403)
  assert.equal((await s.call({ body: { email: 'a@x.com', consent: true }, origin: null })).statusCode, 403)
  assert.equal(s.mailer.sent.length, 0)
})

// ── Sign-up ──

test('a sign-up sends one confirmation email and stores nothing', async () => {
  const s = setup()
  const r = await subscribe(s)
  assert.equal(r.statusCode, 202)
  assert.equal(r.body.status, 'pending')
  assert.equal(s.calls.length, 0, 'no database call before confirmation')
  assert.equal(s.mailer.sent.length, 1)
  const m = s.mailer.sent[0]
  assert.equal(m.to, 'pat@example.com')
  assert.match(m.subject, /Confirm/)
  assert.match(m.text, /48 hours/)
  assert.match(m.text, /general information only, not financial advice/)
  assert.match(m.html, /Unsubscribe/)
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.match(m.headers['List-Unsubscribe'], /^<https:\/\/maddex\.vercel\.app\/api\/waitlist\?action=unsubscribe&token=/)
  assert.equal(linkFrom(m, 'confirm').origin, 'https://maddex.vercel.app')
})

test('the answer is the same whether or not the address is already on the list', async () => {
  const s = setup()
  const first = await subscribe(s)
  const confirm = linkFrom(s.mailer.sent[0], 'confirm')
  await s.call({ query: { action: 'confirm', token: confirm.searchParams.get('token') }, type: 'application/x-www-form-urlencoded', origin: 'https://maddex.vercel.app' })
  const again = await subscribe(s)
  const fresh = await subscribe(s, 'someone.new@example.com')
  assert.deepEqual(again.body, first.body)
  assert.deepEqual(fresh.body, first.body)
  assert.equal(again.statusCode, fresh.statusCode)
  // and no read of the list is ever made to answer a sign-up
  assert.ok(s.calls.every((c) => c.method !== 'GET'))
})

test('bad input is refused with a reason; a filled honeypot gets the normal answer and nothing is sent', async () => {
  const s = setup()
  assert.equal((await s.call({ body: { email: 'nope', consent: true } })).body.error, 'invalid_email')
  assert.equal((await s.call({ body: { email: 'a@x.com', consent: false } })).body.error, 'consent_required')
  assert.equal((await s.call({ body: { email: 'a@x.com', consent: true, tier: 'apex' } })).body.error, 'unexpected_field')
  assert.equal((await s.call({ body: '{not json' })).body.error, 'invalid_body')
  assert.equal((await s.call({ body: 'email=a@x.com', type: 'application/x-www-form-urlencoded' })).statusCode, 415)
  assert.equal((await s.call({ method: 'GET', body: null })).statusCode, 405)
  const bot = await s.call({ body: { email: 'a@x.com', consent: true, website: 'https://spam.example' } })
  assert.equal(bot.statusCode, 202)
  assert.equal(s.mailer.sent.length, 0)
})

test('JSON sent as a string is read the same as a parsed body', async () => {
  const s = setup()
  const r = await s.call({ body: JSON.stringify({ email: 'a@x.com', consent: true }) })
  assert.equal(r.statusCode, 202)
  assert.equal(s.mailer.sent.length, 1)
})

test('rate limits: per IP answers 429; per address answers as normal but sends nothing more', async () => {
  const s = setup()
  const [[, perIp]] = LIMITS.subscribeIp
  for (let i = 0; i < perIp; i++) assert.equal((await subscribe(s, `p${i}@example.com`)).statusCode, 202)
  const over = await subscribe(s, 'another@example.com')
  assert.equal(over.statusCode, 429)
  assert.equal(over.headers['retry-after'], '600')

  const e = setup()
  const [[, perEmail]] = LIMITS.subscribeEmail
  for (let i = 0; i < perEmail + 2; i++) {
    const r = await e.call({ body: { email: 'pat@example.com', consent: true }, ip: `198.51.100.${i}` })
    assert.equal(r.statusCode, 202)
  }
  assert.equal(e.mailer.sent.length, perEmail)
})

test('rate limits roll over when the window ends', async () => {
  const s = setup()
  const [[win, perIp]] = LIMITS.subscribeIp
  for (let i = 0; i < perIp; i++) await subscribe(s, `p${i}@example.com`)
  assert.equal((await subscribe(s, 'x@example.com')).statusCode, 429)
  s.clock.t += win * 1000
  assert.equal((await subscribe(s, 'y@example.com')).statusCode, 202)
})

test('nothing is configured → 503, and nothing is sent', async () => {
  for (const missing of ['WAITLIST_TOKEN_SECRET', 'WAITLIST_ALLOWED_ORIGINS', 'SUPABASE_SERVICE_KEY']) {
    const env = { ...ENV }
    delete env[missing]
    const s = setup({ env })
    const r = await subscribe(s)
    assert.ok([503, 403].includes(r.statusCode), missing) // no allowed origins → every origin is refused
    assert.equal(s.mailer.sent.length, 0, missing)
  }
  const short = setup({ env: { ...ENV, WAITLIST_TOKEN_SECRET: 'short' } })
  assert.equal((await subscribe(short)).statusCode, 503)
  const noMailer = setup({ mailer: null })
  assert.equal((await subscribe(noMailer)).body.error, 'not_configured')
  assert.equal(configuredMailer(), null, 'no sender is configured in the repository')
})

test('a sender that refuses the email → 502 send_failed', async () => {
  const s = setup({ mailer: mockMailer({ fail: true }) })
  const r = await subscribe(s)
  assert.equal(r.statusCode, 502)
  assert.equal(r.body.error, 'send_failed')
})

test('links are built from the configured origin, never from the request Host', async () => {
  assert.equal(readConfig({ VERCEL_PROJECT_PRODUCTION_URL: 'maddex.vercel.app' }).publicUrl, 'https://maddex.vercel.app')
  assert.equal(readConfig({ WAITLIST_PUBLIC_URL: 'http://maddex.vercel.app' }).publicUrl, null)
  assert.equal(readConfig({ WAITLIST_PUBLIC_URL: 'http://localhost:3000' }).publicUrl, null)
  assert.equal(readConfig({ WAITLIST_PUBLIC_URL: '', VERCEL_PROJECT_PRODUCTION_URL: 'maddex.vercel.app' }).publicUrl, 'https://maddex.vercel.app')
  assert.doesNotMatch(fs.readFileSync('api/waitlist.js', 'utf8'), /headers\.host|x-forwarded-host/)
})

// ── Confirm ──

test('opening the confirmation link shows a button and writes nothing; pressing it writes one row', async () => {
  const s = setup()
  await subscribe(s)
  const token = linkFrom(s.mailer.sent[0], 'confirm').searchParams.get('token')
  const view = await s.call({ method: 'GET', query: { action: 'confirm', token }, origin: null, type: null })
  assert.equal(view.statusCode, 200)
  assert.match(view.text, /<form method="post" action="\/api\/waitlist\?action=confirm&amp;token=/)
  assert.equal(view.headers['referrer-policy'], 'no-referrer')
  assert.match(view.headers['content-security-policy'], /default-src 'none'/)
  assert.match(view.headers['content-security-policy'], /form-action 'self'/)
  assert.equal(view.headers['x-frame-options'], 'DENY')
  assert.doesNotMatch(view.text, /<script/)
  assert.equal(s.calls.length, 0)

  const done = await s.call({ query: { action: 'confirm', token }, type: 'application/x-www-form-urlencoded', origin: 'https://maddex.vercel.app' })
  assert.equal(done.statusCode, 200)
  assert.match(done.text, /You are on the list/)
  assert.match(done.text, /href="https:\/\/maddex\.com\.au"/)
  assert.equal(s.calls.length, 1)
  const c = s.calls[0]
  assert.equal(c.url, 'https://db.example/rest/v1/waitlist?on_conflict=email,source')
  assert.equal(c.method, 'POST')
  assert.match(c.headers.prefer, /resolution=ignore-duplicates/)
  assert.deepEqual(JSON.parse(c.body), [{ email: 'pat@example.com', source: SOURCE }])
})

test('the button on our own page confirms in a real browser (no-referrer makes it send Origin: null)', async () => {
  const s = setup()
  const token = makeToken(SECRET, 'confirm', 'a@x.com', { now: T0, ttlHours: 48 })
  const r = await s.call({ query: { action: 'confirm', token }, origin: 'null', type: 'application/x-www-form-urlencoded' })
  assert.equal(r.statusCode, 200)
  assert.match(r.text, /You are on the list/)
  const u = await s.call({ query: { action: 'unsubscribe', token: makeToken(SECRET, 'unsubscribe', 'a@x.com') }, origin: 'null', type: 'application/x-www-form-urlencoded' })
  assert.equal(u.statusCode, 200)
})

test('malformed JSON (Vercel throws when req.body is read) answers invalid_body', async () => {
  const s = setup()
  const res = fakeRes()
  const req = { method: 'POST', query: {}, headers: { origin: SITE, 'content-type': 'application/json', 'x-real-ip': '203.0.113.1' } }
  Object.defineProperty(req, 'body', { get() { throw new Error('Invalid JSON') } })
  const handler = createHandler({ env: ENV, mailer: mockMailer(), store: memoryStore(), fetchImpl: async () => ({ ok: true }), now: () => T0 })
  await handler(req, res)
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'invalid_body' })
})

test('a flood of new keys cannot reset the global send cap or wipe live counters wholesale', async () => {
  const sends = counter()
  for (let i = 0; i < 300; i++) await allow(sends, 'sends', LIMITS.sendsGlobal, T0)
  assert.equal(await allow(sends, 'sends', LIMITS.sendsGlobal, T0), false)
  const store = memoryStore({ max: 100 })
  for (let i = 0; i < 6; i++) await store.hit('victim', 3600, T0)
  for (let i = 0; i < 99; i++) await store.hit(`k${i}`, 3600, T0)   // fills the store; victim is still held
  assert.equal(await store.hit('victim', 3600, T0), 7)
  for (let i = 0; i < 1000; i++) await store.hit(`flood${i}`, 3600, T0)
  assert.equal(await allow(sends, 'sends', LIMITS.sendsGlobal, T0), false, 'the send cap is untouched')
})

test('IPv6 callers are limited by their /64', () => {
  assert.equal(clientIp({ 'x-real-ip': '2001:db8:1:2:aaaa::1' }), '2001:db8:1:2::/64')
  assert.equal(clientIp({ 'x-real-ip': '2001:db8:1:2:ffff:ffff:ffff:fffe' }), '2001:db8:1:2::/64')
  assert.equal(clientIp({ 'x-real-ip': '2001:db8::5' }), '2001:db8:0:0::/64')
  assert.equal(clientIp({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), '203.0.113.7')
  assert.equal(clientIp({}), 'unknown')
})

test('the launch site can confirm with JSON instead of the page', async () => {
  const s = setup()
  const token = makeToken(SECRET, 'confirm', 'a@x.com', { now: T0, ttlHours: 48 })
  const r = await s.call({ query: { action: 'confirm' }, body: { token } })
  assert.equal(r.statusCode, 200)
  assert.deepEqual(r.body, { ok: true, status: 'confirmed' })
  assert.equal(r.headers['access-control-allow-origin'], SITE)
})

test('an expired, forged or missing token is refused and nothing is written', async () => {
  const s = setup()
  const old = makeToken(SECRET, 'confirm', 'a@x.com', { now: T0 - 49 * 3600e3, ttlHours: 48 })
  const r = await s.call({ query: { action: 'confirm', token: old }, body: {} })
  assert.equal(r.body.error, 'expired_token')
  const page = await s.call({ method: 'GET', query: { action: 'confirm', token: old }, origin: null, type: null })
  assert.equal(page.statusCode, 400)
  assert.match(page.text, /expired/)
  assert.equal((await s.call({ query: { action: 'confirm', token: 'abcdef' }, body: {} })).body.error, 'invalid_token')
  assert.equal((await s.call({ query: { action: 'confirm' }, body: {} })).body.error, 'invalid_token')
  const unsub = makeToken(SECRET, 'unsubscribe', 'a@x.com', { now: T0 })
  assert.equal((await s.call({ query: { action: 'confirm', token: unsub }, body: {} })).body.error, 'invalid_token')
  assert.equal(s.calls.length, 0)
})

test('a confirming POST from a foreign page is refused', async () => {
  const s = setup()
  const token = makeToken(SECRET, 'confirm', 'a@x.com', { now: T0, ttlHours: 48 })
  const r = await s.call({ query: { action: 'confirm', token }, origin: 'https://evil.example', type: 'application/x-www-form-urlencoded' })
  assert.equal(r.statusCode, 403)
  assert.equal(s.calls.length, 0)
})

test('a database failure is reported, not shown as success', async () => {
  const s = setup({ dbOk: false })
  const token = makeToken(SECRET, 'confirm', 'a@x.com', { now: T0, ttlHours: 48 })
  const r = await s.call({ query: { action: 'confirm', token }, body: {} })
  assert.equal(r.statusCode, 502)
  assert.equal(r.body.error, 'save_failed')
})

// ── Unsubscribe ──

test('unsubscribe: the page shows a button; one-click and the button delete the launch-site row only', async () => {
  const s = setup()
  const token = makeToken(SECRET, 'unsubscribe', 'pat@example.com', { now: T0 })
  const view = await s.call({ method: 'GET', query: { action: 'unsubscribe', token }, origin: null, type: null })
  assert.match(view.text, /<button type="submit">Unsubscribe<\/button>/)
  assert.equal(s.calls.length, 0)
  // RFC 8058: a mail client POSTs List-Unsubscribe=One-Click with no Origin
  const one = await s.call({ query: { action: 'unsubscribe', token }, body: { 'List-Unsubscribe': 'One-Click' }, origin: null, type: 'application/x-www-form-urlencoded' })
  assert.equal(one.statusCode, 200)
  assert.match(one.text, /Unsubscribed/)
  assert.equal(s.calls[0].method, 'DELETE')
  assert.equal(s.calls[0].url, 'https://db.example/rest/v1/waitlist?email=eq.pat%40example.com&source=eq.launch-site')
  // the same answer when there was nothing to delete
  const again = await s.call({ query: { action: 'unsubscribe' }, body: { token } })
  assert.deepEqual(again.body, { ok: true, status: 'unsubscribed' })
})

test('the unsubscribe link in the confirmation email works', async () => {
  const s = setup()
  await subscribe(s)
  const token = linkFrom(s.mailer.sent[0], 'unsubscribe').searchParams.get('token')
  const r = await s.call({ query: { action: 'unsubscribe', token }, body: {} })
  assert.equal(r.body.status, 'unsubscribed')
})

test('an unknown action is a 404', async () => {
  const s = setup()
  assert.equal((await s.call({ query: { action: 'list' }, body: {} })).statusCode, 404)
})

// ── Privacy ──

test('no address, IP or token is logged, and rate-limit keys are hashed', () => {
  const src = fs.readFileSync('api/waitlist.js', 'utf8')
  const logs = src.split('\n').filter((l) => /console\./.test(l))
  assert.ok(logs.length >= 2)
  // A log line may name the action and the HTTP status, nothing else.
  for (const line of logs) for (const [, v] of line.matchAll(/\$\{([^}]+)\}/g)) assert.match(v, /^(action|r\?\.status \?\? 'network')$/, line)
  assert.match(src, /hashKey\(cfg\.secret, 'ip', clientIp/)
  assert.match(src, /hashKey\(cfg\.secret, 'email', input\.email\)/)
})

test('launch-site rows are covered by Export my data and by account deletion', async () => {
  const { SERVER_EXPORT_TABLES } = await import('../api/account-export.js')
  assert.deepEqual(SERVER_EXPORT_TABLES.find(([t]) => t === 'waitlist'), ['waitlist', 'email']) // every source, by email
  const del = fs.readFileSync('api/account-delete.js', 'utf8')
  assert.match(del, /rest\/v1\/waitlist\?email=eq\.\$\{encodeURIComponent\(user\.email\.toLowerCase\(\)\)\}`, \{ method: 'DELETE'/) // every source, by email
})

test('the confirmation email states the consent it records and makes no claim about advice or licensing', () => {
  const m = confirmEmail({ confirmUrl: 'https://a/c', unsubscribeUrl: 'https://a/u', unsubscribePost: 'https://a/u' })
  for (const s of [m.text, m.html, CONSENT.text]) assert.doesNotMatch(s, /licensed|regulated|recommend|returns|profit/i)
  assert.match(CONSENT.text, /unsubscribe at any time/)
})

test('docs/WAITLIST_API.md states the consent wording and version the code uses', () => {
  const doc = fs.readFileSync('docs/WAITLIST_API.md', 'utf8')
  assert.ok(doc.includes(CONSENT.text), 'consent text')
  assert.ok(doc.includes(CONSENT.version), 'consent version')
  for (const k of ['WAITLIST_TOKEN_SECRET', 'WAITLIST_ALLOWED_ORIGINS', 'WAITLIST_PUBLIC_URL', 'not_configured', 'rate_limited', 'website']) assert.ok(doc.includes(k), k)
})
