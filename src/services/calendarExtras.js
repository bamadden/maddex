// Calendar scoring, reminders and export.
//
// WHAT IS NOT HERE, AND WHY
//
// The design for this asked for an "event impact history" — a bar chart of the
// last six actual-vs-consensus readings per recurring event, with a line like
// "beat consensus 4 of last 6 times". There is no source for it. The FMP
// economic calendar this app reads supplies `estimate` and `previous` for
// UPCOMING events and no `actual` at all, and nothing else in the app records
// releases as they land.
//
// A track record is exactly the kind of figure someone leans on — "this print
// usually beats" is a position, not a decoration — so it is not generated from
// the synthetic series in economicForecastService and not invented here. The
// UI shows what the feed actually carries and says plainly when a release
// result is not connected.

const REMINDER_KEY = 'maddex_event_reminders'

// ─── Importance, 1-5 ─────────────────────────────────────────────────────────
//
// The feed's own `importance` is a coarse high/medium/low, which puts an RBA
// rate decision and a building-approvals print in the same bucket. These rules
// refine it by what the event IS — deterministic, name-based, and inspectable,
// so a reader can see why something scored 5.
//
// Ordered most-specific first; the first match wins.
const STAR_RULES = [
  { stars: 5, re: /\b(RBA (interest )?rate decision|cash rate decision|FOMC (rate )?decision|federal funds|non[- ]farm payrolls|NFP|\bCPI\b|consumer price index|\bGDP\b|gross domestic product)\b/i },
  { stars: 4, re: /\b(unemployment|employment change|labour force|retail sales|trade balance|FOMC minutes|RBA (meeting )?minutes|wage price|PCE)\b/i },
  { stars: 3, re: /\b(business confidence|consumer sentiment|consumer confidence|building approvals|PMI|capital expenditure|housing|private credit)\b/i },
  { stars: 2, re: /\b(inventories|current account|industrial production|factory orders|jobless claims)\b/i },
]

// Falls back to the feed's own importance so an event this list has never seen
// still lands somewhere sensible rather than at the bottom.
const FALLBACK_STARS = { high: 4, medium: 3, low: 1 }

export function eventStars(event) {
  const name = `${event?.event ?? ''} ${event?.title ?? ''}`
  for (const rule of STAR_RULES) {
    if (rule.re.test(name)) return rule.stars
  }
  return FALLBACK_STARS[String(event?.importance ?? '').toLowerCase()] ?? 1
}

export const starString = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))

// ─── Earnings season ─────────────────────────────────────────────────────────
//
// "Earnings season" is a real, checkable condition: an unusual concentration of
// results in a short window. Counted from the events actually present rather
// than from a hardcoded calendar of ASX reporting periods, so it cannot claim a
// season that this app has no events for.
export function earningsSeason(events = [], { now = Date.now(), windowDays = 14, threshold = 5 } = {}) {
  const end = now + windowDays * 86400000
  const inWindow = events.filter((e) => {
    if (e.type !== 'earnings') return false
    const t = new Date(`${e.date}T00:00:00`).getTime()
    return Number.isFinite(t) && t >= now && t <= end
  })

  const weekEnd = now + 7 * 86400000
  const thisWeek = inWindow.filter((e) => new Date(`${e.date}T00:00:00`).getTime() <= weekEnd)

  return {
    active: inWindow.length >= threshold,
    total: inWindow.length,
    thisWeek: thisWeek.length,
    windowDays,
  }
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export const REMINDER_OFFSETS = [
  { key: 'day', label: '1 day before', minutes: 24 * 60 },
  { key: 'morning', label: 'Morning of', minutes: null },   // resolved to 8am local on the day
  { key: 'hour', label: '1 hour before', minutes: 60 },
  { key: 'release', label: 'At release', minutes: 0 },
]

function readReminders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function writeReminders(list) {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(list)) } catch { /* quota */ }
  return list
}

// The instant an event actually occurs. A bare 'YYYY-MM-DD' parses as UTC
// midnight, which in Sydney is 10am the same day — an 11:30 release would fire
// its reminder ninety minutes late and a 22:30 US print half a day early. The
// time field is used whenever it is present and parseable.
export function eventInstant(event) {
  if (!event?.date) return null
  const hasTime = /^\d{1,2}:\d{2}$/.test(event.time ?? '')
  const d = new Date(`${event.date}T${hasTime ? event.time : '09:00'}:00`)
  return isNaN(d) ? null : d
}

export function reminderFireTime(event, offsetKey) {
  const at = eventInstant(event)
  if (!at) return null
  const offset = REMINDER_OFFSETS.find((o) => o.key === offsetKey)
  if (!offset) return null
  if (offset.key === 'morning') {
    const m = new Date(at)
    m.setHours(8, 0, 0, 0)
    return m
  }
  return new Date(at.getTime() - offset.minutes * 60000)
}

export const reminderId = (event, offsetKey) => `${event.date}|${event.event ?? event.title}|${offsetKey}`

export function getReminders() {
  return readReminders()
}

export function addReminder(event, offsetKey) {
  const fireAt = reminderFireTime(event, offsetKey)
  if (!fireAt) return null
  const id = reminderId(event, offsetKey)
  const list = readReminders()
  if (list.some((r) => r.id === id)) return list
  return writeReminders([
    ...list,
    {
      id,
      offsetKey,
      fireAt: fireAt.toISOString(),
      eventDate: event.date,
      eventTime: event.time ?? null,
      title: event.event ?? event.title,
      region: event.region ?? null,
      dismissed: false,
    },
  ])
}

export function removeReminder(id) {
  return writeReminders(readReminders().filter((r) => r.id !== id))
}

export function dismissReminder(id) {
  return writeReminders(readReminders().map((r) => (r.id === id ? { ...r, dismissed: true } : r)))
}

export function hasReminder(event, offsetKey) {
  return readReminders().some((r) => r.id === reminderId(event, offsetKey))
}

export function remindersForEvent(event) {
  const prefix = `${event.date}|${event.event ?? event.title}|`
  return readReminders().filter((r) => r.id.startsWith(prefix))
}

// Reminders that are due and not yet dismissed.
//
// Anything whose event has already passed is dropped rather than shown: a
// reminder for a print that landed last Tuesday is noise, and clearing it here
// keeps the store from growing without bound.
export function pendingReminders(now = Date.now()) {
  const list = readReminders()
  const live = list.filter((r) => new Date(`${r.eventDate}T23:59:59`).getTime() >= now)
  if (live.length !== list.length) writeReminders(live)
  return live.filter((r) => !r.dismissed && new Date(r.fireAt).getTime() <= now)
}

// ─── iCalendar export ────────────────────────────────────────────────────────
//
// RFC 5545. Three details that break calendars when skipped, all of which this
// handles: CRLF line endings (a bare \n makes Apple Calendar reject the file),
// escaping of commas, semicolons and backslashes in text fields, and folding
// of lines past 75 octets.
const icsEscape = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

// Folds at 74 characters with a leading space on continuations, per the spec.
function fold(line) {
  if (line.length <= 74) return line
  const parts = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length > 73) {
    parts.push(` ${rest.slice(0, 73)}`)
    rest = rest.slice(73)
  }
  if (rest) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

const icsStamp = (d) => `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`

export function buildIcs(events = [], { name = 'Maddex Economic Calendar' } = {}) {
  const now = new Date()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maddex//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`,
  ]

  for (const e of events) {
    const start = eventInstant(e)
    if (!start) continue
    // Most of these are point-in-time releases; a 30-minute block gives them
    // visible height in a week view without implying a duration we do not know.
    const end = new Date(start.getTime() + 30 * 60000)
    const stars = eventStars(e)
    const desc = [
      e.description ?? '',
      e.forecast && e.forecast !== '—' ? `Consensus: ${e.forecast}` : '',
      e.prev && e.prev !== '—' ? `Previous: ${e.prev}` : '',
      `Importance: ${starString(stars)} (${stars}/5)`,
      'Exported from Maddex — general information only, not advice.',
    ].filter(Boolean).join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(`${e.date}-${(e.event ?? e.title ?? 'event').replace(/\s+/g, '-')}@maddex`)}`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      fold(`SUMMARY:${icsEscape(`${e.region ? `[${e.region}] ` : ''}${e.event ?? e.title}`)}`),
      fold(`DESCRIPTION:${icsEscape(desc)}`),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
