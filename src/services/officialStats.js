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
  const [rba, cpi, lf, gdp] = await Promise.allSettled([
    fetchRbaCashRate(opts), fetchAuCpi(opts), fetchAuUnemployment(opts), fetchAuGdp(opts),
  ])
  const ok = (r) => (r.status === 'fulfilled' ? r.value : null)
  return { rba: ok(rba), cpi: ok(cpi), lf: ok(lf), gdp: ok(gdp), fetchedAt: Date.now() }
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
  const { rba, au } = constants
  const row = (label, group, field, constant, official, source) => ({
    label, group, field, constant, source, dp: field === 'cashRate' ? 2 : 1,
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
  ]
}

// ── In-app check ─────────────────────────────────────────────────────────────
// Run once at startup and cached for six hours: the agencies publish monthly
// or quarterly, and the RBA eight times a year.

const CHECK_KEY = 'maddex_official_stats_v1'
const CHECK_TTL = 6 * 60 * 60 * 1000
const listeners = new Set()
let latest = null

function applyConfirmations(result) {
  const today = new Date(result.fetchedAt).toLocaleDateString('en-CA')
  const rows = result.rows
  const au = rows.filter((r) => r.group === 'au')
  if (au.length && au.every((r) => r.status === 'match')) markConfirmed('au', today)
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
