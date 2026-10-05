// ─── Economic calendar service ──────────────────────────────────────────────
// Tries FMP's economic-calendar endpoint first; on any failure (the free/demo
// FMP key does not reliably cover this endpoint) falls back to a rolling
// static list. Every date below is ISO, so "upcoming"/"past" is always
// computed from today rather than hand-maintained.

import { getRelativeDate, sydneyOffset } from '../utils/dateUtils'

const FMP_KEY   = import.meta.env.VITE_FMP_API_KEY || 'demo'
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
    description: 'Unemployment rose to 4.6% in August — a second rise would test the RBA\'s hiking bias.' },
  { date: '2026-10-15', time: '23:30', event: 'US PPI (Sep)',                        region: 'US', importance: 'medium' },
  { date: '2026-10-23', time: '11:30', event: 'AU National Accounts (2025-26)',      region: 'AU', importance: 'low' },
  { date: '2026-10-28', time: '11:30', event: 'AU CPI (Sep, incl. Sep quarter)',     region: 'AU', importance: 'high',
    description: 'The last inflation read before the 3 Nov RBA decision.' },
  { date: '2026-10-28', time: '12:00', event: 'RBNZ OCR Decision',                   region: 'NZ', importance: 'medium' },
  { date: '2026-10-29', time: '05:00', event: 'FOMC Rate Decision',                  region: 'US', importance: 'high',
    description: 'First meeting after the September hike to 3.75–4.00%.' },
  { date: '2026-10-30', time: '00:15', event: 'ECB Rate Decision',                   region: 'EU', importance: 'medium' },
  { date: '2026-10-30', time: '—',     event: 'Bank of Japan Rate Decision',         region: 'JP', importance: 'medium' },
  { date: '2026-10-30', time: '11:30', event: 'AU Producer Price Index (Sep)',       region: 'AU', importance: 'low' },
  { date: '2026-11-03', time: '14:30', event: 'RBA Rate Decision',                   region: 'AU', importance: 'high',
    description: 'Cash rate 4.60% after the 29 Sep hike, the fourth of 2026.' },
  { date: '2026-11-04', time: '—',     event: 'US Midterm Election Results',         region: 'US', importance: 'high',
    description: 'Polls close on 3 Nov US time; results arrive through the AU day.' },
  { date: '2026-11-05', time: '23:00', event: 'Bank of England Rate Decision',       region: 'UK', importance: 'medium' },
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
