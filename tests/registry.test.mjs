// The data registry (src/data/registry.js; docs/DATA_PLATFORM.md). Every
// dataset declares source, licence, fetch method, cadence, maximum age, class
// and fallback; every one is within its maximum age, or flagged until a dated
// expiry; every file holding typed tables belongs to a dataset or is exempt
// with a reason. Folds in the freshness guard (15 Nov 2026).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { MAX_AGE_DAYS, CLASSES, DATASETS, EXEMPT, FLAGS, fileOf } from '../src/data/registry.js'
import { VERIFIED_CONSTANTS } from '../src/data/verifiedConstants.js'
import { LICENCE_OFF } from '../src/data/sourceLicence.js'

const NOW = Date.now()
const sydneyToday = new Date(NOW).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const ageOf = (d) => Math.floor((NOW - Date.parse(`${d}T00:00:00Z`)) / 86_400_000)
const read = (f) => fs.readFileSync(f, 'utf8')
const PKG = JSON.parse(read('package.json')).scripts

test('every dataset declares source, licence, fetch method, cadence, max age, class and fallback', () => {
  const ids = new Set()
  for (const e of DATASETS) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`); ids.add(e.id)
    for (const k of ['what', 'licence', 'cadence', 'fallback']) assert.ok(typeof e[k] === 'string' && e[k].length > 3, `${e.id}: ${k}`)
    assert.ok(e.source?.name, `${e.id}: source.name`)
    assert.ok(e.source.url === null || /^https?:\/\//.test(e.source.url), `${e.id}: source.url is a URL or null`)
    assert.ok(CLASSES.includes(e.cls), `${e.id}: class ${e.cls}`)
    assert.ok(Number.isInteger(e.maxAgeDays) && e.maxAgeDays > 0, `${e.id}: maxAgeDays`)
    assert.ok(['manual', 'fetcher', 'derived', 'demo'].includes(e.fetch?.method) && e.fetch.how, `${e.id}: fetch`)
    assert.ok(Array.isArray(e.modules) && e.modules.length, `${e.id}: modules`)
    assert.ok(e.asOf !== undefined, `${e.id}: asOf`)
    assert.ok(e.cls === 'demo' || e.asOf, `${e.id}: only demo data may have no as-of date`)
    assert.ok(fileOf(e) && fs.existsSync(fileOf(e)), `${e.id}: file ${fileOf(e)}`)
  }
})

test('every verify command named in the registry exists', () => {
  for (const e of DATASETS) {
    const v = e.fetch.verify
    if (!v) continue
    const m = v.match(/^npm run ([\w:-]+)/)
    assert.ok(m && PKG[m[1]], `${e.id}: ${v} is not a package script`)
  }
})

test('no dataset relies on a source switched off for licence reasons', () => {
  const off = Object.keys(LICENCE_OFF)
  for (const e of DATASETS) {
    const text = `${e.source.name} ${e.source.url ?? ''}`.toLowerCase()
    for (const id of off) assert.ok(!text.includes(id), `${e.id} names ${id}, which is off: ${LICENCE_OFF[id]}`)
  }
})

test('every verifiedConstants group is a registered dataset', () => {
  const registered = new Set(DATASETS.map((e) => e.asOf?.vc).filter(Boolean))
  const groups = Object.entries(VERIFIED_CONSTANTS).filter(([, g]) => g && typeof g === 'object').map(([k]) => k)
  assert.deepEqual(groups.filter((k) => !registered.has(k)), [], 'unregistered verifiedConstants groups')
  for (const k of registered) assert.ok(VERIFIED_CONSTANTS[k], `vc:${k} is registered but not in verifiedConstants`)
})

// Problems as { id, what, problem }.
async function problems() {
  const out = []
  const check = (id, what, max, date) => {
    if (date == null) out.push({ id, what, problem: 'no as-of date' })
    else if (!ISO.test(date)) out.push({ id, what, problem: `as-of "${date}" is not a date` })
    else if (ageOf(date) > max) out.push({ id, what, problem: `${ageOf(date)} days old (max ${max})` })
  }
  for (const e of DATASETS) {
    const a = e.asOf
    if (!a) continue
    if (a.vc) {
      const g = VERIFIED_CONSTANTS[a.vc]
      const dates = g.lastVerified ? [[e.id, g.lastVerified]] : Object.entries(g).filter(([, v]) => v?.lastVerified).map(([k, v]) => [`${e.id}.${k}`, v.lastVerified])
      if (!dates.length) out.push({ id: e.id, what: e.what, problem: 'no lastVerified' })
      for (const [id, date] of dates) check(id, e.what, e.maxAgeDays, date)
    } else if (a.rows) {
      const rows = (await import(`../${a.file}`))[a.rows]
      assert.ok(rows, `${a.file} exports no ${a.rows}`)
      const entries = Array.isArray(rows) ? rows.map((x) => [x[a.label], x[a.field]]) : Object.entries(rows).map(([k, v]) => [k, a.field ? v?.[a.field] : v])
      for (const [name, date] of entries) check(`${e.id}:${name}`, e.what, e.maxAgeDays, date)
    } else {
      const m = read(a.file).match(new RegExp(`\\b${a.date}\\s*=\\s*(?:'(\\d{4}-\\d{2}-\\d{2})'|(null))`))
      assert.ok(m, `${e.id}: ${a.file} has no ${a.date} = 'YYYY-MM-DD' (or null)`)
      check(e.id, e.what, e.maxAgeDays, m[1] ?? null)
    }
  }
  return out
}

// The scanner: a file with typed tables (lines with two or more `key: number`
// pairs, or typed dates), or forty-plus decimals in src/data or src/services.
const STYLE = /^(top|left|right|bottom|width|height|minWidth|maxWidth|minHeight|maxHeight|fontSize|lineHeight|opacity|zIndex|padding\w*|margin\w*|gap|flex\w*|borderRadius|strokeWidth|r|x|y|x1|x2|y1|y2|cx|cy|dx|dy|lat|lon|lng|latitude|longitude|zoom|pitch|bearing|duration|delay|order|rank|w|h|size|radius|tileSize|maxzoom|minzoom|offset|step|min|max|id|index|i|n|count|version|hour|minute|open|close|tz|maxAgeDays|rate|price|statistic|schedule|editorial|history|reference|method)$/
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

test('every file with hand-typed tables belongs to a dataset or is exempt with a reason', () => {
  const known = new Set([...DATASETS.map(fileOf), ...Object.keys(EXEMPT)])
  const missing = typedTableFiles().filter((f) => !known.has(f))
  assert.deepEqual(missing, [], `hand-typed tables in no dataset (src/data/registry.js): ${missing.join(', ')}`)
  for (const f of Object.keys(EXEMPT)) assert.ok(fs.existsSync(f), `${f} is exempt but does not exist`)
})

test('every dataset is within its maximum age, or flagged until a dated expiry', async (t) => {
  const all = await problems()
  const live = FLAGS.filter((f) => sydneyToday < f.until)
  for (const p of all) {
    const flag = live.find((f) => f.id === p.id)
    t.diagnostic(`${flag ? 'FLAGGED' : 'FAIL   '} ${p.id} — ${p.what}: ${p.problem}${flag ? ` · until ${flag.until}: ${flag.reason}` : ''}`)
  }
  const failing = all.filter((p) => !live.some((f) => f.id === p.id))
  assert.deepEqual(failing.map((p) => `${p.id}: ${p.problem}`), [])
  const unused = FLAGS.filter((f) => !all.some((p) => p.id === f.id))
  assert.deepEqual(unused.map((f) => f.id), [], 'flags for problems that no longer exist: delete them')
  for (const f of FLAGS) assert.ok(ISO.test(f.until) && f.reason, `${f.id}: a flag needs an until date and a reason`)
})

test('max ages are as stated: rates 45 days', async () => {
  assert.equal(MAX_AGE_DAYS.rate, 45)
  // A rate is 45 days, or 30 when it is checked by hand with no fetcher.
  const { isManual } = await import('../src/data/registry.js')
  for (const e of DATASETS.filter((x) => x.kind === 'rate')) assert.equal(e.maxAgeDays, isManual(e) ? 30 : 45, e.id)
})

test('the dataset table in docs/DATA_PLATFORM.md matches the registry (npm run data:docs)', async () => {
  const { registryTable, START, END } = await import('../scripts/data/registryTable.mjs')
  const doc = read('docs/DATA_PLATFORM.md')
  const a = doc.indexOf(START), b = doc.indexOf(END)
  assert.ok(a >= 0 && b > a, 'registry markers in docs/DATA_PLATFORM.md')
  assert.equal(doc.slice(a + START.length, b).trim(), registryTable())
})

test('src/data/registryHealth.js is generated from the registry and current (npm run data:docs)', async () => {
  const { healthSource } = await import('../scripts/data/registryDates.mjs')
  assert.equal(read('src/data/registryHealth.js'), await healthSource())
})

test('manually checked data: at most 30 days old, unless held with a dated reason', async () => {
  const { MANUAL_MAX_DAYS, isManual } = await import('../src/data/registry.js')
  assert.equal(MANUAL_MAX_DAYS, 30)
  for (const e of DATASETS.filter(isManual)) {
    if (e.manualHold) {
      assert.ok(ISO.test(e.manualHold.until) && e.manualHold.reason, `${e.id}: a hold needs an until date and a reason`)
      assert.ok(sydneyToday < e.manualHold.until, `${e.id}: its hold expired on ${e.manualHold.until}`)
    } else assert.ok(e.maxAgeDays <= 30, `${e.id}: ${e.maxAgeDays} days`)
  }
})

test('every badge for manually checked data reads "manually checked, DATE"', async () => {
  const { isManual } = await import('../src/data/registry.js')
  const { badgeText } = await import('../src/utils/dataClass.js')
  assert.equal(badgeText({ cls: 'DELAYED', source: 'RBA', at: '2026-11-16', manual: true }), 'DELAYED · RBA · manually checked, 16 Nov 2026')
  const consts = new Set(DATASETS.filter(isManual).map((e) => e.asOf?.date).filter(Boolean).concat(['BOND_CURVES_CHECKED']))
  const files = fs.readdirSync('src', { recursive: true }).filter((f) => /\.jsx$/.test(f)).map((f) => `src/${f}`)
  const bad = []
  for (const f of files) {
    for (const m of read(f).matchAll(/<DataBadge\b[^>]*?\bat=\{(\w+)\}[^>]*?\/>/g)) {
      if (consts.has(m[1]) && !/\bmanual\b/.test(m[0])) bad.push(`${f}: ${m[0].slice(0, 90)}`)
    }
  }
  assert.deepEqual(bad, [])
  assert.match(read('src/components/ui/VerifiedBadge.jsx'), /at=\{c\.lastVerified \?\? null\} manual/)
})

test('the dated list of manual data in docs/DATA_PLATFORM.md matches the registry (npm run data:docs)', async () => {
  const { manualTable, MANUAL_START, MANUAL_END } = await import('../scripts/data/registryTable.mjs')
  const doc = read('docs/DATA_PLATFORM.md')
  const a = doc.indexOf(MANUAL_START), b = doc.indexOf(MANUAL_END)
  assert.ok(a >= 0 && b > a)
  assert.equal(doc.slice(a + MANUAL_START.length, b).trim(), await manualTable())
})
