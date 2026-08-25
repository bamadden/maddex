// MaddenAI behavior preferences — localStorage-backed, read by both the
// Settings panel (writes) and AIPanel (reads at call time, not subscribed —
// these change rarely enough that a stale read until the next message/open
// is an acceptable tradeoff over wiring a full subscription).
const KEY = 'maddex_ai_preferences'
const DEFAULTS = {
  autoAnalyse: false,
  contextAwareness: true,
  disclaimerFrequency: 'session', // 'always' | 'session' | 'never'
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}

export function getAiPreferences() {
  return load()
}

export function setAiPreference(key, value) {
  const next = { ...load(), [key]: value }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* best-effort */ }
  return next
}
