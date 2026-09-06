// Rough token accounting for MaddenAI.
//
// This is an ESTIMATE and the UI says so. It counts what this browser sent —
// it cannot see calls from another device, another browser, or anything else
// on the same Anthropic key. Anyone treating it as a bill will be wrong.
//
// It is still worth having: the difference between "a few hundred tokens
// today" and "two hundred thousand" is the difference between a feature
// working as intended and something looping.

const KEY = 'maddex_ai_usage'
const DAYS_KEPT = 30

// Sonnet 4.6 list pricing, USD per million tokens. Cached input reads are
// charged at a tenth of the input rate, which is most of why the caching
// work earlier in this project mattered.
const PRICE = {
  input: 3.00,
  cachedRead: 0.30,
  cacheWrite: 3.75,
  output: 15.00,
}

const AUD_PER_USD = 1.52   // indicative; the UI labels the figure as rough

const today = () => new Date().toLocaleDateString('en-CA')

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* quota */ }
}

// Called once per completion. Silent on failure — usage accounting must never
// be the reason a user's actual request appears to fail.
export function recordUsage({ inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheCreated = 0 } = {}) {
  try {
    const data = read()
    const d = today()
    const day = data[d] ?? { calls: 0, input: 0, output: 0, cacheRead: 0, cacheCreated: 0 }
    day.calls += 1
    day.input += inputTokens
    day.output += outputTokens
    day.cacheRead += cacheRead
    day.cacheCreated += cacheCreated
    data[d] = day

    // Trim old days so this cannot grow without bound in localStorage.
    const cutoff = new Date(Date.now() - DAYS_KEPT * 86400000).toLocaleDateString('en-CA')
    for (const k of Object.keys(data)) if (k < cutoff) delete data[k]

    write(data)
  } catch { /* never let accounting break a request */ }
}

function costUsd(day) {
  return (day.input / 1e6) * PRICE.input
    + (day.cacheRead / 1e6) * PRICE.cachedRead
    + (day.cacheCreated / 1e6) * PRICE.cacheWrite
    + (day.output / 1e6) * PRICE.output
}

export function getUsageSummary() {
  const data = read()
  const d = today()
  const day = data[d] ?? { calls: 0, input: 0, output: 0, cacheRead: 0, cacheCreated: 0 }
  const days = Object.keys(data).sort()

  const totalToday = day.input + day.output + day.cacheRead + day.cacheCreated
  const todayCostAud = costUsd(day) * AUD_PER_USD

  // Monthly projection from the mean of the days actually recorded, not from
  // today alone — one heavy afternoon would otherwise project a wild number.
  // With a single day of data it is just that day, which is the honest answer.
  const meanDailyAud = days.length
    ? (days.reduce((s, k) => s + costUsd(data[k]), 0) / days.length) * AUD_PER_USD
    : 0

  return {
    calls: day.calls,
    tokensToday: totalToday,
    cachedToday: day.cacheRead,
    costTodayAud: todayCostAud,
    projectedMonthlyAud: meanDailyAud * 30,
    daysTracked: days.length,
  }
}

export function clearUsage() {
  try { localStorage.removeItem(KEY) } catch { /* best effort */ }
}
