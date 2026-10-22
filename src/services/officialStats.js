import { VERIFIED_CONSTANTS, markConfirmed } from '../data/verifiedConstants.js'

// ─── Official statistics, straight from the agencies ────────────────────────
//
// WHY THIS EXISTS. The headline Australian figures — cash rate, CPI, trimmed
// mean, unemployment, GDP — live in verifiedConstants.js and are checked by
// hand. Hand-checking is what lets them drift: on 1 Oct 2026 the file still
// held a 4.35% cash rate two days after the RBA moved to 4.60%, and a
// trimmed mean from the previous year.
//
// Both agencies publish these as free, keyless machine-readable data:
//   - ABS Data API (SDMX), data.api.abs.gov.au — CORS-enabled, called direct.
//   - RBA statistical table A2 (CSV), www.rba.gov.au — no CORS, so proxied
//     through /api/reservebank (vite.config.js in dev, vercel.json in prod).
//
// WHAT IT DOES WITH THEM. It does not silently replace the constants: many
// consumers derive from them at import time, and a figure that changes under
// half the screen is worse than one that is a day stale. Instead each figure
// is RECONCILED against its constant. A match means the constant is confirmed
// current today (its staleness warning clears). A mismatch is surfaced loudly,
// with the official value and period, so the constant gets updated rather
// than quietly being wrong.
//
// Every function takes an optional `base` so the same code runs in the
// browser (proxied) and in scripts/check-official-stats.mjs (direct).

const ABS = 'https://data.api.abs.gov.au/rest/data'

async function absSeries(flow, key, startPeriod, fetchImpl = fetch) {
  const url = `${ABS}/${flow}/${key}?startPeriod=${startPeriod}&format=csv`
  const r = await fetchImpl(url)
  if (!r.ok) throw new Error(`ABS ${flow} HTTP ${r.status}`)
  const lines = (await r.text()).trim().split(/\r?\n/)
  const head = lines[0].split(',')
  const ti = head.indexOf('TIME_PERIOD'), vi = head.indexOf('OBS_VALUE')
  return lines.slice(1)
    .map((l) => l.split(','))
    .map((c) => ({ period: c[ti], value: parseFloat(c[vi]) }))
    .filter((o) => o.period && Number.isFinite(o.value))
    .sort((a, b) => a.period.localeCompare(b.period))
}

const monthsAgo = (n) => {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 7)
}
const quarterOf = (d) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
const r1 = (v) => Math.round(v * 10) / 10

// "2026-08" → "Aug 2026"; "2026-Q2" → "Jun 2026 quarter"
const periodLabel = (p) => {
  const q = p.match(/^(\d{4})-Q(\d)$/)
  if (q) return `${new Date(+q[1], +q[2] * 3 - 1, 1).toLocaleDateString('en-AU', { month: 'short' })} ${q[1]} quarter`
  const m = p.match(/^(\d{4})-(\d{2})$/)
  if (m) return `${new Date(+m[1], +m[2] - 1, 1).toLocaleDateString('en-AU', { month: 'short' })} ${m[1]}`
  return p
}

export async function fetchRbaCashRate({ base = '/api/reservebank', fetchImpl = fetch } = {}) {
  const r = await fetchImpl(`${base}/statistics/tables/csv/a2-data.csv`)
  if (!r.ok) throw new Error(`RBA A2 HTTP ${r.status}`)
  const rows = (await r.text()).split(/\r?\n/).map((l) => l.split(','))
  // Data rows start with a date like 30-Sep-2026; columns 1-2 are the change
  // and the new cash rate target. Early rows hold ranges ("17.00 to 17.50"),
  // which parseFloat skips past harmlessly because only the last row is used.
  const data = rows.filter((c) => /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(c[0]) && Number.isFinite(parseFloat(c[2])))
  const last = data[data.length - 1]
  if (!last) throw new Error('RBA A2: no data rows')
  const effective = new Date(`${last[0]} 00:00:00`)
  return {
    value: parseFloat(last[2]),
    change: last[1],
    period: `effective ${effective.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    effectiveIso: effective.toLocaleDateString('en-CA'),
    source: 'rba.gov.au table A2',
  }
}

export async function fetchAuCpi({ fetchImpl = fetch } = {}) {
  const [headline, trimmed] = await Promise.all([
    absSeries('ABS,CPI,2.0.0', '3.10001.10.50.M', monthsAgo(6), fetchImpl),
    absSeries('ABS,CPI,2.0.0', '3.999902.20.50.M', monthsAgo(6), fetchImpl),
  ])
  const h = headline[headline.length - 1], hp = headline[headline.length - 2]
  const t = trimmed[trimmed.length - 1]
  return {
    cpi: h && { value: r1(h.value), period: periodLabel(h.period), raw: h.period },
    cpiPrevious: hp && { value: r1(hp.value), period: periodLabel(hp.period) },
    trimmedMean: t && { value: r1(t.value), period: periodLabel(t.period) },
    source: 'ABS Data API — CPI',
  }
}

export async function fetchAuUnemployment({ fetchImpl = fetch } = {}) {
  const s = await absSeries('ABS,LF,1.0.0', 'M13.3.1599.20.AUS.M', monthsAgo(6), fetchImpl)
  const l = s[s.length - 1]
  return { value: r1(l.value), period: periodLabel(l.period), source: 'ABS Data API — Labour Force' }
}

export async function fetchAuGdp({ fetchImpl = fetch } = {}) {
  const start = new Date(); start.setMonth(start.getMonth() - 21)
  const [qoq, levels] = await Promise.all([
    absSeries('ABS,ANA_AGG,1.0.0', 'M2.GPM.20.AUS.Q', quarterOf(start), fetchImpl),
    absSeries('ABS,ANA_AGG,1.0.0', 'M1.GPM.20.AUS.Q', quarterOf(start), fetchImpl),
  ])
  const q = qoq[qoq.length - 1]
  // Annual growth is not a separate series; it is this quarter's chain-volume
  // level against the same quarter a year earlier.
  const last = levels[levels.length - 1]
  const yearAgo = last && levels.find((o) => o.period === `${+last.period.slice(0, 4) - 1}${last.period.slice(4)}`)
  return {
    qoq: q && { value: r1(q.value), period: periodLabel(q.period) },
    annual: last && yearAgo && { value: r1((last.value / yearAgo.value - 1) * 100), period: periodLabel(last.period) },
    source: 'ABS Data API — National Accounts',
  }
}

// Fetches everything, settling each independently so one slow agency never
// blanks the others.
export async function fetchOfficialStats(opts = {}) {
  const [rba, cpi, lf, gdp, us] = await Promise.allSettled([
    fetchRbaCashRate(opts), fetchAuCpi(opts), fetchAuUnemployment(opts), fetchAuGdp(opts), fetchUsOfficial(opts),
  ])
  const ok = (r) => (r.status === 'fulfilled' ? r.value : null)
  return { rba: ok(rba), cpi: ok(cpi), lf: ok(lf), gdp: ok(gdp), us: ok(us), fetchedAt: Date.now() }
}

// US headline figures, all from FRED: one keyless CSV source for the BLS,
// BEA and Federal Reserve series alike. Proxied as /api/fred in the browser
// (FRED sends no CORS headers). Not BLS's own API, which publishes first but
// allows about 25 keyless queries a day per IP — in production every reader
// shares Vercel's IP, so the startup check would exhaust it before lunch.
export async function fetchUsOfficial({ fredBase = '/api/fred', fetchImpl = fetch } = {}) {
  const start = `${new Date().getFullYear() - 2}-01-01`
  const get = (id) => fredSeries(id, start, fetchImpl, `${fredBase}/graph/fredgraph.csv`)
  const settled = await Promise.allSettled(['CPIAUCNS', 'CPILFENS', 'UNRATE', 'A191RL1Q225SBEA', 'DFEDTARU'].map(get))
  const [cpi, core, ur, gdp, tgt] = settled.map((r) => (r.status === 'fulfilled' && r.value.length ? r.value : null))
  if (![cpi, core, ur, gdp, tgt].some(Boolean)) throw new Error('FRED unreachable')
  // CPI year on year from the unadjusted index, as BLS headlines it.
  const yoy = (rows) => {
    if (!rows) return null
    const last = rows[rows.length - 1]
    const prior = rows.find((o) => o.date === `${+last.date.slice(0, 4) - 1}${last.date.slice(4)}`)
    return prior ? { value: r1((last.value / prior.value - 1) * 100), period: periodLabel(last.date.slice(0, 7)) } : null
  }
  const last = (rows, period) => (rows ? { value: rows[rows.length - 1].value, period: period(rows[rows.length - 1].date) } : null)
  return {
    cpi: yoy(cpi),
    cpiCore: yoy(core),
    unemployment: last(ur, (d) => periodLabel(d.slice(0, 7))),
    gdp: last(gdp, (d) => `Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1} ${d.slice(0, 4)}`),
    fedUpper: last(tgt, (d) => `target as at ${d}`),
    source: 'FRED (BLS, BEA, Federal Reserve)',
  }
}

// Where a reader can see each figure at its source.
export const SOURCE_URL = {
  cashRate: 'https://www.rba.gov.au/statistics/cash-rate/',
  cpi: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release',
  cpiTrimmedMean: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release',
  unemployment: 'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release',
  gdpQoQ: 'https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release',
  gdpAnnual: 'https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release',
}

// Each official figure beside the constant it should equal. `group` is the
// verifiedConstants key whose staleness a match can clear.
export function reconcile(constants, live) {
  const { rba, au, us, fed } = constants
  const row = (label, group, field, constant, official, source) => ({
    label, group, field, constant, source, dp: field === 'cashRate' || field === 'fedUpper' ? 2 : 1,
    official: official?.value ?? null,
    period: official?.period ?? null,
    status: official?.value == null ? 'unavailable' : Math.abs(official.value - constant) < 0.05 ? 'match' : 'drift',
  })
  return [
    row('RBA cash rate', 'rba', 'cashRate', rba.cashRate, live.rba, live.rba?.source),
    row('AU CPI (annual)', 'au', 'cpi', au.cpi, live.cpi?.cpi, live.cpi?.source),
    row('Trimmed mean CPI', 'au', 'cpiTrimmedMean', au.cpiTrimmedMean, live.cpi?.trimmedMean, live.cpi?.source),
    row('Unemployment rate', 'au', 'unemployment', au.unemployment, live.lf, live.lf?.source),
    row('GDP growth (QoQ)', 'au', 'gdpQoQ', au.gdpQoQ, live.gdp?.qoq, live.gdp?.source),
    row('GDP growth (annual)', 'au', 'gdpAnnual', au.gdpAnnual, live.gdp?.annual, live.gdp?.source),
    row('Fed funds (upper)', 'fed', 'fedUpper', fed.cashRate, live.us?.fedUpper, live.us?.source),
    row('US CPI (annual)', 'us', 'cpi', us.cpi, live.us?.cpi, live.us?.source),
    row('US core CPI', 'us', 'cpiCore', us.cpiCore, live.us?.cpiCore, live.us?.source),
    row('US unemployment', 'us', 'unemployment', us.unemployment, live.us?.unemployment, live.us?.source),
    row('US GDP (annualised)', 'us', 'gdpQoQAnnualised', us.gdpQoQAnnualised, live.us?.gdp, live.us?.source),
  ]
}

// ── History series (script only) ─────────────────────────────────────────────
// The chart series in verifiedConstants (au.cpiHistory, unemploymentHistory,
// gdpHistory) and rba.decisions, point by point against the agencies.
// Revisions are normal — the ABS revises labour force and national accounts
// figures every release — so a mismatch here is a prompt to refresh the
// series, not evidence it was wrong when written.

export async function fetchRbaChanges({ base = '/api/reservebank', fetchImpl = fetch, since = '2025-01-01' } = {}) {
  const r = await fetchImpl(`${base}/statistics/tables/csv/a2-data.csv`)
  if (!r.ok) throw new Error(`RBA A2 HTTP ${r.status}`)
  return (await r.text()).split(/\r?\n/).map((l) => l.split(','))
    .filter((c) => /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(c[0]) && Number.isFinite(parseFloat(c[2])))
    .map((c) => ({ effective: new Date(`${c[0]} 00:00:00`).toLocaleDateString('en-CA'), change: Math.round(parseFloat(c[1]) * 100), rate: parseFloat(c[2]) }))
    .filter((c) => c.effective >= since)
}

export async function checkHistories(constants, { base = '/api/reservebank', fetchImpl = fetch } = {}) {
  const { au, rba } = constants
  const out = []
  const compare = (label, rows, official, key = 'value') => {
    const byPeriod = new Map(official.map((o) => [o.period, o.value]))
    const misses = rows.filter((r) => r[key] != null)
      .map((r) => ({ period: r.period, ours: r[key], official: byPeriod.has(r.period) ? r1(byPeriod.get(r.period)) : null }))
      .filter((m) => m.official == null || Math.abs(m.official - m.ours) >= 0.05)
    out.push({ label, points: rows.filter((r) => r[key] != null).length, misses })
  }
  const settle = async (label, fn) => { try { await fn() } catch (e) { out.push({ label, error: e.message }) } }
  const monthly = au.cpiHistory.filter((r) => r.type === 'monthly')
  const quarterly = au.cpiHistory.filter((r) => r.type === 'quarterly')
  await settle('CPI monthly', async () => compare('CPI monthly', monthly, await absSeries('ABS,CPI,2.0.0', '3.10001.10.50.M', monthly[0].period, fetchImpl)))
  await settle('CPI trimmed mean', async () => compare('CPI trimmed mean', monthly, await absSeries('ABS,CPI,2.0.0', '3.999902.20.50.M', monthly[0].period, fetchImpl), 'trimmed'))
  await settle('CPI quarterly', async () => compare('CPI quarterly', quarterly, await absSeries('ABS,CPI,1.1.0', '3.10001.10.50.Q', quarterly[0].period, fetchImpl)))
  await settle('Unemployment', async () => compare('Unemployment', au.unemploymentHistory, await absSeries('ABS,LF,1.0.0', 'M13.3.1599.20.AUS.M', au.unemploymentHistory[0].period, fetchImpl)))
  await settle('GDP QoQ', async () => compare('GDP QoQ', au.gdpHistory, await absSeries('ABS,ANA_AGG,1.0.0', 'M2.GPM.20.AUS.Q', au.gdpHistory[0].period, fetchImpl)))
  await settle('RBA decisions', async () => {
    // Every change in A2 must be a HIKE/CUT row the day before, and every
    // HIKE/CUT row must have its A2 change. Holds have nothing to match.
    const changes = await fetchRbaChanges({ base, fetchImpl, since: rba.decisions[0].date })
    const moves = rba.decisions.filter((d) => d.change !== 0)
    const nextDay = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
    const misses = []
    for (const m of moves) {
      const c = changes.find((x) => x.effective === nextDay(m.date))
      if (!c || c.change !== m.change || Math.abs(c.rate - m.rate) > 0.001) misses.push({ period: m.date, ours: `${m.decision} ${m.rate}`, official: c ? `${c.change}bp ${c.rate}` : 'no A2 change' })
    }
    for (const c of changes) if (!moves.some((m) => nextDay(m.date) === c.effective)) misses.push({ period: c.effective, ours: 'missing', official: `${c.change}bp ${c.rate}` })
    out.push({ label: 'RBA decisions', points: rba.decisions.length, misses })
  })
  return out
}

// ── US figures and the FOMC path (script only) ───────────────────────────────
// The BLS public API (v1, keyless; 25 requests a day, which a daily check
// uses one of) and two series from FRED's keyless CSV download: the Fed's own
// target upper bound (DFEDTARU) and BEA's real GDP growth, annualised
// (A191RL1Q225SBEA). Neither BLS nor FRED sends CORS headers, so this runs
// from scripts/check-official-stats.mjs only; the in-app headline check is
// fetchUsOfficial above, through the /api/fred proxy.

const BLS = 'https://api.bls.gov/publicAPI/v1/timeseries/data/'
const FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv'

async function fredSeries(id, start, fetchImpl, base = FRED) {
  const r = await fetchImpl(`${base}?id=${id}&cosd=${start}`)
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`)
  return (await r.text()).trim().split(/\r?\n/).slice(1).map((l) => l.split(','))
    .map(([date, v]) => ({ date, value: parseFloat(v) })).filter((o) => Number.isFinite(o.value))
}

export async function checkUs(constants, { fetchImpl = fetch } = {}) {
  const { us, fed } = constants
  const out = []
  const settle = async (label, fn) => { try { await fn() } catch (e) { out.push({ label, error: e.message }) } }
  const toPeriod = (o) => `${o.year}-${o.period.slice(1)}`

  await settle('US BLS', async () => {
    const startyear = String(+us.unemploymentHistory[0].period.slice(0, 4))
    const r = await fetchImpl(BLS, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesid: ['CUUR0000SA0', 'CUUR0000SA0L1E', 'LNS14000000', 'CES0000000001'], startyear, endyear: String(new Date().getFullYear()) }),
    })
    if (!r.ok) throw new Error(`BLS HTTP ${r.status}`)
    const body = await r.json()
    if (body.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS ${body.status}: ${body.message?.join(' ')}`)
    const series = Object.fromEntries(body.Results.series.map((s) => [s.seriesID,
      new Map(s.data.filter((o) => /^M\d\d$/.test(o.period)).map((o) => [toPeriod(o), o.value === '-' ? null : parseFloat(o.value)]))]))
    const latest = (id) => [...series[id].entries()].filter(([, v]) => v != null).sort(([a], [b]) => b.localeCompare(a))[0]
    const yoy = (id, period) => {
      const prior = `${+period.slice(0, 4) - 1}${period.slice(4)}`
      const a = series[id].get(period), b = series[id].get(prior)
      return a != null && b != null ? r1((a / b - 1) * 100) : null
    }
    // Headline figures: the newest month BLS has must be the one the
    // constants describe, at the same value.
    const [cpiPeriod] = latest('CUUR0000SA0')
    const [luPeriod, lu] = latest('LNS14000000')
    const [nfpPeriod, nfpLevel] = latest('CES0000000001')
    const prevMonth = (p) => { const d = new Date(`${p}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) }
    const nfp = Math.round(nfpLevel - series.CES0000000001.get(prevMonth(nfpPeriod)))
    const misses = []
    const want = (label, period, official, ours) => { if (official == null || Math.abs(official - ours) >= 0.05) misses.push({ period: `${label} ${period}`, ours, official }) }
    want('CPI', cpiPeriod, yoy('CUUR0000SA0', cpiPeriod), us.cpi)
    want('core CPI', cpiPeriod, yoy('CUUR0000SA0L1E', cpiPeriod), us.cpiCore)
    want('unemployment', luPeriod, lu, us.unemployment)
    want('payrolls (k)', nfpPeriod, nfp, us.nfpThousands)
    out.push({ label: 'US headline (BLS)', points: 4, misses })
    // The monthly unemployment series behind the recession monitor.
    const hm = us.unemploymentHistory
      .map((h) => ({ period: h.period, ours: h.value, official: series.LNS14000000.get(h.period) ?? null }))
      .filter((m) => m.ours !== m.official && !(m.ours != null && m.official != null && Math.abs(m.ours - m.official) < 0.05))
    out.push({ label: 'US unemployment hist', points: hm.length + us.unemploymentHistory.length - hm.length, misses: hm })
  })

  await settle('US GDP (BEA)', async () => {
    const rows = await fredSeries('A191RL1Q225SBEA', '2025-01-01', fetchImpl)
    const last = rows[rows.length - 1]
    const q = `${last.date.slice(0, 4)}-Q${Math.floor((+last.date.slice(5, 7) - 1) / 3) + 1}`
    const ours = us.gdpPeriod.replace(/^Q(\d) (\d{4})$/, '$2-Q$1')
    const misses = q !== ours || Math.abs(last.value - us.gdpQoQAnnualised) >= 0.05
      ? [{ period: q, ours: `${us.gdpQoQAnnualised} (${us.gdpPeriod})`, official: last.value }] : []
    out.push({ label: 'US GDP (BEA)', points: 1, misses })
  })

  await settle('FOMC decisions', async () => {
    // Every change in the target upper bound must be a HIKE/CUT row the day
    // before, and every HIKE/CUT row must have its change. As with A2, holds
    // have nothing to match.
    // From a month before the first decision, so that move shows as a change.
    const start = new Date(`${fed.decisions[0].date}T12:00:00Z`); start.setUTCMonth(start.getUTCMonth() - 1)
    const rows = await fredSeries('DFEDTARU', start.toISOString().slice(0, 10), fetchImpl)
    const changes = []
    for (let i = 1; i < rows.length; i++) if (rows[i].value !== rows[i - 1].value) changes.push({ effective: rows[i].date, rate: rows[i].value, change: Math.round((rows[i].value - rows[i - 1].value) * 100) })
    const moves = fed.decisions.filter((d) => d.change !== 0)
    const nextDay = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
    const misses = []
    for (const m of moves) {
      const c = changes.find((x) => x.effective === nextDay(m.date))
      if (!c || c.change !== m.change || Math.abs(c.rate - m.rate) > 0.001) misses.push({ period: m.date, ours: `${m.decision} ${m.rate}`, official: c ? `${c.change}bp ${c.rate}` : 'no change' })
    }
    const listedFrom = nextDay(fed.decisions[0].date)
    for (const c of changes) if (c.effective >= listedFrom && !moves.some((m) => nextDay(m.date) === c.effective)) misses.push({ period: c.effective, ours: 'missing', official: `${c.change}bp ${c.rate}` })
    out.push({ label: 'FOMC decisions', points: fed.decisions.length, misses })
  })
  return out
}

// ── In-app check ─────────────────────────────────────────────────────────────
// Run once at startup and cached for six hours: the agencies publish monthly
// or quarterly, and the RBA eight times a year.

const CHECK_KEY = 'maddex_official_stats_v2' // v2 adds the US figures
const CHECK_TTL = 6 * 60 * 60 * 1000
const listeners = new Set()
let latest = null

function applyConfirmations(result) {
  const today = new Date(result.fetchedAt).toLocaleDateString('en-CA')
  const rows = result.rows
  const au = rows.filter((r) => r.group === 'au')
  if (au.length && au.every((r) => r.status === 'match')) markConfirmed('au', today)
  const usRows = rows.filter((r) => r.group === 'us')
  if (usRows.length && usRows.every((r) => r.status === 'match')) markConfirmed('us', today)
  // The RBA row confirms the group only if the cash rate matches AND table A2
  // shows no change newer than the decision the constants record. A2 lists
  // changes, not holds, so a hold can never be confirmed this way.
  const rbaRow = rows.find((r) => r.group === 'rba')
  const lastChange = result.live.rba?.effectiveIso
  const recorded = VERIFIED_CONSTANTS.rba.lastDecision
  if (rbaRow?.status === 'match' && lastChange && recorded) {
    const dayAfter = new Date(`${recorded}T00:00:00`); dayAfter.setDate(dayAfter.getDate() + 1)
    if (lastChange <= dayAfter.toLocaleDateString('en-CA')) markConfirmed('rba', today)
  }
}

export function getOfficialCheck() { return latest }
export function subscribeOfficialCheck(cb) { listeners.add(cb); return () => listeners.delete(cb) }

// One request in flight at a time — StrictMode mounts effects twice in dev,
// and a click on CHECK NOW during the startup check should join it.
let inflight = null
export function runOfficialCheck(opts = {}) {
  if (!inflight) inflight = doOfficialCheck(opts).finally(() => { inflight = null })
  return inflight
}

async function doOfficialCheck({ force = false } = {}) {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CHECK_KEY) ?? 'null')
      if (cached && Date.now() - cached.fetchedAt < CHECK_TTL) {
        // Re-reconcile against the constants as they are NOW — a cached
        // comparison would hide an edit made since.
        latest = { ...cached, rows: reconcile(VERIFIED_CONSTANTS, cached.live) }
        applyConfirmations(latest)
        listeners.forEach((cb) => cb(latest))
        return latest
      }
    } catch { /* fall through and fetch */ }
  }
  const live = await fetchOfficialStats()
  latest = { live, fetchedAt: live.fetchedAt, rows: reconcile(VERIFIED_CONSTANTS, live) }
  try { localStorage.setItem(CHECK_KEY, JSON.stringify({ live, fetchedAt: live.fetchedAt })) } catch { /* quota */ }
  applyConfirmations(latest)
  const drift = latest.rows.filter((r) => r.status === 'drift')
  if (drift.length) console.warn('[MADDEN OFFICIAL] Constants out of date:', drift.map((r) => `${r.label} ${r.constant} → ${r.official} (${r.period})`).join('; '))
  else console.log('[MADDEN OFFICIAL] ✓ RBA/ABS figures match verifiedConstants')
  listeners.forEach((cb) => cb(latest))
  return latest
}
