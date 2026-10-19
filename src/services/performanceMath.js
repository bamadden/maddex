import { RBA_PATH, rateOn } from '../data/policySpread'

// ─── Portfolio performance arithmetic ───────────────────────────────────────
//
// Pure functions behind the Performance tab: the cash and bond benchmarks,
// annualising, dividend income and the CGT estimate. Nothing here fetches or
// renders, so each piece can be checked on its own.

const DAY = 86400000
export const toMs = (iso) => Date.parse(`${iso}T00:00:00Z`)
export const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10)
export const daysBetween = (fromIso, toIso) => Math.round((toMs(toIso) - toMs(fromIso)) / DAY)

// ── Cash ────────────────────────────────────────────────────────────────────
//
// Growth of A$1 held at the RBA cash rate, compounded daily, using the rate
// in force on each day (RBA_PATH: every move on its effective date, from the
// verified decision list). Over 2026 that is 3.60% until 4 Feb, then 3.85%,
// 4.10% from 18 Mar, 4.35% from 6 May and 4.60% from 30 Sep — not one flat
// rate back-applied to the whole window.
export function cashGrowth(fromIso, toIso) {
  let g = 1
  for (let t = toMs(fromIso); t < toMs(toIso); t += DAY) {
    const r = rateOn(RBA_PATH, isoOf(t))
    if (r == null) return null
    g *= 1 + r / 100 / 365
  }
  return g
}

// ── Bonds ───────────────────────────────────────────────────────────────────
//
// A constant-maturity 10-year Commonwealth bond, from the RBA's daily yields
// (table F2). Each day earns the previous day's yield as carry and loses
// modified duration × the change in yield as price. Modified duration is the
// par-bond figure at that yield (semi-annual coupons, ten years), about 7.8 at
// 5%. This is the standard approximation for a bond index rebalanced to ten
// years; it leaves out convexity, which over a year at these moves is a few
// basis points.
const modDuration = (y) => (y > 0 ? (1 - (1 + y / 200) ** -20) / (y / 100) : 10)

// yields: [{ date, y }] oldest first. Returns growth of A$1, or null when the
// window starts before the series.
export function bondGrowth(yields, fromIso, toIso) {
  if (!yields?.length || fromIso < yields[0].date) return null
  let i = 0
  while (i + 1 < yields.length && yields[i + 1].date <= fromIso) i++
  let g = 1
  let prev = yields[i]
  for (let j = i + 1; j < yields.length && yields[j].date <= toIso; j++) {
    const cur = yields[j]
    const days = daysBetween(prev.date, cur.date)
    const carry = (prev.y / 100) * (days / 365)
    const price = -modDuration(prev.y) * ((cur.y - prev.y) / 100)
    g *= 1 + carry + price
    prev = cur
  }
  // Carry for the days after the last published yield (F2 lags a few days).
  g *= 1 + (prev.y / 100) * (Math.max(0, daysBetween(prev.date, toIso)) / 365)
  return g
}

// ── Annualising ─────────────────────────────────────────────────────────────
//
// (1 + r)^(365 / days) − 1. Under 30 days it returns null: a 2% week
// annualises to 180%, which is arithmetic, not information.
export const MIN_ANNUALISE_DAYS = 30
export function annualise(ret, days) {
  if (ret == null || !Number.isFinite(ret) || days < MIN_ANNUALISE_DAYS) return null
  return (1 + ret) ** (365 / days) - 1
}

// ── Dividend income ─────────────────────────────────────────────────────────
//
// Recorded DIVIDEND transactions are used where the user has any for a
// symbol. Where they have none, income is ESTIMATED by accruing the current
// yield on each lot's value since its purchase date — the ex-dividend
// calendar is not modelled, so a lot bought last week accrues a week's worth
// even though nothing was paid. The split is kept so the UI can say how much
// of a total return is recorded and how much is estimated.
export function dividendsFor(position, lots, transactions, { toAud, yieldPct, today }) {
  const sym = position.symbol
  const recorded = transactions
    .filter((t) => t.type === 'DIVIDEND' && (t.symbol === sym || t.symbol === `${sym}.AX` || `${t.symbol}.AX` === sym))
    .reduce((s, t) => {
      const v = Number(t.price) || 0
      return s + ((t.currency ?? 'AUD') === 'AUD' || typeof toAud !== 'function' ? v : (toAud(v) ?? v))
    }, 0)
  if (recorded > 0) return { recorded, estimated: 0 }
  if (!(yieldPct > 0)) return { recorded: 0, estimated: 0 }
  const estimated = lots.reduce((s, l) => {
    const days = Math.max(0, daysBetween(l.addedAt, today))
    return s + (l.mktVal ?? 0) * (yieldPct / 100) * (days / 365)
  }, 0)
  return { recorded: 0, estimated }
}

// ── Capital gains tax (estimate) ────────────────────────────────────────────
//
// Australian individual rates for 2026-27: 15% (from 1 July 2026), 30%,
// 37%, 45%, plus the 2% Medicare levy. A gain on a parcel held at least 12
// months gets the 50% discount. Losses are netted first against gains that
// get no discount, then against discountable gains, and only then is the
// discount applied — the ATO's order. Net losses produce no refund; they carry
// forward, which this does not track.
export const TAX_RATES = [0, 15, 30, 37, 45]
export const MEDICARE_LEVY = 2

// A parcel qualifies for the discount when it has been held at least 12
// months: bought on 14 Jan 2026, it qualifies from 15 Jan 2027.
export function heldTwelveMonths(boughtIso, todayIso) {
  const b = new Date(`${boughtIso}T00:00:00Z`)
  b.setUTCFullYear(b.getUTCFullYear() + 1)
  return todayIso > isoOf(b.getTime())
}

// parcels: [{ gain, longTerm }]. rate: marginal rate in percent, levy included.
export function cgtEstimate(parcels, rate) {
  let shortGain = 0, longGain = 0, losses = 0
  for (const p of parcels) {
    if (!Number.isFinite(p.gain)) continue
    if (p.gain < 0) losses += -p.gain
    else if (p.longTerm) longGain += p.gain
    else shortGain += p.gain
  }
  const shortAfterLoss = Math.max(0, shortGain - losses)
  const lossLeft = Math.max(0, losses - shortGain)
  const longAfterLoss = Math.max(0, longGain - lossLeft)
  const carriedLoss = Math.max(0, lossLeft - longGain)
  const taxable = shortAfterLoss + longAfterLoss * 0.5
  return { tax: taxable * (rate / 100), taxable, carriedLoss, shortGain, longGain, losses }
}
