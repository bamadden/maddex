// ─── Economic calendar service ──────────────────────────────────────────────
// Tries FMP's economic-calendar endpoint first; on any failure (the free/demo
// FMP key does not reliably cover this endpoint) falls back to a rolling
// static list. Every date below is ISO, so "upcoming"/"past" is always
// computed from today rather than hand-maintained.

import { getRelativeDate, sydneyOffset } from '../utils/dateUtils'
import VERIFIED_CONSTANTS from '../data/verifiedConstants'

// No 'demo' fallback: FMP rejects it on this endpoint with a 401, so without
// a real key the request is pure console noise before the fallback list.
const FMP_KEY   = import.meta.env.VITE_FMP_API_KEY || null
const CACHE_KEY = 'madden_econ_calendar_v1'
const CACHE_MS  = 6 * 60 * 60 * 1000 // 6 hours — calendar doesn't change often

// Rolling fallback schedule (AU/US, highest-impact events through the known
// RBA/FOMC calendar). Past entries fall out of `upcomingEvents()` on their
// own — nothing here needs to be removed as time passes.
const FALLBACK_EVENTS = [
  // Dates checked 2026-10-01 against the ABS and BLS release calendars and
  // each central bank's published meeting schedule. Times are Sydney local
  // (AEST until 4 Oct, AEDT after) — US releases move an hour later in AU
  // terms once Sydney's clocks go forward.
  { date: '2026-10-01', time: '11:30', event: 'AU International Trade in Goods (Aug)', region: 'AU', importance: 'low' },
  { date: '2026-10-02', time: '22:30', event: 'US Non-Farm Payrolls (Sep)',          region: 'US', importance: 'high',
    description: 'First payrolls read since the Fed hiked to 3.75–4.00% on 16 Sep.' },
  { date: '2026-10-07', time: '11:30', event: 'AU Building Approvals (Aug)',         region: 'AU', importance: 'low' },
  { date: '2026-10-09', time: '11:30', event: 'AU Household Spending Indicator (Aug)', region: 'AU', importance: 'medium' },
  { date: '2026-10-14', time: '23:30', event: 'US CPI (Sep)',                        region: 'US', importance: 'high',
    description: 'Last CPI print before the 27–28 Oct FOMC.' },
  { date: '2026-10-15', time: '11:30', event: 'AU Labour Force (Sep)',               region: 'AU', importance: 'high',
    description: 'Unemployment rose to 4.7% (seasonally adjusted), a five-year high. Trend 4.6%.' },
  { date: '2026-10-15', time: '23:30', event: 'US PPI (Sep)',                        region: 'US', importance: 'medium' },
  { date: '2026-10-23', time: '11:30', event: 'AU National Accounts (2025-26)',      region: 'AU', importance: 'low' },
  // Released. The result and the forecasts it was measured against are in
  // verifiedConstants.au (cpiQuarter*), once.
  { date: '2026-10-28', time: '11:30', event: 'AU CPI (Sep, incl. Sep quarter)',     region: 'AU', importance: 'high',
    forecast: VERIFIED_CONSTANTS.au.cpiQuarterForecasts,
    prev: `Aug: ${VERIFIED_CONSTANTS.au.cpiPrevious.toFixed(1)}% y/y, trimmed mean ${VERIFIED_CONSTANTS.au.cpiTrimmedMeanPrevious.toFixed(1)}% (revised)`,
    sourceUrl: VERIFIED_CONSTANTS.au.cpiQuarterUrl, sourceLabel: 'ABS.GOV.AU', watch: ['cpi', 'cpiTrimmedMean'],
    description: (() => {
      const a = VERIFIED_CONSTANTS.au
      return `Released: September ${a.cpi.toFixed(1)}% y/y, trimmed mean ${a.cpiTrimmedMean.toFixed(1)}%. ${a.cpiQuarterPeriod}: trimmed mean ${a.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q (${a.cpiQuarterTrimmedYoY.toFixed(1)}% y/y), headline ${a.cpiQuarterQoQ.toFixed(1)}% q/q (${a.cpiQuarterYoY.toFixed(1)}% y/y). The last inflation read before the 3 Nov RBA decision.`
    })() },
  { date: '2026-10-28', time: '12:00', event: 'RBNZ OCR Decision',                   region: 'NZ', importance: 'medium',
    description: 'RESULT: HOLD at 2.75% (4–3 vote) — markets had priced a hike to 3.00%. Next decision 9 Dec.' },
  { date: '2026-10-29', time: '05:00', event: 'FOMC Rate Decision',                  region: 'US', importance: 'high',
    sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases.htm', sourceLabel: 'FEDERALRESERVE.GOV', watch: ['fedUpper'],
    description: 'First meeting after the September hike to 3.75–4.00%. CME FedWatch had ~90% priced for a hold (28 Oct); no new projections until December.' },
  { date: '2026-10-29', time: '00:45', event: 'Bank of Canada Rate Decision',        region: 'CA', importance: 'medium',
    description: 'Policy rate 2.25%. 9:45am Ottawa, Wed 28 Oct.' },
  { date: '2026-10-30', time: '00:15', event: 'ECB Rate Decision',                   region: 'EU', importance: 'medium',
    description: 'Deposit rate 2.50% after the 10 Sep hike. A hold is the consensus; December carries new projections.' },
  { date: '2026-10-30', time: '—',     event: 'Bank of Japan Rate Decision',         region: 'JP', importance: 'medium',
    description: 'Policy rate 1.25% after the 18 Sep hike; Outlook Report released with the decision.' },
  { date: '2026-10-30', time: '11:30', event: 'AU Producer Price Index (Sep)',       region: 'AU', importance: 'low' },
  { date: '2026-11-03', time: '14:30', event: 'RBA Rate Decision',                   region: 'AU', importance: 'high',
    sourceUrl: 'https://www.rba.gov.au/media-releases/', sourceLabel: 'RBA.GOV.AU', watch: ['cashRate'],
    description: 'Cash rate 4.60% after the 29 Sep hike, the fourth of 2026.' },
  { date: '2026-11-04', time: '—',     event: 'US Midterm Election Results',         region: 'US', importance: 'high',
    description: 'Polls close on 3 Nov US time; results arrive through the AU day.' },
  { date: '2026-11-05', time: '23:00', event: 'Bank of England Rate Decision',       region: 'UK', importance: 'medium' },
  { date: '2026-11-19', time: '11:30', event: 'AU Labour Force (Oct)',               region: 'AU', importance: 'high',
    sourceUrl: 'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release', sourceLabel: 'ABS.GOV.AU', watch: ['unemployment'],
    description: 'Unemployment was 4.7% in September, a five-year high.' },
  { date: '2026-12-08', time: '14:30', event: 'RBA Rate Decision',                   region: 'AU', importance: 'high' },
  { date: '2026-12-10', time: '06:00', event: 'FOMC Rate Decision',                  region: 'US', importance: 'high' },
]

// Recent confirmed results. Kept separate from the forward calendar since
// there's nothing to "auto-generate" here.
const FALLBACK_PREVIOUS = [
  { date: '2026-09-16', event: 'FOMC Rate Decision',            region: 'US', result: 'HIKE +25bp to 3.75–4.00%' },
  { date: '2026-09-18', event: 'Bank of Japan Rate Decision',   region: 'JP', result: 'HIKE +25bp to 1.25%' },
  { date: '2026-09-24', event: 'AU Unemployment Rate (Aug)',    region: 'AU', result: '4.6%' },
  { date: '2026-09-29', event: 'RBA Rate Decision',             region: 'AU', result: 'HIKE +25bp to 4.60%' },
  { date: '2026-10-15', event: 'AU Unemployment Rate (Sep)',    region: 'AU', result: '4.7%' },
  { date: '2026-10-28', event: 'AU CPI (Sep, incl. Sep quarter)', region: 'AU', result: '4.3% y/y · trimmed mean 1.0% q/q' },
  { date: '2026-10-28', event: 'RBNZ OCR Decision',             region: 'NZ', result: 'HOLD at 2.75% (4–3; hike was priced)' },
]

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.cachedAt > CACHE_MS) return null
    return parsed.events
  } catch {
    return null
  }
}

function writeCache(events) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), events }))
  } catch {
    // localStorage unavailable/full — cache is a nice-to-have, not required
  }
}

async function fetchLiveCalendar() {
  if (!FMP_KEY) throw new Error('No FMP key — using the verified schedule')
  const from = getRelativeDate(0)
  const to   = getRelativeDate(60)
  const url  = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`
  // Bounded: without a timeout a slow vendor holds the whole calendar —
  // and every widget built on it — in "loading" instead of falling back.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  let res
  try { res = await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(timer) }
  if (!res.ok) throw new Error(`FMP calendar ${res.status}`)
  const raw = await res.json()
  if (!Array.isArray(raw) || !raw.length) throw new Error('FMP calendar empty')
  return raw
    .filter((e) => e.country === 'AU' || e.country === 'US')
    .map((e) => ({
      date:       e.date?.slice(0, 10),
      time:       e.date?.slice(11, 16) || '—',
      event:      e.event,
      region:     e.country,
      importance: (e.impact || 'low').toLowerCase(),
      forecast:   e.estimate ?? '—',
      prev:       e.previous ?? '—',
    }))
}

// Returns { events, source }. `source` is 'cache' | 'live' | 'fallback' so
// callers can badge the data as demo/fallback when the live fetch failed.
export async function getEconomicCalendar() {
  const cached = readCache()
  if (cached) return { events: cached, source: 'cache' }
  try {
    const events = await fetchLiveCalendar()
    writeCache(events)
    return { events, source: 'live' }
  } catch {
    return { events: FALLBACK_EVENTS, source: 'fallback' }
  }
}

// Filters to events within the next `days` of today, nearest first.
export function upcomingEvents(events, days = 30) {
  const now     = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const horizon = new Date(today.getTime() + days * 86400000)
  return events
    .map((e) => ({ ...e, dateObj: new Date(`${e.date}T00:00:00`) }))
    .filter((e) => !isNaN(e.dateObj) && e.dateObj >= today && e.dateObj <= horizon)
    .sort((a, b) => a.dateObj - b.dateObj)
}

// The coming week's high-impact events for MaddenAI's per-turn context, with
// the consensus and previous print where this list holds a sourced one. Without
// it the model previews a release from memory — asked about the September CPI
// it named services as the pressure, when the bank previews it had never seen
// put fuel at the centre.
export function eventsForAI(days = 7) {
  const rows = upcomingEvents(FALLBACK_EVENTS, days).filter((e) => e.importance === 'high')
  if (!rows.length) return ''
  const lines = rows.map((e) => {
    const when = e.dateObj.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
    const parts = [`${when}${e.time && e.time !== '—' ? ` ${e.time}` : ''} Sydney — ${e.event}`]
    if (e.forecast) parts.push(`consensus: ${e.forecast}`)
    if (e.prev) parts.push(`previous: ${e.prev}`)
    if (e.description) parts.push(e.description)
    return `- ${parts.join('; ')}`
  })
  return `[SCHEDULED EVENTS — next ${days} days; consensus figures are forecasts, not results]\n${lines.join('\n')}`
}

// The curated schedule, synchronously — for the release watch, which must know
// release times without waiting on the calendar fetch.
export function scheduledEvents() {
  return FALLBACK_EVENTS
}

export function getPreviousEvents() {
  return FALLBACK_PREVIOUS
}

// The moment an event lands, as a real instant. Event times are Sydney local;
// an event with no time counts as lasting the whole day.
export function eventInstant(e, { endOfDayIfUntimed = false } = {}) {
  if (!e?.date) return null
  const hasTime = /^\d{1,2}:\d{2}$/.test(e.time ?? '')
  const hhmm = hasTime ? e.time.padStart(5, '0') : (endOfDayIfUntimed ? '23:59' : '00:00')
  const t = new Date(`${e.date}T${hhmm}:00${sydneyOffset(e.date)}`)
  return isNaN(t) ? null : t
}

// upcomingEvents() keeps everything dated today, including this morning's
// releases. This drops the ones that have already happened.
export function pendingEvents(events, days = 30, now = Date.now()) {
  return upcomingEvents(events, days).filter((e) => {
    const t = eventInstant(e, { endOfDayIfUntimed: true })
    return !t || t.getTime() > now
  })
}
