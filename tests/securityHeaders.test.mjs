// Security headers and the CSP report endpoint (WS6, 26 Nov 2026;
// docs/SECURITY.md). The CSP ships REPORT-ONLY until Ben says to enforce it
// after a signed-in pass with no violations.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import handler, { readReports, cleanUrl } from '../api/csp-report.js'

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
const all = vercel.headers.find((h) => h.source === '/(.*)')
const header = (k) => all?.headers.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value

test('every response carries HSTS, frame, content-type, referrer and permissions headers', () => {
  assert.ok(all, 'a /(.*) header block')
  assert.match(header('Strict-Transport-Security'), /max-age=63072000; includeSubDomains/)
  assert.equal(header('X-Frame-Options'), 'DENY')
  assert.equal(header('X-Content-Type-Options'), 'nosniff')
  assert.equal(header('Referrer-Policy'), 'strict-origin-when-cross-origin')
  const pp = header('Permissions-Policy')
  for (const f of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) assert.ok(pp.includes(f), f)
  assert.ok(pp.includes('fullscreen=(self)'), 'the chart fullscreen button keeps working')
})

test('the CSP is report-only (not enforced), strict on scripts, and reports to /api/csp-report', () => {
  assert.equal(header('Content-Security-Policy'), undefined, 'enforcing only on Ben\'s word after the signed-in check')
  const csp = header('Content-Security-Policy-Report-Only')
  assert.ok(csp)
  const d = Object.fromEntries(csp.split(';').map((s) => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v]))
  assert.deepEqual(d['script-src'], ["'self'"])
  assert.ok(!csp.includes('unsafe-eval'))
  assert.deepEqual(d['frame-ancestors'], ["'none'"])
  assert.deepEqual(d['object-src'], ["'none'"])
  assert.deepEqual(d['report-uri'], ['/api/csp-report'])
  assert.deepEqual(d['report-to'], ['csp'])
  assert.equal(header('Reporting-Endpoints'), 'csp="/api/csp-report"')
  // The hosts the signed-in app was seen fetching from on 26 Nov (all 19 modules).
  for (const h of ['https://onzaybvpqkpqupzluapo.supabase.co', 'https://api.coingecko.com', 'https://tiles.openfreemap.org', 'https://earthquake.usgs.gov']) assert.ok(d['connect-src'].includes(h), h)
  assert.ok(!d['connect-src'].some((h) => /anthropic/.test(h)), 'the browser never calls Anthropic directly')
})

test('nothing in the app frames its own pages (X-Frame-Options DENY would break it)', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(`${dir}/${f.name}`) : /\.jsx?$/.test(f.name) ? [`${dir}/${f.name}`] : []))
  for (const f of walk('src')) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /<iframe|createElement\(['"]iframe/, f)
})

function fakeRes() {
  const r = { statusCode: null, headers: {} }
  r.status = (c) => { r.statusCode = c; return r }
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r }
  r.end = () => r
  return r
}

async function capture(fn) {
  const lines = []
  const was = console.warn
  console.warn = (s) => lines.push(s)
  try { await fn() } finally { console.warn = was }
  return lines
}

test('a report-uri report becomes one log line with no query, token or visitor detail', async () => {
  const body = { 'csp-report': { 'document-uri': 'https://maddex.vercel.app/api/waitlist?action=confirm&token=SECRET123', 'violated-directive': 'connect-src', 'effective-directive': 'connect-src', 'blocked-uri': 'https://api.example.com/v1/x?key=abc', 'source-file': 'https://maddex.vercel.app/assets/index-1.js?v=2' } }
  const res = fakeRes()
  const lines = await capture(() => handler({ method: 'POST', body }, res, 1))
  assert.equal(res.statusCode, 204)
  assert.deepEqual(lines, ['[csp] connect-src blocked https://api.example.com on /api/waitlist  (source: https://maddex.vercel.app/assets/index-1.js)'])
  assert.doesNotMatch(lines[0], /SECRET|key=|token/)
})

test('report-to reports (a list) and raw Buffer bodies are read too; other types ignored', () => {
  const list = [
    { type: 'csp-violation', body: { documentURL: 'https://maddex.vercel.app/', effectiveDirective: 'img-src', blockedURL: 'data' } },
    { type: 'deprecation', body: { id: 'x' } },
  ]
  assert.deepEqual(readReports(list), [{ directive: 'img-src', blocked: 'data', page: '/', source: null }])
  assert.equal(readReports(Buffer.from(JSON.stringify(list))).length, 1)
  assert.deepEqual(readReports('{not json'), [])
  assert.deepEqual(readReports(null), [])
  assert.equal(cleanUrl('blob:https://maddex.vercel.app/abc'), 'blob')
  assert.equal(cleanUrl('inline'), 'inline')
})

test('the endpoint answers 204 to anything it cannot read, 405 to a GET, and caps a flood', async () => {
  const bad = fakeRes()
  const req = { method: 'POST' }
  Object.defineProperty(req, 'body', { get() { throw new Error('Invalid JSON') } })
  await handler(req, bad, 2)
  assert.equal(bad.statusCode, 204)
  const get = fakeRes()
  await handler({ method: 'GET' }, get, 3)
  assert.equal(get.statusCode, 405)
  const one = { type: 'csp-violation', body: { documentURL: 'https://maddex.vercel.app/', effectiveDirective: 'img-src', blockedURL: 'https://x.example/a.png' } }
  const lines = await capture(async () => { for (let i = 0; i < 20; i++) await handler({ method: 'POST', body: Array(20).fill(one) }, fakeRes(), 10 * 60_000) })
  assert.equal(lines.length, 120)
})
