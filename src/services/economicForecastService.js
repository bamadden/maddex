import { askClaudeJSON } from './api'

// Deterministic seeded PRNG — same technique used elsewhere in this app's
// mock layer, used here instead of the brief's raw Math.random() so the
// generated history (and therefore the charts) stay stable across renders
// rather than reshuffling on every re-render.
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const INDICATORS = [
  { key: 'gdp',      label: 'GDP Growth',          current: 1.2,  vol: 0.3,  trend: -0.02, unit: '%', targetHint: 'RBA target 2-3%' },
  { key: 'inflation',label: 'Inflation',            current: 3.8,  vol: 0.2,  trend: -0.05, unit: '%', targetHint: 'RBA target 2-3%' },
  { key: 'unemp',    label: 'Unemployment',         current: 4.2,  vol: 0.1,  trend: 0.01,  unit: '%', targetHint: 'full employment ~4%' },
  { key: 'cashrate', label: 'Cash Rate',            current: 4.35, vol: 0,    trend: 0,     unit: '%', targetHint: 'neutral ~2.5%' },
  { key: 'trade',    label: 'Trade Balance',        current: 5.2,  vol: 0.5,  trend: 0.02,  unit: 'B', targetHint: 'monthly surplus, A$' },
  { key: 'consconf', label: 'Consumer Confidence',  current: 84.3, vol: 2,    trend: -0.01, unit: '',  targetHint: '100 = neutral' },
  { key: 'busconf',  label: 'Business Confidence',  current: 6,    vol: 3,    trend: 0,     unit: '',  targetHint: 'NAB survey index' },
  { key: 'house',    label: 'House Prices',         current: 3.2,  vol: 0.4,  trend: 0.01,  unit: '%', targetHint: 'YoY, national' },
  { key: 'wage',     label: 'Wage Growth',          current: 3.4,  vol: 0.15, trend: -0.02, unit: '%', targetHint: 'YoY, WPI' },
  { key: 'retail',   label: 'Retail Sales',         current: 0.3,  vol: 0.3,  trend: 0,     unit: '%', targetHint: 'MoM' },
  { key: 'pmi',      label: 'PMI',                  current: 48.2, vol: 1.5,  trend: -0.01, unit: '',  targetHint: '<50 = contraction' },
  { key: 'curracct', label: 'Current Account',      current: 2.1,  vol: 0.8,  trend: 0.01,  unit: 'B', targetHint: 'quarterly, A$' },
]

// Per the brief's exact formula, seeded for render-stability.
export function generateIndicatorHistory(current, volatility, trend, seedKey) {
  const rng = mulberry32(hashStr(seedKey))
  const history = []
  // A zero-volatility indicator (the Cash Rate — an administered rate, not
  // a survey estimate) should stay pinned at its known current value, not
  // drift to a random starting point it can never return to (there's no
  // change to correct it back, since change = trend*0.01 + noise*volatility
  // is 0 for every month when both trend and volatility are 0).
  let value = volatility > 0 ? current * (0.85 + rng() * 0.1) : current

  for (let i = 24; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const change = (trend * 0.01) + (rng() - 0.5) * volatility
    value = value * (1 + change)
    history.push({
      date: date.toISOString().split('T')[0],
      actual: parseFloat(value.toFixed(2)),
      consensus: parseFloat((value * (0.98 + rng() * 0.04)).toFixed(2)),
    })
  }
  return history
}

// % of the last N readings where consensus was within 0.2 (absolute) of
// actual — "Consensus was within 0.2% actual in 7 of last 10 readings".
export function consensusAccuracy(history, lookback = 10) {
  const recent = history.slice(-lookback)
  const within = recent.filter((r) => Math.abs(r.actual - r.consensus) <= 0.2).length
  return { within, total: recent.length, pct: Math.round((within / recent.length) * 100) }
}

// Average absolute consensus miss over the last 12 readings — feeds the
// FORECASTER ACCURACY bar chart.
export function avgConsensusMiss(history, lookback = 12) {
  const recent = history.slice(-lookback)
  const sum = recent.reduce((s, r) => s + Math.abs(r.actual - r.consensus), 0)
  return parseFloat((sum / recent.length).toFixed(3))
}

const CACHE_PREFIX = 'maddex_indicator_forecast_'
function todayKey(indicatorKey) {
  return `${CACHE_PREFIX}${indicatorKey}_${new Date().toLocaleDateString('en-CA')}`
}

// MaddenAI's own forecast for the NEXT reading, generated on demand (when
// a card is expanded) rather than for all 12 indicators up front, and
// cached once per indicator per day.
export async function forecastIndicator(indicator, history) {
  const cacheKey = todayKey(indicator.key)
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch { /* fall through to regenerate */ }
  }

  const recentReadings = history.slice(-6).map((r) => `${r.date}: actual ${r.actual}, consensus ${r.consensus}`).join('\n')
  const latestConsensus = history[history.length - 1]?.consensus

  const prompt = `You are MaddenAI, forecasting the next reading of an Australian economic indicator using leading-indicator analysis.

Indicator: ${indicator.label} (${indicator.targetHint})
Last 6 readings (actual vs consensus at the time):
${recentReadings}

Current market consensus for the NEXT reading: ${latestConsensus}${indicator.unit}

Return JSON only:
{
  "forecastValue": number,
  "vsConsensus": "ABOVE" | "BELOW" | "IN LINE",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": "1-2 sentences on the leading indicators driving this forecast",
  "whatItMeans": "1 sentence on what a reading at this forecast level would mean for RBA policy or markets"
}`

  const forecast = await askClaudeJSON(prompt, { maxTokens: 400 })
  try { localStorage.setItem(cacheKey, JSON.stringify(forecast)) } catch { /* best-effort */ }
  return forecast
}
