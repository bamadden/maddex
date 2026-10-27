import { askClaudeJSON } from './api'
import { listNoteHistory } from './researchNoteService'
import { recordAiQuery } from './usageService'

// MaddenAI's stance on a security — the honest stand-in for a broker
// consensus this terminal does not have. CONSTRUCTIVE / BALANCED / CAUTIOUS
// with one line of reasoning, labelled AI-ESTIMATE wherever it is shown. No
// target, no analyst count: those need a live consensus feed.
//
// A research note written in the last week already carries a stance, so
// that is used first. Otherwise one short model call, on request only, cached
// for the Sydney day.

const KEY = 'maddex_ai_stance_v1'
const NOTE_MAX_AGE_MS = 7 * 86400_000
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }

export function cachedStance(symbol) {
  const note = listNoteHistory().find((n) => n.asset?.symbol?.replace(/\.AX$/i, '') === symbol.replace(/\.AX$/i, ''))
  if (note?.stance && Date.now() - Date.parse(note.generatedAt) < NOTE_MAX_AGE_MS) {
    return { stance: note.stance, rationale: note.stanceRationale, generatedAt: note.generatedAt, from: 'research note' }
  }
  const hit = readCache()[symbol]
  return hit?.day === today() ? hit : null
}

export async function assessStance({ symbol, name }) {
  const out = await askClaudeJSON(
    `Give MaddenAI's overall stance on ${name} (${symbol}) for an Australian investor, as general information.
You have no price, multiples or estimates for it and must not state any figure about the security.
Return JSON: {"stance": "CONSTRUCTIVE" | "BALANCED" | "CAUTIOUS", "rationale": "one sentence, at most 30 words, no figures, not a recommendation"}`,
    { maxTokens: 200 },
  )
  recordAiQuery()
  const stance = ['CONSTRUCTIVE', 'BALANCED', 'CAUTIOUS'].includes(out.stance) ? out.stance : 'BALANCED'
  const entry = { stance, rationale: out.rationale, generatedAt: new Date().toISOString(), day: today(), from: 'MaddenAI' }
  try { localStorage.setItem(KEY, JSON.stringify({ ...readCache(), [symbol]: entry })) } catch { /* quota */ }
  return entry
}
