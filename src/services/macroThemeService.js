// ─── AI-generated macro themes ──────────────────────────────────────────────
// Hardcoded "current macro theme" copy goes stale the moment the news cycle
// moves on. MaddenAI generates the themes once per Sydney day on the server
// (/api/ai-daily, kind "macro-themes" — the prompt lives in
// services/aiDaily.js) and every reader shares that one generation. This file
// keeps the figure-free fallback shown when it is unavailable.

import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'
import { getDaily, clearDaily } from './aiDailyClient'

const V = VERIFIED_CONSTANTS
const releaseDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })

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

// Returns { themes, implications, source: 'cache' | 'live' | 'stale' | 'fallback' }.
// clearMacroThemeCache drops this browser's copy, so REFRESH re-reads the
// shared themes. It does not regenerate them: they are shared for the day.
export function clearMacroThemeCache() {
  clearDaily('macro-themes')
}

export async function getMacroThemes() {
  try {
    const { data, source } = await getDaily('macro-themes')
    return { ...data, source: source === 'shared' ? 'live' : source }
  } catch {
    return { themes: FALLBACK_THEMES, implications: FALLBACK_IMPLICATIONS, source: 'fallback' }
  }
}
