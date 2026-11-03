// Re-reads every row of src/data/rbaDecisions.js from rba.gov.au: the cash
// rate target table (effective date, change, rate, statement link) and each
// statement (its own date). Exits 1 on any difference, 2 if the RBA site
// could not be read.
//   npm run check-rba

import { RBA_DECISIONS, rbaStatementUrl } from '../src/data/rbaDecisions.js'

const UA = { 'user-agent': 'Mozilla/5.0 (maddex check-rba)' }
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
const iso = (d, m, y) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

async function get(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.text()
}

let page
try { page = await get('https://www.rba.gov.au/statistics/cash-rate/') } catch (e) { console.error(`Could not read the RBA cash rate table: ${e.message}`); process.exit(2) }
const table = new Map()
for (const [, row] of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
  const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1]))
  const m = cells[0]?.match(/^(\d{1,2}) (\w{3}) (\d{4})$/)
  if (!m) continue
  const mr = row.match(/\/media-releases\/\d{4}\/(mr-\d\d-\d\d)\.html/)?.[1] ?? null
  table.set(iso(m[1], MON[m[2]], m[3]), { changeBp: Math.round(parseFloat(cells[1]) * 100), rate: parseFloat(cells[2]), mr })
}

let bad = 0
const check = (ok, line) => { console.log(`${ok ? '✓' : '✗'} ${line}`); if (!ok) bad++ }
for (const d of RBA_DECISIONS) {
  const t = table.get(d.effective)
  if (!t) { check(false, `${d.announced}: no row effective ${d.effective} in the RBA table`); continue }
  const stmt = await get(rbaStatementUrl(d.mr)).catch((e) => { check(false, `${d.mr}: ${e.message}`); return null })
  const dated = stmt?.match(/<time[^>]*datetime="(\d{4}-\d\d-\d\d)/)?.[1]
  const issues = [
    t.rate !== d.rate && `rate ${d.rate} vs RBA ${t.rate}`,
    t.changeBp !== d.changeBp && `change ${d.changeBp}bp vs RBA ${t.changeBp}bp`,
    t.mr !== d.mr && `statement ${d.mr} vs RBA ${t.mr}`,
    stmt && dated !== d.announced && `announced ${d.announced} vs statement ${dated}`,
  ].filter(Boolean)
  check(!issues.length, `${d.announced} ${d.rate.toFixed(2)}% ${d.changeBp >= 0 ? '+' : ''}${d.changeBp}bp ${d.mr}${issues.length ? ` — ${issues.join('; ')}` : ''}`)
}
console.log(bad ? `\n${bad} row(s) differ from rba.gov.au.` : `\nAll ${RBA_DECISIONS.length} rows match rba.gov.au.`)
process.exit(bad ? 1 : 0)
