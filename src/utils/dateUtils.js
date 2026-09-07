// ─── Date helpers ───────────────────────────────────────────────────────────
// Shared relative-date formatting so displayed dates/countdowns are always
// correct relative to "now" instead of being hand-bumped every session.

export function relativeDate(dateStr) {
  const date = new Date(dateStr)
  const today = new Date()
  const diff = Math.ceil((date - today) / 86400000)

  if (diff === 0) return 'TODAY'
  if (diff === 1) return 'TOMORROW'
  if (diff < 0) return `${Math.abs(diff)}d ago`
  if (diff < 7) return `in ${diff} days`
  if (diff < 14) return 'next week'
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

export function isPast(dateStr) {
  return new Date(dateStr) < new Date()
}

// THE relative-time formatter. Singular, deliberately.
//
// There were nine of these — in dateUtils, ModuleHeader, ModuleStates,
// NotificationCenter, the scanner, the unusual-activity tracker, the global
// module, IntelSections and the news module — and they disagreed. The same
// event ninety minutes old read "1h ago" in one panel and "2h ago" in the next,
// because one floored and one rounded. At thirty seconds you could get "just
// now", "30s ago" and "0m ago" on the same screen.
//
// None of that is a bug anyone files. It is the kind of thing that makes a
// terminal feel assembled rather than designed, which is exactly what this pass
// is for.
//
// Accepts a Date, an ISO string or epoch milliseconds, and an optional `now` so
// a component that freezes its clock for a stable render (the seismic list
// does) still gets the same words as everything else.
export function timeAgo(when, now = Date.now()) {
  if (when == null) return null
  const then = when instanceof Date ? when.getTime()
    : typeof when === 'number' ? when
    : new Date(when).getTime()
  if (!Number.isFinite(then)) return null

  // Floor throughout: elapsed time counts what has completed, so 90 minutes is
  // an hour and a half ago, not two hours ago.
  const secs = Math.max(0, Math.floor((now - then) / 1000))
  if (secs < 10)    return 'just now'
  if (secs < 60)    return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60)    return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)     return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)     return `${days}d ago`
  // Past a week "43d ago" stops being readable as a date. A calendar date is.
  return new Date(then).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// ISO date `daysOffset` days from today — used to build mock/demo history
// series that always end at "today" regardless of when the app is opened.
export function getRelativeDate(daysOffset) {
  return new Date(Date.now() + daysOffset * 86400000).toISOString().split('T')[0]
}
