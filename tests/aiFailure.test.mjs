// MaddenAI failure paths (26 Nov 2026, live testing): an upstream that never
// answers, a stream that stalls, and each upstream error come back as a code
// with no vendor text, and the client words each code for the reader.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { upstreamError, startUpstream, readWithIdle } from '../api/claude.js'
import { userFacingAiError, AI_PAUSED, AI_UNAVAILABLE } from '../src/services/api.js'

test('upstream errors are classified; the vendor text never reaches the browser', () => {
  const cases = [
    [400, '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. req_011"}}', 'UPSTREAM_PAUSED', 502],
    [402, '', 'UPSTREAM_PAUSED', 502],
    [429, '{"error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}', 'UPSTREAM_BUSY', 503],
    [529, '{"error":{"type":"overloaded_error","message":"Overloaded"}}', 'UPSTREAM_BUSY', 503],
    [400, '{"error":{"message":"prompt is too long: 210000 tokens > 200000 maximum"}}', 'UPSTREAM_TOO_LONG', 400],
    [401, '{"error":{"type":"authentication_error","message":"invalid x-api-key"}}', 'UPSTREAM_AUTH', 502],
    [500, 'Internal server error', 'UPSTREAM_ERROR', 502],
  ]
  for (const [status, text, code, out] of cases) {
    const e = upstreamError(status, text)
    assert.equal(e.body.code, code, text)
    assert.equal(e.status, out, text)
    assert.doesNotMatch(JSON.stringify(e.body), /credit|req_|x-api-key|rate_limit_error|tokens >|Overloaded/i)
  }
})

test('the client words each code: paused, busy, too long, unavailable', () => {
  assert.equal(userFacingAiError(502, '', 'UPSTREAM_PAUSED'), AI_PAUSED)
  assert.match(userFacingAiError(503, '', 'UPSTREAM_BUSY'), /busy/)
  assert.match(userFacingAiError(400, '', 'UPSTREAM_TOO_LONG'), /too long/)
  for (const c of ['UPSTREAM_TIMEOUT', 'UPSTREAM_ERROR', 'UPSTREAM_AUTH']) assert.equal(userFacingAiError(502, '', c), AI_UNAVAILABLE)
})

test('an upstream that never answers is abandoned, and the request is aborted', async () => {
  let signal
  const hang = (url, init) => { signal = init.signal; return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) }
  const t0 = Date.now()
  const r = await startUpstream({ method: 'POST' }, { fetchImpl: hang, timeoutMs: 50 })
  assert.equal(r.timedOut, true)
  assert.ok(signal.aborted)
  assert.ok(Date.now() - t0 < 1000)
  const down = await startUpstream({}, { fetchImpl: async () => { throw new Error('ECONNRESET') }, timeoutMs: 1000 })
  assert.equal(down.failed, 'ECONNRESET')
  const ok = await startUpstream({}, { fetchImpl: async () => ({ ok: true, status: 200 }), timeoutMs: 1000 })
  assert.equal(ok.res.status, 200)
})

test('a stalled stream is ended after the idle limit and cancelled upstream', async () => {
  let cancelled = false
  const reader = { read: () => new Promise(() => {}), cancel: async () => { cancelled = true } }
  const ctl = new AbortController()
  const r = await readWithIdle(reader, ctl, 30)
  assert.equal(r.idle, true)
  assert.ok(ctl.signal.aborted && cancelled)
  const live = await readWithIdle({ read: async () => ({ done: false, value: new Uint8Array([1]) }) }, new AbortController(), 1000)
  assert.equal(live.done, false)
})

test('the handler uses the timeout path and sends codes, not errText; the Settings check signs in', () => {
  const src = fs.readFileSync('api/claude.js', 'utf8')
  assert.match(src, /await startUpstream\(/)
  assert.match(src, /readWithIdle\(reader, up\.ctl\)/)
  assert.doesNotMatch(src, /json\(\{ error: errText \}\)|json\(\{ error: err\.message \}\)/)
  const settings = fs.readFileSync('src/components/settings/SettingsPanel.jsx', 'utf8')
  const check = settings.slice(settings.indexOf('async function checkCredits'), settings.indexOf('async function checkCredits') + 1600)
  assert.match(check, /authorization: `Bearer \$\{token\}`/)
  assert.match(check, /DAILY_LIMIT/)
})
