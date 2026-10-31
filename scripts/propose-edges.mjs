// npm run propose-edges -- --file <pdf|txt> --ticker XXX --source-url <url> --as-at YYYY-MM-DD [--pages 200-260] [--label "..."]
//
// Dev tooling for the Relationships graph. Reads a company document, asks
// Claude to PROPOSE candidate edges (supplier, customer, owns, subsidiary,
// joint venture, director), and checks every proposal in code before keeping
// it:
//   - the quote must appear verbatim (whitespace-normalised) in the document;
//   - a weight must appear, as a number, inside that quote.
// Anything that fails is logged with the reason and kept out of the queue.
//
// Output: src/data/graph/proposals/<TICKER>-<as-at>.json. Nothing here writes
// to the live graph — a person approves each edge in the review queue, which
// is the only path into approved.json. A proposal rejected there is
// remembered (proposals/decisions.json) and never re-suggested.
//
// Needs ANTHROPIC_API_KEY in the local environment. Never run in CI or on
// Vercel.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { validateProposal, quoteContext, normaliseWs, PROPOSAL_TYPES } from '../src/data/graph/validate.js'
import { ALL_NODES } from '../src/data/graph/nodes.js'

const MODEL = 'claude-sonnet-4-6'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT_DIR = path.join(ROOT, 'src/data/graph/proposals')
const DECISIONS = path.join(OUT_DIR, 'decisions.json')

// ── Arguments ───────────────────────────────────────────────────────────────
function args(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i]
  return out
}
const a = args(process.argv.slice(2))
const fail = (m) => { console.error(`propose-edges: ${m}`); process.exit(1) }
if (!a.file || !a.ticker || !a['source-url'] || !a['as-at']) fail('usage: --file <pdf|txt> --ticker XXX --source-url <https url> --as-at YYYY-MM-DD [--pages 200-260] [--label "..."]')
if (!/^\d{4}-\d{2}-\d{2}$/.test(a['as-at'])) fail('--as-at must be YYYY-MM-DD')
if (!/^https:\/\//.test(a['source-url'])) fail('--source-url must be https')
const TICKER = String(a.ticker).toUpperCase()
if (!/^[A-Z0-9]{2,6}$/.test(TICKER)) fail('--ticker looks wrong')

// ── Document text, page by page ─────────────────────────────────────────────
async function readPages(file) {
  if (/\.txt$/i.test(file)) {
    // Form feeds mark pages when the text was exported with them; otherwise
    // the file is one page.
    return fs.readFileSync(file, 'utf8').split('\f')
  }
  if (!/\.pdf$/i.test(file)) fail('--file must be .pdf or .txt')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false }).promise
  // Text runs are joined by where they sit on the page, not with a blanket
  // space: PDFs often split a word across runs ("compris" + "e"), and a space
  // there would make an honest quote fail the verbatim check. A space goes in
  // only where there is a visible gap, or a run ends a line.
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent()
    let out = '', prev = null
    for (const it of c.items) {
      if (!('str' in it)) continue
      if (prev) {
        const [x, y] = [it.transform[4], it.transform[5]]
        const prevEnd = prev.transform[4] + prev.width
        const size = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10
        const sameLine = Math.abs(y - prev.transform[5]) < size * 0.5
        if (prev.hasEOL || !sameLine) out += '\n'
        else if (x - prevEnd > size * 0.15 && !/\s$/.test(out) && !/^\s/.test(it.str)) out += ' '
      }
      out += it.str
      prev = it
    }
    pages.push(out)
  }
  return pages
}

const pages = await readPages(a.file)
let [from, to] = [1, pages.length]
if (a.pages) {
  const m = String(a.pages).match(/^(\d+)-(\d+)$/)
  if (!m) fail('--pages must look like 200-260')
  ;[from, to] = [Math.max(1, +m[1]), Math.min(pages.length, +m[2])]
}
const docText = pages.slice(from - 1, to).map((t, i) => `=== PAGE ${from + i} ===\n${t}`).join('\n\n')
console.log(`${a.file}: ${pages.length} pages, sending ${from}–${to} (${docText.length.toLocaleString()} characters)`)

// ── Ask for proposals ───────────────────────────────────────────────────────
const SYSTEM = `You extract business relationships from a company document for a financial graph. Every relationship you propose is checked by software against the document text, and rejected unless your quote appears in it word for word.

Rules:
- Propose only relationships the document states. Never infer, never use outside knowledge.
- "quote" must be copied exactly from the document — the sentence or table row that states the relationship. Do not paraphrase, shorten with ellipses, or fix typos.
- "page" is the number from the === PAGE n === marker the quote sits under.
- "weight" is a percentage only if the quote itself states it (e.g. ownership %, share of revenue). Otherwise null.
- Direction: supplier — from supplies to; customer — from is a customer of to; owns — from holds an equity stake in to; subsidiary — from is the parent, to the subsidiary; joint_venture — from and to are partners; director_of — from is the person, to the company.
- Ignore custodians and nominee companies (e.g. "HSBC Custody Nominees") as owners: they hold for others.
- Use the company's full name as written in the document. The document's own company is ${TICKER}.
- An empty list is a correct answer when the document states no such relationships.`

const TOOL = {
  name: 'propose_edges',
  description: 'Record the relationships the document states, each with a verbatim quote and page.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['proposals'],
    properties: {
      proposals: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'from', 'to', 'weight', 'quote', 'page'],
          properties: {
            type: { type: 'string', enum: PROPOSAL_TYPES },
            from: { type: 'string' },
            to: { type: 'string' },
            weight: { type: ['number', 'null'] },
            quote: { type: 'string' },
            page: { type: 'integer' },
          },
        },
      },
    },
  },
}

const client = new Anthropic()
let response
try {
  response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: `Document: ${a.label ?? path.basename(a.file)} (${TICKER}), as at ${a['as-at']}.\n\n${docText}` }],
  })
} catch (err) {
  if (err instanceof Anthropic.AuthenticationError) fail('ANTHROPIC_API_KEY is missing or invalid')
  if (err instanceof Anthropic.RateLimitError) fail('rate limited — try again shortly')
  if (err instanceof Anthropic.BadRequestError) fail(`request rejected: ${err.message} (a long document may need --pages)`)
  if (err instanceof Anthropic.APIError) fail(`API error ${err.status}: ${err.message}`)
  throw err
}
if (response.stop_reason === 'refusal') fail('the model declined this document')
if (response.stop_reason === 'max_tokens') console.warn('warning: output hit max_tokens — the proposal list may be cut short; narrow --pages')
const call = response.content.find((b) => b.type === 'tool_use' && b.name === TOOL.name)
const raw = Array.isArray(call?.input?.proposals) ? call.input.proposals : fail('no proposals returned')

// ── Validate in code ────────────────────────────────────────────────────────
const nodeByName = new Map()
const key = (s) => normaliseWs(s).toLowerCase().replace(/\b(limited|ltd|plc|inc|group|holdings|corporation|pty)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
for (const n of ALL_NODES) { nodeByName.set(key(n.name), n.id); if (n.ticker) nodeByName.set(n.ticker.toLowerCase(), n.id) }
const resolve = (name) => nodeByName.get(key(name)) ?? (key(name) === key(TICKER) ? TICKER : null)

let decisions = {}
try { decisions = JSON.parse(fs.readFileSync(DECISIONS, 'utf8')) } catch { /* first run */ }
const idOf = (p) => crypto.createHash('sha1').update([p.type, key(p.from), key(p.to), normaliseWs(p.quote)].join('|')).digest('hex').slice(0, 16)

const accepted = [], rejected = []
const seen = new Set()
for (const p of raw) {
  const id = idOf(p)
  if (seen.has(id)) continue
  seen.add(id)
  if (decisions[id]) { rejected.push({ ...p, id, reasons: [`already ${decisions[id].decision} in review (${decisions[id].at})`] }); continue }
  const v = validateProposal(p, pages)
  if (!v.ok) { rejected.push({ ...p, id, reasons: v.reasons }); continue }
  accepted.push({
    id, status: 'pending', type: p.type,
    from: { name: p.from, id: resolve(p.from) }, to: { name: p.to, id: resolve(p.to) },
    weight: p.weight, quote: normaliseWs(p.quote), page: v.page,
    ...(v.pageCorrected ? { pageClaimed: p.page } : {}),
    context: quoteContext(pages[v.page - 1], p.quote),
  })
}

for (const r of rejected) console.log(`REJECTED ${r.type} ${r.from} → ${r.to}: ${r.reasons.join('; ')}`)
for (const p of accepted) console.log(`proposed ${p.type} ${p.from.name}${p.from.id ? ` [${p.from.id}]` : ''} → ${p.to.name}${p.to.id ? ` [${p.to.id}]` : ''}${p.weight != null ? ` ${p.weight}%` : ''} (p${p.page}${p.pageClaimed ? `, model said p${p.pageClaimed}` : ''})`)

fs.mkdirSync(OUT_DIR, { recursive: true })
const out = path.join(OUT_DIR, `${TICKER}-${a['as-at']}.json`)
fs.writeFileSync(out, JSON.stringify({
  ticker: TICKER, label: a.label ?? path.basename(a.file), sourceUrl: a['source-url'], asAt: a['as-at'],
  pagesSent: [from, to], model: MODEL, generatedAt: new Date().toISOString(),
  usage: response.usage, proposals: accepted, rejected,
}, null, 2) + '\n')
console.log(`\n${accepted.length} proposed, ${rejected.length} rejected → ${path.relative(ROOT, out)}`)
