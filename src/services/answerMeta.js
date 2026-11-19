// What every MaddenAI answer shows about how it was made (WS4, 19 Nov 2026):
// the dated datasets its figures were given from, and a "how this was
// produced" record (model, prompt versions, the advice check, timing). The
// model is told to quote only these figures (systemPrompt rules 3 and 13);
// the reader can check any of them against its source.
import { DATASETS } from '../data/registry.js'
import { HEALTH } from '../data/registryHealth.js'
import { textHash } from '../utils/textHash.js'

// The datasets in MaddenAI's per-turn facts block (verifiedFactsForAI,
// eventsForAI, regimeForAI). The pending RBA reading only while one exists.
export const AI_CONTEXT_DATASETS = ['vc:rba', 'vc:au', 'vc:fed', 'vc:centralBankOfficials', 'econ-schedule']

export function answerSources({ pendingRba = false } = {}) {
  const ids = pendingRba ? [...AI_CONTEXT_DATASETS, 'vc:rbaNextDecision'] : AI_CONTEXT_DATASETS
  return ids.map((id) => {
    const d = DATASETS.find((x) => x.id === id)
    const h = HEALTH.find((x) => x.id === id)
    return d ? { id, what: d.what, source: d.source.name, url: d.source.url, asOf: h?.asOf ?? null, cls: d.cls } : null
  }).filter(Boolean)
}

// result: askClaude's return. prompts: [[name, text]] actually sent.
export function buildAnswerMeta({ result, model, prompts = [], pendingRba = false, at = Date.now() }) {
  const g = result?.guard
  return {
    at,
    model,
    versions: prompts.filter(([, t]) => t).map(([n, t]) => `${n}@${textHash(t)}`),
    sources: answerSources({ pendingRba }),
    guard: g ? { checked: true, removed: g.flags ? new Set(g.flags.map((f) => f.sentence)).size : 0, blocked: !!g.blocked } : { checked: false, removed: 0, blocked: false },
    elapsed: result?.elapsed ?? null,
    outputTokens: result?.outputTokens ?? null,
  }
}
