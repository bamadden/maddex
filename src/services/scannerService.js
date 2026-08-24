import { MOCK_ASX_STOCKS, MOCK_US_STOCKS, getMockFMPRow, getMockFMPHistory } from './mockData'
import { askClaudeJSON } from './api'

const CACHE_PREFIX = 'maddex_scanner_pattern_'

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

export const SCAN_UNIVERSE = [
  ...Object.keys(MOCK_ASX_STOCKS),
  ...Object.keys(MOCK_US_STOCKS),
]

// Standard 14-period RSI over closes (oldest-first). Guards the flat-losses
// case (a stretch of only up days) the same way alertsService.js's own
// computeRSI does — an unguarded avgLoss of 0 would divide by zero.
export function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff; else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function baseRow(symbol) {
  const q = getMockFMPRow(symbol)
  if (!q) return null
  return { symbol, name: q.shortName, price: q.regularMarketPrice, changePct: q.regularMarketChangePercent, q }
}

// ── Momentum extremes — real RSI(14) computed from the shared mock price
// history, so results are stable within a page load (same underlying
// history every consumer reads) rather than reseeded on each scan.
export function scanOversold() {
  const results = []
  for (const symbol of SCAN_UNIVERSE) {
    const row = baseRow(symbol)
    if (!row) continue
    const hist = getMockFMPHistory(symbol, 30)
    const rsi = calculateRSI(hist.map((h) => h.close))
    if (rsi != null && rsi < 30) results.push({ ...row, rsi })
  }
  return results.sort((a, b) => a.rsi - b.rsi)
}

export function scanOverbought() {
  const results = []
  for (const symbol of SCAN_UNIVERSE) {
    const row = baseRow(symbol)
    if (!row) continue
    const hist = getMockFMPHistory(symbol, 30)
    const rsi = calculateRSI(hist.map((h) => h.close))
    if (rsi != null && rsi > 70) results.push({ ...row, rsi })
  }
  return results.sort((a, b) => b.rsi - a.rsi)
}

// ── Breakouts, volume, and gaps — mockData's own 52W high/volume/open
// fields are static per symbol (a fixed ratio or a fixed band above the
// jittered price), so a signal built directly from them would never fire
// or would fire identically forever. Each gets its own tick-seeded roll
// (mirrors UnusualActivityTracker's seededVolumeRatio) so results actually
// change across scans, the same deliberate mock-design tradeoff already
// documented there.
export function scanBreakouts(tick = 0) {
  const results = []
  for (const symbol of SCAN_UNIVERSE) {
    const row = baseRow(symbol)
    if (!row) continue
    const rng = mulberry32(hashStr(`${symbol}_breakout_${tick}`))
    if (rng() > 0.82) {
      const upsidePct = 0.5 + rng() * 2.5 // 0.5%-3% above the breakout level
      const breakoutLevel = row.price / (1 + upsidePct / 100)
      const volumeRatio = 1.5 + rng() * 2.5
      results.push({ ...row, breakoutLevel: Math.round(breakoutLevel * 100) / 100, volumeRatio })
    }
  }
  return results.sort((a, b) => b.volumeRatio - a.volumeRatio)
}

export function scanVolume(tick = 0) {
  const results = []
  for (const symbol of SCAN_UNIVERSE) {
    const row = baseRow(symbol)
    if (!row) continue
    const rng = mulberry32(hashStr(`${symbol}_volume_${tick}`))
    const roll = rng()
    let volumeRatio
    if (roll < 0.12) volumeRatio = 3.0 + rng() * 2.5
    else if (roll < 0.3) volumeRatio = 1.8 + rng() * 1.2
    else volumeRatio = 0.5 + rng() * 1.2
    if (volumeRatio < 1.8) continue
    const absChange = Math.abs(row.changePct)
    const explanation = volumeRatio > 3
      ? (absChange < 0.5
        ? `High volume with flat price suggests possible institutional ${row.changePct >= 0 ? 'accumulation' : 'distribution'}`
        : 'Unusually high volume — worth watching for follow-through')
      : 'Elevated volume — above its recent average but not yet extreme'
    results.push({ ...row, volumeRatio, explanation })
  }
  return results.sort((a, b) => b.volumeRatio - a.volumeRatio)
}

export function scanGaps(tick = 0) {
  const results = []
  for (const symbol of SCAN_UNIVERSE) {
    const row = baseRow(symbol)
    if (!row) continue
    const rng = mulberry32(hashStr(`${symbol}_gap_${tick}`))
    if (rng() > 0.8) {
      const direction = rng() > 0.5 ? 1 : -1
      const gapPct = direction * (1.5 + rng() * 3.5)
      const prevClose = row.q.regularMarketPreviousClose
      const openPrice = Math.round(prevClose * (1 + gapPct / 100) * 100) / 100
      results.push({ ...row, prevClose, openPrice, gapPct, direction: direction > 0 ? 'UP' : 'DOWN' })
    }
  }
  return results.sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct))
}

// ── AI-powered pattern detection ────────────────────────────────────────────
// A handful of the session's biggest movers, not the full universe — this
// makes a real Claude call per card, so scanning all ~40 symbols on every
// tab open would be both slow and needlessly expensive.
export function getPatternCandidates() {
  const withMove = SCAN_UNIVERSE
    .map((symbol) => baseRow(symbol))
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  const asx = withMove.filter((r) => r.symbol.endsWith('.AX')).slice(0, 3)
  const us = withMove.filter((r) => !r.symbol.endsWith('.AX')).slice(0, 3)
  return [...asx, ...us]
}

function todayKey(symbol) {
  const day = new Date().toISOString().slice(0, 10)
  return `${CACHE_PREFIX}${symbol}_${day}`
}

export async function detectPattern(symbol) {
  const cacheKey = todayKey(symbol)
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch { /* fall through to regenerate */ }
  }

  const row = baseRow(symbol)
  const hist = getMockFMPHistory(symbol, 20)
  const closesSummary = hist.map((h) => h.close).join(', ')

  const prompt = `You are MaddenAI, a technical analyst identifying chart patterns from recent price data.

Symbol: ${symbol}
Current price: ${row.price}
Today's change: ${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(2)}%
Last 20 closes (oldest to newest): ${closesSummary}

Identify the single most notable chart pattern in this series (e.g. cup-and-handle, descending triangle, ascending triangle, head-and-shoulders, double top/bottom, flag, wedge — or "no clear pattern" if genuinely none stands out).

Return JSON only:
{
  "patternName": "short pattern name",
  "description": "1-2 sentences describing what the pattern looks like in this data",
  "implication": "BULLISH" | "BEARISH" | "NEUTRAL",
  "probability": "LOW" | "MEDIUM" | "HIGH",
  "targetLevel": number
}`

  const pattern = await askClaudeJSON(prompt, { maxTokens: 400 })
  try { localStorage.setItem(cacheKey, JSON.stringify(pattern)) } catch { /* best-effort */ }
  return pattern
}
