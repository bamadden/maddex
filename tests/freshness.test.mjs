// Freshness guard (15 Nov 2026). Every hand-typed figure, date, weight or
// constant has an as-of date no older than the maximum for its kind
// (src/data/freshness.js), or a dated flag that says why not, until when.
// A file holding typed tables must be registered or exempt with a reason.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { MAX_AGE_DAYS, VC_KINDS, FRESHNESS, FRESHNESS_ROWS, FRESHNESS_EXEMPT, FRESHNESS_FLAGS } from '../src/data/freshness.js'
import { VERIFIED_CONSTANTS } from '../src/data/verifiedConstants.js'

const NOW = Date.now()
const sydneyToday = new Date(NOW).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const ageOf = (d) => Math.floor((NOW - Date.parse(`${d}T00:00:00Z`)) / 86_400_000)
const read = (f) => fs.readFileSync(f, 'utf8')

// Problems as { id, what, problem }.
function problems() {
  const out = []
  const check = (id, what, kind, date) => {
    const max = MAX_AGE_DAYS[kind]
    assert.ok(max, `${id}: unknown kind ${kind}`)
    if (date == null) out.push({ id, what, problem: 'no as-of date' })
    else if (!ISO.test(date)) out.push({ id, what, problem: `as-of "${date}" is not a date` })
    else if (ageOf(date) > max) out.push({ id, what, problem: `${ageOf(date)} days old (${kind}, max ${max})` })
  }
  for (const e of FRESHNESS) {
    const m = read(e.file).match(new RegExp(`\\b${e.date}\\s*=\\s*(?:'(\\d{4}-\\d{2}-\\d{2})'|(null))`))
    assert.ok(m, `${e.id}: ${e.file} has no ${e.date} = 'YYYY-MM-DD' (or null)`)
    check(e.id, e.what, e.kind, m[1] ?? null)
  }
  return out
}

async function rowProblems() {
  const out = []
  for (const r of FRESHNESS_ROWS) {
    const mod = await import(`../${r.file}`)
    const rows = mod[r.rows]
    assert.ok(rows, `${r.file} exports no ${r.rows}`)
    const entries = Array.isArray(rows) ? rows.map((x) => [x[r.label], x[r.field]]) : Object.entries(rows).map(([k, v]) => [k, r.field ? v?.[r.field] : v])
    for (const [name, date] of entries) {
      const max = MAX_AGE_DAYS[r.kind]
      const id = `${r.id}:${name}`
      if (date == null) out.push({ id, what: r.what, problem: 'no as-of date' })
      else if (ageOf(date) > max) out.push({ id, what: r.what, problem: `${ageOf(date)} days old (${r.kind}, max ${max})` })
    }
  }
  for (const [key, g] of Object.entries(VERIFIED_CONSTANTS)) {
    if (!g || typeof g !== 'object') continue
    const kind = VC_KINDS[key] ?? ('cashRate' in g ? 'rate' : 'statistic')
    const dates = g.lastVerified ? [[key, g.lastVerified]] : Object.entries(g).filter(([, v]) => v?.lastVerified).map(([k, v]) => [`${key}.${k}`, v.lastVerified])
    if (!dates.length) out.push({ id: `vc:${key}`, what: `verifiedConstants.${key}`, problem: 'no lastVerified' })
    for (const [name, d] of dates) if (ageOf(d) > MAX_AGE_DAYS[kind]) out.push({ id: `vc:${name}`, what: `verifiedConstants.${name}`, problem: `last verified ${ageOf(d)} days ago (${kind}, max ${MAX_AGE_DAYS[kind]})` })
  }
  return out
}

// The scanner: a file with typed tables (lines with two or more `key: number`
// pairs, or typed dates), or forty-plus decimals in src/data or src/services.
const STYLE = /^(top|left|right|bottom|width|height|minWidth|maxWidth|minHeight|maxHeight|fontSize|lineHeight|opacity|zIndex|padding\w*|margin\w*|gap|flex\w*|borderRadius|strokeWidth|r|x|y|x1|x2|y1|y2|cx|cy|dx|dy|lat|lon|lng|latitude|longitude|zoom|pitch|bearing|duration|delay|order|rank|w|h|size|radius|tileSize|maxzoom|minzoom|offset|step|min|max|id|index|i|n|count|version|hour|minute|open|close|tz)$/
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => { const p = path.join(d, e.name); return e.isDirectory() ? walk(p) : /\.(js|jsx)$/.test(e.name) ? [p] : [] })
function typedTableFiles() {
  const hits = []
  for (const f of walk('src')) {
    const src = read(f)
    let rows = 0
    for (const line of src.split('\n')) {
      if (/^\s*\/\//.test(line)) continue
      const pairs = [...line.matchAll(/\b([A-Za-z_]\w*)\s*:\s*-?\d+(?:\.\d+)?\b/g)].filter((m) => !STYLE.test(m[1]))
      if (pairs.length >= 2 || /['"`]20\d\d-\d\d-\d\d/.test(line)) rows++
    }
    const decimals = (src.match(/\b\d+\.\d+\b/g) ?? []).length
    // Decimals count only where data lives: in components they are colours,
    // opacities and easing.
    const rel = f.split(path.sep).join('/')
    if (rows >= 4 || (decimals >= 40 && /^src\/(data|services)\//.test(rel))) hits.push(rel)
  }
  return hits
}

test('every file with hand-typed tables is registered or exempt with a reason', () => {
  const known = new Set([...FRESHNESS.map((e) => e.file), ...FRESHNESS_ROWS.map((e) => e.file), ...Object.keys(FRESHNESS_EXEMPT)])
  const missing = typedTableFiles().filter((f) => !known.has(f))
  assert.deepEqual(missing, [], `hand-typed tables with no as-of registration (src/data/freshness.js): ${missing.join(', ')}`)
  for (const f of known) assert.ok(fs.existsSync(f), `${f} is registered but does not exist`)
})

test('every hand-typed figure is within its maximum age, or flagged until a dated expiry', async (t) => {
  const all = [...problems(), ...await rowProblems()]
  const live = FRESHNESS_FLAGS.filter((f) => sydneyToday < f.until)
  for (const p of all) {
    const flag = live.find((f) => f.id === p.id)
    t.diagnostic(`${flag ? 'FLAGGED' : 'FAIL   '} ${p.id} — ${p.what}: ${p.problem}${flag ? ` · until ${flag.until}: ${flag.reason}` : ''}`)
  }
  const failing = all.filter((p) => !live.some((f) => f.id === p.id))
  assert.deepEqual(failing.map((p) => `${p.id}: ${p.problem}`), [])
  const unused = FRESHNESS_FLAGS.filter((f) => !all.some((p) => p.id === f.id))
  assert.deepEqual(unused.map((f) => f.id), [], 'flags for problems that no longer exist: delete them')
  for (const f of FRESHNESS_FLAGS) assert.ok(ISO.test(f.until) && f.reason, `${f.id}: a flag needs an until date and a reason`)
})

test('max ages are as stated: rates 45 days', () => {
  assert.equal(MAX_AGE_DAYS.rate, 45)
  for (const e of [...FRESHNESS, ...FRESHNESS_ROWS]) assert.ok(MAX_AGE_DAYS[e.kind], e.id)
})
