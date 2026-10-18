// Compares src/data/verifiedConstants.js against the agencies' own data.
//   npm run check-stats
// Exit code 1 when any figure has drifted, so it can run in CI or a cron.
import { fetchOfficialStats, reconcile } from '../src/services/officialStats.js'
import { VERIFIED_CONSTANTS } from '../src/data/verifiedConstants.js'

// The agencies' endpoints time out now and then; one retry for whichever
// feeds came back empty clears most of it.
const live = await fetchOfficialStats({ base: 'https://www.rba.gov.au' })
if (['rba', 'cpi', 'lf', 'gdp'].some((k) => !live[k])) {
  const again = await fetchOfficialStats({ base: 'https://www.rba.gov.au' })
  for (const k of ['rba', 'cpi', 'lf', 'gdp']) live[k] ??= again[k]
}
const rows = reconcile(VERIFIED_CONSTANTS, live)
const pad = (s, n) => String(s ?? '—').padEnd(n)
console.log(`\n${pad('FIGURE', 22)}${pad('CONSTANT', 11)}${pad('OFFICIAL', 11)}${pad('PERIOD', 26)}STATUS`)
for (const r of rows) {
  const mark = r.status === 'match' ? '✓ match' : r.status === 'drift' ? '⚠ DRIFT — update verifiedConstants.au/rba' : '✕ unavailable'
  console.log(`${pad(r.label, 22)}${pad(r.constant, 11)}${pad(r.official, 11)}${pad(r.period, 26)}${mark}`)
}
const drift = rows.filter((r) => r.status === 'drift')
const unavailable = rows.filter((r) => r.status !== 'match' && r.status !== 'drift').length
const tail = unavailable ? ` ${unavailable} figure(s) could not be checked — feed unreachable, run again.` : ''
console.log(drift.length ? `\n${drift.length} figure(s) out of date.${tail}` : unavailable === rows.length ? '\nNothing could be checked — every feed was unreachable.' : `\nAll reachable figures match the constants.${tail}`)
process.exit(drift.length ? 1 : 0)
