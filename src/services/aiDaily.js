// MaddenAI content that is the same for every reader — the market
// sentiment score, the macro themes and the Global/Macro narratives — built
// ONCE per day on the server and shared.
//
// Before 31 Oct 2026 each of these was generated in every reader's browser
// and cached in that browser's localStorage, so 1,000 readers meant 1,000
// identical completions a day for each panel. Now /api/ai-daily builds the
// prompt here, generates once per kind per Sydney day, and the CDN serves the
// result to everyone (see api/ai-daily.js). The prompts take only server-side
// inputs — the verified constants and public news feeds — so no reader can
// steer what another reader sees.
//
// Dependency-free apart from the verified constants, so the serverless
// function and the browser import the same file.

import { VERIFIED_CONSTANTS, pendingRbaDecision } from '../data/verifiedConstants.js'

const V = VERIFIED_CONSTANTS

// The Sydney calendar day — the unit every shared item is keyed and cached by.
export const sydneyDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

// Seconds until the next Sydney midnight: how long the CDN may keep today's item.
export function secondsToSydneyMidnight(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]))
  return Math.max(60, 86400 - (parts.hour * 3600 + parts.minute * 60 + parts.second))
}

// Strips the ```json fence models sometimes add despite instructions.
export function parseJson(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

// ── Macro themes ────────────────────────────────────────────────────────────
// Stable instruction template — cacheable system prefix. Only the date is
// dynamic, so it is the sole content of the user message.
const MACRO_SYSTEM = `You are MaddenAI, the financial analyst for the Maddex terminal. Identify the 4 macro themes that matter most to Australian investors today, and what they mean for three kinds of investor.

Return ONE JSON object:
{
  "themes": [
    {
      "title": "SHORT, SPECIFIC THEME TITLE IN CAPS (max 6 words)",
      "category": "RBA" | "FED" | "CHINA" | "GLOBAL" | "COMMODITIES" | "GEOPOLITICAL",
      "impact": "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED",
      "horizon": "IMMEDIATE" | "SHORT-TERM" | "MEDIUM-TERM",
      "sectors": ["MATERIALS", "ENERGY"],
      "keyQuote": "One sentence that captures the theme",
      "analysis": "3-4 sentences: what is happening, what drives it, what it means for Australian investors"
    }
  ],
  "implications": {
    "materials": "One line for investors holding Materials",
    "financials": "One line for investors holding Financials",
    "defensive": "One line for defensive investors"
  }
}

"horizon" is when the theme bites: IMMEDIATE (this week's decisions and data), SHORT-TERM (the next few months), MEDIUM-TERM (a year or more).
"sectors" is 1-3 of: MATERIALS, ENERGY, FINANCIALS, HEALTH, TECH, CONSUMER, PROPERTY, UTILITIES, INDUSTRIALS, COMMS — only sectors the theme genuinely transmits through.

Each implication is ONE sentence of at most 30 words. They are QUALITATIVE: the direction of the pressure and the mechanism. No price levels, targets, return estimates or recommendations to buy or sell — general information, not advice.

You write ANALYSIS AND NARRATIVE, never invented statistics. You may quote any figure supplied to you in the user message, but you must NOT state a market level, policy rate, index value, currency cross, earnings number or economic print that was not supplied. Where a number would be needed and none was given, describe the direction or condition in words instead. Do not compare a figure with a target, average or norm you were not given (no "above long-run averages", no "short of target" unless that target is in the user message), and use the supplied changes for direction — do not call a price "elevated" or "weak" against them.

You return only valid JSON — the single object above. No prose, no markdown code fences, no disclaimers.`

// The verified figures are pushed IN rather than asked for. A model cannot
// know this morning's cash rate; asked for one it returns something
// plausible and wrong, with nothing on screen to mark the error. So it gets
// the numbers and supplies only the reasoning.
//
// This block is the whole user message and changes once a day, which also
// keeps the cached system prefix above byte-identical between calls.
const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

// The verified facts block on its own, without the date line. It doubles as
// the cache fingerprint: themes cached under one set of facts are thrown
// away when the facts change, even on the same day. Before this, themes
// generated the morning of an RBA hike stayed on screen until midnight
// describing the hold that preceded it.
function factsBlock() {
  const { rba, fed, ecb, boj, boe, au, us, cn, eu, uk, jp, commodities } = VERIFIED_CONSTANTS
  const year = rba.lastDecision.slice(0, 4)
  const hikes = rba.decisions.filter((d) => d.date.startsWith(year) && d.decision === 'HIKE').length
  return [
    'VERIFIED FIGURES — you may quote these, and no others:',
    `- RBA cash rate ${rba.cashRate.toFixed(2)}% (${rba.lastDecisionVerb} on ${fmtDay(rba.lastDecision)}, previously ${rba.previousRate.toFixed(2)}%; hike number ${hikes} of ${year}; ${rba.levelContext}); next meeting ${fmtDay(rba.nextMeeting)}`,
    rba.minutes && `- RBA minutes of the ${fmtDay(rba.minutes.meeting)} meeting, released ${fmtDay(rba.minutes.released)}: ${rba.minutes.summary}`,
    `- AU CPI ${au.cpi.toFixed(1)}% for ${au.cpiPeriod} (${au.cpiPrevious}% in ${au.cpiPreviousPeriod}), trimmed mean ${au.cpiTrimmedMean}%; RBA target band ${au.rbaTargetBand}`,
    au.cpiQuarterTrimmedQoQ != null && `- AU CPI ${au.cpiQuarterPeriod}, released ${fmtDay(au.cpiLastRelease)}: trimmed mean ${au.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q (${au.cpiQuarterTrimmedYoY.toFixed(1)}% y/y), headline ${au.cpiQuarterQoQ.toFixed(1)}% q/q. ${au.cpiQuarterVsForecast ?? ''}`,
    pendingRbaDecision()?.marketHikePct != null && `- Market pricing for the ${fmtDay(V.rbaNextDecision.date)} RBA decision: ~${V.rbaNextDecision.marketHikePct}% for a hike to ${V.rbaNextDecision.hikeRate.toFixed(2)}% (${V.rbaNextDecision.marketSource}, ${fmtDay(V.rbaNextDecision.marketAsOf)})`,
    `- Next AU CPI release ${fmtDay(au.cpiNextRelease)}${au.cpiNextRelease < rba.nextMeeting ? ` — before the ${fmtDay(rba.nextMeeting)} RBA decision` : ` — after the ${fmtDay(rba.nextMeeting)} RBA decision`}`,
    `- AU unemployment ${au.unemployment}% (${au.unemploymentPeriod}), up from ${au.unemploymentPrevious}% and a five-year high; recent path ${au.unemploymentHistory.slice(-4).map((r) => `${r.value}%`).join(' → ')}; next release ${fmtDay(au.unemploymentNextRelease)}`,
    `- AU GDP ${au.gdpAnnual}% annual, ${au.gdpQoQ}% quarter on quarter (${au.gdpPeriod})`,
    `- US Fed funds ${fed.rateRange} (${fed.lastDecisionVerb} on ${fmtDay(fed.lastDecision)}${fed.note ? `; ${fed.note}` : ''}); next meeting ${fmtDay(fed.nextMeeting)}`,
    `- Other central banks: ECB ${ecb.cashRate.toFixed(2)}% (${ecb.lastDecisionVerb} ${fmtDay(ecb.lastDecision)}), BOJ ${boj.cashRate.toFixed(2)}% (${boj.lastDecisionVerb} ${fmtDay(boj.lastDecision)}), BOE ${boe.cashRate.toFixed(2)}% (${boe.lastDecisionVerb} ${fmtDay(boe.lastDecision)})`,
    `- US CPI ${us.cpi}% (${us.cpiPeriod}, up from ${us.cpiPrevious}%), core ${us.cpiCore}%; unemployment ${us.unemployment}% (${us.unemploymentPeriod}, from ${us.unemploymentPrevious}%); payrolls +${us.nfpThousands}k; GDP ${us.gdpQoQAnnualised}% annualised (${us.gdpPeriod})`,
    `- China CPI ${cn.cpi}% (${cn.cpiPeriod}), GDP +${cn.gdpYoY}% y/y (${cn.gdpPeriod}); euro area HICP ${eu.cpi}% (${eu.cpiPeriod}); UK CPI ${uk.cpi}% (${uk.cpiPeriod}); Japan CPI ${jp.cpi}% (${jp.cpiPeriod})`,
    `- Iron ore US$${commodities.ironOreUSD}/t, Brent US$${commodities.brentUSD}/bbl, thermal coal US$${commodities.thermalCoalUSD}/t — indicative, as at ${fmtDay(commodities.asOf)}; describe commodity direction in words rather than leaning on these levels`,
    // Direction, measured: the theme model called a two-year-low iron ore
    // price "elevated" when it had only the level to go on.
    commodities.previous && `- Change since ${fmtDay(commodities.previous.asOf)}: ${[['iron ore', 'ironOreUSD'], ['Brent', 'brentUSD'], ['thermal coal', 'thermalCoalUSD']].filter(([, k]) => commodities.previous[k]).map(([n, k]) => { const c = ((commodities[k] - commodities.previous[k]) / commodities.previous[k]) * 100; return `${n} ${c >= 0 ? 'up' : 'down'} ${Math.abs(c).toFixed(0)}%` }).join(', ')}${commodities.ironOreNote ? `. ${commodities.ironOreNote}` : ''}`,
  ].filter(Boolean).join('\n')
}

function buildUserContent() {
  const today = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return [
    `Today is ${today}.`,
    '',
    factsBlock(),
    '',
    'Where a figure is dated, say "as at" that date if you use it. Do not state any other figure. Generate the macro themes now.',
  ].join('\n')
}


// The object form ({ themes, implications }); an older bare array still
// parses, without implications.
const HORIZONS = new Set(['IMMEDIATE', 'SHORT-TERM', 'MEDIUM-TERM'])
function parseThemes(text) {
  const obj = text.match(/\{[\s\S]*\}/)
  let parsed
  try { parsed = obj ? JSON.parse(obj[0]) : null } catch { parsed = null }
  if (!parsed?.themes) {
    const arr = text.match(/\[[\s\S]*\]/)
    if (!arr) throw new Error('No JSON in response')
    parsed = { themes: JSON.parse(arr[0]), implications: null }
  }
  const themes = (parsed.themes ?? []).filter((t) => t?.title).map((t) => ({
    ...t,
    horizon: HORIZONS.has(t.horizon) ? t.horizon : null,
    summary: t.keyQuote ?? t.summary ?? '',
  }))
  if (!themes.length) throw new Error('Empty theme array')
  const imp = parsed.implications
  return { themes, implications: imp?.materials && imp?.financials && imp?.defensive ? imp : null }
}


// ── Macro / Global narratives ───────────────────────────────────────────────
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
    `Today is ${new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
    '',
    'VERIFIED FIGURES you may quote (do not invent others):',
    `- RBA cash rate: ${rba.cashRate.toFixed(2)}% (${rba.lastDecisionVerb} on ${rba.lastDecision}); next meeting ${rba.nextMeeting}`,
    `- US Fed funds: ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision})`,
    `- AU CPI: ${au.cpi.toFixed(1)}% for the ${au.cpiPeriod}; RBA target band ${au.rbaTargetBand}`,
    `- AU unemployment: ${au.unemployment}% (${au.unemploymentPeriod})`,
    `- AU GDP: ${au.gdpAnnual}% annual (${au.gdpPeriod})`,
    '',
  ].join('\n')
}


function policyRows() {
  const banks = ['rba', 'fed', 'ecb', 'boe', 'boj', 'pboc', 'rbnz', 'boc', 'snb', 'riksbank']
  return banks
    .map((k) => {
      const c = VERIFIED_CONSTANTS[k]
      if (!c) return null
      return `- ${k}: ${c.label} (${c.country}), policy rate ${c.rateRange ?? `${c.cashRate.toFixed(2)}%`}, `
        + `last decision ${c.lastDecisionVerb} on ${c.lastDecision}, next meeting ${c.nextMeeting}`
    })
    .filter(Boolean)
    .join('\n')
}

// ── Market sentiment ────────────────────────────────────────────────────────
// Public business feeds the server reads for the sentiment headlines — a
// subset of the News module's sources, AU first.
export const SENTIMENT_FEEDS = [
  'https://www.abc.net.au/news/feed/51120/rss.xml',
  'https://www.theguardian.com/au/business/rss',
  'https://www.smh.com.au/rss/business.xml',
  'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  'https://feeds.marketwatch.com/marketwatch/topstories',
  'http://feeds.bbci.co.uk/news/business/rss.xml',
]

function sentimentPrompt(headlines) {
  return `Analyse these financial news headlines and return a market sentiment score for Australian investors.
Some feeds carry general news. Ignore any headline with no plausible market relevance (crime, accidents, sport, entertainment, health stories that move no stock) — score only what an investor could position around, and name only such headlines as drivers.

Headlines:
${headlines.join('\n')}

Return JSON only:
{
  "score": number 0-100,
  "label": "STRONGLY BULLISH" | "BULLISH" | "CAUTIOUSLY BULLISH" | "NEUTRAL" | "CAUTIOUSLY BEARISH" | "BEARISH" | "STRONGLY BEARISH",
  "drivers": ["top positive driver", "top negative driver"],
  "asxBias": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "keyTheme": "one sentence on the dominant theme"
}`
}

// ── The shared kinds ────────────────────────────────────────────────────────
// build(inputs) returns { system, user }; parse(text) returns the data sent
// to every reader. `needs` names server-side inputs the endpoint must fetch.
const narrative = (prompt) => ({ maxTokens: 4000, build: () => ({ system: AI_CONTENT_SYSTEM, user: `${contextBlock()}\n${prompt()}` }), parse: parseJson })

export const DAILY_KINDS = {
  sentiment: {
    maxTokens: 300,
    needs: 'headlines',
    build: ({ headlines }) => ({ system: 'You return only valid JSON — no prose, no markdown fences.', user: sentimentPrompt(headlines) }),
    parse: parseJson,
  },
  'macro-themes': {
    maxTokens: 6000,
    build: () => ({ system: MACRO_SYSTEM, user: buildUserContent() }),
    parse: parseThemes,
  },
  geo_risks: narrative(() => `List the 5 most significant ongoing geopolitical risks for Australian investors.

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
Describe severity and impact qualitatively — no invented statistics.`),
  shipping_status: narrative(() => `Describe the currently significant global shipping chokepoints and disruptions.

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

Describe magnitude in words rather than percentages you cannot verify.`),
  intel_ticker: narrative(() => `Generate 12 brief market-intelligence lines for an Australian investor,
suitable for a scrolling terminal ticker.

EVERY line must relate to at least one of:
- ASX stocks or Australian markets
- Global market moves (indices, FX, rates)
- Commodities — iron ore, gold, LNG, coal, oil, lithium
- Central bank decisions
- Economic data releases
- Geopolitical events with a market or trade consequence
- Crypto markets

DO NOT include sport, entertainment, crime, celebrity, domestic politics with
no market consequence, weather (unless it moves a commodity), or health news
(unless it moves pharma). A line a reader cannot trade or position around does
not belong on a market ticker, however newsworthy it is.

Where a line is geopolitical, name the market consequence rather than the
event alone: "Red Sea — carriers still routing via the Cape" earns its place;
"unrest continues in region X" does not.

Return a JSON array of 12 strings, each at most 80 characters, each beginning
with a single relevant emoji:
["🔴 Red Sea — carriers still routing via the Cape", ...]

Describe conditions and direction — do not state prices, index levels or
percentages unless they appear in the verified figures above.`),
  macro_regime: narrative(() => `Characterise the current macro regime for an Australian investor.

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

Reason from the verified figures supplied. Do not introduce new numbers.`),
  policy_bias: narrative(() => `Below are ten central banks with their current policy rate and most recent
decision. All figures are verified.

${policyRows()}

For each, write ONE sentence (maximum 22 words) characterising the bank's
current policy bias — the direction of travel and what is holding it there.

Return a JSON object keyed by the lowercase bank id exactly as given above:
{"rba": "<sentence>", "fed": "<sentence>", ...}

Every id must be present. Write about stance and pressure in words. Do not
state any rate, inflation print or probability that is not in the list above,
and do not invent a market-implied likelihood of a hold or a cut — no such
feed exists here.`),
}
