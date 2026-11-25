// The launch site's early-access sign-up (WS1, 26 Nov 2026). Contract:
// docs/WAITLIST_API.md.
//
//   POST /api/waitlist                      { email, consent: true, website: "" }
//   GET  /api/waitlist?action=confirm&token=…      page with a Confirm button
//   POST /api/waitlist?action=confirm&token=…      confirms (form, or JSON)
//   GET  /api/waitlist?action=unsubscribe&token=…  page with an Unsubscribe button
//   POST /api/waitlist?action=unsubscribe&token=…  unsubscribes (form, one-click, JSON)
//
// Double opt-in: a sign-up only sends an email; the row is written when the
// link in it is used. The answer to a sign-up is the same whether or not the
// address is already on the list, and nothing is read from the list to give
// it. Unsubscribing deletes the row.
//
// Env (server-only, never VITE_): WAITLIST_TOKEN_SECRET (32+ characters; signs
// links and hashes rate-limit keys), WAITLIST_ALLOWED_ORIGINS (the launch
// site's exact origins, comma-separated; no wildcard), WAITLIST_PUBLIC_URL
// (this deployment's origin, for the links; defaults to the Vercel production
// URL), WAITLIST_SITE_URL (optional, the "Back to Maddex" link), SUPABASE_URL
// and SUPABASE_SERVICE_KEY (to write). Anything missing → 503 not_configured.

import {
  LISTS, CONFIRM_TTL_HOURS, LIMITS, readSubscribe, makeToken, readToken, memoryStore, counter, hashKey, allow,
  clientIp, parseOrigins, confirmEmail, page, PAGE_HEADERS,
} from './_waitlist.js'
import { configuredMailer } from './_mailer.js'

const httpsOrigin = (v) => { try { const u = new URL(v); return u.protocol === 'https:' ? u.origin : null } catch { return null } }

export function readConfig(env) {
  const secret = env.WAITLIST_TOKEN_SECRET
  return {
    secret: typeof secret === 'string' && secret.length >= 32 ? secret : null,
    origins: parseOrigins(env.WAITLIST_ALLOWED_ORIGINS),
    publicUrl: httpsOrigin(env.WAITLIST_PUBLIC_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')),
    siteUrl: env.WAITLIST_SITE_URL ? httpsOrigin(env.WAITLIST_SITE_URL) : null,
    db: env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY ? { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY } : null,
  }
}

export function createHandler({ env = process.env, mailer = configuredMailer(), store = memoryStore(), sends = counter(), fetchImpl = (...a) => fetch(...a), now = () => Date.now() } = {}) {
  return async function handler(req, res) {
    const cfg = readConfig(env)
    const headers = req.headers ?? {}
    const origin = headers.origin ?? null
    const q = req.query ?? Object.fromEntries(new URL(req.url ?? '/', 'http://x').searchParams)
    const action = q.action ?? 'subscribe'
    const type = String(headers['content-type'] ?? '')
    const wantsJson = type.includes('application/json') || (String(headers.accept ?? '').includes('application/json') && !String(headers.accept ?? '').includes('text/html'))

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const allowed = origin != null && cfg.origins.includes(origin)
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    const json = (status, body) => res.status(status).json(body)
    const html = (status, p) => { for (const [k, v] of Object.entries(PAGE_HEADERS)) res.setHeader(k, v); return res.status(status).send(page({ ...p, back: cfg.siteUrl })) }
    const reply = (status, body, p) => (wantsJson ? json(status, body) : html(status, p))
    // Vercel parses req.body lazily and throws on malformed JSON; read it once.
    const readBody = () => { try { const b = req.body; return typeof b === 'string' ? JSON.parse(b) : b } catch { return undefined } }

    if (!['subscribe', 'confirm', 'unsubscribe'].includes(action)) return json(404, { error: 'unknown_action' })

    if (req.method === 'OPTIONS') {
      if (!allowed) return res.status(403).json({ error: 'origin_not_allowed' })
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      res.setHeader('Access-Control-Max-Age', '600')
      return res.status(204).end()
    }

    // ── Sign-up ──
    if (action === 'subscribe') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return json(405, { error: 'method_not_allowed' }) }
      // The launch site (allowlisted), or the terminal itself (same origin).
      if (!allowed && !(origin != null && origin === cfg.publicUrl)) return json(403, { error: 'origin_not_allowed' })
      if (!type.includes('application/json')) return json(415, { error: 'json_required' })
      if (!cfg.secret || !cfg.publicUrl || !cfg.db || !mailer) return json(503, { error: 'not_configured' })
      if (!(await allow(store, hashKey(cfg.secret, 'ip', clientIp(headers)), LIMITS.subscribeIp, now()))) return tooMany(res)

      const body = readBody()
      if (body === undefined) return json(400, { error: 'invalid_body' })
      const input = readSubscribe(body)
      const accepted = () => json(202, { ok: true, status: 'pending', message: `If that address can receive email, a confirmation link is on its way. It works for ${CONFIRM_TTL_HOURS} hours.` })
      if (input.honeypot) return accepted() // a bot: the same answer, nothing sent
      if (input.error) return json(input.error === 'too_large' ? 413 : 400, { error: input.error })
      // Over the per-address limit: the same answer, nothing sent, so the
      // limit says nothing about the address to whoever is asking.
      if (!(await allow(store, hashKey(cfg.secret, 'email', input.email), LIMITS.subscribeEmail, now()))) return accepted()
      if (!(await allow(sends, 'sends', LIMITS.sendsGlobal, now()))) return tooMany(res)

      const t = now()
      const link = (a, token) => `${cfg.publicUrl}/api/waitlist?action=${a}&token=${token}`
      const list = input.list
      const unsub = makeToken(cfg.secret, 'unsubscribe', input.email, { now: t, list })
      const msg = confirmEmail({
        list,
        confirmUrl: link('confirm', makeToken(cfg.secret, 'confirm', input.email, { now: t, ttlHours: CONFIRM_TTL_HOURS, list })),
        unsubscribeUrl: link('unsubscribe', unsub),
        unsubscribePost: link('unsubscribe', unsub),
      })
      try { await mailer.send({ to: input.email, ...msg }) } catch {
        console.error('[waitlist] the sender refused a confirmation email')
        return json(502, { error: 'send_failed' })
      }
      return accepted()
    }

    // ── The emailed links ──
    const isConfirm = action === 'confirm'
    if (!cfg.secret || !cfg.db) return reply(503, { error: 'not_configured' }, { title: 'Not available', message: 'This link cannot be used just now. Please try again later.' })
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(405, { error: 'method_not_allowed' }, { title: 'Not available', message: 'Open the link from the email.' }) }
    // A form on our own page (its no-referrer policy makes the browser send
    // "Origin: null"), a mail client's one-click POST (no Origin), or the
    // launch site; nothing else. The token is the credential either way.
    if (req.method === 'POST' && origin != null && origin !== 'null' && !allowed && origin !== cfg.publicUrl) {
      return reply(403, { error: 'origin_not_allowed' }, { title: 'Not available', message: 'Open the link from the email.' })
    }
    if (!(await allow(store, hashKey(cfg.secret, 'ip', clientIp(headers)), LIMITS.tokenIp, now()))) {
      res.setHeader('Retry-After', '600')
      return reply(429, { error: 'rate_limited' }, { title: 'Too many attempts', message: 'Please try the link again in a few minutes.' })
    }

    let token = q.token
    if (token == null && req.method === 'POST' && wantsJson) token = readBody()?.token
    const p = readToken(cfg.secret, isConfirm ? 'confirm' : 'unsubscribe', token, { now: now() })
    if (p.error) {
      const message = p.error === 'expired_token'
        ? `This confirmation link has expired (links work for ${CONFIRM_TTL_HOURS} hours). Sign up again to get a new one.`
        : 'This link is not valid. Check that the whole link was copied from the email.'
      return reply(400, { error: p.error }, { title: 'Link not valid', message })
    }

    const L = LISTS[p.l]
    const words = isConfirm
      ? { title: 'Confirm your sign-up', message: `Confirm that you want ${L.about}.`, button: 'Confirm my email address' }
      : { title: 'Unsubscribe', message: `Stop ${L.about}, and remove your address from that list.`, button: 'Unsubscribe' }
    if (req.method === 'GET') return html(200, { ...words, action: `/api/waitlist?action=${action}&token=${token}` })

    const db = { apikey: cfg.db.key, authorization: `Bearer ${cfg.db.key}` }
    const r = isConfirm
      ? await fetchImpl(`${cfg.db.url}/rest/v1/waitlist?on_conflict=email,source`, {
        method: 'POST',
        headers: { ...db, 'content-type': 'application/json', prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([{ email: p.e, source: L.source }]),
      }).catch(() => null)
      : await fetchImpl(`${cfg.db.url}/rest/v1/waitlist?email=eq.${encodeURIComponent(p.e)}&source=eq.${L.source}`, {
        method: 'DELETE', headers: { ...db, prefer: 'return=minimal' },
      }).catch(() => null)
    if (!r?.ok) {
      console.error(`[waitlist] ${action} could not be saved (${r?.status ?? 'network'})`)
      return reply(502, { error: 'save_failed' }, { title: 'Not saved', message: 'That did not go through. Please try the link again in a few minutes.' })
    }
    return isConfirm
      ? reply(200, { ok: true, status: 'confirmed' }, { title: 'You are on the list', message: `You will get ${L.about}. Every email has an unsubscribe link.` })
      : reply(200, { ok: true, status: 'unsubscribed' }, { title: 'Unsubscribed', message: `Your address has been removed from ${L.name}. You will get no more of its emails.` })
  }
}

function tooMany(res) {
  res.setHeader('Retry-After', '600')
  return res.status(429).json({ error: 'rate_limited' })
}

export default createHandler()
