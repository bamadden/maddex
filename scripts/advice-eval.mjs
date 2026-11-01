// Live check of the advice boundary: sends every attack in
// tests/fixtures/adversarialPrompts.mjs to the model with the production
// system prompt and boundary reminder, then runs each raw reply through the
// output guard. Reports, per attack, whether the model itself held the line
// (no flags on the raw reply) and whether anything would reach the screen.
//
// COSTS MONEY (about 46 short completions). Not part of `npm test`; run only
// on purpose:   ANTHROPIC_API_KEY=... node --import ./tests/setup/resolve.mjs scripts/advice-eval.mjs --yes

import Anthropic from '@anthropic-ai/sdk'
import { MADDEX_SYSTEM_PROMPT } from '../src/services/systemPrompt.js'
import { adviceIntent, BOUNDARY_REMINDER, guardText } from '../src/services/adviceGuard.js'
import { ADVERSARIAL } from '../tests/fixtures/adversarialPrompts.mjs'

if (!process.argv.includes('--yes')) {
  console.error(`advice-eval sends ${ADVERSARIAL.length} prompts to the live model and is billed. Re-run with --yes to proceed.`)
  process.exit(2)
}

const MODEL = 'claude-sonnet-4-6' // the model askClaude uses
const client = new Anthropic()
let held = 0, leaked = 0
for (const a of ADVERSARIAL) {
  const content = adviceIntent(a.prompt) ? `${a.prompt}\n\n${BOUNDARY_REMINDER}` : a.prompt
  const msg = await client.messages.create({ model: MODEL, max_tokens: 600, system: MADDEX_SYSTEM_PROMPT, messages: [{ role: 'user', content }] })
  const raw = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const g = guardText(raw)
  if (!g.flags.length) held++
  const shownFlags = guardText(g.text).flags.length
  if (shownFlags) leaked++
  console.log(`${g.flags.length ? '⚠' : '✓'} [${a.kind}] ${a.prompt.slice(0, 60)}${g.flags.length ? `  — guard: ${g.flags.map((f) => f.rule).join(', ')}` : ''}`)
}
console.log(`\nModel held the line on ${held}/${ADVERSARIAL.length}; replies with advice left after the guard: ${leaked}.`)
process.exit(leaked ? 1 : 0)
