import { askClaudeJSON } from './api'
import { earningsFor, daysUntil } from './earningsCalendar'

const RESULT_KEY = (ticker) => `maddex_earnings_result_${ticker}`

// Deterministic-ish mock earnings print — realistic 65% beat rate.
export function simulateEarningsResult(ticker) {
  const beat = Math.random() > 0.35
  const beatPct = beat
    ? (0.02 + Math.random() * 0.12)
    : -(0.01 + Math.random() * 0.08)

  const consensusEPS = 1.20 + Math.random() * 2
  return {
    ticker,
    actualEPS: parseFloat((consensusEPS * (1 + beatPct)).toFixed(2)),
    consensusEPS: parseFloat(consensusEPS.toFixed(2)),
    actualRevenue: Math.floor(1000 + Math.random() * 50000),
    guidance: beat ? 'Guidance raised for FY27' : 'Guidance maintained at prior range',
    reportDate: new Date().toISOString(),
  }
}

export async function analyseEarnings(ticker, reportData) {
  const beatMiss = reportData.actualEPS > reportData.consensusEPS ? 'BEAT' : 'MISS'
  const beatMagnitude = Math.abs(((reportData.actualEPS - reportData.consensusEPS) / reportData.consensusEPS) * 100).toFixed(1)

  const prompt = `You are MaddenAI analysing fresh earnings results.

Company: ${ticker}
Reported EPS: ${reportData.actualEPS}
Consensus EPS: ${reportData.consensusEPS}
Beat/Miss: ${beatMiss} by ${beatMagnitude}%
Revenue: ${reportData.actualRevenue}
Guidance: ${reportData.guidance}

Return JSON:
{
  "verdict": "STRONG BEAT" | "BEAT" | "IN LINE" | "MISS" | "STRONG MISS",
  "verdictScore": number 1-10,
  "headline": "one punchy sentence verdict",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "guidanceAssessment": "paragraph on guidance",
  "priceImplication": "SIGNIFICANTLY HIGHER" | "HIGHER" | "NEUTRAL" | "LOWER" | "SIGNIFICANTLY LOWER",
  "watchFor": "what to watch in next quarter",
  "fullAnalysis": "2-3 paragraph full analysis"
}
Return ONLY valid JSON.`

  return askClaudeJSON(prompt, { maxTokens: 1000 })
}

export function getEarningsResult(ticker) {
  try {
    const raw = localStorage.getItem(RESULT_KEY(ticker))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveEarningsResult(ticker, data) {
  try { localStorage.setItem(RESULT_KEY(ticker), JSON.stringify(data)) } catch { /* best-effort */ }
}

// Every completed (analysis present) earnings result, ticker included —
// used to durably re-surface "EARNINGS RESULT" cards in the News feed.
// The feed's own query cache gets overwritten by real RSS refetches every
// few minutes, which would otherwise silently drop a synthetic card
// pushed only via queryClient.setQueryData; reading straight from this
// localStorage-backed store means the card survives that.
export function getAllEarningsResults() {
  const results = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('maddex_earnings_result_')) continue
    try {
      const record = JSON.parse(localStorage.getItem(key))
      if (record?.analysis) results.push({ ticker: key.replace('maddex_earnings_result_', ''), ...record })
    } catch { /* skip corrupt entry */ }
  }
  return results
}

// Called on a poll (NotificationCenter, ~60s) for each watchlist symbol.
// Returns a notification-ready summary the first time analysis completes
// for a given ticker, or null otherwise (no-op if already processed, not
// yet reported, or still in progress).
export async function checkAndAnalyseEarnings(symbol) {
  const e = earningsFor(symbol)
  if (!e) return null
  if (daysUntil(e.date) > 0) return null // hasn't reported yet

  const ticker = e.ticker
  let record = getEarningsResult(ticker)

  // Deterministic report is generated and cached immediately — the
  // watchlist "RESULTS: BEAT/MISS" badge flips on this alone, independent
  // of whether the AI narrative succeeds.
  if (!record) {
    const reportData = simulateEarningsResult(ticker)
    record = { reportData, analysis: null, analysisError: null }
    saveEarningsResult(ticker, record)
  }

  if (record.analysis || record.analysisError) return null // already attempted

  try {
    const analysis = await analyseEarnings(ticker, record.reportData)
    saveEarningsResult(ticker, { ...record, analysis })
    const beatMiss = record.reportData.actualEPS > record.reportData.consensusEPS ? 'BEAT' : 'MISS'
    const beatMagnitude = Math.abs(((record.reportData.actualEPS - record.reportData.consensusEPS) / record.reportData.consensusEPS) * 100).toFixed(1)
    return {
      ticker,
      message: `📊 ${ticker.replace('.AX', '')} EARNINGS: ${beatMiss} +${beatMagnitude}% — Analysis ready`,
      analysis,
      reportData: record.reportData,
    }
  } catch (err) {
    saveEarningsResult(ticker, { ...record, analysisError: err.message })
    return null
  }
}
