// Live-model test harness (26 Nov 2026). Every paid call in scripts/ai-live
// goes through call(): it counts, stops at the run's ceiling, refuses after
// the window Ben opened (paid calls end Fri 27 Nov 2026 14:45 Brisbane =
// 04:45 UTC), and records tokens and estimated cost. Keys come from the
// environment (node --env-file=.env); nothing here prints them.
//
// Prices: Claude Sonnet 4.6, US$ per million tokens (docs/AI_COST.md):
// input 3, output 15, cache write 3.75, cache read 0.30.

import fs from 'node:fs'

export const MODEL = 'claude-sonnet-4-6' // what askClaude and /api/claude use
export const PAID_UNTIL = Date.parse('2026-11-27T04:45:00Z')
const PRICE = { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 }

export const costOf = (u = {}) => ((u.input_tokens ?? 0) * PRICE.in + (u.output_tokens ?? 0) * PRICE.out
  + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead) / 1e6

export function makeRun(name, { ceiling, now = () => Date.now() }) {
  if (!Number.isInteger(ceiling) || ceiling < 1) throw new Error('a run needs a call ceiling')
  const run = { name, ceiling, calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0, errors: 0, started: new Date(now()).toISOString() }

  // One paid completion. Throws (and makes no call) past the ceiling or the window.
  run.call = async ({ system, messages, max_tokens = 800, timeoutMs = 90_000, cacheSystem = true }) => {
    if (now() >= PAID_UNTIL) throw new Error('paid-call window closed (Fri 27 Nov 2026 14:45 Brisbane)')
    if (run.calls >= run.ceiling) throw new Error(`run ceiling of ${run.ceiling} calls reached`)
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
    run.calls += 1
    const body = { model: MODEL, max_tokens, messages }
    if (system) body.system = cacheSystem ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : system
    let r
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e.message) }))
      // Retries an overload or rate limit twice (counted as one call).
      if (r.ok || ![429, 529, 0].includes(r.status)) break
      await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)))
    }
    if (!r.ok) { run.errors += 1; throw new Error(`Anthropic HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`) }
    const msg = await r.json()
    const u = msg.usage ?? {}
    run.input += u.input_tokens ?? 0
    run.output += u.output_tokens ?? 0
    run.cacheWrite += u.cache_creation_input_tokens ?? 0
    run.cacheRead += u.cache_read_input_tokens ?? 0
    run.cost += costOf(u)
    return { text: msg.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') ?? '', usage: u, stop: msg.stop_reason }
  }

  // A call made elsewhere (the app in a browser, through the dev proxy):
  // counted against the same ceiling and window, and costed from its usage.
  // → false when it must not be made (the caller aborts the request).
  run.admit = () => {
    if (now() >= PAID_UNTIL || run.calls >= run.ceiling) return false
    run.calls += 1
    return true
  }
  run.record = (u = {}) => {
    run.input += u.input_tokens ?? 0
    run.output += u.output_tokens ?? 0
    run.cacheWrite += u.cache_creation_input_tokens ?? 0
    run.cacheRead += u.cache_read_input_tokens ?? 0
    run.cost += costOf(u)
  }

  // Appends this run's line to the ledger and to docs/AI_COST.md.
  run.finish = (note = '') => {
    run.finished = new Date(now()).toISOString()
    fs.mkdirSync('docs/ai-eval', { recursive: true })
    fs.appendFileSync('docs/ai-eval/ledger.jsonl', `${JSON.stringify({ name: run.name, started: run.started, finished: run.finished, calls: run.calls, ceiling: run.ceiling, errors: run.errors, input: run.input, output: run.output, cacheWrite: run.cacheWrite, cacheRead: run.cacheRead, costUSD: Number(run.cost.toFixed(4)), note })}\n`)
    const doc = 'docs/AI_COST.md'
    let s = fs.readFileSync(doc, 'utf8')
    const HEAD = '## Live test runs (paid)'
    if (!s.includes(HEAD)) s += `\n${HEAD}\n\nEach run of \`scripts/ai-live\` (Ben opened paid testing until Fri 27 Nov 2026 14:45 Brisbane). Tokens from the API's own usage; cost estimated at the Sonnet 4.6 prices above (cache write 3.75, cache read 0.30 US$/M).\n\n| Run | Started (UTC) | Calls | Input | Output | Cache write | Cache read | Est. US$ | Note |\n|---|---|---|---|---|---|---|---|---|\n`
    s = s.trimEnd() + `\n| ${run.name} | ${run.started.slice(0, 16).replace('T', ' ')} | ${run.calls} | ${run.input} | ${run.output} | ${run.cacheWrite} | ${run.cacheRead} | ${run.cost.toFixed(3)} | ${note} |\n`
    fs.writeFileSync(doc, s)
    return run
  }
  return run
}

// Runs tasks with a fixed number in flight.
export async function pool(items, size, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i) }
  }))
  return out
}

export function totalSpend() {
  try { return fs.readFileSync('docs/ai-eval/ledger.jsonl', 'utf8').trim().split('\n').filter(Boolean).reduce((n, l) => n + (JSON.parse(l).costUSD ?? 0), 0) } catch { return 0 }
}
