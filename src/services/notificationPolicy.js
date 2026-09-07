// What a notification is allowed to do.
//
// THE PROBLEM THIS SOLVES
//
// Every notification in this app currently behaves the same way: it lands in
// the bell, and anything that calls a sound plays one. That is fine at three
// notifications a day and hostile at thirty. The failure mode is not that a
// user is annoyed once — it is that they turn notifications off entirely, and
// then the price alert they actually set never reaches them.
//
// So each type declares a PRIORITY, and the priority decides the treatment.
// Nothing here suppresses a notification; it only decides whether it may
// interrupt.

export const PRIORITY = {
  CRITICAL: 'CRITICAL',   // interrupts: toast + sound
  HIGH: 'HIGH',           // toast, silent
  MEDIUM: 'MEDIUM',       // bell only
  LOW: 'LOW',             // bell only, batched
}

// Type -> priority. Unknown types default to MEDIUM: a new notification should
// have to earn the right to interrupt, not inherit it.
const TYPE_PRIORITY = {
  // The two the user set themselves. Everything else in this map is something
  // the app decided to say; these two are something the user asked for, which
  // is why they are the only ones allowed to make a noise.
  PRICE_ALERT: PRIORITY.CRITICAL,
  CUSTOM_ALERT: PRIORITY.CRITICAL,

  MARKET_CRASH: PRIORITY.CRITICAL,

  // A story naming a stock the user tracks. HIGH, not CRITICAL: it toasts,
  // silently. CRITICAL is for the two things the user configured themselves —
  // a price alert they set is a request to be interrupted; a headline the wire
  // happened to publish is not, however relevant, and a feed that makes a
  // noise every time a bank is mentioned is a feed that gets turned off.
  //
  // This type was declared CRITICAL here with no producer anywhere in the app.
  // The News module's watchlist mentions were raised as NEWS, which is LOW —
  // bell only — so the toast this type existed for had never fired.
  BREAKING_WATCHLIST: PRIORITY.HIGH,

  MORNING_BRIEF: PRIORITY.HIGH,
  EARNINGS_WATCHLIST: PRIORITY.HIGH,
  RBA_DECISION: PRIORITY.HIGH,
  MARKET_OPEN: PRIORITY.HIGH,
  CALENDAR: PRIORITY.HIGH,
  // Once a day, at a time the user knows, summarising a day they were part of.
  // A single expected toast is not the noise problem.
  DAILY_DIGEST: PRIORITY.HIGH,

  WATCHLIST_MOVE: PRIORITY.MEDIUM,
  UNUSUAL_ACTIVITY: PRIORITY.MEDIUM,
  SCANNER_WATCHLIST: PRIORITY.MEDIUM,
  WEEKLY_SUMMARY: PRIORITY.MEDIUM,

  MARKET_UPDATE: PRIORITY.LOW,
  SCANNER_SIGNAL: PRIORITY.LOW,
  NEWS: PRIORITY.LOW,
  SYSTEM: PRIORITY.LOW,
}

const CHIMES = new Set(['MARKET_OPEN'])

export const priorityOf = (type) => TYPE_PRIORITY[type] ?? PRIORITY.MEDIUM

// ─── Quiet hours ─────────────────────────────────────────────────────────────

const QUIET_KEY = 'maddex_quiet_hours'
const DEFAULT_QUIET = { enabled: true, from: 22, to: 7 }   // 10pm–7am
const AU_TZ = 'Australia/Brisbane'

export function getQuietHours() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUIET_KEY) ?? 'null')
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_QUIET, ...parsed } : DEFAULT_QUIET
  } catch { return DEFAULT_QUIET }
}

export function setQuietHours(next) {
  const merged = { ...getQuietHours(), ...next }
  try { localStorage.setItem(QUIET_KEY, JSON.stringify(merged)) } catch { /* quota */ }
  return merged
}

// Australian hour, not the browser's.
//
// A user in Singapore watching the ASX should get Sydney's quiet hours, not
// their own — the notifications are about an Australian market, and silencing
// them on a foreign clock would mute the market open.
function auParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: AU_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const hour = get('hour')
  return { hour, minutes: hour * 60 + get('minute') }
}

function auHour(now = new Date()) {
  return auParts(now).hour
}

export function inQuietHours(now = new Date()) {
  const q = getQuietHours()
  if (!q.enabled) return false
  const h = auHour(now)
  // Wraps midnight, so the comparison is an OR rather than a range.
  return q.from > q.to ? (h >= q.from || h < q.to) : (h >= q.from && h < q.to)
}

// ─── The decision ────────────────────────────────────────────────────────────
//
// Returns what this notification may do right now. CRITICAL still toasts in
// quiet hours but loses its sound: a triggered price alert is the thing the
// user explicitly asked to be told about, and swallowing it entirely would
// break the one feature they configured themselves.
export function treatmentFor(type, now = new Date()) {
  const priority = priorityOf(type)
  const quiet = inQuietHours(now)

  if (priority === PRIORITY.CRITICAL) {
    return { priority, toast: true, sound: !quiet, quiet }
  }
  // One HIGH exemption. The market-open chime fires once a day at 10:00 AEST
  // on a schedule the user cannot be surprised by, so it is not the repeated
  // interruption this file exists to stop — and silencing it would be a
  // regression dressed up as a policy.
  if (priority === PRIORITY.HIGH) {
    return { priority, toast: !quiet, sound: CHIMES.has(type) && !quiet, quiet }
  }
  return { priority, toast: false, sound: false, quiet }
}

// ─── History ─────────────────────────────────────────────────────────────────
//
// The store keeps the last 20 for the bell. This keeps seven days for the
// history view, separately, so raising one limit does not silently change the
// other's behaviour.
const HISTORY_KEY = 'maddex_notification_history'
const KEEP_DAYS = 7

export function recordHistory(notification) {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    const cutoff = Date.now() - KEEP_DAYS * 86400000
    const next = [notification, ...(Array.isArray(list) ? list : [])]
      .filter((n) => new Date(n.createdAt ?? 0).getTime() >= cutoff)
      .slice(0, 300)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    return next
  } catch { return [] }
}

export function getHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    const cutoff = Date.now() - KEEP_DAYS * 86400000
    return (Array.isArray(list) ? list : []).filter((n) => new Date(n.createdAt ?? 0).getTime() >= cutoff)
  } catch { return [] }
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY) } catch { /* best effort */ }
}

// Removes specific entries — one dismissed notification, or every entry in a
// day group. Takes ids rather than a predicate so the caller decides what a
// "day" means and this file does not have to agree twice.
export function removeHistory(ids) {
  const drop = new Set(Array.isArray(ids) ? ids : [ids])
  const next = getHistory().filter((n) => !drop.has(n.id))
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch { /* quota */ }
  return next
}

// Groups history into TODAY / YESTERDAY / EARLIER, which is how someone
// actually looks for a notification they half-remember.
export function groupHistoryByDay(list, now = new Date()) {
  const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: AU_TZ }).format(d)
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 86400000))

  const groups = { TODAY: [], YESTERDAY: [], EARLIER: [] }
  for (const n of list) {
    const k = dayKey(new Date(n.createdAt ?? Date.now()))
    if (k === today) groups.TODAY.push(n)
    else if (k === yesterday) groups.YESTERDAY.push(n)
    else groups.EARLIER.push(n)
  }
  return groups
}

// ─── Daily digest ────────────────────────────────────────────────────────────

const DIGEST_KEY = 'maddex_last_digest'
const auDayKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: AU_TZ }).format(d)

// True once per Australian market day, after the 4pm close plus half an hour
// for the closing auction to settle, and only on a weekday.
//
// Checked on app load and then on the same 60s tick as everything else, rather
// than scheduled — a browser tab is not a cron. Someone who opens the app at
// 9pm still gets the day's digest; someone who leaves it open through 4:30pm
// gets it as it passes.
const DIGEST_AFTER_MIN = 16 * 60 + 30

export function shouldSendDigest(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-AU', { timeZone: AU_TZ, weekday: 'short' }).format(now)
  if (weekday === 'Sat' || weekday === 'Sun') return false
  if (auParts(now).minutes < DIGEST_AFTER_MIN) return false
  try { return localStorage.getItem(DIGEST_KEY) !== auDayKey(now) } catch { return false }
}

export function markDigestSent(now = new Date()) {
  try { localStorage.setItem(DIGEST_KEY, auDayKey(now)) } catch { /* quota */ }
}

// ─── Digest composition ──────────────────────────────────────────────────────
//
// Built ENTIRELY from what already happened. Every clause below is a count of
// notifications this app actually raised today, or a close figure passed in by
// the caller from a live quote. Nothing here is generated, and if the day was
// quiet the digest says so rather than padding itself out.
const DIGEST_LABEL = {
  PRICE_ALERT: ['price alert', 'price alerts'],
  CUSTOM_ALERT: ['alert', 'alerts'],
  WATCHLIST_MOVE: ['watchlist move', 'watchlist moves'],
  NEWS: ['news story', 'news stories'],
  CALENDAR: ['earnings reminder', 'earnings reminders'],
  MARKET_OPEN: ['market open', 'market opens'],
}

// The digest is about the day's events, so its own arrival is not one of them,
// and neither is a SYSTEM message about the app itself.
const DIGEST_EXCLUDE = new Set(['DAILY_DIGEST', 'SYSTEM'])

export function buildDigest({ history = getHistory(), close = null, now = new Date() } = {}) {
  const today = groupHistoryByDay(history, now).TODAY.filter((n) => !DIGEST_EXCLUDE.has(n.type))

  const counts = {}
  for (const n of today) counts[n.type] = (counts[n.type] ?? 0) + 1

  const clauses = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => {
      const [one, many] = DIGEST_LABEL[type] ?? [type.toLowerCase().replace(/_/g, ' '), `${type.toLowerCase().replace(/_/g, ' ')}s`]
      return `${n} ${n === 1 ? one : many}`
    })

  const head = close?.pct != null
    ? `ASX 200 closed ${close.pct >= 0 ? 'up' : 'down'} ${Math.abs(close.pct).toFixed(2)}%`
    : 'Market close'

  const body = clauses.length
    ? `${clauses.join(', ')} today`
    : 'nothing on your watchlist or alerts fired today'

  return { message: `${head} — ${body}`, count: today.length }
}
