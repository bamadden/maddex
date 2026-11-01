// npm run graph:second-pass — Stage 2 of the Relationships review pipeline.
//
// For every proposal that passed Stage 1 (proposals/verification.json), asks
// a separate model, blind to the first pass, what relationship the source
// passage states between the two parties — see src/data/graph/secondPass.js.
// Records the verdict, the code checks on it, and the comparison with the
// proposal in proposals/secondpass.json. A record is reused while its passage
// is unchanged, so re-running costs nothing for proposals already read.
//
// Needs ANTHROPIC_API_KEY locally. Never run in CI or on Vercel.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { SECOND_PASS_MODEL, SECOND_PASS_SYSTEM, SECOND_PASS_SCHEMA, secondPassUser, passageFor, partiesOf, verdictProblems, compareVerdict } from '../src/data/graph/secondPass.js'
import { loadProposalDocs } from './graph-verify.mjs'
import { sourcePages } from './lib/sourceText.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'src/data/graph/proposals')
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')

// One blind reading. `client` is an Anthropic client (or a test double).
export async function readPassage(client, { passage, a, b }) {
  const msg = await client.messages.create({
    model: SECOND_PASS_MODEL,
    max_tokens: 8000,
    system: SECOND_PASS_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SECOND_PASS_SCHEMA } },
    messages: [{ role: 'user', content: secondPassUser({ passage, a, b }) }],
  })
  if (msg.stop_reason === 'refusal') return { verdict: null, error: 'model declined', usage: msg.usage }
  if (msg.stop_reason === 'max_tokens') return { verdict: null, error: 'reply cut off at max_tokens', usage: msg.usage }
  const text = msg.content?.find((c) => c.type === 'text')?.text
  try { return { verdict: JSON.parse(text), usage: msg.usage } } catch { return { verdict: null, error: 'reply was not JSON', usage: msg.usage } }
}

// items: [{ proposal, passage }]; previous: the existing secondpass.json
// results (reused when the passage hash matches). Returns the results map.
export async function runSecondPass(client, items, previous = {}, now = () => new Date().toISOString()) {
  const results = {}
  for (const { proposal: p, passage } of items) {
    const passageSha256 = sha(passage)
    const { a, b } = partiesOf(p)
    let r = previous[p.id]?.passageSha256 === passageSha256 && previous[p.id]?.model === SECOND_PASS_MODEL ? previous[p.id] : null
    if (!r) {
      const { verdict, error, usage } = await readPassage(client, { passage, a, b })
      r = { model: SECOND_PASS_MODEL, at: now(), parties: { a, b }, passage, passageSha256, verdict, usage: usage ?? null, ...(error ? { error } : {}) }
    }
    const problems = r.verdict ? verdictProblems(r.verdict, passage) : [r.error ?? 'no verdict']
    results[p.id] = { ...r, problems, comparison: compareVerdict(p, r.verdict, problems) }
  }
  return results
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const verification = JSON.parse(fs.readFileSync(path.join(DIR, 'verification.json'), 'utf8'))
  const outPath = path.join(DIR, 'secondpass.json')
  let previous = {}
  try { previous = JSON.parse(fs.readFileSync(outPath, 'utf8')).results ?? {} } catch { /* first run */ }

  const items = []
  for (const doc of loadProposalDocs()) {
    const passing = (doc.proposals ?? []).filter((p) => p.status === 'pending' && verification.results[p.id]?.ok)
    if (!passing.length) continue
    const src = await sourcePages(doc.sourceUrl)
    for (const p of passing) {
      const m = verification.results[p.id].match
      if (m.sourceSha256 !== src.sha256) { console.error(`${p.id}: source changed since Stage 1 — re-run npm run graph:verify`); process.exit(1) }
      items.push({ proposal: p, passage: passageFor(src.pages[m.page - 1], m) })
    }
  }
  const fresh = items.filter(({ proposal, passage }) => previous[proposal.id]?.passageSha256 !== sha(passage)).length
  console.log(`${items.length} proposals passed Stage 1; ${fresh} need a model reading (${SECOND_PASS_MODEL}).`)

  const results = await runSecondPass(new Anthropic(), items, previous)
  fs.writeFileSync(outPath, JSON.stringify({ stage: 2, model: SECOND_PASS_MODEL, generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
  for (const [id, r] of Object.entries(results)) {
    console.log(`${r.comparison.outcome.padEnd(22)} ${id} ${r.verdict ? `${r.verdict.relationship}/${r.verdict.direction}/${r.verdict.confidence}` : r.error} — ${r.comparison.detail}`)
  }
  const usage = Object.values(results).reduce((s, r) => ({ in: s.in + (r.usage?.input_tokens ?? 0), out: s.out + (r.usage?.output_tokens ?? 0) }), { in: 0, out: 0 })
  console.log(`\ntokens recorded: ${usage.in} in / ${usage.out} out → src/data/graph/proposals/secondpass.json`)
}
