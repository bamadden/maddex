// Fetch each source and write a dated record (data/records/<source>/<date>.json,
// Sydney date). Nothing in the app changes: a person reads the record, or
// `npm run data:verify`, and updates the constant with its date.
//   npm run data:fetch            every source
//   npm run data:fetch -- rba bls  named sources
import { SOURCES } from './sources/index.mjs'
import { recordingFetch, writeRecord } from './lib.mjs'

export async function fetchSource(id) {
  const src = SOURCES[id]
  if (!src) throw new Error(`unknown source ${id}; known: ${Object.keys(SOURCES).join(', ')}`)
  const shapes = {}
  const fetchedAt = new Date().toISOString()
  try {
    const { figures } = await src.fetchRecord(recordingFetch(shapes))
    return { source: id, name: src.SOURCE.name, fetchedAt, ok: true, figures, shapes }
  } catch (e) {
    return { source: id, name: src.SOURCE.name, fetchedAt, ok: false, error: String(e.message ?? e), shapes }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES)
  let failed = 0
  for (const id of ids) {
    const rec = await fetchSource(id)
    const file = writeRecord(rec)
    console.log(`${rec.ok ? '✓' : '✕'} ${id.padEnd(4)} ${rec.ok ? `→ ${file.replace(/^.*\/data\/records/, 'data/records')}` : rec.error}`)
    if (!rec.ok) failed++
  }
  process.exit(failed ? 1 : 0)
}
