import { PAL } from '../styles/palette.js'
// ─── Sovereign bond curves ──────────────────────────────────────────────────
//
// The full maturity spectrum for five government bond markets, 1M to 50Y.
//
// WHAT THESE FIGURES ARE (15 Nov 2026). Each curve is its publisher's own
// end-of-day reading (BOND_CURVE_SOURCES, dated in BOND_CURVES_AS_OF): RBA
// table F2, the US Treasury par curve, the Bank of England spot curve, the
// Bundesbank term structure and the MoF JGB rates. Only the maturities each
// publishes are held; the typed bills, in-between tenors and 50Y points that
// stood here before were removed, and nothing ticks on top (useBondYields).
// The freshness guard holds each curve to 30 days.
//
// This file is the SINGLE SOURCE for bond yields in the terminal. The Rates
// module previously carried its own eight-tenor AU and US curves; those now
// derive from here (see curveForRates below), so the 2s10s spread the Rates
// module prints and the one the Bonds module prints cannot disagree — which
// they would have within a week of two people editing two tables.

export const BOND_MARKETS = [
  { key: 'AU', label: 'AU',  flag: '🇦🇺', name: 'Australian Government Bonds', colour: PAL.gold, issuer: 'AOFM' },
  { key: 'US', label: 'US',  flag: '🇺🇸', name: 'US Treasuries',               colour: '#4A7FB5', issuer: 'US Treasury' },
  { key: 'UK', label: 'UK',  flag: '🇬🇧', name: 'UK Gilts',                    colour: '#a855f7', issuer: 'UK DMO' },
  { key: 'DE', label: 'DE',  flag: '🇩🇪', name: 'German Bunds',                colour: PAL.up, issuer: 'Bundesbank' },
  { key: 'JP', label: 'JP',  flag: '🇯🇵', name: 'Japanese Government Bonds',   colour: '#14b8a6', issuer: 'MOF Japan' },
]

// Maturity in years, for the log-scaled x axis and for duration maths. Bills
// are quoted in months and have to become a fraction of a year to plot.
export const YEARS = {
  '1M': 1 / 12, '2M': 2 / 12, '3M': 0.25, '4M': 4 / 12, '6M': 0.5,
  '1Y': 1, '2Y': 2, '3Y': 3, '4Y': 4, '5Y': 5, '7Y': 7,
  '10Y': 10, '12Y': 12, '15Y': 15, '20Y': 20, '25Y': 25, '30Y': 30,
  '40Y': 40, '50Y': 50,
}

const b = (maturity, coupon, yieldPct, type, indicative = false) =>
  ({ maturity, coupon, yield: yieldPct, type, years: YEARS[maturity], indicative })

export const BOND_CURVES_AS_OF = { AU: '2026-11-11', US: '2026-11-13', UK: '2026-11-12', DE: '2026-11-13', JP: '2026-11-12' }
// What each curve is and where it was read.
export const BOND_CURVE_SOURCES = {
  AU: { series: 'RBA table F2 (indicative mid yields)', url: 'https://www.rba.gov.au/statistics/tables/' },
  US: { series: 'US Treasury daily par yield curve', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
  UK: { series: 'Bank of England nominal spot (zero-coupon) curve', url: 'https://www.bankofengland.co.uk/-/media/boe/files/statistics/yield-curves/latest-yield-curve-data.zip' },
  DE: { series: 'Bundesbank term structure of listed Federal securities (Svensson, zero-coupon)', url: 'https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZST.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?lastNObservations=2&format=csv' },
  JP: { series: 'Ministry of Finance JGB interest rates (constant maturity)', url: 'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv' },
}

export const BOND_CURVES = {
  // AU: the four tenors RBA table F2 publishes (latest day 11 Nov 2026).
  // US: the Treasury daily par yield curve, 13 Nov 2026. Both read
  // 15 Nov 2026. Par yields: the coupon equals the yield. The typed AU bill,
  // in-between and long-end points ("moved by the change in the nearest
  // sourced tenor") were removed.
  AU: [
    b('2Y', 4.808, 4.808, 'TBond'),
    b('3Y', 4.733, 4.733, 'TBond'),
    b('5Y', 4.757, 4.757, 'TBond'),
    b('10Y', 5.044, 5.044, 'TBond'),
  ],
  US: [
    b('1M', 4.1, 4.1, 'TBill'),
    b('2M', 4.26, 4.26, 'TBill'),
    b('3M', 4.32, 4.32, 'TBill'),
    b('4M', 4.34, 4.34, 'TBill'),
    b('6M', 4.42, 4.42, 'TBill'),
    b('1Y', 4.65, 4.65, 'TNote'),
    b('2Y', 4.88, 4.88, 'TNote'),
    b('3Y', 4.92, 4.92, 'TNote'),
    b('5Y', 4.98, 4.98, 'TNote'),
    b('7Y', 5.05, 5.05, 'TNote'),
    b('10Y', 5.15, 5.15, 'TBond'),
    b('20Y', 5.52, 5.52, 'TBond'),
    b('30Y', 5.47, 5.47, 'TBond'),
  ],
  // UK, DE and JP read 15 Nov 2026 from the official publishers
  // (BOND_CURVE_SOURCES): UK and DE are zero-coupon curves, so the coupon is
  // 0; JP is the MoF's constant-maturity JGB yield (close to par), so the
  // coupon equals the yield. Only the published maturities are shown; the
  // typed bill and in-between points that stood here were removed.
  UK: [
    b('1Y', 0, 4.5013, 'Gilt'),
    b('2Y', 0, 4.7395, 'Gilt'),
    b('5Y', 0, 4.9249, 'Gilt'),
    b('7Y', 0, 5.0447, 'Gilt'),
    b('10Y', 0, 5.2617, 'Gilt'),
    b('15Y', 0, 5.5714, 'Gilt'),
    b('20Y', 0, 5.7278, 'Gilt'),
    b('25Y', 0, 5.763, 'Gilt'),
    b('30Y', 0, 5.7041, 'Gilt'),
    b('40Y', 0, 5.3174, 'Gilt'),
  ],
  DE: [
    b('1Y', 0, 3.0, 'Bund'),
    b('2Y', 0, 3.13, 'Bund'),
    b('5Y', 0, 3.18, 'Bund'),
    b('10Y', 0, 3.43, 'Bund'),
    b('15Y', 0, 3.62, 'Bund'),
    b('20Y', 0, 3.72, 'Bund'),
    b('30Y', 0, 3.83, 'Bund'),
  ],
  JP: [
    b('1Y', 1.653, 1.653, 'JGB'),
    b('2Y', 1.857, 1.857, 'JGB'),
    b('5Y', 2.209, 2.209, 'JGB'),
    b('7Y', 2.423, 2.423, 'JGB'),
    b('10Y', 2.841, 2.841, 'JGB'),
    b('15Y', 3.382, 3.382, 'JGB'),
    b('20Y', 3.698, 3.698, 'JGB'),
    b('25Y', 4.004, 4.004, 'JGB'),
    b('30Y', 3.974, 3.974, 'JGB'),
    b('40Y', 4.006, 4.006, 'JGB'),
  ],
}

// ─── Bond maths ─────────────────────────────────────────────────────────────
//
// All of it arithmetic, none of it generated. The formulas are standard and
// the UI shows them on hover, because a duration figure a reader cannot check
// is just another number they have to take on trust.

// Price per 100 face from a yield, annual coupons. A zero-coupon bill is the
// same formula with c = 0, which is why bills need no special case.
export function priceFromYield(couponPct, yieldPct, years) {
  const y = yieldPct / 100
  const c = couponPct / 100
  if (years <= 0) return 100
  // Bills under a year: simple discount, which is how they are actually quoted.
  if (years < 1) return 100 / (1 + y * years)
  const n = Math.round(years)
  let pv = 0
  for (let t = 1; t <= n; t++) pv += (c * 100) / (1 + y) ** t
  pv += 100 / (1 + y) ** n
  return pv
}

// Macaulay duration in years, then modified duration. Modified duration is the
// one that answers "how much does the price move for a 1% rate change", which
// is the only reason most people ever look at either.
export function durationOf(couponPct, yieldPct, years) {
  const y = yieldPct / 100
  const c = couponPct / 100
  if (years < 1) return { macaulay: years, modified: years / (1 + y * years), convexity: 0 }
  const n = Math.round(years)
  const price = priceFromYield(couponPct, yieldPct, years)
  let weighted = 0
  let convex = 0
  for (let t = 1; t <= n; t++) {
    const cf = t === n ? c * 100 + 100 : c * 100
    const pv = cf / (1 + y) ** t
    weighted += t * pv
    convex += t * (t + 1) * pv
  }
  const macaulay = weighted / price
  return {
    macaulay,
    modified: macaulay / (1 + y),
    convexity: convex / (price * (1 + y) ** 2),
  }
}

// Dollar value of one basis point, per given face value.
export function dv01(couponPct, yieldPct, years, face = 100) {
  const p0 = priceFromYield(couponPct, yieldPct, years)
  const p1 = priceFromYield(couponPct, yieldPct + 0.01, years)
  return ((p0 - p1) / 100) * face
}

// Yield to maturity by Newton-Raphson. Returns the yield and the iteration
// count, which the UI shows — a solver that silently fails to converge and
// returns its last guess is worse than one that says how hard it worked.
export function ytm(face, couponPct, years, price, { guess = 5, maxIter = 60, tol = 1e-7 } = {}) {
  const c = (couponPct / 100) * face
  const n = Math.max(1, Math.round(years))
  let y = guess / 100
  let iterations = 0

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1
    let pv = 0
    let deriv = 0
    for (let t = 1; t <= n; t++) {
      const cf = t === n ? c + face : c
      pv += cf / (1 + y) ** t
      deriv -= (t * cf) / (1 + y) ** (t + 1)
    }
    const diff = pv - price
    if (Math.abs(diff) < tol) return { ytm: y * 100, iterations, converged: true }
    if (deriv === 0) break
    const next = y - diff / deriv
    // Keep the solver inside a sane band; a bad guess on a deep-discount bond
    // can otherwise send it negative and diverge.
    y = Math.max(-0.5, Math.min(2, next))
  }
  return { ytm: y * 100, iterations, converged: false }
}

// ─── Curve shape ────────────────────────────────────────────────────────────

export function curveStats(rows) {
  const at = (m) => rows.find((r) => r.maturity === m)?.yield ?? null
  const y2 = at('2Y')
  const y10 = at('10Y')
  const y30 = at('30Y')
  const spread = y2 != null && y10 != null ? y10 - y2 : null

  let shape = '—'
  if (spread != null) {
    // HUMPED before the others: a curve that rises then falls is a distinct
    // shape, and calling it NORMAL because 2s10s happens to be positive loses
    // the thing that makes it interesting.
    const humped = y30 != null && y10 != null && y30 < y10 && spread > 0
    shape = humped ? 'HUMPED' : spread > 0.3 ? 'NORMAL' : spread > 0 ? 'FLAT' : 'INVERTED'
  }
  return { spread, shape, y2, y10, y30 }
}

// The eight tenors the Rates module's chart uses, in the shape it expects.
// Derived rather than duplicated — see the note at the top of this file.
export function curveForRates(key) {
  const rows = BOND_CURVES[key] ?? []
  const TENORS = ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '10Y', '30Y']
  return TENORS
    .map((m) => {
      const row = rows.find((r) => r.maturity === m)
      return row ? { m, y: row.yield } : null
    })
    .filter(Boolean)
}
