// Vercel serverless function — MaddenAI content that is the same for every
// reader, generated once per Sydney day and shared.
//
//   GET /api/ai-daily?kind=<kind>&day=<YYYY-MM-DD>
//
// The prompt is built HERE from server-side inputs only (the verified
// constants; public news feeds for the sentiment headlines — see
// src/services/aiDaily.js), so a reader cannot steer what another reader is
// shown, and the endpoint needs no sign-in. The response is cached by the CDN
// until Sydney midnight; a warm function instance also keeps it in memory.
//
// COST CONTROL. The only parameters accepted are `kind` (a fixed list) and
// `day` (must be today in Sydney). Anything else is a 400 before any model
// call, so the cache cannot be busted with junk query strings. A per-instance
// daily cap stops a cold-cache stampede from running away.

import { DAILY_KINDS, SENTIMENT_FEEDS, sydneyDay, secondsToSydneyMidnight } from '../src/services/aiDaily.js'
import { parseFeed } from './rss.js'

const MODEL = 'claude-sonnet-4-6'
const CAP_PER_INSTANCE_PER_DAY = 40

const memory = new Map()     // `${kind}:${day}` → payload
const inFlight = new Map()   // `${kind}:${day}` → Promise<payload>
let generated = { day: null, count: 0 }

async function headlines() {
  const results = await Promise.allSettled(SENTIMENT_FEEDS.map(async (url) => {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Maddex)' }, signal: AbortSignal.timeout(6000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return parseFeed(await r.text())
  }))
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((i) => i?.title)
    .sort((a, b) => (Date.parse(b.pubDate ?? '') || 0) - (Date.parse(a.pubDate ?? '') || 0))
  const seen = new Set()
  return items.map((i) => i.title.trim()).filter((t) => (seen.has(t) ? false : seen.add(t))).slice(0, 20)
}

async function generate(kind, day) {
  const spec = DAILY_KINDS[kind]
  if (generated.day !== day) generated = { day, count: 0 }
  if (generated.count >= CAP_PER_INSTANCE_PER_DAY) throw Object.assign(new Error('Daily generation cap reached'), { status: 503 })
  const inputs = spec.needs === 'headlines' ? { headlines: await headlines() } : {}
  if (spec.needs === 'headlines' && !inputs.headlines.length) throw Object.assign(new Error('No headlines available'), { status: 503 })
  const { system, user } = spec.build(inputs)
  generated.count += 1
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: spec.maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!r.ok) throw Object.assign(new Error(`Anthropic HTTP ${r.status}`), { status: 502 })
  const msg = await r.json()
  if (msg.stop_reason === 'max_tokens') throw Object.assign(new Error('Reply cut off at max_tokens'), { status: 502 })
  const text = msg.content?.find((b) => b.type === 'text')?.text
  if (!text) throw Object.assign(new Error('Empty reply'), { status: 502 })
  const data = spec.parse(text)
  console.log('[ai-daily]', kind, day, msg.usage)
  return { kind, day, generatedAt: new Date().toISOString(), model: MODEL, data }
}

export default async function handler(req, res) {
  const noStore = () => res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { noStore(); return res.status(405).json({ error: 'GET only' }) }
  const params = new URL(req.url, 'http://localhost').searchParams
  const keys = [...params.keys()]
  const kind = params.get('kind')
  const day = params.get('day')
  if (keys.some((k) => k !== 'kind' && k !== 'day') || !DAILY_KINDS[kind] || day !== sydneyDay()) {
    noStore()
    return res.status(400).json({ error: 'Expected ?kind=<known kind>&day=<today in Sydney>', today: sydneyDay() })
  }
  if (!process.env.ANTHROPIC_API_KEY) { noStore(); return res.status(503).json({ error: 'AI not configured' }) }

  const key = `${kind}:${day}`
  try {
    let payload = memory.get(key)
    if (!payload) {
      let run = inFlight.get(key)
      if (!run) { run = generate(kind, day); inFlight.set(key, run) }
      try { payload = await run } finally { inFlight.delete(key) }
      memory.set(key, payload)
      for (const k of memory.keys()) if (!k.endsWith(`:${day}`)) memory.delete(k)
    }
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${secondsToSydneyMidnight()}, stale-while-revalidate=300`)
    return res.status(200).json(payload)
  } catch (err) {
    noStore()
    return res.status(err.status ?? 500).json({ error: err.message })
  }
}
