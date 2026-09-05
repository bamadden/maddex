// ─── AI-generated content ───────────────────────────────────────────────────
//
// SCOPE, deliberately narrow: this service generates PROSE ONLY — themes,
// risk narratives, interpretation, ticker lines. It does not generate
// figures.
//
// The reason is that a language model cannot know today's cash rate, this
// morning's CPI print, or the current 10-year yield. Asked for them it will
// return numbers that look right and are not, with nothing on screen to
// signal the error. A wrong number presented confidently is worse than an
// obviously stale one.
//
// So the division is:
//   figures  → src/data/verifiedConstants.js (checked facts + verify dates)
//              or liveDataService (real APIs)
//   prose    → here
//
// Where a prompt needs a number for context, it is passed IN from the
// verified constants rather than asked for. The model interprets; it does not
// source.
//
// Caching is per calendar day: content regenerates once a day, so a module
// mounting fifty times costs one call, and a stale-but-yesterday narrative is
// preferred over a blank panel.

import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'

const AI_CACHE_PREFIX = 'maddex_ai_content_'

const today = () => new Date().toISOString().split('T')[0]
const yesterday = () => new Date(Date.now() - 86400000).toISOString().split('T')[0]

function readDay(key, day) {
  try {
    const raw = localStorage.getItem(`${AI_CACHE_PREFIX}${key}_${day}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// Strips the ```json fence models sometimes add despite instructions.
function parseJson(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

// Today's cache → network → yesterday's cache → fallback.
// The yesterday step matters: a day-old set of macro themes is still broadly
// true and far more useful than an empty panel when a request fails.
async function withDailyCache(key, buildPrompt, fallback = null) {
  const cachedToday = readDay(key, today())
  if (cachedToday) return { data: cachedToday, source: 'cache' }

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        // 4000, not 1600: at 1600 a six-theme payload hit stop_reason
        // "max_tokens" and truncated mid-string, so JSON.parse threw and the
        // whole call fell back. Verified failing at 1600, passing at 4000.
        max_tokens: 4000,
        stream: false,
        system: AI_CONTENT_SYSTEM,
        messages: [{ role: 'user', content: buildPrompt() }],
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const payload = await res.json()
    const text = payload?.content?.[0]?.text
    if (!text) throw new Error('Empty completion')
    const parsed = parseJson(text)
    try { localStorage.setItem(`${AI_CACHE_PREFIX}${key}_${today()}`, JSON.stringify(parsed)) } catch { /* quota */ }
    return { data: parsed, source: 'live' }
  } catch (err) {
    console.warn(`[AIContent] ${key} failed:`, err.message)
    const cachedYesterday = readDay(key, yesterday())
    if (cachedYesterday) return { data: cachedYesterday, source: 'stale' }
    return { data: fallback, source: fallback ? 'fallback' : 'failed' }
  }
}

// Stable across every call so the cached prompt prefix stays byte-identical.
const AI_CONTENT_SYSTEM =
  'You are MaddenAI, the financial intelligence analyst embedded in the Maddex terminal, writing for an Australian investor. '
  + 'You return ONLY valid JSON — no markdown, no code fences, no prose outside the JSON. '
  + 'You write ANALYSIS AND NARRATIVE, never invented statistics: any specific figure you are given in the prompt may be quoted, '
  + 'but never state a market level, policy rate, index value or economic print that was not supplied to you. '
  + 'Where a number would be needed and none was given, describe the direction or condition in words instead. '
  + 'General information only, not financial advice.'

// Context block appended to every prompt, so the model reasons from our
// verified figures rather than reaching for its own.
function contextBlock() {
  const { rba, fed, au } = VERIFIED_CONSTANTS
  return [
    `Today is ${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
    '',
    'VERIFIED FIGURES you may quote (do not invent others):',
    `- RBA cash rate: ${rba.cashRate}% (${rba.lastDecisionVerb} on ${rba.lastDecision}); next meeting ${rba.nextMeeting}`,
    `- US Fed funds: ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision})`,
    `- AU CPI: ${au.cpi}% for the ${au.cpiPeriod}; RBA target band ${au.rbaTargetBand}`,
    `- AU unemployment: ${au.unemployment}% (${au.unemploymentPeriod})`,
    `- AU GDP: ${au.gdpAnnual}% annual (${au.gdpPeriod})`,
    '',
  ].join('\n')
}

export const aiContentService = {
  // ── Macro themes ──────────────────────────────────────────────────────────
  async getMacroThemes() {
    return withDailyCache('macro_themes', () => `${contextBlock()}
Generate 6 current macro themes relevant to Australian investors.

Return a JSON array of 6 objects:
[{
  "title": "<theme name, max 5 words>",
  "category": "DOMESTIC|GLOBAL|COMMODITY|RATES|FX|RISK",
  "impact": "BULLISH|BEARISH|NEUTRAL",
  "summary": "<2-3 sentences of analysis>",
  "whatWouldChangeIt": "<1 sentence: the development that would invalidate this read>",
  "affectedSectors": ["<ASX sector>"],          // max 3
  "affectedStocks": ["<ASX ticker>"],            // max 4
  "timeHorizon": "NEAR|MEDIUM|LONG"
}]

Write analysis, not data. Do not state index levels or prices.
Keep affectedSectors to at most 3 and affectedStocks to at most 4.`)
  },

  // ── Geopolitical risk narratives ──────────────────────────────────────────
  async getGeopoliticalRisks() {
    return withDailyCache('geo_risks', () => `${contextBlock()}
List the 5 most significant ongoing geopolitical risks for Australian investors.

Return a JSON array:
[{
  "id": "<slug>",
  "title": "<event name>",
  "location": "<city or region>",
  "coordinates": [<longitude>, <latitude>],
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "type": "CONFLICT|ECONOMIC|POLITICAL|NATURAL",
  "summary": "<2 sentences>",
  "marketImpact": "<the transmission channel to markets, in words>",
  "asxExposure": "<specific ASX sectors or tickers and why>",
  "auTradeDependence": "HIGH|MEDIUM|LOW",
  "trend": "ESCALATING|STABLE|DE-ESCALATING"
}]

Coordinates should be the approximate centre of the region.
Describe severity and impact qualitatively — no invented statistics.`)
  },

  // ── Shipping / chokepoint narratives ──────────────────────────────────────
  async getShippingStatus() {
    return withDailyCache('shipping_status', () => `${contextBlock()}
Describe the currently significant global shipping chokepoints and disruptions.

Return a JSON array:
[{
  "id": "<slug>",
  "name": "<chokepoint name>",
  "coordinates": [<longitude>, <latitude>],
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "title": "<short headline>",
  "detail": "<2-3 sentences on the current situation>",
  "impact": "<effect on freight and trade, in words>",
  "affectedRoutes": ["<route>"],
  "commodities": ["<commodity>"],
  "auExports": "<how this affects Australian exports>",
  "trend": "WORSENING|STABLE|IMPROVING"
}]

Describe magnitude in words rather than percentages you cannot verify.`)
  },

  // ── Intelligence ticker ───────────────────────────────────────────────────
  async getIntelTicker() {
    return withDailyCache('intel_ticker', () => `${contextBlock()}
Generate 12 brief market-intelligence lines for an Australian investor,
suitable for a scrolling terminal ticker.

Return a JSON array of 12 strings, each at most 80 characters, each beginning
with a single relevant emoji:
["🔴 Red Sea — carriers still routing via the Cape", ...]

Mix: market conditions, geopolitics, commodities, central banks, shipping,
domestic data. Describe conditions and direction — do not state prices,
index levels or percentages unless they appear in the verified figures above.`)
  },

  // ── Macro regime read ─────────────────────────────────────────────────────
  async getMacroRegime() {
    return withDailyCache('macro_regime', () => `${contextBlock()}
Characterise the current macro regime for an Australian investor.

Return a JSON object:
{
  "regime": "TIGHTENING|EASING|NEUTRAL|STAGFLATION",
  "growthMomentum": "ACCELERATING|DECELERATING|STABLE",
  "inflationTrend": "RISING|FALLING|STABLE",
  "riskAppetite": "RISK_ON|RISK_OFF|NEUTRAL",
  "description": "<2 sentences characterising the regime>",
  "implications": {
    "equities": "<one line>",
    "bonds": "<one line>",
    "commodities": "<one line>",
    "aud": "<one line>"
  },
  "keyTension": "<the single biggest unresolved question in this regime>"
}

Reason from the verified figures supplied. Do not introduce new numbers.`)
  },

  // ── Status + maintenance ──────────────────────────────────────────────────
  KEYS: ['macro_themes', 'geo_risks', 'shipping_status', 'intel_ticker', 'macro_regime'],

  getContentStatus() {
    const d = today()
    return this.KEYS.map((key) => {
      const fresh = readDay(key, d)
      if (fresh) return { key, kind: 'ai', status: 'today' }
      return { key, kind: 'ai', status: readDay(key, yesterday()) ? 'yesterday' : 'none' }
    })
  },

  clearCache() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(AI_CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k))
    } catch { /* best effort */ }
  },

  // Warms anything not already generated today. Sequential with a small gap
  // rather than parallel: five concurrent completions is a burst that buys
  // nothing when the results are cached for the rest of the day anyway.
  async refreshAll() {
    const missing = this.KEYS.filter((k) => !readDay(k, today()))
    if (!missing.length) return { refreshed: 0, skipped: this.KEYS.length }
    let refreshed = 0
    for (const key of missing) {
      try {
        if (key === 'macro_themes') await this.getMacroThemes()
        if (key === 'geo_risks') await this.getGeopoliticalRisks()
        if (key === 'shipping_status') await this.getShippingStatus()
        if (key === 'intel_ticker') await this.getIntelTicker()
        if (key === 'macro_regime') await this.getMacroRegime()
        refreshed += 1
        await new Promise((r) => setTimeout(r, 400))
      } catch { /* individual failures already logged and cached-through */ }
    }
    return { refreshed, skipped: this.KEYS.length - missing.length }
  },
}

export default aiContentService
