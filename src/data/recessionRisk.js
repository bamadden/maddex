import { VERIFIED_CONSTANTS } from './verifiedConstants'
import { BOND_CURVES, BOND_CURVES_AS_OF } from './bondCurves'

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
//   Yield curve inverted (2s10s < 0)        +25   (partial credit below +25bp)
//   Unemployment turning up (Sahm-style)    +20   (scaled, 0.5pp = full)
//   GDP growth weak or negative             +20   (scaled, <0% = full)
//   Policy tightening (12-month change)     +15   (scaled, +150bp = full)
//   Real policy rate restrictive            +10   (scaled, +2pp = full)
//   Inflation outside the target band       +10   (scaled, 2pp above = full)
//
// REVISED 2026-10-19. The first version had five factors and two blind spots
// that the 2026 data exposed:
//   - Unemployment was measured from a fixed 2023 trough of 3.5%, so it
//     scored a three-year drift, not a labour market turning. It now uses the
//     Sahm-rule construction on the ABS monthly series: the latest three-month
//     average against the lowest three-month average of the prior year. A
//     0.5pp gap is the rule's own recession threshold, hence full weight.
//   - Nothing scored a hiking cycle. Four RBA hikes in nine months scored
//     zero beyond what the real-rate factor caught, yet the pace of
//     tightening is what squeezes credit before the level does. That is the
//     new tightening factor, read from the dated decision lists.
// The curve and growth weights came down 5 points each to make room.
//
// A yield-curve inversion still carries the largest single weight because it
// is the most-studied leading indicator, not because this file claims it is
// decisive.

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const round = (v) => Math.round(v * 10) / 10

// ─── Yield curves ───────────────────────────────────────────────────────────
//
// Read from bondCurves.js, the single source for yields, so this factor and
// the Bonds/Rates curves cannot disagree.
const at = (key, m) => BOND_CURVES[key].find((r) => r.maturity === m)?.yield ?? null
export const YIELD_CURVE_POINTS = {
  AU: { twoYear: at('AU', '2Y'), tenYear: at('AU', '10Y'), asOf: BOND_CURVES_AS_OF.AU, source: 'Market close' },
  US: { twoYear: at('US', '2Y'), tenYear: at('US', '10Y'), asOf: BOND_CURVES_AS_OF.US, source: 'US Treasury par curve' },
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
    weight: 25,
    points: round(25 * t),
    reading: `${spreadBp >= 0 ? '+' : ''}${spreadBp}bp`,
    state: spreadBp < 0 ? 'RED' : spreadBp < 25 ? 'AMBER' : 'GREEN',
    note: spreadBp < 0
      ? 'Inverted — short rates above long. The most-studied recession lead indicator.'
      : spreadBp < 25
        ? 'Flat. Not inverted, but little term premium left.'
        : 'Positive slope — no inversion signal.',
  }
}

// Sahm-style: the latest three-month average of the unemployment rate
// against the lowest three-month average of the twelve months before it.
// Needs fifteen monthly points; returns null without them.
export function sahmGap(history) {
  const v = history.map((r) => r.value)
  if (v.length < 15) return null
  const avg3 = (end) => (v[end] + v[end - 1] + v[end - 2]) / 3
  const last = v.length - 1
  let low = Infinity
  for (let i = last - 12; i < last; i++) low = Math.min(low, avg3(i))
  return { current: avg3(last), low, gap: avg3(last) - low, period: history[last].period }
}

function unemploymentFactor(current, { history, trough } = {}) {
  const sahm = history ? sahmGap(history) : null
  if (sahm) {
    const t = clamp(sahm.gap / 0.5)
    return {
      key: 'unemployment',
      label: 'Unemployment turning (Sahm-style)',
      weight: 20,
      points: round(20 * t),
      reading: `+${sahm.gap.toFixed(2)}pp`,
      state: sahm.gap >= 0.5 ? 'RED' : sahm.gap >= 0.3 ? 'AMBER' : 'GREEN',
      note: `3-month average ${sahm.current.toFixed(2)}% vs a low of ${sahm.low.toFixed(2)}% in the prior year (latest ${current}%). `
        + (sahm.gap >= 0.5
          ? 'At or past the 0.5pp threshold the rule treats as a recession signal.'
          : sahm.gap >= 0.3
            ? 'Approaching the 0.5pp threshold the rule treats as a recession signal.'
            : 'Well short of the 0.5pp threshold.'),
    }
  }
  // No monthly history held for this economy — fall back to the rise from
  // its cycle trough, on a gentler scale (1.5pp = full), and say so.
  const rise = current - trough
  const t = clamp(rise / 1.5)
  return {
    key: 'unemployment',
    label: 'Unemployment vs cycle trough',
    weight: 20,
    points: round(20 * t),
    reading: `${current}% (trough ${trough}%)`,
    state: rise >= 0.8 ? 'RED' : rise >= 0.4 ? 'AMBER' : 'GREEN',
    note: rise <= 0
      ? 'At or below its cycle low.'
      : `Up ${rise.toFixed(1)}pp from the cycle trough. No monthly series is held for the Sahm-style reading.`,
  }
}

// Policy rate on a date, from a dated decision list (each row's `rate` is
// the level set that day).
function rateOn(decisions, iso) {
  const prior = decisions.filter((d) => d.date <= iso)
  return prior.length ? prior[prior.length - 1].rate : null
}

function tighteningFactor(decisions, now) {
  const today = new Date(now).toISOString().slice(0, 10)
  const yearAgo = new Date(now - 365 * 86400000).toISOString().slice(0, 10)
  const then = rateOn(decisions, yearAgo)
  const current = rateOn(decisions, today)
  if (then == null || current == null) {
    return { key: 'tightening', label: 'Policy tightening (12m)', weight: 15, points: 0, reading: 'n/a', state: 'GREEN',
      note: 'No decision history reaching back twelve months — scored as zero rather than guessed.' }
  }
  const bp = Math.round((current - then) * 100)
  const moves = decisions.filter((d) => d.date > yearAgo && d.date <= today && d.change !== 0)
  const hikes = moves.filter((d) => d.change > 0).length
  const cuts = moves.filter((d) => d.change < 0).length
  const t = clamp(bp / 150)
  return {
    key: 'tightening',
    label: 'Policy tightening (12m)',
    weight: 15,
    points: round(15 * t),
    reading: `${bp >= 0 ? '+' : ''}${bp}bp`,
    state: bp >= 100 ? 'RED' : bp > 0 ? 'AMBER' : 'GREEN',
    note: `${then.toFixed(2)}% a year ago, ${current.toFixed(2)}% now`
      + (hikes || cuts ? ` — ${[hikes && `${hikes} hike${hikes > 1 ? 's' : ''}`, cuts && `${cuts} cut${cuts > 1 ? 's' : ''}`].filter(Boolean).join(', ')} in twelve months.` : ' — no moves in twelve months.')
      + (bp > 0 ? ' The pace of tightening squeezes credit before the level does.' : ''),
  }
}

function growthFactor(annualPct) {
  // Full weight at or below zero, none at 3%.
  const t = clamp((3 - annualPct) / 3)
  return {
    key: 'growth',
    label: 'GDP growth (annual)',
    weight: 20,
    points: round(20 * t),
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
    weight: 10,
    points: round(10 * t),
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

export function auRecessionRisk(now = Date.now()) {
  const { rba, au } = VERIFIED_CONSTANTS
  return {
    region: 'Australia',
    asOf: au.lastVerified,
    ...assemble([
      curveFactor(curveSpreadBp(YIELD_CURVE_POINTS.AU)),
      unemploymentFactor(au.unemployment, { history: au.unemploymentHistory }),
      growthFactor(au.gdpAnnual),
      tighteningFactor(rba.decisions, now),
      policyFactor(rba.cashRate, au.cpi),
      inflationFactor(au.cpi, 3),
    ]),
  }
}

export function usRecessionRisk(now = Date.now()) {
  const { fed, us } = VERIFIED_CONSTANTS
  return {
    region: 'United States',
    asOf: us.lastVerified,
    ...assemble([
      curveFactor(curveSpreadBp(YIELD_CURVE_POINTS.US)),
      unemploymentFactor(us.unemployment, { trough: 3.4 }),
      // The US publishes an annualised quarterly rate, which is the closest
      // comparable to the annual figure the AU side uses.
      growthFactor(us.gdpQoQAnnualised),
      tighteningFactor(fed.decisions, now),
      policyFactor(fed.cashRate, us.cpi),
      inflationFactor(us.cpi, 2),
    ]),
  }
}

// Deliberately the mean of the two composites this file can actually compute,
// not a third opinion about the world. Naming it that way in the UI matters:
// "global" would imply China, the EU and Japan are in it, and they are not.
export function combinedRisk(now = Date.now()) {
  const au = auRecessionRisk(now)
  const us = usRecessionRisk(now)
  const score = round((au.score + us.score) / 2)
  return {
    region: 'AU + US average',
    score,
    band: score >= 60 ? 'ELEVATED' : score >= 35 ? 'MODERATE' : 'LOW',
    parts: [au, us],
  }
}

// The rubric as data, so the panel's "how the score is built" list cannot
// disagree with the weights above.
export const RUBRIC = [
  ['Yield curve inverted (2s10s)', 25],
  ['Unemployment turning up (Sahm-style)', 20],
  ['GDP growth weak or negative', 20],
  ['Policy tightening, 12-month change', 15],
  ['Real policy rate restrictive', 10],
  ['Inflation outside target band', 10],
]

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
