// ─── AI-generated macro themes ──────────────────────────────────────────────
// Hardcoded "current macro theme" copy goes stale the moment the news cycle
// moves on. Instead, MaddenAI (the same Claude call used elsewhere in the
// terminal) generates 6 themes once per day, cached in localStorage under a
// date-stamped key so every user gets one fresh generation per day and every
// subsequent module open that day is instant.

import { askClaude } from './api'

const CACHE_PREFIX  = 'macro_themes_'
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24h safety net if the date key ever collides across a rollover

function todayKey() {
  return CACHE_PREFIX + new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time
}

// Used on first load, while the AI call is in flight, and as the permanent
// fallback if the call or the JSON parse fails — never leave the module blank.
export const FALLBACK_THEMES = [
  { title: 'RBA ON HOLD', category: 'RBA',
    summary: 'RBA held at 4.35% on 12 August, citing softer June-quarter CPI of 3.8%. Markets now pricing the first cut not until Q1 2027. September meeting expected to hold.',
    impact: 'NEUTRAL', impactNote: 'Neutral for equities, mildly bearish AUD' },
  { title: 'FED POLICY UNCERTAINTY', category: 'FED',
    summary: 'FOMC minutes (19 Aug) showed divided views on the rate path. The Sep 17 decision is live — markets pricing 65% hold, 35% cut. US CPI (Sep 11) is the key input.',
    impact: 'MIXED', impactNote: 'A cut would be bullish for risk assets' },
  { title: 'CHINA SLOWDOWN DEEPENING', category: 'CHINA',
    summary: 'August PMI data shows manufacturing below 50 for a 5th consecutive month. Property sector stress continues, weighing on demand for Australian exports.',
    impact: 'BEARISH', impactNote: 'Bearish for ASX Materials and Energy' },
  { title: 'AI CAPEX SUPERCYCLE CONTINUES', category: 'GLOBAL',
    summary: 'NVIDIA earnings beat consensus by 18%. US tech capex is at record highs, with AI infrastructure buildout accelerating through 2026-2027.',
    impact: 'BULLISH', impactNote: 'Bullish Tech, broadly neutral for the ASX' },
  { title: 'IRAN-MIDDLE EAST TENSIONS EASING', category: 'GEOPOLITICAL',
    summary: 'Ceasefire negotiations are progressing. Oil is down 8% from its July peak — if sustained, this removes a key inflation pressure that drove the RBA\'s 2026 hikes.',
    impact: 'BULLISH', impactNote: 'Bullish risk assets, bearish Energy' },
  { title: 'AUD STRENGTHENING', category: 'COMMODITIES',
    summary: 'AUD/USD is trading near a 6-month high. Iron ore prices are stabilising, and China stimulus hopes are supporting commodity currencies.',
    impact: 'MIXED', impactNote: 'Negative for USD-denominated returns' },
]

function buildPrompt() {
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return `Today is ${today}.

You are MaddenAI, the financial analyst for the Maddex terminal. Generate 6 current macro themes relevant to Australian investors.

For each theme return JSON:
{
  "title": "THEME TITLE IN CAPS",
  "summary": "2-3 sentence summary of the current situation",
  "impact": "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED",
  "impactNote": "Impact on ASX/AUD in one line",
  "category": "RBA" | "FED" | "CHINA" | "GLOBAL" | "COMMODITIES" | "GEOPOLITICAL"
}

Base themes on real current macro conditions as of today. Focus on: RBA policy, Fed policy, the China economy, commodities (iron ore, oil, gold), AUD strength, and geopolitical risks affecting Australia.

Return ONLY a JSON array of 6 theme objects — no prose, no markdown fences, no disclaimer.`
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
      [{ role: 'user', content: buildPrompt() }],
      null,
      { systemPrompt: 'You return only valid JSON. No prose, no markdown code fences, no disclaimers.' },
    )
    const themes = parseThemes(text)
    writeCache(themes)
    return { themes, source: 'live' }
  } catch {
    return { themes: FALLBACK_THEMES, source: 'fallback' }
  }
}
