// ─── Australian tax, super and duty rates ───────────────────────────────────
//
// Every figure a calculator in this terminal uses to produce a dollar amount
// someone might act on, in one place, with its source and the year it applies
// to.
//
// THE BRIEF'S BRACKETS WERE WRONG, and it is worth recording why rather than
// silently substituting. It specified "$45,001-$135,000: $5,092 + 32.5c" —
// that is the pre-Stage-3 rate structure pasted onto the post-Stage-3
// thresholds, and $5,092 is 19% of the second bracket, a rate that no longer
// exists. Verified against the ATO schedule for 2026-27: the second bracket is
// 15% (down from 16% on 1 July 2026) and the third is 30%. Using the brief's
// numbers would have overstated tax on a $95,000 income by roughly $2,600.

export const TAX_YEAR = '2026-27'

// Marginal brackets. `base` is the cumulative tax at the bottom of the band,
// which is what makes the calculation a lookup rather than a loop — and lets
// each row be checked against the published table directly.
export const TAX_BRACKETS = [
  { from: 0,       to: 18200,  rate: 0,    base: 0,     label: 'Tax free' },
  { from: 18200,   to: 45000,  rate: 0.15, base: 0,     label: '15%' },
  { from: 45000,   to: 135000, rate: 0.30, base: 4020,  label: '30%' },
  { from: 135000,  to: 190000, rate: 0.37, base: 31020, label: '37%' },
  { from: 190000,  to: Infinity, rate: 0.45, base: 51370, label: '45%' },
]
export const TAX_SOURCE = 'ato.gov.au — resident rates 2026-27'

export const MEDICARE_LEVY = 0.02

// Low Income Tax Offset: $700 max, reduced 5c/$1 over $37,500, then 1.5c/$1
// over $45,000, gone at $66,667. The two-stage taper is why it cannot be
// approximated with a single percentage.
export const LITO = { max: 700, fullTo: 37500, taper1: 0.05, taper1To: 45000, taper2: 0.015, zeroAt: 66667 }

export const SUPER = {
  sgRate: 0.12,                 // 12% for 2026-27 — the brief said 11.5%, which was 2024-25
  concessionalCap: 32500,
  contributionsTax: 0.15,
  source: 'ato.gov.au / superguide.com.au — 2026-27',
}

// ASFA retirement standard — the widely-cited benchmark for what a comfortable
// retirement costs. A guide, not a target, and the UI says so.
export const ASFA = {
  comfortableSingleAnnual: 52085,
  comfortableCoupleAnnual: 73337,
  comfortableSingleLumpSum: 595000,
  comfortableCoupleLumpSum: 690000,
  source: 'ASFA Retirement Standard (indicative)',
  indicative: true,
}

// ─── Stamp duty ─────────────────────────────────────────────────────────────
//
// ONLY QUEENSLAND HAS A CALCULABLE SCHEDULE HERE, and that is a deliberate
// stopping point rather than an oversight.
//
// Stamp duty is a five-figure number people budget against. Producing one
// requires the complete band schedule for a state, and a schedule that is
// right for the first four bands and guessed above $387,000 — which is where
// essentially every real purchase sits — would be confidently wrong at exactly
// the values that matter. The QLD schedule below is complete and was checked
// against two published worked examples ($500k → $8,750 and $800k → $21,850
// with the home concession; both reproduce exactly).
//
// The other states carry what IS recorded — the first-home threshold and the
// top marginal rate — and the calculator says the band schedule is not held
// and points at the state revenue office rather than estimating.
export const STAMP_DUTY = {
  QLD: {
    name: 'Queensland',
    calculable: true,
    source: 'qld.gov.au transfer duty rates, 2026',
    general: [
      { from: 0,       base: 0,     rate: 0 },
      { from: 5000,    base: 0,     rate: 0.015 },
      { from: 75000,   base: 1050,  rate: 0.035 },
      { from: 540000,  base: 17325, rate: 0.045 },
      { from: 1000000, base: 38025, rate: 0.0575 },
    ],
    home: [
      { from: 0,       base: 0,     rate: 0.01 },
      { from: 350000,  base: 3500,  rate: 0.035 },
      { from: 540000,  base: 10150, rate: 0.045 },
      { from: 1000000, base: 30850, rate: 0.0575 },
    ],
    firstHomeFullExemptionTo: 700000,
    firstHomeNote: 'Established homes under $700,000 are fully exempt. New homes and vacant land are exempt with no value cap from 1 May 2025.',
  },
  NSW: { name: 'New South Wales', calculable: false, topRate: 0.055, firstHomeFullExemptionTo: 800000, firstHomeNote: 'Full exemption to $800,000, sliding concession to $1,000,000.' },
  VIC: { name: 'Victoria',        calculable: false, topRate: 0.065, firstHomeFullExemptionTo: 600000, firstHomeNote: 'Full exemption to $600,000, sliding concession to $750,000.' },
  WA:  { name: 'Western Australia', calculable: false, topRate: 0.0515, firstHomeFullExemptionTo: 600000, firstHomeNote: 'Full exemption to $600,000, concessional rate to $800,000.' },
  SA:  { name: 'South Australia', calculable: false, topRate: 0.055, firstHomeFullExemptionTo: null, firstHomeNote: 'First-home buyers of a NEW home receive full relief with no price cap.' },
  TAS: { name: 'Tasmania',        calculable: false, topRate: 0.045, firstHomeFullExemptionTo: null, firstHomeNote: 'Established-home relief for first-home buyers expired 30 June 2026.' },
  ACT: { name: 'ACT',             calculable: false, topRate: null,  firstHomeFullExemptionTo: 1000000, firstHomeNote: 'Full exemption to $1.0M, sliding concession to $1.5M.' },
  NT:  { name: 'Northern Territory', calculable: false, topRate: null, firstHomeFullExemptionTo: null, firstHomeNote: 'Progressive scale; duty is generally lower than the southern states at equivalent values.' },
}

// ─── Calculations ───────────────────────────────────────────────────────────

export function incomeTax(taxable) {
  if (!Number.isFinite(taxable) || taxable <= 0) return 0
  const b = [...TAX_BRACKETS].reverse().find((x) => taxable > x.from)
  return b ? b.base + (taxable - b.from) * b.rate : 0
}

export function marginalRate(taxable) {
  const b = [...TAX_BRACKETS].reverse().find((x) => taxable > x.from)
  return b ? b.rate : 0
}

export function litoFor(taxable) {
  if (taxable <= LITO.fullTo) return LITO.max
  if (taxable >= LITO.zeroAt) return 0
  if (taxable <= LITO.taper1To) return Math.max(0, LITO.max - (taxable - LITO.fullTo) * LITO.taper1)
  const atTaper1To = LITO.max - (LITO.taper1To - LITO.fullTo) * LITO.taper1
  return Math.max(0, atTaper1To - (taxable - LITO.taper1To) * LITO.taper2)
}

export function fullTaxPosition(gross, { deductions = 0, salarySacrifice = 0 } = {}) {
  const taxable = Math.max(0, gross - deductions - salarySacrifice)
  const tax = incomeTax(taxable)
  const medicare = taxable > 27222 ? taxable * MEDICARE_LEVY : 0
  const lito = litoFor(taxable)
  const total = Math.max(0, tax - lito) + medicare
  return {
    taxable, tax, medicare, lito, total,
    afterTax: taxable - total,
    effective: taxable > 0 ? (total / taxable) * 100 : 0,
    marginal: marginalRate(taxable) * 100,
  }
}

export function stampDuty(stateKey, price, { ownerOccupier = true, firstHome = false } = {}) {
  const st = STAMP_DUTY[stateKey]
  if (!st) return null
  if (!st.calculable) return { calculable: false, state: st }

  if (firstHome && st.firstHomeFullExemptionTo != null && price <= st.firstHomeFullExemptionTo) {
    return { calculable: true, state: st, duty: 0, exempt: true, scale: 'first home' }
  }
  const scale = ownerOccupier ? st.home : st.general
  const band = [...scale].reverse().find((b) => price > b.from) ?? scale[0]
  const duty = band.base + (price - band.from) * band.rate
  return { calculable: true, state: st, duty: Math.max(0, duty), exempt: false, scale: ownerOccupier ? 'home concession' : 'general' }
}
