import { VERIFIED_CONSTANTS } from './verifiedConstants'

// ─── Recession risk monitor ─────────────────────────────────────────────────
//
// WHAT THIS IS, AND WHY IT IS NOT AN AI ESTIMATE
//
// The design for this asked for "AU Recession Risk: 28%" generated daily by
// MaddenAI behind an AI-ESTIMATE badge. That would have been the most
// actionable fabricated figure in the terminal. A recession probability is not
// decoration — it is the number a person moves to cash on — and a model asked
// for one will produce a confident, stable, entirely invented percentage.
// The badge does not fix that; it labels the provenance of a guess.
//
// So this works like geopoliticalRisk.js instead: a PUBLISHED RUBRIC over
// figures the app already holds and dates. Each score is the sum of its listed
// factors, computed below, so the number and its reasoning cannot drift apart.
// Every input is a verified constant or a yield curve point with a source.
//
// It is still Maddex's own composite and the UI says so. The difference from
// an AI estimate is that a reader can check it: every contribution is shown,
// and moving any input moves the score in a way they can predict.
//
// THE RUBRIC — points out of 100, higher means more recessionary
//
//   Yield curve inverted (2s10s < 0)        +30   (partial credit below +25bp)
//   Unemployment above its recent trough    +20   (scaled, 1.5pp = full)
//   GDP growth weak or negative             +25   (scaled, <0% = full)
//   Policy restrictive (real rate > 0)      +15   (scaled, +2pp = full)
//   Inflation outside the target band       +10   (scaled, 2pp above = full)
//
// A yield-curve inversion carries the largest single weight because it is the
// most-studied leading indicator of the five, not because this file claims it
// is decisive.

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const round = (v) => Math.round(v * 10) / 10

// ─── Yield curves ───────────────────────────────────────────────────────────
//
// Copied here from FXModule rather than imported, because importing a module's
// private constant would make the Macro module depend on the Rates module's
// internals. Both should ultimately read one source; until a live curve feed
// exists, the as-of date says which snapshot this is.
export const YIELD_CURVE_POINTS = {
  AU: { twoYear: 3.65, tenYear: 4.20, asOf: 'Aug 2026', source: 'AOFM / RBA' },
  US: { twoYear: 4.10, tenYear: 4.45, asOf: 'Aug 2026', source: 'US Treasury' },
}

export const curveSpreadBp = (c) => Math.round((c.tenYear - c.twoYear) * 100)

// ─── Factor scoring ─────────────────────────────────────────────────────────

function curveFactor(spreadBp) {
  // Full weight when inverted; tapering to zero at a comfortably positive
  // +25bp. A curve at exactly zero is not "no signal", it is flat — which is
  // why partial credit starts above zero rather than at it.
  const t = clamp((25 - spreadBp) / 25)
  return {
    key: 'curve',
    label: 'Yield curve (2s10s)',
    weight: 30,
    points: round(30 * t),
    reading: `${spreadBp >= 0 ? '+' : ''}${spreadBp}bp`,
    state: spreadBp < 0 ? 'RED' : spreadBp < 25 ? 'AMBER' : 'GREEN',
    note: spreadBp < 0
      ? 'Inverted — short rates above long. The most-studied recession lead indicator.'
      : spreadBp < 25
        ? 'Flat. Not inverted, but little term premium left.'
        : 'Positive slope — no inversion signal.',
  }
}

function unemploymentFactor(current, trough) {
  // The Sahm-style reading: the LEVEL of unemployment says little, the RISE
  // from its recent low says a lot. 4.1% is benign; 4.1% after a 3.4% trough
  // is a labour market turning.
  const rise = current - trough
  const t = clamp(rise / 1.5)
  return {
    key: 'unemployment',
    label: 'Unemployment vs trough',
    weight: 20,
    points: round(20 * t),
    reading: `${current}% (trough ${trough}%)`,
    state: rise >= 0.8 ? 'RED' : rise >= 0.4 ? 'AMBER' : 'GREEN',
    note: rise <= 0
      ? 'At or below its recent low.'
      : `Up ${rise.toFixed(1)}pp from the recent trough. The rise matters more than the level.`,
  }
}

function growthFactor(annualPct) {
  // Full weight at or below zero, none at 3%.
  const t = clamp((3 - annualPct) / 3)
  return {
    key: 'growth',
    label: 'GDP growth (annual)',
    weight: 25,
    points: round(25 * t),
    reading: `${annualPct}%`,
    state: annualPct <= 0 ? 'RED' : annualPct < 1.5 ? 'AMBER' : 'GREEN',
    note: annualPct <= 0
      ? 'Contracting.'
      : annualPct < 1.5
        ? 'Positive but below trend — little buffer against a shock.'
        : 'Growing at or near trend.',
  }
}

function policyFactor(cashRate, cpi) {
  // Real policy rate. Above zero is restrictive; the further above, the more
  // the brakes are on.
  const real = cashRate - cpi
  const t = clamp(real / 2)
  return {
    key: 'policy',
    label: 'Real policy rate',
    weight: 15,
    points: round(15 * t),
    reading: `${real >= 0 ? '+' : ''}${real.toFixed(2)}pp`,
    state: real >= 1.5 ? 'RED' : real > 0 ? 'AMBER' : 'GREEN',
    note: real > 0
      ? `Cash rate ${cashRate}% against inflation ${cpi}% — policy is restrictive.`
      : `Cash rate ${cashRate}% below inflation ${cpi}% — policy is still accommodative.`,
  }
}

function inflationFactor(cpi, bandTop) {
  const over = cpi - bandTop
  const t = clamp(over / 2)
  return {
    key: 'inflation',
    label: 'Inflation vs target',
    weight: 10,
    points: round(10 * t),
    reading: `${cpi}% (target ≤${bandTop}%)`,
    state: over >= 1 ? 'RED' : over > 0 ? 'AMBER' : 'GREEN',
    note: over > 0
      ? `${over.toFixed(1)}pp above the top of the band — constrains any policy response to weakness.`
      : 'Within the target band, which leaves room to cut if growth deteriorates.',
  }
}

// ─── Composites ─────────────────────────────────────────────────────────────

function assemble(factors) {
  const score = round(factors.reduce((s, f) => s + f.points, 0))
  const band = score >= 60 ? 'ELEVATED' : score >= 35 ? 'MODERATE' : 'LOW'
  return { score, band, factors }
}

export function auRecessionRisk() {
  const { rba, au } = VERIFIED_CONSTANTS
  return {
    region: 'Australia',
    asOf: au.lastVerified,
    ...assemble([
      curveFactor(curveSpreadBp(YIELD_CURVE_POINTS.AU)),
      // The trough is the cycle low this app has recorded, not a forecast.
      unemploymentFactor(au.unemployment, 3.5),
      growthFactor(au.gdpAnnual),
      policyFactor(rba.cashRate, au.cpi),
      inflationFactor(au.cpi, 3),
    ]),
  }
}

export function usRecessionRisk() {
  const { fed, us } = VERIFIED_CONSTANTS
  return {
    region: 'United States',
    asOf: us.lastVerified,
    ...assemble([
      curveFactor(curveSpreadBp(YIELD_CURVE_POINTS.US)),
      unemploymentFactor(us.unemployment, 3.4),
      // The US publishes an annualised quarterly rate, which is the closest
      // comparable to the annual figure the AU side uses.
      growthFactor(us.gdpQoQAnnualised),
      policyFactor(fed.cashRate, us.cpi),
      inflationFactor(us.cpi, 2),
    ]),
  }
}

// Deliberately the mean of the two composites this file can actually compute,
// not a third opinion about the world. Naming it that way in the UI matters:
// "global" would imply China, the EU and Japan are in it, and they are not.
export function combinedRisk() {
  const au = auRecessionRisk()
  const us = usRecessionRisk()
  const score = round((au.score + us.score) / 2)
  return {
    region: 'AU + US average',
    score,
    band: score >= 60 ? 'ELEVATED' : score >= 35 ? 'MODERATE' : 'LOW',
    parts: [au, us],
  }
}

export const BAND_TONE = {
  LOW: '#2D8A50',
  MODERATE: '#C9A84C',
  ELEVATED: '#A83232',
}

export const STATE_TONE = {
  GREEN: '#2D8A50',
  AMBER: '#C9A84C',
  RED: '#A83232',
}

// Past Australian recessions, for chart context. Dates are historical record.
export const AU_RECESSIONS = [
  { label: '1990-91 recession', from: '1990-09-01', to: '1991-09-01' },
  { label: 'GFC downturn', from: '2008-09-01', to: '2009-06-01' },
  { label: 'COVID recession', from: '2020-03-01', to: '2020-09-01' },
]
