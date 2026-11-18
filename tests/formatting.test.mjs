// One formatting layer (WS3, 19 Nov 2026): money always says A$ or US$ and
// uses a true minus; no bare "$" amount in the code; no raw ISO date shown
// as an "as at" date.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fmt, MINUS } from '../src/utils/format.js'

test('money names its currency and uses a true minus', () => {
  assert.equal(fmt.aud(1234.5), 'A$1,234.50')
  assert.equal(fmt.aud(1234.5, { clarify: false }), 'A$1,234.50', 'clarify no longer drops the A')
  assert.equal(fmt.aud(-2), `${MINUS}A$2.00`)
  assert.equal(fmt.usd(3), 'US$3.00')
  assert.equal(fmt.money(5, 'EUR'), '5.00 EUR')
  assert.equal(fmt.currency(7), 'A$7.00')
  assert.equal(fmt.aud(null), '—')
})

const SRC = fs.readdirSync('src', { recursive: true }).filter((f) => /\.jsx?$/.test(f)).map((f) => `src/${f}`)
// Quotes from filings keep their own words; regex replacements use $1.
const EXEMPT = new Set(['src/data/graph/keyFacts.js', 'src/services/aiResponseFormat.js', 'src/services/officialStats.js'])
const lines = (f) => fs.readFileSync(f, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*(\/\/|\*|\{\/\*)/.test(l))

test('no bare "$" amount anywhere in src', () => {
  const bad = []
  for (const f of SRC.filter((x) => !EXEMPT.has(x))) {
    for (const [n, l] of lines(f)) {
      const code = l.replace(/\/\/.*$/, '')
      if (/(?<![A-Z$\\`])\$(?=\d)|`\$\$\{|(?<![A-Z])\$\$\{/.test(code)) bad.push(`${f}:${n}: ${l.trim().slice(0, 100)}`)
    }
  }
  assert.deepEqual(bad, [])
})

// Prompt context for MaddenAI keeps ISO dates: the model reads them, readers
// do not.
const PROMPT_CONTEXT = new Set(['src/data/verifiedConstants.js', 'src/services/morningBriefService.js', 'src/services/researchNoteService.js'])
test('no raw ISO date shown after "as at"', () => {
  const bad = []
  for (const f of SRC.filter((x) => !PROMPT_CONTEXT.has(x))) {
    for (const [n, l] of lines(f)) if (/as at \{[\w.?]+(asOf|AsOf|asOfBy)[\w.?[\]]*\}|as at \$\{[\w.?]+(asOf|AsOf)[\w.?[\]]*\}/.test(l)) bad.push(`${f}:${n}`)
  }
  assert.deepEqual(bad, [])
})
