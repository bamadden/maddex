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
// As at 22 August 2026.
export const FALLBACK_THEMES = [
  { title: 'RBA ON HOLD', category: 'RBA',
    summary: 'RBA held at 4.35% on 12 August, citing softer June-quarter CPI of 3.8%. Next meeting 16 September — the softer print supports an extended hold rather than a near-term move either way.',
    impact: 'NEUTRAL', impactNote: 'Neutral for equities' },
  { title: 'JACKSON HOLE WRAP', category: 'FED',
    summary: 'Powell spoke 22 August and signalled gradual policy normalisation. Markets are now pricing a 35% chance of a cut at the 17 September FOMC decision, up from earlier in the month.',
    impact: 'MIXED', impactNote: 'Mildly bullish for risk assets' },
  { title: 'CHINA SLOWDOWN', category: 'CHINA',
    summary: 'Manufacturing PMI has held below 50 for a 5th consecutive month. Beijing has announced stimulus measures, but they remain modest relative to the scale of the slowdown.',
    impact: 'BEARISH', impactNote: 'Bearish Materials, Energy, and the ASX' },
  { title: 'AI CAPEX SUPERCYCLE', category: 'GLOBAL',
    summary: 'NVIDIA earnings beat consensus by 18%. US tech capex is at record highs, with AI infrastructure buildout accelerating through 2026-2027.',
    impact: 'BULLISH', impactNote: 'Bullish Tech, neutral for the ASX' },
  { title: 'IRAN CEASEFIRE PROGRESS', category: 'GEOPOLITICAL',
    summary: 'Oil is down 8% from its July peak as ceasefire talks advance in the Middle East. If sustained, this removes a key inflation pressure that had been driving RBA hawkishness.',
    impact: 'BULLISH', impactNote: 'Bullish risk assets, bearish Energy' },
  { title: 'AUD AT RESISTANCE', category: 'COMMODITIES',
    summary: 'AUD/USD is trading near 0.6520, close to a 6-month high. China stimulus hopes are supporting commodity-linked FX alongside stabilising iron ore prices.',
    impact: 'MIXED', impactNote: 'Good for imports, negative for AUD earners' },
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
