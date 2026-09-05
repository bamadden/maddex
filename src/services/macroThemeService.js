// ─── AI-generated macro themes ──────────────────────────────────────────────
// Hardcoded "current macro theme" copy goes stale the moment the news cycle
// moves on. Instead, MaddenAI (the same Claude call used elsewhere in the
// terminal) generates 6 themes once per day, cached in localStorage under a
// date-stamped key so every user gets one fresh generation per day and every
// subsequent module open that day is instant.

import { askClaude } from './api'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'

const CACHE_PREFIX  = 'macro_themes_'
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24h safety net if the date key ever collides across a rollover

function todayKey() {
  return CACHE_PREFIX + new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time
}

// Used on first load, while the AI call is in flight, and as the permanent
// fallback if the call or the JSON parse fails — never leave the module blank.
// As at 22 August 2026.
export const FALLBACK_THEMES = [
  { title: 'RBA ON HOLD', category: 'RBA',
    summary: 'RBA held at 4.35% on 12 August, citing softer June-quarter CPI of 3.8%. Next meeting 16 September — the softer print supports an extended hold rather than a near-term move either way.',
    analysis: 'The Board\'s August statement leaned on the softer June-quarter CPI print (3.8% YoY, down from 4.1%) as the primary justification for holding rather than extending the 2026 hiking cycle. That inflation read is still comfortably above the RBA\'s 2-3% target band, so this is a pause born of caution rather than a signal that the tightening cycle is over.\n\nThe key drivers to watch into the 16 September meeting are the Q3 CPI print (due late October, after the meeting) and labour-market data — unemployment has been ticking up gradually, which if it continues would strengthen the case for the Board to stay on hold rather than resume hiking. Energy prices, still elevated from the Middle East conflict earlier in the year, remain the wildcard that could reverse this.\n\nFor Australian investors, an extended hold is broadly neutral to mildly supportive for rate-sensitive sectors (REITs, retail, banks) that have been pricing in further tightening. The AUD should stay range-bound near current levels unless the Fed moves first, which would reopen the rate-differential trade.',
    impact: 'NEUTRAL', impactNote: 'Neutral for equities' },
  { title: 'JACKSON HOLE WRAP', category: 'FED',
    summary: 'Powell spoke 22 August and signalled gradual policy normalisation. Markets are now pricing a 35% chance of a cut at the 17 September FOMC decision, up from earlier in the month.',
    analysis: 'Powell\'s Jackson Hole remarks were read as more dovish than his recent FOMC press conferences, emphasising that policy remains "meaningfully restrictive" and that the balance of risks between inflation and employment has shifted. That framing is what moved market pricing for a September cut from the low-20s into the mid-30s within the following 48 hours.\n\nThe drivers into the 17 September decision are the August payrolls report and the next CPI print — a soft jobs number would likely push cut odds well above 50%, while a hot inflation read would push the Fed back toward "higher for longer" language. Fed funds futures are the cleanest real-time read on how this is shifting.\n\nFor Australian investors, a Fed cut (even a modest one) tends to weaken the USD and support AUD/USD, and historically has been a tailwind for ASX-listed growth and tech-adjacent names that are sensitive to global discount rates. It would also narrow the RBA-Fed policy gap, which matters for capital flows into Australian bonds.',
    impact: 'MIXED', impactNote: 'Mildly bullish for risk assets' },
  { title: 'CHINA SLOWDOWN', category: 'CHINA',
    summary: 'Manufacturing PMI has held below 50 for a 5th consecutive month. Beijing has announced stimulus measures, but they remain modest relative to the scale of the slowdown.',
    analysis: 'China\'s manufacturing PMI has now printed below the 50 expansion/contraction threshold for five straight months, driven by weak property-sector activity and soft export orders as global demand cools. Beijing\'s stimulus response so far has been targeted (local-government debt swaps, modest infrastructure spending) rather than the broad-based fiscal push seen in prior slowdowns.\n\nThe key driver to watch is whether the property sector stabilises — new-home sales and developer credit stress remain the biggest swing factors for domestic demand, and by extension for steel and iron ore consumption. A more aggressive stimulus package, if announced, would be the clearest bullish catalyst for the trade.\n\nFor Australia, this is directly relevant to the Materials and Energy sectors given China\'s role as the dominant buyer of iron ore, coal, and LNG. Sustained PMI weakness without a matching stimulus response would put downward pressure on bulk commodity prices and, by extension, on the ASX 200\'s heavily-weighted mining majors and on AUD, which trades as a commodity-linked currency.',
    impact: 'BEARISH', impactNote: 'Bearish Materials, Energy, and the ASX' },
  { title: 'AI CAPEX SUPERCYCLE', category: 'GLOBAL',
    summary: 'NVIDIA earnings beat consensus by 18%. US tech capex is at record highs, with AI infrastructure buildout accelerating through 2026-2027.',
    analysis: 'NVIDIA\'s latest quarter beat consensus revenue estimates by roughly 18%, driven by continued hyperscaler demand for AI training and inference hardware. Guidance for the following quarter came in ahead of expectations too, with management citing multi-year data-centre buildout commitments from the largest cloud providers as visibility extending well into 2027.\n\nThe driver to watch is capex guidance from the hyperscalers themselves (Microsoft, Amazon, Google, Meta) each earnings season — their combined capex run-rate is the leading indicator for the whole AI infrastructure trade, more so than any single chipmaker\'s results. Any sign of capex deceleration would be the first crack in this narrative.\n\nFor Australian investors, the direct ASX exposure to this theme is limited (no major AI infrastructure players locally), but the indirect effects matter: US tech strength supports global risk appetite and superannuation fund returns via international equity allocations, and rising global electricity demand from data centres is a incremental long-term tailwind for Australian LNG and uranium exporters.',
    impact: 'BULLISH', impactNote: 'Bullish Tech, neutral for the ASX' },
  { title: 'IRAN CEASEFIRE PROGRESS', category: 'GEOPOLITICAL',
    summary: 'Oil is down 8% from its July peak as ceasefire talks advance in the Middle East. If sustained, this removes a key inflation pressure that had been driving RBA hawkishness.',
    analysis: 'Brent crude has retreated roughly 8% from its July peak as ceasefire negotiations in the Middle East have progressed further than markets initially expected, easing the risk premium that had been built into energy prices since the conflict escalated earlier in the year.\n\nThe driver to watch is whether the ceasefire holds through the coming weeks — energy markets have been whipsawed by false starts on this story before, and a breakdown in talks would quickly reprice the geopolitical risk premium back into oil. Shipping-lane security through the Strait of Hormuz remains the other key variable, given its outsized effect on both oil price and freight costs.\n\nFor Australian investors, sustained lower energy prices ease the inflation pressure that has been a key input into the RBA\'s hawkish stance this year, which is constructive for rate-sensitive equities broadly. It is a headwind for the ASX Energy sector specifically, but a tailwind for consumer-facing sectors and for household budgets via lower fuel costs.',
    impact: 'BULLISH', impactNote: 'Bullish risk assets, bearish Energy' },
  { title: 'AUD AT RESISTANCE', category: 'COMMODITIES',
    summary: 'AUD/USD is trading near 0.6520, close to a 6-month high. China stimulus hopes are supporting commodity-linked FX alongside stabilising iron ore prices.',
    analysis: 'AUD/USD is trading near a 6-month high around 0.6520, supported by a combination of stabilising iron ore prices, renewed China stimulus speculation, and a softer USD backdrop as Fed cut expectations build. The pair has approached this resistance level twice in the past year without a sustained break higher.\n\nThe drivers to watch are the RBA-Fed rate differential (a Fed cut would widen it in AUD\'s favour) and the iron ore price itself, which has been range-bound in the mid-$90s to low-$100s per tonne. A confirmed break above resistance would likely require both a dovish Fed pivot and a genuine China demand recovery, not just stimulus announcements.\n\nFor Australian investors, a stronger AUD is a headwind for the ASX\'s large cohort of offshore-earning companies (whose foreign revenue translates back to fewer AUD) and for exporters generally, but it\'s supportive for importers and for the purchasing power of Australians travelling or buying offshore goods. It also tends to correlate with — rather than cause — broader risk-on conditions in Australian equities.',
    impact: 'MIXED', impactNote: 'Good for imports, negative for AUD earners' },
]

// Stable instruction template — cacheable system prefix. Only the date is
// dynamic, so it is the sole content of the user message.
const MACRO_SYSTEM = `You are MaddenAI, the financial analyst for the Maddex terminal. Generate 6 current macro themes relevant to Australian investors.

For each theme return JSON:
{
  "title": "THEME TITLE IN CAPS",
  "summary": "2-3 sentence summary of the current situation",
  "analysis": "3-4 paragraph deep-dive (separated by \\n\\n): context and how we got here, key drivers to watch, and the outlook/implications for Australian investors",
  "impact": "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED",
  "impactNote": "Impact on ASX/AUD in one line",
  "category": "RBA" | "FED" | "CHINA" | "GLOBAL" | "COMMODITIES" | "GEOPOLITICAL"
}

Base themes on real current macro conditions as of today. Focus on: RBA policy, Fed policy, the China economy, commodities (iron ore, oil, gold), AUD strength, and geopolitical risks affecting Australia.

You write ANALYSIS AND NARRATIVE, never invented statistics. You may quote any figure supplied to you in the user message, but you must NOT state a market level, policy rate, index value, currency cross, earnings number or economic print that was not supplied. Where a number would be needed and none was given, describe the direction or condition in words instead.

You return only valid JSON. No prose, no markdown code fences, no disclaimers.
Return ONLY a JSON array of 6 theme objects.`

// The verified figures are pushed IN rather than asked for. A model cannot
// know this morning's cash rate; asked for one it returns something
// plausible and wrong, with nothing on screen to mark the error. So it gets
// the numbers and supplies only the reasoning.
//
// This block is the whole user message and changes once a day, which also
// keeps the cached system prefix above byte-identical between calls.
function buildUserContent() {
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const { rba, fed, au, us, cn, commodities } = VERIFIED_CONSTANTS
  return [
    `Today is ${today}.`,
    '',
    'VERIFIED FIGURES — you may quote these, and no others:',
    `- RBA cash rate ${rba.cashRate}% (${rba.lastDecisionVerb} on ${rba.lastDecision}, previously ${rba.previousRate}%); next meeting ${rba.nextMeeting}`,
    `- US Fed funds ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision}); next meeting ${fed.nextMeeting}`,
    `- AU CPI ${au.cpi}% for the ${au.cpiPeriod}, trimmed mean ${au.cpiTrimmedMean}%; RBA target band ${au.rbaTargetBand}`,
    `- AU unemployment ${au.unemployment}% (${au.unemploymentPeriod}); GDP ${au.gdpAnnual}% annual (${au.gdpPeriod})`,
    `- US CPI ${us.cpi}% (${us.cpiPeriod}); US unemployment ${us.unemployment}%`,
    `- China CPI ${cn.cpi}%; manufacturing PMI ${cn.pmiManufacturing}`,
    `- Iron ore US$${commodities.ironOreUSD}/t; Brent US$${commodities.brentUSD}/bbl; thermal coal US$${commodities.thermalCoalUSD}/t`,
    '',
    'Do not state any other figure. Generate the macro themes now.',
  ].join('\n')
}

function readCache() {
  try {
    const raw = localStorage.getItem(todayKey())
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.cachedAt > CACHE_MAX_AGE) return null
    return parsed.themes
  } catch {
    return null
  }
}

function writeCache(themes) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify({ cachedAt: Date.now(), themes }))
  } catch {
    // localStorage unavailable/full — cache is a nice-to-have, not required
  }
}

function parseThemes(text) {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in response')
  const themes = JSON.parse(match[0])
  if (!Array.isArray(themes) || !themes.length) throw new Error('Empty theme array')
  return themes
}

// Returns { themes, source: 'cache' | 'live' | 'fallback' }.
export async function getMacroThemes() {
  const cached = readCache()
  if (cached) return { themes: cached, source: 'cache' }
  try {
    const { text } = await askClaude(
      [{ role: 'user', content: buildUserContent() }],
      null,
      { systemPrompt: MACRO_SYSTEM },
    )
    const themes = parseThemes(text)
    writeCache(themes)
    return { themes, source: 'live' }
  } catch {
    return { themes: FALLBACK_THEMES, source: 'fallback' }
  }
}
