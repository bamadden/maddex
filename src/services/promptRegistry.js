// Every prompt MaddenAI is given, by name, with its version (WS4, 19 Nov
// 2026). A version is `name@hash` of the text, the same hash the server
// records against each reply (api/_aiRecords.js template_version), so any
// answer can be traced to the exact prompt that produced it.
//
// tests/prompts.test.mjs holds the accepted versions in
// tests/fixtures/promptVersions.json and fails when any prompt changes.
// After a deliberate change: update the tests that pin its wording, then run
// `npm run prompts:accept` to record the new version.
import { MADDEX_SYSTEM_PROMPT, buildSystemPrompt } from './systemPrompt.js'
import { EXPERIENCE_CONTEXT } from '../lib/profileUtils.js'
import { FOLLOW_UP_GUIDE, RESEARCH_INSTRUCTION, DEEP_DIVE_INSTRUCTION, rbaPreviewInstruction, PERSONAS, personaLine } from './aiPrompts.js'
import { BOUNDARY_REMINDER } from './adviceGuard.js'
import { JSON_SYSTEM_PROMPT } from './api.js'
import { textHash } from '../utils/textHash.js'

export function prompts() {
  return [
    ['system', MADDEX_SYSTEM_PROMPT],
    ...Object.keys(EXPERIENCE_CONTEXT).map((level) => [`system:${level.toLowerCase()}`, buildSystemPrompt(level)]),
    ['follow-ups', FOLLOW_UP_GUIDE],
    ['mode:research', RESEARCH_INSTRUCTION],
    ['mode:deep-dive', DEEP_DIVE_INSTRUCTION],
    ['mode:rba-preview', rbaPreviewInstruction('{words}')],
    ...PERSONAS.map(([id]) => [`persona:${id}`, personaLine(id)]),
    ['boundary-reminder', BOUNDARY_REMINDER],
    ['json-system', JSON_SYSTEM_PROMPT],
  ]
}

export const promptVersion = (name, text) => `${name}@${textHash(text)}`
export const promptVersions = () => Object.fromEntries(prompts().map(([n, t]) => [n, promptVersion(n, t)]))
