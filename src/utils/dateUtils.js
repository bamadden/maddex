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

export function timeAgo(dateStr) {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ISO date `daysOffset` days from today — used to build mock/demo history
// series that always end at "today" regardless of when the app is opened.
export function getRelativeDate(daysOffset) {
  return new Date(Date.now() + daysOffset * 86400000).toISOString().split('T')[0]
}
