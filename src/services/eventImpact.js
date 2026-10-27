import { askClaudeJSON } from './api'
import { recordAiQuery } from './usageService'

// HISTORICAL IMPACT ANALYSIS for a high-impact scheduled release: how markets
// have typically responded when it surprised either way. Qualitative, written
// by MaddenAI, labelled AI-ESTIMATE — not a backtest. The prompt forbids
// percentages and point moves: none has been measured here, and a model asked
// for "typical moves" will produce confident numbers it never saw.
//
// One call per kind of event (the CPI, not each CPI), cached for 30 days, on
// request only.

const KEY = 'maddex_event_impact_v1'
const TTL_MS = 30 * 86400_000

// "AU CPI (Sep, incl. Sep quarter)" and "AU CPI (Oct)" are the same kind of
// release; the parenthetical period is dropped.
export const eventKind = (e) => `${e.region ?? ''}:${String(e.event).replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase()}`

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }

export function cachedImpact(event) {
  const hit = read()[eventKind(event)]
  return hit && Date.now() - Date.parse(hit.generatedAt) < TTL_MS ? hit : null
}

export async function analyseImpact(event) {
  const out = await askClaudeJSON(
    `Scheduled release: ${event.event} (${event.region}).
Describe, for an Australian investor, how markets have historically tended to respond when this release surprised (a) to the upside and (b) to the downside: the ASX and its rate-sensitive sectors, the AUD, and bond yields. Then one sentence on what makes a surprise matter more or less (for example, how close the next central bank decision is).

Rules: qualitative only. No percentages, point moves, basis points, dates of specific past episodes, or any other figure. Describe direction and which assets typically react most. General information, not advice.

Return JSON: {"upside": "2-3 sentences", "downside": "2-3 sentences", "context": "1 sentence"}`,
    { maxTokens: 450 },
  )
  recordAiQuery()
  const entry = { ...out, generatedAt: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [eventKind(event)]: entry })) } catch { /* quota */ }
  return entry
}
