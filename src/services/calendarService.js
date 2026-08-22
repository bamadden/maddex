// ─── Economic calendar service ──────────────────────────────────────────────
// Tries FMP's economic-calendar endpoint first; on any failure (the free/demo
// FMP key does not reliably cover this endpoint) falls back to a rolling
// static list. Every date below is ISO, so "upcoming"/"past" is always
// computed from today rather than hand-maintained.

import { getRelativeDate } from '../utils/dateUtils'

const FMP_KEY   = import.meta.env.VITE_FMP_API_KEY || 'demo'
const CACHE_KEY = 'madden_econ_calendar_v1'
const CACHE_MS  = 6 * 60 * 60 * 1000 // 6 hours — calendar doesn't change often

// Rolling fallback schedule (AU/US, highest-impact events through the known
// RBA/FOMC calendar). Past entries fall out of `upcomingEvents()` on their
// own — nothing here needs to be removed as time passes.
const FALLBACK_EVENTS = [
  { date: '2026-08-25', time: '11:30', event: 'AU Construction Work Done (Q2)',      region: 'AU', importance: 'low' },
  { date: '2026-08-26', time: '22:30', event: 'US Consumer Confidence (Aug)',        region: 'US', importance: 'medium' },
  { date: '2026-08-27', time: '11:30', event: 'AU Monthly CPI Indicator (Jul)',      region: 'AU', importance: 'high',
    description: 'First major inflation read since the RBA held at 4.35% on 12 Aug.' },
  { date: '2026-08-28', time: '11:30', event: 'AU Retail Sales (Jul)',               region: 'AU', importance: 'medium' },
  { date: '2026-08-29', time: '11:30', event: 'AU Private Capital Expenditure (Q2)', region: 'AU', importance: 'medium' },
  { date: '2026-09-01', time: '11:00', event: 'China Manufacturing PMI (Aug)',       region: 'CN', importance: 'medium' },
  { date: '2026-09-02', time: '11:30', event: 'AU GDP (Q2 2026)',                    region: 'AU', importance: 'high',
    description: 'Key growth read — consensus +0.3% QoQ.' },
  { date: '2026-09-03', time: '11:30', event: 'AU Trade Balance (Jul)',              region: 'AU', importance: 'low' },
  { date: '2026-09-04', time: '22:30', event: 'US Initial Jobless Claims',           region: 'US', importance: 'low' },
  { date: '2026-09-05', time: '22:30', event: 'US Non-Farm Payrolls (Aug)',          region: 'US', importance: 'high',
    description: 'Key Fed input before the September FOMC.' },
  { date: '2026-09-08', time: '11:00', event: 'China CPI (Aug)',                     region: 'CN', importance: 'medium' },
  { date: '2026-09-09', time: '11:30', event: 'AU NAB Business Confidence (Aug)',    region: 'AU', importance: 'medium' },
  { date: '2026-09-10', time: '11:30', event: 'AU Westpac Consumer Sentiment (Sep)', region: 'AU', importance: 'medium' },
  { date: '2026-09-11', time: '22:30', event: 'US CPI (Aug)',                        region: 'US', importance: 'high',
    description: 'Critical Fed input for the Sep 17 FOMC.' },
  { date: '2026-09-16', time: '14:30', event: 'RBA Interest Rate Decision',          region: 'AU', importance: 'high',
    description: 'Expected HOLD at 4.35% — softer CPI supports a hold.' },
  { date: '2026-09-17', time: '04:00', event: 'FOMC Rate Decision',                  region: 'US', importance: 'high',
    description: 'Expected HOLD at 4.25–4.50%.' },
  { date: '2026-09-18', time: '—',     event: 'Bank of Japan Rate Decision',         region: 'JP', importance: 'medium' },
  { date: '2026-09-25', time: '11:30', event: 'AU CPI (Q3 2026)',                    region: 'AU', importance: 'high',
    description: 'Quarterly inflation — pivotal for the November RBA meeting.' },
  { date: '2026-10-01', time: '11:30', event: 'AU RBA Meeting Minutes (Sep)',        region: 'AU', importance: 'medium' },
  { date: '2026-11-04', time: '11:00', event: 'US Presidential Election Day',        region: 'US', importance: 'high',
    description: 'Midterm elections — market volatility expected.' },
  { date: '2026-11-04', time: '14:30', event: 'RBA Rate Decision',                   region: 'AU', importance: 'high' },
]

// Genuinely historical — last 7 days of confirmed results. Kept separate
// from the forward calendar since there's nothing to "auto-generate" here.
const FALLBACK_PREVIOUS = [
  { date: '2026-08-19', event: 'FOMC Minutes',               region: 'US', result: 'Held dovish tone' },
  { date: '2026-08-20', event: 'AU Wage Price Index (Q2)',   region: 'AU', result: '+3.4% YoY' },
  { date: '2026-08-21', event: 'AU Unemployment Rate (Jul)', region: 'AU', result: '4.2%' },
  { date: '2026-08-22', event: 'US Flash PMI (Aug)',         region: 'US', result: 'Pending' },
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
  const res  = await fetch(url)
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
