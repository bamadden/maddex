// ─── AI-generated macro themes ──────────────────────────────────────────────
// Hardcoded "current macro theme" copy goes stale the moment the news cycle
// moves on. Instead, MaddenAI (the same Claude call used elsewhere in the
// terminal) generates 6 themes once per day, cached in localStorage under a
// date-stamped key so every user gets one fresh generation per day and every
// subsequent module open that day is instant.

import { askClaude } from './api'
import { VERIFIED_CONSTANTS, pendingRbaDecision } from '../data/verifiedConstants'

const V = VERIFIED_CONSTANTS
const releaseDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })

// v2: the themes became an object (themes + implications); a v1 cached
// array would otherwise be read back in the wrong shape.
const CACHE_PREFIX  = 'macro_themes_v2_'
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24h safety net if the date key ever collides across a rollover

function todayKey() {
  return CACHE_PREFIX + new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time
}

// FALLBACK: shown only when AI unavailable
// Contains NO specific figures by design
// Last reviewed: 2026-10-19 (rewritten for the September hike — the RBA and
// Fed themes still described a hold and a patient Fed)
//
// Every number is gone from this block on purpose. These themes render when
// the AI call fails, which is exactly when nobody is watching them, and a
// hardcoded "AUD/USD near 0.6520" or "NVIDIA beat by 18%" stays on screen
// long after it stopped being true — presented with the same confidence as a
// live figure and with no date attached to give the reader pause.
//
// So this is directional prose only: the shape of each situation, which
// changes on the scale of quarters, rather than its level, which changes
// daily. "Iron ore has been supported by Chinese infrastructure demand" ages
// gracefully in a way that "iron ore at US$98/t, up 2.3%" cannot.
//
// If a figure is genuinely needed here, interpolate it from
// VERIFIED_CONSTANTS — never type one in. The panel shows a DEFAULT badge
// whenever this content is what the reader is seeing.
export const FALLBACK_THEMES = [
  { title: 'RBA TIGHTENING INTO A SOFTER ECONOMY', category: 'RBA', impact: 'BEARISH', horizon: 'IMMEDIATE',
    sectors: ['FINANCIALS', 'PROPERTY', 'CONSUMER'],
    keyQuote: `The RBA has raised the cash rate to ${V.rba.cashRate.toFixed(2)}% and the September-quarter inflation print came in above its own forecast, with the ${releaseDay(V.rba.nextMeeting)} decision next.`,
    analysis: 'Inflation has re-accelerated this year while growth has slowed and unemployment has risen, which leaves the Board weighing inflation against a softening economy rather than choosing between them. Its statements keep further increases explicitly on the table. Rate-sensitive sectors carry the most exposure; bank margins benefit up to the point that arrears rise.' },
  { title: 'GLOBAL TIGHTENING CYCLE', category: 'FED', impact: 'BEARISH', horizon: 'SHORT-TERM',
    sectors: ['TECH', 'PROPERTY'],
    keyQuote: 'Several major central banks raised rates in September after inflation stopped falling short of target, reversing the easing priced through 2025.',
    analysis: 'Energy prices have done much of the work in pushing inflation back up across economies. A synchronised tightening cycle lifts global discount rates together, which weighs on long-duration growth stocks and listed property. It also narrows the rate-differential cushion that usually steadies a currency.' },
  { title: 'CHINA DEMAND AND THE COMMODITY CYCLE', category: 'CHINA', impact: 'MIXED', horizon: 'MEDIUM-TERM',
    sectors: ['MATERIALS', 'ENERGY'],
    keyQuote: 'China remains the dominant buyer of Australian iron ore, coal and LNG, and its property sector is still the swing factor for bulk commodity demand.',
    analysis: 'Beijing has leaned on targeted support rather than broad stimulus, which limits the read-across to steel and iron ore. Property construction drives steel output, and steel output drives iron ore. That channel runs straight through the ASX mining majors and, through export receipts, the Australian dollar.' },
  { title: 'ENERGY AND SHIPPING RISK', category: 'GEOPOLITICAL', impact: 'MIXED', horizon: 'SHORT-TERM',
    sectors: ['ENERGY', 'CONSUMER'],
    keyQuote: 'Middle East disruption keeps an energy risk premium in oil and LNG and adds to the inflation pressure central banks are fighting.',
    analysis: 'Higher fuel costs feed directly into consumer prices, as they did in Australia\'s latest CPI, which complicates the RBA\'s task. They support ASX energy producers while raising costs for import-dependent retailers. Shipping disruptions have repeatedly changed on short notice, so the premium can move quickly either way.' },
].map((t) => ({ ...t, summary: t.keyQuote }))

// What the themes above mean for three kinds of investor — qualitative, and
// shown when the AI call is unavailable.
export const FALLBACK_IMPLICATIONS = {
  materials: 'Commodity prices and Chinese demand matter more to miners than the local cash rate; the AUD is the main domestic channel.',
  financials: 'Higher rates tend to widen bank margins, but rising unemployment is the risk to watch through arrears and bad debts.',
  defensive: 'Defensive sectors with steady demand have tended to hold up better in tightening cycles, though bond-like income names compete with higher cash rates.',
}

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
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return [
    `Today is ${today}.`,
    '',
    factsBlock(),
    '',
    'Where a figure is dated, say "as at" that date if you use it. Do not state any other figure. Generate the macro themes now.',
  ].join('\n')
}

function readCache() {
  try {
    const raw = localStorage.getItem(todayKey())
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.cachedAt > CACHE_MAX_AGE) return null
    if (parsed.facts !== factsBlock()) return null   // generated from different facts
    return parsed.result
  } catch {
    return null
  }
}

function writeCache(result) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify({ cachedAt: Date.now(), facts: factsBlock(), result }))
  } catch {
    // localStorage unavailable/full — cache is a nice-to-have, not required
  }
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

// Returns { themes, implications, source: 'cache' | 'live' | 'fallback' }.
// Drops today's cached themes so the next getMacroThemes() call regenerates.
// Exported for the REFRESH control — without this the button would refetch a
// query whose queryFn hands straight back the same cached day.
export function clearMacroThemeCache() {
  try { localStorage.removeItem(todayKey()) } catch { /* storage unavailable */ }
}

export async function getMacroThemes() {
  const cached = readCache()
  if (cached) return { ...cached, source: 'cache' }
  try {
    const { text } = await askClaude(
      [{ role: 'user', content: buildUserContent() }],
      null,
      // Six themes of JSON ran past askClaude's 1,024-token default (and past
      // 3,000 with uncapped analysis); cut off, the array never closed,
      // parsing failed, and every load showed FALLBACK_THEMES. Found in the
      // 27 Oct launch audit. Now four themes of 3-4 sentences plus three
      // implication lines — well inside the cap.
      { systemPrompt: MACRO_SYSTEM, maxTokens: 6000 },
    )
    const result = parseThemes(text)
    writeCache(result)
    return { ...result, source: 'live' }
  } catch {
    return { themes: FALLBACK_THEMES, implications: FALLBACK_IMPLICATIONS, source: 'fallback' }
  }
}
