// Sidebar width preference: COMPACT (icons, labels on hover) or FULL (icons
// and labels, pinned open). One key, one event, so the pin button in the
// sidebar and the toggle in Settings stay in step.
const KEY = 'maddex_sidebar_width'
const LEGACY_KEY = 'maddex_sidebar_pinned'
const EVENT = 'maddex:sidebar-width'

export function getSidebarWidth() {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'compact' || v === 'full') return v
    // Carry over the old pin flag the first time.
    return localStorage.getItem(LEGACY_KEY) === 'true' ? 'full' : 'compact'
  } catch { return 'compact' }
}

export function setSidebarWidth(v) {
  try {
    localStorage.setItem(KEY, v)
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }))
}

export function onSidebarWidthChange(cb) {
  const h = (e) => cb(e.detail)
  window.addEventListener(EVENT, h)
  return () => window.removeEventListener(EVENT, h)
}
