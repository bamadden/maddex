// The launch site's early-access list (WS1, 26 Nov 2026): everything the
// endpoint (api/waitlist.js) needs that is not the request itself — input
// checks, signed tokens, rate limits, CORS, and the emails and pages. The
// contract is docs/WAITLIST_API.md.
//
// Nothing about an address is stored until its owner confirms: the
// confirmation token carries the address, signed, so a pending sign-up lives
// only in the email. A confirmed address is one row in public.waitlist
// (source 'launch-site'); unsubscribing deletes it.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import { domainToASCII } from 'node:url'

export const SOURCE = 'launch-site'
export const CONFIRM_TTL_HOURS = 48

// The words the launch site shows beside its consent box. A change of wording
// is a new version; docs/WAITLIST_API.md lists each with its dates, which is
// how a row's consent is known (its created_at is when it was confirmed).
export const CONSENT = {
  version: 'waitlist-consent-2026-11-26',
  text: 'Email me about Maddex early access and its launch. I can unsubscribe at any time.',
}

// ── Input ────────────────────────────────────────────────────────────────────

export const FIELDS = ['email', 'consent', 'website'] // website: the honeypot
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

// A trimmed, lower-cased address, or null. The domain may be Unicode (it is
// stored as its ASCII form); the local part must be ASCII. Dots and +tags are
// kept: they are part of the address as its owner gave it.
export function normaliseEmail(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.normalize('NFC').trim()
  if (s.length > 254 || /\s/.test(s)) return null
  const at = s.lastIndexOf('@')
  if (at < 1 || at === s.length - 1) return null
  const local = s.slice(0, at).toLowerCase()
  const domain = domainToASCII(s.slice(at + 1).toLowerCase())
  if (!domain || local.length > 64 || !LOCAL.test(local)) return null
  const labels = domain.split('.')
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels.at(-1))) return null
  const email = `${local}@${domain}`
  return email.length <= 254 ? email : null
}

// { email, honeypot } or { error }. Only the three fields are accepted, and
// consent must be the JSON value true (not "true", not 1).
export function readSubscribe(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid_body' }
  if (JSON.stringify(body).length > 2048) return { error: 'too_large' }
  if (Object.keys(body).some((k) => !FIELDS.includes(k))) return { error: 'unexpected_field' }
  if (body.website != null && typeof body.website !== 'string') return { error: 'invalid_body' }
  const honeypot = typeof body.website === 'string' && body.website.trim() !== ''
  const email = normaliseEmail(body.email)
  if (!email) return { error: 'invalid_email', honeypot }
  if (body.consent !== true) return { error: 'consent_required', honeypot }
  return { email, honeypot }
}

// ── Tokens ───────────────────────────────────────────────────────────────────
// AES-256-GCM over a small JSON payload, with the purpose as associated data:
// a confirmation token cannot unsubscribe and an unsubscribe token cannot
// confirm, any change to a token fails authentication, and the address inside
// cannot be read by whoever sees the link (a log, a forwarded email). Token =
// base64url(12-byte IV ‖ ciphertext ‖ 16-byte tag).

const tokenKey = (secret) => createHash('sha256').update(`waitlist-token-key:${secret}`).digest()

export function makeToken(secret, purpose, email, { now = Date.now(), ttlHours = null } = {}) {
  const payload = { e: email, t: Math.floor(now / 1000) }
  if (purpose === 'confirm') payload.v = CONSENT.version
  if (ttlHours != null) payload.x = payload.t + ttlHours * 3600
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', tokenKey(secret), iv)
  c.setAAD(Buffer.from(purpose))
  const ct = Buffer.concat([c.update(JSON.stringify(payload), 'utf8'), c.final()])
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64url')
}

// The payload, or { error: 'invalid_token' | 'expired_token' }. A confirmation
// issued under earlier consent wording counts as expired: the row must record
// the wording its owner saw, and a row's wording is known by its date.
export function readToken(secret, purpose, token, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || token.length > 1024 || !/^[\w-]+$/.test(token)) return { error: 'invalid_token' }
  const raw = Buffer.from(token, 'base64url')
  if (raw.length < 12 + 16 + 2) return { error: 'invalid_token' }
  let p
  try {
    const d = createDecipheriv('aes-256-gcm', tokenKey(secret), raw.subarray(0, 12))
    d.setAAD(Buffer.from(purpose))
    d.setAuthTag(raw.subarray(raw.length - 16))
    p = JSON.parse(Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]).toString('utf8'))
  } catch { return { error: 'invalid_token' } }
  if (normaliseEmail(p?.e) !== p.e) return { error: 'invalid_token' }
  if (p.x != null && Math.floor(now / 1000) > p.x) return { error: 'expired_token' }
  if (purpose === 'confirm' && p.v !== CONSENT.version) return { error: 'expired_token' }
  return p
}

// ── Rate limits ──────────────────────────────────────────────────────────────
// Fixed windows over a store with hit(key, windowSeconds) → count. The
// default store is this instance's memory: a serverless platform runs several
// instances, so the effective limit is per instance (docs/WAITLIST_API.md).
// Keys are hashed with the token secret, so no address or IP is held in the
// clear, even in memory.

export function memoryStore({ max = 20_000 } = {}) {
  const m = new Map() // key → { n, ends }, oldest first
  return {
    async hit(key, windowSeconds, now = Date.now()) {
      const slot = Math.floor(now / 1000 / windowSeconds)
      const k = `${key}:${windowSeconds}:${slot}`
      if (!m.has(k) && m.size >= max) {
        for (const [old, v] of m) if (v.ends <= now) m.delete(old)
        // Still full of live windows: drop the oldest, never clear. A flood
        // of new keys can then only age out other per-key counters, and the
        // global send cap (kept apart, below) is never dropped.
        for (const old of m.keys()) { if (m.size < max) break; m.delete(old) }
      }
      const v = m.get(k) ?? { n: 0, ends: (slot + 1) * windowSeconds * 1000 }
      v.n += 1
      m.delete(k)
      m.set(k, v)
      return v.n
    },
  }
}

// The global send cap: one counter per window, outside the keyed store so no
// flood of other keys can reset it.
export function counter() {
  let slot = null, n = 0
  return { async hit(_key, windowSeconds, now = Date.now()) { const s = Math.floor(now / 1000 / windowSeconds); if (s !== slot) { slot = s; n = 0 } return ++n } }
}

export const LIMITS = {
  subscribeIp: [[600, 5], [86_400, 20]],   // per IP: 5 in 10 minutes, 20 a day
  subscribeEmail: [[3600, 3], [86_400, 5]], // per address: 3 an hour, 5 a day
  sendsGlobal: [[3600, 300]],               // emails sent per instance an hour (counter(), not the store)
  tokenIp: [[600, 30]],                     // confirm/unsubscribe per IP
}

export const hashKey = (secret, kind, value) => createHmac('sha256', secret).update(`rl:${kind}:${value}`).digest('base64url').slice(0, 22)

// true when within every window; false at the first one exceeded.
export async function allow(store, key, windows, now = Date.now()) {
  for (const [w, max] of windows) if ((await store.hit(key, w, now)) > max) return false
  return true
}

// The caller's IP as Vercel reports it (x-real-ip, else the first
// x-forwarded-for hop). Only ever hashed.
export function clientIp(headers = {}) {
  const h = (k) => headers[k] ?? headers[k.toLowerCase()]
  const ip = String(h('x-real-ip') ?? String(h('x-forwarded-for') ?? '').split(',')[0] ?? '').trim()
  if (!ip) return 'unknown'
  // IPv6: one subscriber usually holds a whole /64, so limit by the /64.
  if (ip.includes(':')) {
    const [head, tail = ''] = ip.split('::')
    const left = head ? head.split(':') : []
    const right = tail ? tail.split(':') : []
    const full = ip.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left
    return `${full.slice(0, 4).map((x) => (parseInt(x, 16) || 0).toString(16)).join(':')}::/64`
  }
  return ip
}

// ── CORS ─────────────────────────────────────────────────────────────────────

// WAITLIST_ALLOWED_ORIGINS: comma-separated exact origins. A wildcard, a path
// or anything that is not an origin is dropped; plain http only for localhost.
export function parseOrigins(value) {
  return String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean).filter((s) => {
    if (s.includes('*')) return false
    try {
      const u = new URL(s)
      if (u.origin !== s) return false
      return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
    } catch { return false }
  })
}

// ── Emails and pages ─────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function confirmEmail({ confirmUrl, unsubscribeUrl, unsubscribePost }) {
  const text = [
    'Confirm your place on the Maddex early-access list.',
    '',
    `Confirm: ${confirmUrl}`,
    '',
    `The link works for ${CONFIRM_TTL_HOURS} hours. If you did not ask to join, ignore this email: nothing is kept unless the link is used.`,
    '',
    'Maddex provides general information only, not financial advice.',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n')
  const html = `<p>Confirm your place on the Maddex early-access list.</p>
<p><a href="${esc(confirmUrl)}">Confirm my email address</a></p>
<p>The link works for ${CONFIRM_TTL_HOURS} hours. If you did not ask to join, ignore this email: nothing is kept unless the link is used.</p>
<p style="color:#666;font-size:12px">Maddex provides general information only, not financial advice. <a href="${esc(unsubscribeUrl)}">Unsubscribe</a></p>`
  return {
    subject: 'Confirm your Maddex early-access sign-up',
    text,
    html,
    // RFC 8058 one-click unsubscribe: mail clients POST to this URL.
    headers: { 'List-Unsubscribe': `<${unsubscribePost}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  }
}

// A small page for the emailed links. A GET only shows a button; the button
// POSTs, so a mail scanner that opens links cannot confirm or unsubscribe.
export function page({ title, message, action = null, button = null, back = null }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Maddex</title>
<style>body{margin:0;background:#0b0f14;color:#e6e9ee;font:15px/1.5 system-ui,sans-serif}main{max-width:440px;margin:15vh auto;padding:0 16px}h1{font-size:18px;color:#d4a843}button{font:inherit;background:#d4a843;color:#0b0f14;border:0;padding:10px 18px;cursor:pointer}a{color:#d4a843}@media (prefers-color-scheme:light){body{background:#fff;color:#111}}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(message)}</p>${action ? `<form method="post" action="${esc(action)}"><button type="submit">${esc(button)}</button></form>` : ''}${back ? `<p><a href="${esc(back)}">Back to Maddex</a></p>` : ''}</main></body></html>`
}

export const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', // the token is in the URL
  'X-Content-Type-Options': 'nosniff',
}
