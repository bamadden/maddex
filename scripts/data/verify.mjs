// Compare the constants with the newest record for each source (fetching one
// first when there is none from today). Exit 1 when a figure differs.
//   npm run data:verify            every source
//   npm run data:verify -- abs     one source
import { SOURCES } from './sources/index.mjs'
import { latestRecord, sydneyDate, writeRecord } from './lib.mjs'
import { fetchSource } from './fetch.mjs'
import { VERIFIED_CONSTANTS } from '../../src/data/verifiedConstants.js'

export async function verifySource(id, { refetch = false } = {}) {
  let rec = latestRecord(id)
  if (refetch || !rec || sydneyDate(new Date(rec.fetchedAt)) !== sydneyDate()) { rec = await fetchSource(id); writeRecord(rec) }
  if (!rec.ok) return { id, rec, rows: [], error: rec.error }
  return { id, rec, rows: SOURCES[id].verify(rec, VERIFIED_CONSTANTS) }
}

const MARK = { match: '✓ match', drift: '⚠ DRIFT', missing: '⚠ no constant', unavailable: '✕ not in the record', period: '… different period' }
const pad = (s, n) => String(s ?? '—').padEnd(n)

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const refetch = process.argv.includes('--refetch')
  let drift = 0
  for (const id of ids.length ? ids : Object.keys(SOURCES)) {
    const { rec, rows, error } = await verifySource(id, { refetch })
    console.log(`\n${rec.name} (record ${rec.fetchedAt.slice(0, 16)}Z)`)
    if (error) { console.log(`  ✕ fetch failed: ${error}`); continue }
    for (const r of rows) {
      console.log(`  ${pad(r.label, 26)}${pad(r.ours, 8)}${pad(r.official, 8)}${pad(r.period, 22)}${MARK[r.status]}${r.note ? ` · ${r.note}` : ''}`)
      if (r.status === 'drift' || r.status === 'missing') drift++
    }
  }
  console.log(drift ? `\n${drift} figure(s) differ from the source.` : '\nNo figure differs from its source.')
  process.exit(drift ? 1 : 0)
}
