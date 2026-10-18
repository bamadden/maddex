// ─── AI-generated macro themes ──────────────────────────────────────────────
// Hardcoded "current macro theme" copy goes stale the moment the news cycle
// moves on. Instead, MaddenAI (the same Claude call used elsewhere in the
// terminal) generates 6 themes once per day, cached in localStorage under a
// date-stamped key so every user gets one fresh generation per day and every
// subsequent module open that day is instant.

import { askClaude } from './api'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'

const V = VERIFIED_CONSTANTS
const releaseDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })

const CACHE_PREFIX  = 'macro_themes_'
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
  { title: 'RBA STILL TIGHTENING', category: 'RBA',
    summary: `The RBA hiked again in September, to ${V.rba.cashRate.toFixed(2)}%, its fourth increase this year, and the minutes left the door open to more. The ${releaseDay(V.au.cpiNextRelease)} CPI release is the last inflation read before the ${releaseDay(V.rba.nextMeeting)} decision.`,
    analysis: `The Board reversed the 2025 easing cycle through the first half of the year, paused over winter, and moved again in September after inflation re-accelerated. The minutes describe a Board that briefly weighed a pause but judged that cost pressures were broad and that upside risks were already unfolding, and they keep further increases explicitly on the table. That is a tightening bias, not a peak.\n\nTwo releases decide the next step. The CPI on ${releaseDay(V.au.cpiNextRelease)} covers both September and the September quarter, and the trimmed mean matters more than the headline: it has edged up this year rather than fallen. The labour market is the counterweight — unemployment has risen to a five-year high, and a Board raising rates into a softening jobs market is weighing a real trade-off rather than a formality.\n\nFor Australian investors this keeps pressure on the rate-sensitive end of the market: property trusts, consumer discretionary and highly geared companies. Bank margins benefit from higher rates up to the point that arrears rise. A firm CPI print raises the odds of a move on ${releaseDay(V.rba.nextMeeting)}; a soft one, alongside rising unemployment, strengthens the case for a pause.`,
    impact: 'BEARISH', impactNote: 'Headwind for rate-sensitives; banks mixed', sectors: ['FINANCIALS', 'PROPERTY', 'CONSUMER'] },

  { title: 'GLOBAL TIGHTENING RESUMES', category: 'FED',
    summary: 'The Fed, the ECB and the Bank of Japan all raised rates in September, with the Fed moving for the first time since 2023. The easing cycle markets had priced through 2025 has turned.',
    analysis: 'Through 2025 the major central banks were cutting and markets priced more of the same. September broke that pattern: the Fed hiked, unanimously, the ECB raised its deposit rate, and the Bank of Japan continued its slow normalisation. The common thread is inflation that stopped falling before it reached target, with energy prices doing much of the work.\n\nThe variables to watch are US payrolls and CPI ahead of each FOMC meeting, and whether the ECB follows through or treats September as insurance. A synchronised tightening cycle is a different environment from one bank moving alone: it lifts global discount rates together and removes the rate-differential cushion that usually steadies a currency.\n\nFor Australian investors, higher global yields weigh on long-duration growth stocks and on listed property, and they compete with dividend yields across the ASX. A Fed that keeps hiking supports the US dollar, which tends to pull AUD/USD lower even as the RBA tightens at home.',
    impact: 'BEARISH', impactNote: 'Higher global discount rates weigh on growth and property', sectors: ['TECH', 'PROPERTY'] },

  { title: 'CHINA DEMAND SOFT', category: 'CHINA',
    summary: 'Chinese manufacturing activity has been subdued and the property sector remains under stress. Stimulus has been targeted rather than broad, which limits the read-across to bulk commodity demand.',
    analysis: 'Chinese factory activity has hovered around the expansion threshold rather than recovering decisively, held back by weak property construction and soft external orders. Beijing has leaned on targeted measures — local-government debt support, selective infrastructure spending — rather than the broad fiscal expansion seen in earlier downturns.\n\nThe property sector is the variable that matters most. New-home sales and developer credit conditions drive steel output, and steel output drives iron ore. A genuinely large stimulus package would be the clearest bullish catalyst; continued targeted measures leave the trade where it is.\n\nFor Australia this runs straight through Materials and Energy, given China\'s position as the dominant buyer of iron ore, coal and LNG. Sustained weakness without a matching policy response pressures bulk commodity prices, the ASX\'s heavily weighted mining majors, and the AUD as a commodity-linked currency.',
    impact: 'BEARISH', impactNote: 'Bearish Materials and Energy, a headwind for the ASX' , sectors: ["MATERIALS", "ENERGY"] },

  { title: 'AI INFRASTRUCTURE BUILDOUT', category: 'GLOBAL',
    summary: 'Hyperscaler capital spending on AI infrastructure remains the dominant driver of global tech earnings. Australian direct exposure is limited; the indirect effects are not.',
    analysis: 'Data-centre construction and AI hardware demand have continued to absorb an unusually large share of global technology capex, with the largest cloud providers guiding to multi-year commitments rather than single-year budgets. That visibility is what has sustained the trade well beyond the point sceptics expected it to break.\n\nThe leading indicator is hyperscaler capex guidance each earnings season, not any single chipmaker\'s results. A deceleration in combined capex plans would be the first genuine crack in the narrative, and would show up there before it showed up in semiconductor revenue.\n\nDirect ASX exposure to this theme is thin — there are no large local AI infrastructure players. The indirect channels matter more: US technology strength supports global risk appetite and superannuation returns through international equity allocations, and the electricity demand from data-centre growth is a slow-building tailwind for Australian LNG and uranium exporters.',
    impact: 'BULLISH', impactNote: 'Bullish global tech, largely indirect for the ASX' , sectors: ["TECH", "ENERGY", "UTILITIES"] },

  { title: 'SHIPPING LANE RISK PERSISTS', category: 'GEOPOLITICAL',
    summary: 'Red Sea transits remain disrupted with carriers routing around southern Africa, and Middle East tensions continue to carry an energy risk premium.',
    analysis: 'Commercial shipping through the Red Sea has stayed well below normal levels, with major carriers continuing to route around the Cape of Good Hope. Longer voyages absorb vessel capacity, which keeps effective global container supply tighter than the headline fleet count suggests and leaves freight rates sensitive to any further disruption.\n\nThe variables to watch are whether transits normalise and whether tensions spread to affect the Strait of Hormuz, which would have a far larger effect on energy markets than the Red Sea alone. Both have repeatedly moved on short notice, so positioning around either has been costly.\n\nFor Australian investors this transmits through energy prices and freight costs. Elevated energy prices complicate the inflation picture the RBA is working against, which is a headwind for rate-sensitive equities, while supporting the ASX Energy sector. Higher freight costs weigh on import-dependent retailers.',
    impact: 'MIXED', impactNote: 'Supports Energy, pressures retail and rate-sensitives' , sectors: ["ENERGY", "CONSUMER"] },

  { title: 'AUD TIED TO CHINA AND THE FED', category: 'COMMODITIES',
    summary: 'The Australian dollar continues to trade as a proxy for Chinese demand and the RBA-Fed policy gap. With both banks now hiking, neither driver has resolved decisively in either direction.',
    analysis: 'The AUD has been caught between forces that largely offset each other: soft Chinese industrial demand weighing on the commodity complex, and an RBA tightening faster than the Fed, which supports the rate differential. The result has been range-trading rather than a trend, with iron ore and rate-differential news the two things that reliably move it.\n\nA decisive break higher would likely need a genuine Chinese demand recovery on top of the RBA staying ahead of the Fed — stimulus announcements alone have not been enough. A break lower would most likely come from a deterioration in Chinese construction activity feeding through to bulk commodity prices.\n\nA stronger AUD is a headwind for the ASX\'s large cohort of offshore earners, whose foreign revenue translates into fewer Australian dollars, and for exporters generally. It supports importers and the purchasing power of Australians buying offshore. It also tends to correlate with, rather than cause, broader risk-on conditions in Australian equities.',
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
  "category": "RBA" | "FED" | "CHINA" | "GLOBAL" | "COMMODITIES" | "GEOPOLITICAL",
  "sectors": ["MATERIALS", "ENERGY"]
}

"sectors" is 1-3 ASX GICS sector names this theme actually transmits through,
drawn from: MATERIALS, ENERGY, FINANCIALS, HEALTH, TECH, CONSUMER, PROPERTY,
UTILITIES, INDUSTRIALS, COMMS. Name only sectors the analysis genuinely
touches — an empty-ish list is better than tagging every sector on the board.

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
const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

// The verified facts block on its own, without the date line. It doubles as
// the cache fingerprint: themes cached under one set of facts are thrown
// away when the facts change, even on the same day. Before this, themes
// generated the morning of an RBA hike stayed on screen until midnight
// describing the hold that preceded it.
function factsBlock() {
  const { rba, fed, ecb, boj, boe, au, us, cn, commodities } = VERIFIED_CONSTANTS
  const year = rba.lastDecision.slice(0, 4)
  const hikes = rba.decisions.filter((d) => d.date.startsWith(year) && d.decision === 'HIKE').length
  return [
    'VERIFIED FIGURES — you may quote these, and no others:',
    `- RBA cash rate ${rba.cashRate.toFixed(2)}% (${rba.lastDecisionVerb} on ${fmtDay(rba.lastDecision)}, previously ${rba.previousRate.toFixed(2)}%; hike number ${hikes} of ${year}; ${rba.levelContext}); next meeting ${fmtDay(rba.nextMeeting)}`,
    rba.minutes && `- RBA minutes of the ${fmtDay(rba.minutes.meeting)} meeting, released ${fmtDay(rba.minutes.released)}: ${rba.minutes.summary}`,
    `- AU CPI ${au.cpi.toFixed(1)}% for ${au.cpiPeriod} (${au.cpiPrevious}% in ${au.cpiPreviousPeriod}), trimmed mean ${au.cpiTrimmedMean}%; RBA target band ${au.rbaTargetBand}`,
    `- Next AU CPI release ${fmtDay(au.cpiNextRelease)} (September month and September quarter) — the last inflation read before the ${fmtDay(rba.nextMeeting)} RBA decision`,
    `- AU unemployment ${au.unemployment}% (${au.unemploymentPeriod}), up from ${au.unemploymentPrevious}% and a five-year high; next release ${fmtDay(au.unemploymentNextRelease)}`,
    `- AU GDP ${au.gdpAnnual}% annual, ${au.gdpQoQ}% quarter on quarter (${au.gdpPeriod})`,
    `- US Fed funds ${fed.rateRange} (${fed.lastDecisionVerb} on ${fmtDay(fed.lastDecision)}${fed.note ? `; ${fed.note}` : ''}); next meeting ${fmtDay(fed.nextMeeting)}`,
    `- Other central banks: ECB ${ecb.cashRate.toFixed(2)}% (${ecb.lastDecisionVerb} ${fmtDay(ecb.lastDecision)}), BOJ ${boj.cashRate.toFixed(2)}% (${boj.lastDecisionVerb} ${fmtDay(boj.lastDecision)}), BOE ${boe.cashRate.toFixed(2)}% (${boe.lastDecisionVerb} ${fmtDay(boe.lastDecision)})`,
    `- US CPI ${us.cpi}% and unemployment ${us.unemployment}% — as at ${fmtDay(us.asOf)}, older than the figures above`,
    `- China CPI ${cn.cpi}%, manufacturing PMI ${cn.pmiManufacturing} — as at ${fmtDay(cn.asOf)}`,
    `- Iron ore US$${commodities.ironOreUSD}/t, Brent US$${commodities.brentUSD}/bbl, thermal coal US$${commodities.thermalCoalUSD}/t — indicative, as at ${fmtDay(commodities.asOf)}; describe commodity direction in words rather than leaning on these levels`,
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
    return parsed.themes
  } catch {
    return null
  }
}

function writeCache(themes) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify({ cachedAt: Date.now(), facts: factsBlock(), themes }))
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
// Drops today's cached themes so the next getMacroThemes() call regenerates.
// Exported for the REFRESH control — without this the button would refetch a
// query whose queryFn hands straight back the same cached day.
export function clearMacroThemeCache() {
  try { localStorage.removeItem(todayKey()) } catch { /* storage unavailable */ }
}

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
