// Vercel serverless function — MaddenAI content that is the same for every
// reader, generated once per Sydney day by a SCHEDULED JOB and shared.
//
//   GET /api/ai-daily?kind=<kind>&day=<YYYY-MM-DD>   a reader's view: READS ONLY
//   GET /api/ai-daily?generate=all                   the daily job (Vercel cron)
//
// Ben's decision, 26 Nov 2026: this is the one AI content readers see without
// pressing anything, so it is generated at a fixed time by the scheduled job
// in vercel.json (19:00 UTC: 06:00 Sydney in daylight time), never because
// someone viewed a page. A view reads today's stored reply (public.ai_records,
// purpose "daily:<kind>"), re-checks it with the advice guard, and answers
// "not generated" when there is none: no generation and no retry from a view.
// At most one generation per content type per Sydney day: the job skips a
// type whose reply is already stored, whichever instance runs it.
//
// The prompt is built HERE from server-side inputs only (the verified
// constants; public news feeds for the sentiment headlines — see
// src/services/aiDaily.js), so a reader cannot steer what another reader is
// shown. The only parameters accepted are `kind` (a fixed list) and `day`
// (today in Sydney), or `generate=all`; anything else is a 400.
//
// The job is authorised by CRON_SECRET when it is set in Vercel (Vercel
// sends it as a bearer token), and otherwise by Vercel's cron user agent.
// Either way the daily cap holds: a stray trigger can only run what the
// schedule would have run that day.

import { guardJson, GUARD_VERSION } from '../src/services/adviceGuard.js'
import { buildRecord, saveRecord, serviceDb } from './_aiRecords.js'
import { DAILY_KINDS, SENTIMENT_FEEDS, sydneyDay, secondsToSydneyMidnight } from '../src/services/aiDaily.js'
import { parseFeed } from './rss.js'

const MODEL = 'claude-sonnet-4-6'
const memory = new Map()     // `${kind}:${day}` → payload, once stored

async function headlines(fetchImpl = fetch) {
  const results = await Promise.allSettled(SENTIMENT_FEEDS.map(async (url) => {
    const r = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0 (Maddex)' }, signal: AbortSignal.timeout(6000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return parseFeed(await r.text())
  }))
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((i) => i?.title)
    .sort((a, b) => (Date.parse(b.pubDate ?? '') || 0) - (Date.parse(a.pubDate ?? '') || 0))
  const seen = new Set()
  return items.map((i) => i.title.trim()).filter((t) => (seen.has(t) ? false : seen.add(t))).slice(0, 20)
}

// One generation of one kind, stored as today's record. → 'generated'.
async function generate(kind, day, { env, fetchImpl, db }) {
  const spec = DAILY_KINDS[kind]
  const inputs = spec.needs === 'headlines' ? { headlines: await headlines(fetchImpl) } : {}
  if (spec.needs === 'headlines' && !inputs.headlines.length) throw new Error('No headlines available')
  const { system, user } = spec.build(inputs)
  const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: spec.maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`)
  const msg = await r.json()
  if (msg.stop_reason === 'max_tokens') throw new Error('Reply cut off at max_tokens')
  const text = msg.content?.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Empty reply')
  spec.parse(text) // must parse before it is stored
  const saved = await saveRecord(db, buildRecord({ model: MODEL, purpose: `daily:${kind}`, template: `ai-daily:${kind}`, dataDate: day, system, messages: [{ role: 'user', content: user }], outputText: text }))
  if (!saved) throw new Error('Could not store the reply')
  console.log('[ai-daily] generated', kind, day, msg.usage)
  return 'generated'
}

// Today's stored reply for a kind, as readers are shown it: parsed and
// re-checked by today's advice guard. null when there is none.
async function storedPayload(kind, day, db) {
  const r = await db(`ai_records?select=output_text,created_at,model&purpose=eq.${encodeURIComponent(`daily:${kind}`)}&input_data_date=eq.${day}&order=created_at.desc&limit=1`)
  if (!r.ok) throw new Error(`ai_records read ${r.status}`)
  const [row] = await r.json()
  if (!row) return null
  const flags = []
  const data = guardJson(DAILY_KINDS[kind].parse(row.output_text), flags)
  if (flags.length) console.warn('[ai-daily] advice guard rewrote', kind, flags.map((f) => f.rule).join(','))
  return { kind, day, generatedAt: row.created_at, model: row.model, guard: { version: GUARD_VERSION, flags: flags.length }, data }
}

export function cronAuthorised(headers = {}, env = process.env) {
  if (env.CRON_SECRET) return headers.authorization === `Bearer ${env.CRON_SECRET}`
  return /^vercel-cron\//i.test(String(headers['user-agent'] ?? ''))
}

export function createHandler({ env = process.env, fetchImpl = (...a) => fetch(...a), dbFor = (e) => serviceDb(e, fetchImpl), now = () => new Date() } = {}) {
  return async function handler(req, res) {
    const noStore = () => res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') { noStore(); return res.status(405).json({ error: 'GET only' }) }
    const params = new URL(req.url, 'http://localhost').searchParams
    const keys = [...params.keys()]
    const day = sydneyDay(now())
    const db = dbFor(env)

    // ── The daily job ──
    if (params.get('generate') === 'all' && keys.length === 1) {
      noStore()
      if (!cronAuthorised(req.headers ?? {}, env)) return res.status(401).json({ error: 'scheduled job only' })
      if (!env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI not configured' })
      if (!db) return res.status(503).json({ error: 'records not configured: nothing could be stored' })
      const kinds = Object.keys(DAILY_KINDS)
      const results = await Promise.all(kinds.map(async (kind) => {
        try {
          if (await storedPayload(kind, day, db)) return [kind, 'already generated today']
          return [kind, await generate(kind, day, { env, fetchImpl, db })]
        } catch (e) {
          console.warn('[ai-daily] not generated', kind, e.message)
          return [kind, 'failed']
        }
      }))
      return res.status(200).json({ day, results: Object.fromEntries(results) })
    }

    // ── A reader's view: read only ──
    const kind = params.get('kind')
    if (keys.some((k) => k !== 'kind' && k !== 'day') || !DAILY_KINDS[kind] || params.get('day') !== day) {
      noStore()
      return res.status(400).json({ error: 'Expected ?kind=<known kind>&day=<today in Sydney>', today: day })
    }
    const notYet = () => {
      // Short cache: the job may store it within minutes.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300')
      return res.status(200).json({ kind, day, status: 'not_generated' })
    }
    const key = `${kind}:${day}`
    try {
      let payload = memory.get(key)
      if (!payload) {
        if (!db) return notYet()
        payload = await storedPayload(kind, day, db)
        if (!payload) return notYet()
        memory.set(key, payload)
        for (const k of memory.keys()) if (!k.endsWith(`:${day}`)) memory.delete(k)
      }
      res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${secondsToSydneyMidnight(now())}, stale-while-revalidate=300`)
      return res.status(200).json(payload)
    } catch (err) {
      console.warn('[ai-daily] read failed', kind, err.message)
      return notYet()
    }
  }
}

export default createHandler()
