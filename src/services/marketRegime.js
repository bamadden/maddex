// ─── Market regime ──────────────────────────────────────────────────────────
//
// A one-word read on the policy backdrop — TIGHTENING / EASING / ON HOLD — and
// a short stance for the RBA, the Fed and the Australian outlook, all derived
// from VERIFIED_CONSTANTS rather than typed in. When the RBA's next decision
// lands in the constants, the regime, MaddenAI's context and the Dashboard
// quick prompts follow with no edit here.
//
// Stances say what the banks did and said, not what they will do: "door open
// to further hikes" is from the RBA's own minutes; nothing here forecasts a
// move nobody announced.

import VERIFIED_CONSTANTS from '../data/verifiedConstants.js'
import { formatDate } from '../utils/dateUtils.js'
import { PAL } from '../styles/palette.js'

const verb = (cb) => String(cb?.lastDecisionVerb ?? '').toUpperCase()

export function getMarketRegime(c = VERIFIED_CONSTANTS) {
  const { rba, fed, au } = c
  const moves = [verb(rba), verb(fed)]
  const marketRegime = moves.every((v) => v === 'HIKE') ? 'TIGHTENING'
    : moves.every((v) => v === 'CUT') ? 'EASING'
    : moves.includes('HIKE') ? 'MIXED — TIGHTENING BIAS'
    : moves.includes('CUT') ? 'MIXED — EASING BIAS' : 'ON HOLD'

  const rbaOpen = /further|more hikes|if required/i.test(rba.minutes?.summary ?? '')
  const rbaStance = verb(rba) === 'HIKE'
    ? `HAWKISH — hiked ${rba.lastChange ?? ''} to ${rba.cashRate.toFixed(2)}% on ${formatDate(rba.lastDecision)}${rbaOpen ? '; minutes leave the door open to more hikes' : ''}`
    : verb(rba) === 'CUT' ? `DOVISH — cut to ${rba.cashRate.toFixed(2)}% on ${formatDate(rba.lastDecision)}` : `ON HOLD at ${rba.cashRate.toFixed(2)}%`
  const fedStance = verb(fed) === 'HIKE'
    ? `HAWKISH — hiked ${fed.lastChange ?? ''} to ${fed.rateRange} on ${formatDate(fed.lastDecision)}; next meeting ${formatDate(fed.nextMeeting)}`
    : verb(fed) === 'CUT' ? `DOVISH — cut to ${fed.rateRange} on ${formatDate(fed.lastDecision)}` : `ON HOLD at ${fed.rateRange}`

  const rising = au.unemploymentPrevious != null && au.unemployment > au.unemploymentPrevious
  const slowing = rising || (au.gdpAnnual != null && au.gdpAnnual < 2.5)
  const auOutlook = `${slowing ? 'SLOWING' : 'STEADY'} — GDP ${au.gdpAnnual}% annual (${au.gdpPeriod}), unemployment ${au.unemployment}% (${au.unemploymentPeriod})${rising ? ', rising' : ''}, CPI ${au.cpi.toFixed(1)}% (${au.cpiPeriod}) above the ${au.rbaTargetBand} target`

  return { marketRegime, rbaStance, fedStance, auOutlook }
}

// For MaddenAI's per-turn context.
export function regimeForAI() {
  const r = getMarketRegime()
  const q = currentRegime()
  return `[MARKET REGIME — derived from the verified facts]\n- Classification: ${q.regime} — ${q.note} (RBA ${q.inputs.rba}; CPI ${q.inputs.cpi}; GDP ${q.inputs.gdp}; unemployment ${q.inputs.unemployment})\n- Policy backdrop: ${r.marketRegime}\n- RBA: ${r.rbaStance}\n- Fed: ${r.fedStance}\n- Australia: ${r.auOutlook}`
}

// Dashboard quick prompts for the current regime.
export function regimePrompts() {
  const { rba } = VERIFIED_CONSTANTS
  const rate = `${rba.cashRate.toFixed(2)}%`
  const { marketRegime } = getMarketRegime()
  if (!marketRegime.includes('TIGHTENING')) return null
  return [
    { label: 'RATE HIKES & ASX SECTORS', prompt: 'Describe how the RBA and Fed rate hikes reach ASX sectors, and which sectors are most exposed to higher rates, using only the figures given. Describe only: no forecast.', dataKeys: ['asx'] },
    { label: `EARNINGS AND A ${rate} CASH RATE`, prompt: `Explain how a ${rate} cash rate reaches company earnings — margins, cash balances, borrowing costs, pricing power — by business model. Describe only: no stock picks and no suggestion of any action.`, dataKeys: ['asx'] },
    { label: 'TIGHTENING CYCLES EXPLAINED', prompt: 'Explain what a tightening cycle is and how past RBA tightening cycles have reached borrowers, savers and company earnings. Describe only: no view on investing now or later.', dataKeys: ['asx', 'aud'] },
    { label: 'RISK OF MORE RBA HIKES', prompt: `What is the case for and against another RBA hike at the ${rba.nextMeeting} meeting, and what data between now and then matters most? Describe it in words — no market-implied probability.`, dataKeys: [] },
  ]
}

// ─── Regime classification ──────────────────────────────────────────────────
//
// The four-way label shown on the Dashboard, the Macro module, MaddenAI's
// context and the morning brief: the POLICY direction (is the RBA tightening
// or easing) against the GROWTH direction (is the economy slowing or not).
//
//   TIGHTENING + SLOWING  → HIKING · SLOWER GROWTH
//   TIGHTENING + GROWING  → HIKING · FIRMER GROWTH
//   EASING     + SLOWING  → CUTTING · SLOWER GROWTH
//   EASING     + GROWING  → CUTTING · FIRMER GROWTH
//
// Plain descriptions (16 Nov 2026). The names used before (STAGFLATION RISK,
// OVERHEATING, RECESSION RISK, GOLDILOCKS) carried judgements the rules do
// not make, and the Macro quadrant used a third set of names.
//
// The rules, so the label can be checked:
//   Policy  — the direction of the RBA's most recent move, if it came within
//             the last nine months; with no move in that window, ON HOLD.
//   Growth  — SLOWING if annual GDP growth is below GROWTH_REFERENCE or
//             unemployment has risen 0.2pt or more over six months;
//             otherwise GROWING.
// CPI against the 2–3% band and the Fed's stance are shown beside the label
// as inputs; they colour the reading but do not change the quadrant.

// The growth line: 2.25% annual GDP growth, a fixed reference Maddex uses to
// split "slower" from "firmer" growth. It is a method choice, not an estimate
// of potential growth: the RBA publishes no figure for that. Its own
// assessment, in words, is RBA_GROWTH_ASSESSMENT, shown beside the label.
// (Until 16 Nov 2026 this was called "trend growth", a figure with no source.)
export const GROWTH_REFERENCE = 2.25
export const RBA_GROWTH_ASSESSMENT = {
  text: 'GDP growth has slowed this year to a little below its potential growth rate',
  source: 'RBA, Statement on Monetary Policy, November 2026',
  url: 'https://www.rba.gov.au/publications/smp/2026/nov/outlook.html',
  read: '2026-11-16',
}
// The RBA's NAIRU, in its words: no figure is published in the Statement,
// so none is shown (a typed "~4.25%" stood on three panels until 16 Nov 2026).
export const RBA_NAIRU_NOTE = {
  text: 'the RBA raised its assessment of the NAIRU a little in November 2026 and calls the estimate very uncertain; it publishes no single figure in the Statement',
  source: 'RBA, Statement on Monetary Policy, November 2026',
  url: 'https://www.rba.gov.au/publications/smp/2026/nov/outlook.html',
  read: '2026-11-16',
}

// The inflation line everywhere: the top of the RBA's 2–3% band.
export const CPI_REFERENCE = 3

export const REGIME_STYLE = {
  'HIKING · SLOWER GROWTH': { colour: PAL.amber, note: 'The RBA\'s last move was a rise; growth is below the 2.25% reference line, or unemployment has risen.' },
  'HIKING · FIRMER GROWTH': { colour: PAL.amber, note: 'The RBA\'s last move was a rise; growth is at or above the 2.25% reference line.' },
  'CUTTING · SLOWER GROWTH': { colour: PAL.dim, note: 'The RBA\'s last move was a cut; growth is below the 2.25% reference line, or unemployment has risen.' },
  'CUTTING · FIRMER GROWTH': { colour: PAL.dim, note: 'The RBA\'s last move was a cut; growth is at or above the 2.25% reference line.' },
  'ON HOLD': { colour: PAL.dim, note: 'No RBA move in nine months.' },
}

// Growth against the reference line and CPI against the top of the band:
// the Macro quadrant's four cells, in the same words.
export const QUADRANT_LABELS = {
  'slow-hot': 'SLOWER GROWTH · CPI ABOVE THE BAND',
  'firm-hot': 'FIRMER GROWTH · CPI ABOVE THE BAND',
  'slow-cool': 'SLOWER GROWTH · CPI IN OR BELOW THE BAND',
  'firm-cool': 'FIRMER GROWTH · CPI IN OR BELOW THE BAND',
}
export function growthInflationQuadrant(gdpAnnual, cpi) {
  const key = `${gdpAnnual < GROWTH_REFERENCE ? 'slow' : 'firm'}-${cpi > CPI_REFERENCE ? 'hot' : 'cool'}`
  return { key, label: QUADRANT_LABELS[key] }
}

const monthsBetween = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / (30.44 * 86_400_000)
const ym = (iso) => iso.slice(0, 7)

function policyAt(asOf, c) {
  const moves = (c.rba.decisions ?? []).filter((d) => d.date <= asOf && d.decision !== 'HOLD')
  const last = moves.at(-1)
  if (!last || monthsBetween(last.date, asOf) > 9) return { policy: 'HOLD', last }
  return { policy: last.decision === 'HIKE' ? 'TIGHTENING' : 'EASING', last }
}

function unemploymentTrendAt(asOf, c) {
  const series = (c.au.unemploymentHistory ?? []).filter((p) => p.period <= ym(asOf))
  const now = series.at(-1)
  const back = series.at(-7)
  if (!now || !back) return { trend: 'STABLE', now: now?.value ?? null, back: back?.value ?? null }
  const d = Math.round((now.value - back.value) * 10) / 10
  return { trend: d >= 0.2 ? 'RISING' : d <= -0.2 ? 'FALLING' : 'STABLE', now: now.value, back: back.value, from: back.period, to: now.period }
}

function label(policy, slowing) {
  if (policy === 'HOLD') return 'ON HOLD'
  if (policy === 'TIGHTENING') return slowing ? 'HIKING · SLOWER GROWTH' : 'HIKING · FIRMER GROWTH'
  return slowing ? 'CUTTING · SLOWER GROWTH' : 'CUTTING · FIRMER GROWTH'
}

// gdpAnnual / cpi: the readings known at asOf (callers pass the quarter's own
// for history; the current call uses the latest in the constants).
export function classifyRegime({ asOf, gdpAnnual, cpi }, c = VERIFIED_CONSTANTS) {
  const { policy, last } = policyAt(asOf, c)
  const u = unemploymentTrendAt(asOf, c)
  const belowTrend = gdpAnnual != null && gdpAnnual < GROWTH_REFERENCE
  const slowing = belowTrend || u.trend === 'RISING'
  const regime = label(policy, slowing)
  const band = [2, 3]
  return {
    regime,
    colour: REGIME_STYLE[regime].colour,
    note: REGIME_STYLE[regime].note,
    inputs: {
      rba: policy === 'HOLD' ? 'Holding' : policy === 'TIGHTENING' ? `Hiking (last ${formatDate(last.date)})` : `Cutting (last ${formatDate(last.date)})`,
      cpi: cpi == null ? '—' : cpi > band[1] ? `Above target (${cpi.toFixed(1)}%)` : cpi < band[0] ? `Below target (${cpi.toFixed(1)}%)` : `In the band (${cpi.toFixed(1)}%)`,
      gdp: gdpAnnual == null ? '—' : `${belowTrend ? 'Below' : 'At or above'} the reference line (${gdpAnnual}% vs ${GROWTH_REFERENCE}%)`,
      unemployment: u.now == null ? '—' : `${u.trend[0]}${u.trend.slice(1).toLowerCase()} (${u.back}% → ${u.now}% over 6 months)`,
    },
  }
}

export function currentRegime(c = VERIFIED_CONSTANTS, now = new Date()) {
  const asOf = now.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const r = classifyRegime({ asOf, gdpAnnual: c.au.gdpAnnual, cpi: c.au.cpi }, c)
  const fed = verb(c.fed)
  return { ...r, inputs: { ...r.inputs, fed: fed === 'HIKE' ? `Hiking (${formatDate(c.fed.lastDecision)})` : fed === 'CUT' ? `Cutting (${formatDate(c.fed.lastDecision)})` : `Holding at ${c.fed.rateRange} (${formatDate(c.fed.lastDecision)})` } }
}

// The last four quarter-ends, each classified with what was published for
// that quarter (GDP and CPI from auQuarterlyPath; the RBA's moves and the
// unemployment series up to that date). A quarter whose GDP is not out yet
// uses the latest published figure, and says so.
export function regimeHistory(c = VERIFIED_CONSTANTS, now = new Date()) {
  const path = Object.fromEntries((c.au.auQuarterlyPath ?? []).map((p) => [p.period, p]))
  const ends = []
  const d = new Date(now)
  let y = d.getFullYear(), q = Math.floor(d.getMonth() / 3) // current quarter index
  for (let i = 0; i < 4; i++) {
    q -= 1
    if (q < 0) { q = 3; y -= 1 }
    const month = q * 3 + 3
    const end = new Date(Date.UTC(y, month, 0)).toISOString().slice(0, 10)
    ends.unshift({ end, label: `Q${q + 1} ${y}`, key: `${['Mar', 'Jun', 'Sep', 'Dec'][q]} ${String(y).slice(2)}` })
  }
  return ends.map(({ end, label: lbl, key }) => {
    const p = path[key]
    const gdpAnnual = p?.gdpAnnual ?? c.au.gdpAnnual
    const cpi = p?.cpi ?? (c.au.cpiHistory ?? []).filter((x) => x.period <= ym(end)).at(-1)?.value ?? null
    return { quarter: lbl, end, gdpProvisional: !p, ...classifyRegime({ asOf: end, gdpAnnual, cpi }, c) }
  })
}
