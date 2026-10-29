// SMART NOTIFICATIONS — alerts the terminal raises on its own, from market
// conditions, checked every 15 minutes (NotificationCenter).
//
// Each trigger fires at most once for the thing it is about (an RBA meeting
// per day, a release, a ticker per day, a week), remembered in localStorage.
// All of them together are capped per day by plan — services/plans
// smartAlertsPerDay: Core 3, Prime 10, Apex unlimited — and each respects the
// user's notification settings (rba / market / news alerts). Alerts the user
// configured themselves (price alerts) are never counted against the cap.
// Quiet hours are applied downstream by notificationPolicy: they silence,
// they do not suppress.
//
// Wording rule: every figure in a message is a verified figure with its
// source, a count the app made itself, or a demo price labelled DEMO.

import VERIFIED_CONSTANTS from '../data/verifiedConstants'
import { getCurrentTier, limitFor } from './plans'
import { sydneyOffset } from '../utils/dateUtils'
import { useAuthStore } from '../store/useAuthStore'
import { getMockFMPHistory } from './mockData'
import { USING_MOCK_DATA } from './api'
import { rateImpact } from '../modules/portfolio/rateSensitivity'
import { SCANNER_BADGE_KEY, SCANNER_BADGE_EVENT } from './scannerBadge'

const SENT_KEY = 'maddex_smart_sent_v1'
const DAY_KEY = 'maddex_smart_day_v1'

const sydDay = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const sydParts = (now = new Date()) => {
  const d = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
  return { dow: d.getDay(), hour: d.getHours() + d.getMinutes() / 60 }
}
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* quota */ } }

function prefs() {
  const s = useAuthStore.getState?.().settings ?? {}
  return {
    rba: s.rba_alerts_enabled ?? true,
    market: s.market_alerts_enabled ?? true,
    news: s.news_alerts_enabled ?? true,
  }
}

// One slot from today's budget for `id`, or false: already sent, or the
// day's cap is used.
export function takeSmartSlot(id, now = new Date()) {
  const sent = read(SENT_KEY, [])
  if (sent.includes(id)) return false
  const day = sydDay(now)
  const counter = read(DAY_KEY, { day, n: 0 })
  const n = counter.day === day ? counter.n : 0
  if (n >= limitFor('smartAlertsPerDay', getCurrentTier())) return false
  write(SENT_KEY, [...sent, id].slice(-300))
  write(DAY_KEY, { day, n: n + 1 })
  return true
}

// Mean absolute daily % move over the last 20 sessions, from the bars the
// charts draw. Null without enough history.
export function typicalDailyMove(symbol) {
  const closes = getMockFMPHistory(symbol, 22).map((b) => b.close).filter((v) => v > 0)
  if (closes.length < 10) return null
  const moves = closes.slice(1, -1).map((c, i) => Math.abs((c / closes[i] - 1) * 100))
  return moves.reduce((s, v) => s + v, 0) / moves.length
}

const bare = (s) => String(s).toUpperCase().replace(/\.AX$/, '')
const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

// ── Triggers ────────────────────────────────────────────────────────────────

function rbaProximity(now, events) {
  const nd = VERIFIED_CONSTANTS.rbaNextDecision
  if (!nd) return null
  const at = Date.parse(`${nd.date}T${nd.time}:00${sydneyOffset(nd.date)}`)
  const hours = (at - now.getTime()) / 3_600_000
  if (!(hours > 0 && hours < 72)) return null
  const before = events
    .filter((e) => e.region === 'AU' && String(e.importance).toLowerCase() === 'high' && !/RBA/.test(e.event))
    .find((e) => { const t = Date.parse(`${e.date}T${/^\d/.test(e.time ?? '') ? e.time : '23:59'}:00${sydneyOffset(e.date)}`); return t > now.getTime() && t < at })
  return {
    id: `rba-prox:${nd.date}:${sydDay(now)}`,
    type: 'RBA_DECISION',
    pref: 'rba',
    message: `🏦 RBA decision in ${Math.round(hours)} hours (${day(nd.date)}, ${nd.time}). Key data before it: ${before ? `${before.event}, ${day(before.date)}` : 'no major AU release scheduled'}. Pricing: ~${nd.marketHikePct}% for a hike to ${nd.hikeRate.toFixed(2)}% (${nd.marketSource}, ${day(nd.marketAsOf)}).`,
    module: 'fx',
  }
}

function releaseDay(now, events) {
  const today = sydDay(now)
  const { hour } = sydParts(now)
  if (hour < 6) return []
  return events
    .filter((e) => e.date === today && String(e.importance).toLowerCase() === 'high' && /^\d/.test(e.time ?? ''))
    .filter((e) => Date.parse(`${e.date}T${e.time}:00${sydneyOffset(e.date)}`) > now.getTime())
    .map((e) => ({
      id: `release:${e.date}:${e.event}`,
      type: 'CALENDAR',
      pref: 'market',
      message: `⏰ ${e.event} at ${e.time} today.${e.forecast ? ` Consensus: ${e.forecast}.` : ''}${e.prev ? ` Previous: ${e.prev}.` : ''}`,
      module: 'calendar',
    }))
}

function newsSurge(now, articles, watchlist, annotate) {
  if (!articles?.length || !watchlist.length) return []
  const since = now.getTime() - 24 * 3_600_000
  const counts = new Map()
  for (const a of annotate(articles, watchlist)) {
    if ((a.pubDate ?? 0) < since) continue
    for (const c of a.companies ?? []) {
      const k = bare(c.ticker)
      if (watchlist.some((w) => bare(w) === k)) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 3).map(([t, n]) => ({
    id: `news:${t}:${sydDay(now)}`,
    type: 'BREAKING_WATCHLIST',
    pref: 'news',
    message: `📰 ${t} is trending in financial news today — ${n} articles in the last 24 hours mention it.`,
    module: 'news',
  }))
}

function weeklySummary(now, watchlist) {
  const { dow, hour } = sydParts(now)
  if (dow !== 5 || hour < 16.5 || !watchlist.length) return null
  const rows = watchlist.map((s) => {
    const bars = getMockFMPHistory(s, 6)
    if (bars.length < 6) return null
    return { s: bare(s), pct: (bars.at(-1).close / bars[0].close - 1) * 100 }
  }).filter(Boolean).sort((a, b) => b.pct - a.pct)
  if (rows.length < 2) return null
  const f = (r) => `${r.s} ${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%`
  return {
    id: `weekly:${sydDay(now)}`,
    type: 'WEEKLY_SUMMARY',
    pref: 'market',
    message: `📊 Week in review — your watchlist: best ${f(rows[0])}, worst ${f(rows.at(-1))}${USING_MOCK_DATA ? ' (DEMO prices)' : ''}.`,
    module: 'watchlist',
  }
}

// Scanner signals on watchlist stocks. Also keeps the Scanner nav badge.
function scannerSignals(now, watchlist, scanner) {
  if (!watchlist.length) return []
  const wl = new Set(watchlist.map(bare))
  const hits = [
    ...scanner.scanVolume().map((r) => ({ r, kind: 'VOLUME SPIKE', detail: `${r.volumeRatio.toFixed(1)}× average volume` })),
    ...scanner.scanBreakouts().map((r) => ({ r, kind: 'BREAKOUT', detail: r.descriptor ?? 'new 20-session high' })),
    ...scanner.scanGaps().map((r) => ({ r, kind: `GAP ${r.direction}`, detail: `opened ${r.gapPct >= 0 ? '+' : ''}${r.gapPct.toFixed(1)}% from the previous close` })),
  ].filter(({ r }) => wl.has(bare(r.symbol)))
  const today = sydDay(now)
  const badge = read(SCANNER_BADGE_KEY, { day: today, count: 0, seen: 0 })
  const next = { day: today, count: hits.length, seen: badge.day === today ? badge.seen : 0 }
  write(SCANNER_BADGE_KEY, next)
  try { window.dispatchEvent(new Event(SCANNER_BADGE_EVENT)) } catch { /* non-browser */ }
  return hits.map(({ r, kind, detail }) => ({
    id: `scan:${bare(r.symbol)}:${kind}:${today}`,
    type: 'SCANNER_WATCHLIST',
    pref: 'market',
    message: `⚡ ${r.symbol} — ${kind}: ${detail}${USING_MOCK_DATA ? ' (DEMO data)' : ''}.`,
    module: 'scanner',
  }))
}

// After an RBA decision lands in the constants: what it means for the
// holdings, by sector. Fires once per decision, within three days of it.
export function rbaPortfolioImpact(holdings = []) {
  const rba = VERIFIED_CONSTANTS.rba
  const rows = []
  const seen = new Set()
  for (const h of holdings) {
    const k = `${h.type}:${h.symbol}`
    if (seen.has(k) || h.type === 'crypto') continue
    seen.add(k)
    const { impact, why } = rateImpact(h)
    if (impact && impact !== 'NEUTRAL') rows.push({ symbol: h.type === 'asx' ? `${h.symbol}.AX` : h.symbol, impact, why })
  }
  return { decision: rba.lastDecisionVerb, date: rba.lastDecision, rate: rba.cashRate, change: rba.lastChange, rows }
}

function rbaDecision(now, holdings) {
  const rba = VERIFIED_CONSTANTS.rba
  const age = (now.getTime() - Date.parse(`${rba.lastDecision}T14:30:00${sydneyOffset(rba.lastDecision)}`)) / 86_400_000
  if (!(age >= 0 && age <= 3) || !holdings.length) return null
  const imp = rbaPortfolioImpact(holdings)
  const verb = imp.decision === 'HIKE' ? `hiked ${imp.change ?? ''} to` : imp.decision === 'CUT' ? `cut ${imp.change ?? ''} to` : 'held at'
  const lines = imp.rows.slice(0, 4).map((r) => `${r.symbol} ${r.impact === 'POSITIVE' ? '+' : '−'}${r.impact === 'POSITIVE' ? 'NIM benefit' : 'rate pressure'}`)
  return {
    id: `rba-decision:${rba.lastDecision}`,
    type: 'RBA_DECISION',
    pref: 'rba',
    message: `🏦 RBA ${verb} ${imp.rate.toFixed(2)}%. Your portfolio: ${lines.length ? lines.join('; ') : 'no strongly rate-sensitive holdings'} — see Portfolio for the full read.`,
    module: 'portfolio',
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────

export async function runSmartChecks({ watchlist = [], holdings = [], notify, now = new Date() }) {
  const p = prefs()
  const [{ getEconomicCalendar }, { fetchNews }, intel, scanner] = await Promise.all([
    import('./calendarService'), import('./api'), import('./newsIntelligence'), import('./scannerService'),
  ])
  let events = []
  try { events = (await getEconomicCalendar()).events ?? [] } catch { /* calendar optional */ }
  let articles = []
  if (p.news) { try { articles = (await fetchNews())?.articles ?? [] } catch { /* news optional */ } }

  const candidates = [
    rbaDecision(now, holdings),
    rbaProximity(now, events),
    ...releaseDay(now, events),
    ...newsSurge(now, articles, watchlist, intel.annotateArticles),
    weeklySummary(now, watchlist),
    ...scannerSignals(now, watchlist, scanner),
  ].filter(Boolean)

  for (const c of candidates) {
    if (!p[c.pref]) continue
    if (!takeSmartSlot(c.id, now)) continue
    notify(c.type, c.message, { browser: { title: c.message.split(/[.—]/)[0], body: c.message, tag: c.id, module: c.module } })
  }
}
