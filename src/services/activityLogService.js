// Rolling feed of recent user actions across the terminal, shown on the
// Dashboard's Activity Feed card. Not every action in the app logs here
// (that would mean touching dozens of files) — wired into the highest
// signal points: watchlist changes, alerts firing, AI conversations,
// portfolio changes, and brief generation.
const LOG_KEY = 'maddex_activity_log'
const MAX_ENTRIES = 50

const ICONS = {
  watchlist: '★',
  alert: '🔔',
  brief: '☀',
  research: '📝',
  unusual: '⚡',
  portfolio: '💼',
  ai: '▲',
}

function load() {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(entries) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(entries)) } catch { /* best-effort */ }
}

export function logActivity(type, text) {
  const entries = load()
  entries.unshift({ id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, text, timestamp: Date.now() })
  save(entries.slice(0, MAX_ENTRIES))
}

export function getActivityLog(limit = 8) {
  return load().slice(0, limit)
}

export function iconFor(type) {
  return ICONS[type] ?? '●'
}
