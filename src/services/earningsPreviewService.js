import { askClaudeJSON } from './api'
import { getMockFMPRow } from './mockData'

// ticker: bare or .AX-suffixed symbol. earningsDate: 'YYYY-MM-DD'.
// Only generates within a 7-day lookahead window (and never for a date
// that's already passed) — outside that window this returns null so
// callers can decide not to show a preview affordance at all.
export async function generateEarningsPreview(ticker, earningsDate) {
  const daysUntil = Math.ceil((new Date(`${earningsDate}T00:00:00`) - new Date()) / 86400000)
  if (daysUntil > 7 || daysUntil < 0) return null

  const cacheKey = `maddex_earnings_preview_${ticker}_${earningsDate}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch { /* fall through to regenerate */ }
  }

  const quote = getMockFMPRow(ticker)

  const prompt = `Generate a pre-earnings brief for ${ticker} reporting in ${daysUntil} days.

Current price: ${quote?.regularMarketPrice ?? 'unknown'}
P/E: ${quote?.trailingPE ?? 'unknown'}
52W range: ${quote?.fiftyTwoWeekLow ?? 'unknown'} - ${quote?.fiftyTwoWeekHigh ?? 'unknown'}

Return JSON:
{
  "consensusEPS": number,
  "consensusRevenue": number,
  "revenueCurrency": "AUD" | "USD",
  "historicalBeatRate": "X of last Y quarters",
  "keyMetricsToWatch": ["metric 1", "metric 2", "metric 3"],
  "impliedMove": number (% the market implies stock could move),
  "analystSentiment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "analystCount": number,
  "priceTarget": number,
  "bullCase": "one sentence bull scenario",
  "bearCase": "one sentence bear scenario",
  "keyQuestion": "The one question this earnings will answer",
  "recommendation": "HOLD INTO EARNINGS" | "REDUCE BEFORE" | "ADD BEFORE"
}
Return ONLY valid JSON.`

  const preview = await askClaudeJSON(prompt, { maxTokens: 800 })
  try { localStorage.setItem(cacheKey, JSON.stringify(preview)) } catch { /* best-effort */ }
  return preview
}
