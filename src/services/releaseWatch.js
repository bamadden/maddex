// ─── Data release watch ─────────────────────────────────────────────────────
//
// The moment a high-impact release lands (CPI, Labour Force, an RBA or FOMC
// decision), the terminal's verified figures are about to be out of date and
// nothing on screen knows it. This service notices:
//
//   1. Which scheduled releases have passed their Sydney release time and are
//      not yet reflected in verifiedConstants ("released, not absorbed").
//   2. Re-runs the official-stats check a couple of minutes after each one,
//      then every ten minutes for a few hours, until the agency's API shows
//      the new period.
//   3. Reports what the API now says beside what the terminal shows.
//
// It never writes a figure. verifiedConstants changes by hand, after a person
// has read the release — see verifiedConstants.js. A banner ends when the
// constants catch up (their release markers reach the event's date), when it
// is dismissed, or 72 hours after the release.

import VERIFIED_CONSTANTS from '../data/verifiedConstants'
import { scheduledEvents, eventInstant } from './calendarService'
import { runOfficialCheck, getOfficialCheck, subscribeOfficialCheck } from './officialStats'

const BANNER_MS = 72 * 3600_000
const FIRST_CHECK_MS = 2 * 60_000      // agency APIs lag the release page slightly
const RECHECK_MS = 10 * 60_000
const POLL_FOR_MS = 6 * 3600_000
const DISMISS_KEY = 'maddex_release_dismissed'

export const releaseKey = (e) => `${e.date}|${e.event}`

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Whether verifiedConstants already carries this release. Keyed off each
// group's own release marker, so updating the constants is what clears it.
function absorbed(e) {
  const C = VERIFIED_CONSTANTS
  const w = e.watch ?? []
  if (w.includes('cpi')) return (C.au?.cpiLastRelease ?? '') >= e.date
  if (w.includes('unemployment')) return (C.au?.unemploymentLastRelease ?? '') >= e.date
  if (w.includes('cashRate')) return (C.rba?.lastDecision ?? '') >= e.date
  // FOMC dates here are Sydney dates; the constants record the US date.
  if (w.includes('fedUpper')) return (C.fed?.lastDecision ?? '') >= addDays(e.date, -1)
  return false
}

function readDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '{}') ?? {} } catch { return {} }
}

export function dismissRelease(key) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ ...readDismissed(), [key]: Date.now() })) } catch { /* best-effort */ }
  notify()
}

// What the agency's API now says that the terminal does not, for one event.
// A new PERIOD counts as new data even when the value is unchanged — a
// September CPI that repeats August's 4.0% is still a release to absorb.
export function newDataFor(e, check = getOfficialCheck()) {
  const live = check?.live
  if (!live) return []
  const C = VERIFIED_CONSTANTS
  const w = e.watch ?? []
  const out = []
  const push = (label, off, terminal, terminalPeriod) => {
    if (off?.value == null) return
    if (off.period === terminalPeriod && Math.abs(off.value - terminal) < 0.05) return
    out.push({ label, official: off.value, officialPeriod: off.period, terminal, terminalPeriod })
  }
  if (w.includes('cpi')) {
    push('AU CPI (annual)', live.cpi?.cpi, C.au.cpi, C.au.cpiPeriod)
    push('Trimmed mean (annual)', live.cpi?.trimmedMean, C.au.cpiTrimmedMean, C.au.cpiPeriod)
    if (C.au.cpiQuarterQoQ != null) push('Headline CPI (q/q)', live.cpi?.quarterlyQoQ, C.au.cpiQuarterQoQ, C.au.cpiQuarterPeriod)
  }
  if (w.includes('unemployment')) push('Unemployment', live.lf, C.au.unemployment, C.au.unemploymentPeriod)
  if (w.includes('cashRate') && live.rba?.value != null && Math.abs(live.rba.value - C.rba.cashRate) >= 0.005) {
    out.push({ label: 'RBA cash rate', official: live.rba.value, officialPeriod: live.rba.period, terminal: C.rba.cashRate, terminalPeriod: C.rba.lastDecision })
  }
  if (w.includes('fedUpper') && live.us?.fedUpper?.value != null && Math.abs(live.us.fedUpper.value - C.fed.cashRate) >= 0.005) {
    out.push({ label: 'Fed funds (upper)', official: live.us.fedUpper.value, officialPeriod: live.us.fedUpper.period, terminal: C.fed.cashRate, terminalPeriod: C.fed.lastDecision })
  }
  return out
}

// Released, not yet absorbed, not dismissed, inside the banner window.
export function releasedEvents(now = Date.now()) {
  const dismissed = readDismissed()
  return scheduledEvents()
    .filter((e) => e.importance === 'high' && e.sourceUrl && /^\d{1,2}:\d{2}$/.test(e.time ?? ''))
    .map((e) => ({ ...e, key: releaseKey(e), at: eventInstant(e) }))
    .filter((e) => e.at && e.at.getTime() <= now && now - e.at.getTime() < BANNER_MS)
    .map((e) => ({ ...e, polling: now - e.at.getTime() < POLL_FOR_MS }))
    .filter((e) => !absorbed(e) && !dismissed[e.key])
    .sort((a, b) => b.at - a.at)
}

// ── Scheduler ────────────────────────────────────────────────────────────────

const listeners = new Set()
function notify() { listeners.forEach((cb) => cb()) }
export function subscribeReleaseWatch(cb) { listeners.add(cb); return () => listeners.delete(cb) }

let timer = null
let lastForced = 0

function tick() {
  const now = Date.now()
  const pending = releasedEvents(now).filter((e) => {
    const since = now - e.at.getTime()
    return since >= FIRST_CHECK_MS && since < POLL_FOR_MS && newDataFor(e).length === 0
  })
  if (!pending.length) return
  // A check older than the newest release cannot know about it.
  const fetchedAt = getOfficialCheck()?.fetchedAt ?? 0
  const newest = Math.max(...pending.map((e) => e.at.getTime()))
  const stale = fetchedAt < newest + FIRST_CHECK_MS
  if ((stale || now - fetchedAt >= RECHECK_MS) && now - lastForced >= RECHECK_MS) {
    lastForced = now
    console.log('[MADDEN RELEASE] Checking agencies for', pending.map((e) => e.event).join(', '))
    runOfficialCheck({ force: true }).catch(() => { /* next tick retries */ })
  }
}

// Started once from App. Idempotent.
export function startReleaseWatch() {
  if (timer) return
  subscribeOfficialCheck(notify)
  tick()
  timer = setInterval(() => { tick(); notify() }, 60_000)
}
