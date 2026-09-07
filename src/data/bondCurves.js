// ─── Sovereign bond curves ──────────────────────────────────────────────────
//
// The full maturity spectrum for five government bond markets, 1M to 50Y.
//
// WHAT THESE FIGURES ARE. INDICATIVE. They are a plausible, internally
// consistent snapshot of each curve — not a feed, and not a set of verified
// constants. Every surface that renders them says INDICATIVE, and the ultra-
// long points (40Y, 50Y) carry a second marker because those maturities are
// thinly traded and quoted yields there are estimates even in real markets.
//
// This file is the SINGLE SOURCE for bond yields in the terminal. The Rates
// module previously carried its own eight-tenor AU and US curves; those now
// derive from here (see curveForRates below), so the 2s10s spread the Rates
// module prints and the one the Bonds module prints cannot disagree — which
// they would have within a week of two people editing two tables.

export const BOND_MARKETS = [
  { key: 'AU', label: 'AU',  flag: '🇦🇺', name: 'Australian Government Bonds', colour: '#C9A84C', issuer: 'AOFM' },
  { key: 'US', label: 'US',  flag: '🇺🇸', name: 'US Treasuries',               colour: '#4A7FB5', issuer: 'US Treasury' },
  { key: 'UK', label: 'UK',  flag: '🇬🇧', name: 'UK Gilts',                    colour: '#a855f7', issuer: 'UK DMO' },
  { key: 'DE', label: 'DE',  flag: '🇩🇪', name: 'German Bunds',                colour: '#2D8A50', issuer: 'Bundesbank' },
  { key: 'JP', label: 'JP',  flag: '🇯🇵', name: 'Japanese Government Bonds',   colour: '#14b8a6', issuer: 'MOF Japan' },
]

// Maturity in years, for the log-scaled x axis and for duration maths. Bills
// are quoted in months and have to become a fraction of a year to plot.
export const YEARS = {
  '1M': 1 / 12, '2M': 2 / 12, '3M': 0.25, '6M': 0.5,
  '1Y': 1, '2Y': 2, '3Y': 3, '4Y': 4, '5Y': 5, '7Y': 7,
  '10Y': 10, '12Y': 12, '15Y': 15, '20Y': 20, '25Y': 25, '30Y': 30,
  '40Y': 40, '50Y': 50,
}

const b = (maturity, coupon, yieldPct, type, indicative = false) =>
  ({ maturity, coupon, yield: yieldPct, type, years: YEARS[maturity], indicative })

export const BOND_CURVES = {
  AU: [
    b('1M', 0, 4.28, 'TBill'), b('2M', 0, 4.26, 'TBill'), b('3M', 0, 4.24, 'TBill'), b('6M', 0, 4.22, 'TBill'),
    b('1Y', 4.10, 4.18, 'TNote'), b('2Y', 4.00, 4.12, 'TNote'), b('3Y', 4.00, 4.15, 'TNote'),
    b('4Y', 4.25, 4.18, 'TNote'), b('5Y', 4.25, 4.21, 'TNote'), b('7Y', 4.50, 4.28, 'TNote'),
    b('10Y', 4.50, 4.42, 'TBond'), b('12Y', 4.75, 4.48, 'TBond'), b('15Y', 4.75, 4.54, 'TBond'),
    b('20Y', 4.75, 4.62, 'TBond'), b('25Y', 5.00, 4.68, 'TBond'), b('30Y', 5.00, 4.72, 'TBond'),
    b('40Y', 5.25, 4.78, 'TBond', true), b('50Y', 5.25, 4.82, 'TBond', true),
  ],
  US: [
    b('1M', 0, 4.32, 'TBill'), b('2M', 0, 4.31, 'TBill'), b('3M', 0, 4.30, 'TBill'), b('6M', 0, 4.27, 'TBill'),
    b('1Y', 4.10, 4.22, 'TNote'), b('2Y', 4.00, 4.24, 'TNote'), b('3Y', 4.00, 4.20, 'TNote'),
    b('5Y', 4.13, 4.18, 'TNote'), b('7Y', 4.25, 4.22, 'TNote'),
    b('10Y', 4.25, 4.28, 'TBond'), b('20Y', 4.75, 4.44, 'TBond'), b('30Y', 4.50, 4.52, 'TBond'),
  ],
  UK: [
    b('1M', 0, 4.52, 'TBill'), b('3M', 0, 4.48, 'TBill'), b('6M', 0, 4.40, 'TBill'),
    b('1Y', 4.00, 4.28, 'Gilt'), b('2Y', 4.00, 4.18, 'Gilt'), b('5Y', 4.25, 4.24, 'Gilt'),
    b('7Y', 4.25, 4.32, 'Gilt'), b('10Y', 4.25, 4.48, 'Gilt'), b('15Y', 4.50, 4.68, 'Gilt'),
    b('20Y', 4.75, 4.78, 'Gilt'), b('30Y', 4.75, 4.84, 'Gilt'),
    b('40Y', 4.00, 4.72, 'Gilt', true), b('50Y', 3.75, 4.62, 'Gilt', true),
  ],
  DE: [
    b('3M', 0, 2.18, 'Bubill'), b('6M', 0, 2.14, 'Bubill'),
    b('1Y', 2.00, 2.08, 'Schatz'), b('2Y', 2.00, 2.84, 'Schatz'), b('5Y', 2.25, 2.74, 'Bobl'),
    b('10Y', 2.50, 2.62, 'Bund'), b('15Y', 2.50, 2.74, 'Bund'), b('20Y', 2.75, 2.82, 'Bund'),
    b('30Y', 2.75, 2.88, 'Bund'),
  ],
  JP: [
    b('3M', 0, 0.18, 'TDB'), b('6M', 0, 0.22, 'TDB'),
    b('1Y', 0.10, 0.30, 'JGB'), b('2Y', 0.20, 0.42, 'JGB'), b('5Y', 0.40, 0.68, 'JGB'),
    b('10Y', 1.00, 1.08, 'JGB'), b('20Y', 1.70, 1.86, 'JGB'), b('30Y', 2.00, 2.14, 'JGB'),
    b('40Y', 2.20, 2.28, 'JGB', true),
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
