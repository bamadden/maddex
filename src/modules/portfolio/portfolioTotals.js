// The holdings table's total row, from lot data only.
//
// Invested is what was paid for every priced lot (in AUD at today's rate for
// USD-cost lots, as the table shows them); value is those lots at today's
// price. Lots without a price (crypto here, or a quote that failed) are left
// out of both sides rather than counted at cost, and the row says how many.
//
// ANNUALISED is a money-weighted return (XIRR): each lot is a purchase on the
// day it was bought, and today's value is the one inflow. That answers "what
// rate did my money earn", which a time-weighted figure does not when lots
// were bought at different times. It is only shown once the earliest lot is
// a year old — annualising a few weeks' move would print a number like
// +140% p.a. that describes nothing.

const DAY = 86_400_000

function xirr(flows) {
  // flows: [{ t: years from first flow, v: amount }]; negative = paid in.
  const f = (r) => flows.reduce((s, x) => s + x.v / (1 + r) ** x.t, 0)
  let lo = -0.99, hi = 10
  let flo = f(lo), fhi = f(hi)
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (Math.abs(fm) < 1e-7) return mid
    if (fm * flo > 0) { lo = mid; flo = fm } else { hi = mid }
  }
  return (lo + hi) / 2
}

export function portfolioTotals(lots, now = Date.now()) {
  const priced = lots.filter((l) => l.mktVal != null && l.totalCost > 0)
  const unpriced = lots.length - priced.length
  if (!priced.length) return null
  const invested = priced.reduce((s, l) => s + l.totalCost, 0)
  const value = priced.reduce((s, l) => s + l.mktVal, 0)
  const ret = value - invested
  const retPct = invested > 0 ? (ret / invested) * 100 : null

  const dated = priced.map((l) => ({ l, at: Date.parse(`${l.addedAt ?? ''}T00:00:00`) })).filter((x) => Number.isFinite(x.at))
  const earliest = dated.length ? Math.min(...dated.map((x) => x.at)) : null
  const heldDays = earliest != null ? Math.floor((now - earliest) / DAY) : null

  let annualised = null
  if (heldDays != null && heldDays >= 365 && dated.length === priced.length) {
    const years = (at) => (at - earliest) / (365 * DAY)
    const r = xirr([
      ...dated.map(({ l, at }) => ({ t: years(at), v: -l.totalCost })),
      { t: years(now), v: value },
    ])
    annualised = r != null ? r * 100 : null
  }

  return {
    invested, value, ret, retPct, annualised, heldDays, unpriced,
    earliest: dated.length ? dated.map((x) => x.l.addedAt).sort()[0] : null,
  }
}

// "230d" under a year, "1y 4m" after.
export function heldFor(addedAt, now = Date.now()) {
  const at = Date.parse(`${addedAt ?? ''}T00:00:00`)
  if (!Number.isFinite(at)) return null
  const days = Math.max(0, Math.floor((now - at) / DAY))
  if (days < 365) return `${days}d`
  const months = Math.floor(days / 30.44)
  return `${Math.floor(months / 12)}y ${months % 12}m`
}
