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

// FALLBACK: shown only when AI unavailable
// Contains NO specific figures by design
// Last reviewed: 2026-09-06
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
  { title: 'RBA HOLDING ABOVE NEUTRAL', category: 'RBA',
    summary: 'The RBA is holding the cash rate above neutral with headline inflation still above its target band. The Board has signalled patience rather than a near-term move in either direction.',
    analysis: 'The Board has paused after an extended tightening phase rather than declaring it finished. Inflation has moderated from its peak but has not yet settled inside the target band, so the hold reads as caution rather than a pivot, and the statement language has stayed deliberately non-committal about what comes next.\n\nThe drivers to watch are the quarterly CPI prints and the labour market. Unemployment drifting higher would strengthen the case for staying on hold and eventually easing; a reacceleration in services inflation or a fresh energy shock would reopen the question of further tightening. Wage growth sits between the two as the variable the Board watches most closely.\n\nFor Australian investors an extended hold is broadly neutral, and mildly supportive for the rate-sensitive parts of the market — REITs, retailers and the banks — that had been pricing further increases. The AUD should stay range-bound against the USD unless the Fed moves first, which would reopen the rate-differential trade.',
    impact: 'NEUTRAL', impactNote: 'Neutral for equities, mildly supportive for rate-sensitives' },

  { title: 'FED PATIENT, MARKET IMPATIENT', category: 'FED',
    summary: 'US policy remains restrictive while markets continue to price an easing cycle earlier than the Fed itself has guided. That gap between pricing and guidance is the live tension.',
    analysis: 'The Fed has held policy in restrictive territory while describing the balance of risks between inflation and employment as more even than it was through the tightening cycle. Markets have consistently run ahead of that language, pricing cuts sooner and faster than the dot plot implies — a pattern that has repeated for several quarters and been repeatedly disappointed.\n\nPayrolls and CPI remain the two prints that move this. A soft employment report pulls expectations forward sharply; a firm inflation read pushes the Fed back toward higher-for-longer framing. Fed funds futures are the cleanest real-time read on where that balance sits.\n\nFor Australian investors, Fed easing tends to weaken the USD and support AUD/USD, and has historically been a tailwind for ASX growth names sensitive to global discount rates. It also narrows the policy gap between the RBA and the Fed, which matters for capital flows into Australian bonds.',
    impact: 'MIXED', impactNote: 'Direction depends on which way the data breaks' },

  { title: 'CHINA DEMAND SOFT', category: 'CHINA',
    summary: 'Chinese manufacturing activity has been subdued and the property sector remains under stress. Stimulus has been targeted rather than broad, which limits the read-across to bulk commodity demand.',
    analysis: 'Chinese factory activity has hovered around the expansion threshold rather than recovering decisively, held back by weak property construction and soft external orders. Beijing has leaned on targeted measures — local-government debt support, selective infrastructure spending — rather than the broad fiscal expansion seen in earlier downturns.\n\nThe property sector is the variable that matters most. New-home sales and developer credit conditions drive steel output, and steel output drives iron ore. A genuinely large stimulus package would be the clearest bullish catalyst; continued targeted measures leave the trade where it is.\n\nFor Australia this runs straight through Materials and Energy, given China\'s position as the dominant buyer of iron ore, coal and LNG. Sustained weakness without a matching policy response pressures bulk commodity prices, the ASX\'s heavily weighted mining majors, and the AUD as a commodity-linked currency.',
    impact: 'BEARISH', impactNote: 'Bearish Materials and Energy, a headwind for the ASX' },

  { title: 'AI INFRASTRUCTURE BUILDOUT', category: 'GLOBAL',
    summary: 'Hyperscaler capital spending on AI infrastructure remains the dominant driver of global tech earnings. Australian direct exposure is limited; the indirect effects are not.',
    analysis: 'Data-centre construction and AI hardware demand have continued to absorb an unusually large share of global technology capex, with the largest cloud providers guiding to multi-year commitments rather than single-year budgets. That visibility is what has sustained the trade well beyond the point sceptics expected it to break.\n\nThe leading indicator is hyperscaler capex guidance each earnings season, not any single chipmaker\'s results. A deceleration in combined capex plans would be the first genuine crack in the narrative, and would show up there before it showed up in semiconductor revenue.\n\nDirect ASX exposure to this theme is thin — there are no large local AI infrastructure players. The indirect channels matter more: US technology strength supports global risk appetite and superannuation returns through international equity allocations, and the electricity demand from data-centre growth is a slow-building tailwind for Australian LNG and uranium exporters.',
    impact: 'BULLISH', impactNote: 'Bullish global tech, largely indirect for the ASX' },

  { title: 'SHIPPING LANE RISK PERSISTS', category: 'GEOPOLITICAL',
    summary: 'Red Sea transits remain disrupted with carriers routing around southern Africa, and Middle East tensions continue to carry an energy risk premium.',
    analysis: 'Commercial shipping through the Red Sea has stayed well below normal levels, with major carriers continuing to route around the Cape of Good Hope. Longer voyages absorb vessel capacity, which keeps effective global container supply tighter than the headline fleet count suggests and leaves freight rates sensitive to any further disruption.\n\nThe variables to watch are whether transits normalise and whether tensions spread to affect the Strait of Hormuz, which would have a far larger effect on energy markets than the Red Sea alone. Both have repeatedly moved on short notice, so positioning around either has been costly.\n\nFor Australian investors this transmits through energy prices and freight costs. Elevated energy prices complicate the inflation picture the RBA is working against, which is a headwind for rate-sensitive equities, while supporting the ASX Energy sector. Higher freight costs weigh on import-dependent retailers.',
    impact: 'MIXED', impactNote: 'Supports Energy, pressures retail and rate-sensitives' },

  { title: 'AUD TIED TO CHINA AND THE FED', category: 'COMMODITIES',
    summary: 'The Australian dollar continues to trade as a proxy for Chinese demand and the RBA-Fed policy gap. Neither driver has resolved decisively in either direction.',
    analysis: 'The AUD has been caught between two forces that have largely offset each other: soft Chinese industrial demand weighing on the commodity complex, and expectations of Fed easing weighing on the USD. The result has been range-trading rather than a trend, with iron ore and rate-differential news the two things that reliably move it.\n\nA decisive break higher would likely need both a genuine Chinese demand recovery and a confirmed Fed easing cycle — stimulus announcements alone have not been enough. A break lower would most likely come from a deterioration in Chinese construction activity feeding through to bulk commodity prices.\n\nA stronger AUD is a headwind for the ASX\'s large cohort of offshore earners, whose foreign revenue translates into fewer Australian dollars, and for exporters generally. It supports importers and the purchasing power of Australians buying offshore. It also tends to correlate with, rather than cause, broader risk-on conditions in Australian equities.',
    impact: 'MIXED', impactNote: 'Good for importers, a drag on offshore earners' },
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
