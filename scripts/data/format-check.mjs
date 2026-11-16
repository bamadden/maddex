// Nightly format-change check (WS1 step 3). Fetches every source, compares
// the shape of each response (CSV header and series-ID rows, JSON keys, HTTP
// status) with the last accepted shapes in scripts/data/formats.json, runs
// the verification, and writes a Markdown report.
//
//   npm run data:format-check              report to stdout (and to
//                                          $GITHUB_STEP_SUMMARY in Actions)
//   npm run data:format-check -- --accept  record today's shapes as accepted
//
// Exit 1 when a source failed or its format changed. A figure that differs
// from its constant is reported but does not fail the run: updating it needs
// a person to read the release.
import fs from 'node:fs'
import { SOURCES } from './sources/index.mjs'
import { fetchSource } from './fetch.mjs'
import { sydneyDate } from './lib.mjs'
import { VERIFIED_CONSTANTS } from '../../src/data/verifiedConstants.js'

const BASELINE = new URL('./formats.json', import.meta.url)

export function compareShapes(accepted = {}, today = {}) {
  const changes = []
  for (const [url, shape] of Object.entries(today)) {
    const was = accepted[url]
    if (!was) { changes.push({ url, change: 'new endpoint (not in the accepted shapes)' }); continue }
    for (const k of new Set([...Object.keys(was), ...Object.keys(shape)])) {
      if (JSON.stringify(was[k]) !== JSON.stringify(shape[k])) changes.push({ url, change: `${k}: ${JSON.stringify(was[k])} → ${JSON.stringify(shape[k])}` })
    }
  }
  for (const url of Object.keys(accepted)) if (!(url in today)) changes.push({ url, change: 'no longer requested (or the fetch stopped before it)' })
  return changes
}

export function report(results, date) {
  const lines = [`# Data format check, ${date} (Sydney)`, '', '| Source | Fetch | Format | Figures |', '|---|---|---|---|']
  for (const r of results) {
    const figs = r.rows.length ? `${r.rows.filter((x) => x.status === 'match').length}/${r.rows.length} match` : '—'
    lines.push(`| ${r.name} | ${r.ok ? 'ok' : `**failed**: ${r.error}`} | ${r.changes.length ? `**${r.changes.length} change(s)**` : 'unchanged'} | ${figs} |`)
  }
  const changed = results.filter((r) => r.changes.length)
  if (changed.length) {
    lines.push('', '## Format changes', '', 'Check the parser in `scripts/data/sources/` against the new format, then run `npm run data:format-check -- --accept`.', '')
    for (const r of changed) for (const c of r.changes) lines.push(`- ${r.name}: \`${c.url}\`: ${c.change}`)
  }
  const differing = results.flatMap((r) => r.rows.filter((x) => x.status !== 'match').map((x) => ({ ...x, source: r.name })))
  if (differing.length) {
    lines.push('', '## Figures that differ or are for another period', '', 'Read the release, then update `src/data/verifiedConstants.js` with its date.', '')
    for (const x of differing) lines.push(`- ${x.source}, ${x.label} (\`${x.constant}\`): ours ${x.ours ?? '—'}, source ${x.official ?? '—'}, ${x.period}: ${x.status}${x.note ? `; ${x.note}` : ''}`)
  }
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const accepted = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {}
  const results = []
  for (const id of Object.keys(SOURCES)) {
    const rec = await fetchSource(id)
    const rows = rec.ok ? SOURCES[id].verify(rec, VERIFIED_CONSTANTS) : []
    results.push({ id, name: rec.name, ok: rec.ok, error: rec.error, shapes: rec.shapes, changes: rec.ok ? compareShapes(accepted[id], rec.shapes) : [], rows })
  }
  if (process.argv.includes('--accept')) {
    const next = { ...accepted }
    for (const r of results) if (r.ok) next[r.id] = r.shapes
    for (const r of results) if (r.ok) r.changes = []
    fs.writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`)
    console.log(`Accepted today's shapes for ${results.filter((r) => r.ok).map((r) => r.id).join(', ')}.`)
  }
  const md = report(results, sydneyDate())
  console.log(md)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
  fs.mkdirSync('reports', { recursive: true })
  fs.writeFileSync('reports/data-format-check.md', md)
  const failing = results.filter((r) => !r.ok || (!process.argv.includes('--accept') && r.changes.length))
  process.exit(failing.length ? 1 : 0)
}
