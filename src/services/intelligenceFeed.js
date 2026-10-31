// MaddenAI's INTELLIGENCE UPDATE — the cards on the empty chat panel.
//
// Built from verifiedConstants and the user's own holdings, not generated:
// every figure on a card is one the terminal already holds with a source, so
// a card can be shown without a model call and cannot invent a number. Each
// card's READ MORE sends a question to MaddenAI, which then writes the
// analysis from the same figures (see ai_prose_not_figures).
//
// Rebuilt on each day's first open of the panel; the inputs only change when
// the constants are updated, so there is nothing to cache beyond that.

import VERIFIED_CONSTANTS, { pendingRbaDecision } from '../data/verifiedConstants'
import { rateImpact } from '../modules/portfolio/rateSensitivity'

const DAY = 86_400_000
const BANKS = ['fed', 'ecb', 'boj', 'boe', 'boc', 'rbnz', 'pboc', 'snb', 'riksbank']

const sydDate = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const dayMonth = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
const weekday = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short' })
const daysBetween = (fromIso, toIso) => Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / DAY)

function rbaCard(now) {
  const C = VERIFIED_CONSTANTS
  const nd = pendingRbaDecision(now)
  const a = C.au
  if (!nd) return null
  const days = daysBetween(sydDate(now), nd.date)
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
  const priced = nd.marketHikePct != null
  const cpi = a?.cpiQuarterTrimmedQoQ != null && a?.cpiQuarterRbaForecast != null
    ? ` The ${a.cpiQuarterPeriod} trimmed mean ran ${a.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q against the RBA's own ${a.cpiQuarterRbaForecast.toFixed(1)}% forecast.`
    : ''
  return {
    id: 'rba',
    tag: 'RBA',
    tone: 'gold',
    title: `RBA decision ${when}${priced ? ` — ~${nd.marketHikePct}% hike priced` : ''}`,
    body: `${weekday(nd.date)} ${dayMonth(nd.date)}, ${nd.time} AEDT. ${priced ? `Markets price ~${nd.marketHikePct}% for a 25bp hike to ${nd.hikeRate.toFixed(2)}% (${nd.marketSource}, ${dayMonth(nd.marketAsOf)}).` : `The cash rate is ${nd.currentRate.toFixed(2)}%.`}${cpi} Watch the statement for whether the Board signals more after this one.`,
    prompt: `The RBA decides on ${dayMonth(nd.date)}. Using the market pricing, CPI and RBA statement figures in your context, what should I watch for, and what would a hike versus a hold mean for the AUD and ASX sectors?`,
    source: nd.source,
  }
}

function cpiCard(holdings) {
  const a = VERIFIED_CONSTANTS.au
  if (a?.cpiQuarterTrimmedQoQ == null) return null
  const above = a.cpiQuarterRbaForecast != null && a.cpiQuarterTrimmedQoQ > a.cpiQuarterRbaForecast
  let mine = ''
  const rows = (holdings ?? []).filter((h) => h?.symbol && h.type !== 'crypto')
  if (rows.length) {
    const seen = new Map()
    for (const h of rows) seen.set(`${h.type}:${h.symbol}`, h)
    const by = { POSITIVE: [], NEUTRAL: [], NEGATIVE: [] }
    for (const h of seen.values()) {
      const { impact } = rateImpact(h)
      if (impact) by[impact].push(h.symbol)
    }
    const list = (xs) => xs.slice(0, 3).join(', ') + (xs.length > 3 ? ` +${xs.length - 3}` : '')
    const parts = []
    if (by.POSITIVE.length) parts.push(`${list(by.POSITIVE)} tend${by.POSITIVE.length === 1 ? 's' : ''} to benefit from higher rates`)
    if (by.NEGATIVE.length) parts.push(`${list(by.NEGATIVE)} ${by.NEGATIVE.length === 1 ? 'is' : 'are'} rate-sensitive`)
    if (!parts.length && by.NEUTRAL.length) parts.push(`${list(by.NEUTRAL)} ${by.NEUTRAL.length === 1 ? 'has' : 'have'} limited direct rate exposure`)
    if (parts.length) mine = ` In your portfolio, ${parts.join('; ')}.`
  }
  return {
    id: 'cpi',
    tag: 'CPI',
    tone: above ? 'red' : 'green',
    title: `${a.cpiQuarterPeriod} CPI ${above ? 'came in above the RBA forecast' : 'came in at or below the RBA forecast'}`,
    body: `Trimmed mean ${a.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q (${a.cpiQuarterTrimmedYoY.toFixed(1)}% y/y), headline ${a.cpiQuarterQoQ.toFixed(1)}% q/q (ABS, ${dayMonth(a.cpiLastRelease)}).${a.cpiQuarterRbaForecast != null ? ` The RBA had forecast ${a.cpiQuarterRbaForecast.toFixed(1)}%.` : ''}${mine}`,
    prompt: rows.length
      ? 'Using the September quarter CPI figures in your context and my portfolio holdings, which of my holdings are most exposed to a higher-for-longer rate path, and which are relatively insulated?'
      : 'Using the September quarter CPI figures in your context, what does the result mean for the RBA, the AUD and ASX sectors?',
    source: 'abs.gov.au',
  }
}

// Central-bank decisions in the last week, and any due in the next three days.
// Dates are each bank's own (the Fed's 28 Oct is the morning of the 29th in
// Sydney), so the card prints dates rather than "today" or "yesterday".
function globalCard(now) {
  const C = VERIFIED_CONSTANTS
  const today = sydDate(now)
  const recent = []
  const due = []
  for (const k of BANKS) {
    const b = C[k]
    if (!b?.lastDecision) continue
    const ago = daysBetween(b.lastDecision, today)
    if (ago >= 0 && ago <= 7) recent.push({ k, b, ago })
    if (b.nextMeeting) {
      const ahead = daysBetween(today, b.nextMeeting)
      if (ahead >= 0 && ahead <= 3 && b.nextMeeting > b.lastDecision) due.push({ k, b, ahead })
    }
  }
  if (!recent.length && !due.length) return null
  recent.sort((x, y) => x.ago - y.ago)
  const describe = ({ k, b }) => {
    const last = k === 'fed' ? b.decisions?.at(-1) : null
    const range = k === 'fed' && b.rateRange ? b.rateRange : `${b.cashRate.toFixed(2)}%`
    const verb = b.lastDecisionVerb === 'HOLD' ? 'held at' : b.lastDecisionVerb === 'HIKE' ? 'raised to' : b.lastDecisionVerb === 'CUT' ? 'cut to' : 'at'
    return `${b.label === 'BOC' ? 'BoC' : b.label} ${verb} ${range}${last?.vote ? ` (${last.vote})` : ''}`
  }
  const lead = recent.find((r) => r.k === 'fed') ?? recent[0]
  const leadDecision = lead?.k === 'fed' ? lead.b.decisions?.at(-1) : null
  const title = lead
    ? `${describe(lead)} on ${dayMonth(lead.b.lastDecision)}`
    : `${due.map(({ b }) => b.label).join(' and ')} decide${due.length === 1 ? 's' : ''} this week`
  const others = recent.filter((r) => r !== lead).map(describe)
  const body = [
    leadDecision?.reason ?? (lead?.b.note ? `${lead.b.note}.` : null),
    others.length ? `Also this week: ${others.join('; ')}.` : null,
    due.length ? `Still to come: ${due.map(({ b }) => `${b.label === 'BOC' ? 'BoC' : b.label} ${dayMonth(b.nextMeeting)}`).join(', ')}.` : null,
  ].filter(Boolean).join(' ')
  return {
    id: 'global',
    tag: 'GLOBAL',
    tone: 'blue',
    title,
    body,
    prompt: 'Using the central bank decisions in your context, what do this week\'s global rate decisions mean for the AUD and for the RBA\'s next move?',
    source: 'central bank statements',
  }
}

export function intelligenceFeed({ now = Date.now(), holdings = [] } = {}) {
  return {
    date: new Date(now).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' }).toUpperCase(),
    cards: [rbaCard(now), cpiCard(holdings), globalCard(now)].filter(Boolean),
  }
}
