// ─── Australian 10-year bond yields, daily ──────────────────────────────────
//
// From the RBA's statistical table F2 (capital market yields — government
// bonds), series FCMYGBAG10D. Keyless CSV on www.rba.gov.au; no CORS, so it
// goes through the /api/reservebank proxy (vite.config.js in dev, vercel.json
// in production). The file is about 200 KB, so the 10-year column since 2020
// is kept in localStorage for twelve hours rather than re-fetched per render.

const CACHE_KEY = 'maddex_au10y_v1'
const TTL = 12 * 60 * 60 * 1000
const SINCE = '2020-01-01'
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }

export function parseF2(text, seriesId = 'FCMYGBAG10D') {
  const lines = text.split(/\r?\n/).map((l) => l.split(','))
  const ids = lines.find((c) => c[0] === 'Series ID')
  const col = ids ? ids.indexOf(seriesId) : -1
  if (col < 0) throw new Error(`F2: series ${seriesId} not found`)
  const out = []
  for (const c of lines) {
    const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(c[0] ?? '')
    if (!m || !MON[m[2]]) continue
    const y = parseFloat(c[col])
    if (!Number.isFinite(y)) continue
    const date = `${m[3]}-${MON[m[2]]}-${m[1]}`
    if (date >= SINCE) out.push({ date, y })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

// [{ date, y }] oldest first, with `source` and the date of the last yield.
export async function fetchAu10y({ base = '/api/reservebank', fetchImpl = fetch } = {}) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    if (cached && Date.now() - cached.fetchedAt < TTL) return cached
  } catch { /* storage unavailable — fetch */ }
  const r = await fetchImpl(`${base}/statistics/tables/csv/f2-data.csv`)
  if (!r.ok) throw new Error(`RBA F2 HTTP ${r.status}`)
  const yields = parseF2(await r.text())
  if (!yields.length) throw new Error('RBA F2: no 10-year yields parsed')
  const out = { fetchedAt: Date.now(), yields, lastDate: yields[yields.length - 1].date, source: 'RBA table F2 (FCMYGBAG10D)' }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(out)) } catch { /* cache is optional */ }
  return out
}
