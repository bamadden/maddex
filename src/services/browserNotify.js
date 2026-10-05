// ─── Browser (system) notifications ─────────────────────────────────────────
//
// The in-app bell only reaches someone looking at the tab. This delivers the
// notifications that matter as OS notifications when the tab is in the
// background — the case a price alert exists for.
//
// ONE INSERTION POINT. Every notification in the app goes through the store's
// addNotification, which calls maybeNotify() below. Producers don't decide
// whether to go to the OS; the category preferences here do. A notification
// fires as a system notification only when ALL hold:
//   - the browser supports it and permission is granted,
//   - the user has not switched browser notifications off in Settings,
//   - its category is ticked,
//   - the tab is hidden (in the foreground the toast already shows it — two
//     copies of the same alert is noise).

const PREFS_KEY = 'maddex_notification_prefs'
const PROMPT_KEY = 'maddex_notif_prompt_dismissed'

export const CATEGORIES = [
  { id: 'priceAlerts',   label: 'Price alerts (when a target is hit)',     defaultOn: true },
  { id: 'events',        label: 'High-impact events (5-minute warning)',   defaultOn: true },
  { id: 'morningBrief',  label: 'Morning brief ready (7am weekdays)',      defaultOn: true },
  { id: 'watchlistNews', label: 'Breaking news on watchlist stocks',       defaultOn: false },
  { id: 'marketClose',   label: 'Daily market close summary',              defaultOn: false },
]

// Notification type → category. Types not listed never go to the OS.
const TYPE_CATEGORY = {
  PRICE_ALERT: 'priceAlerts',
  CUSTOM_ALERT: 'priceAlerts',
  CALENDAR: 'events',
  RBA_DECISION: 'events',
  EVENT_WARNING: 'events',
  MORNING_BRIEF: 'morningBrief',
  BREAKING_WATCHLIST: 'watchlistNews',
  DAILY_DIGEST: 'marketClose',
}

const TYPE_TITLE = {
  PRICE_ALERT: '⚡ Price alert triggered',
  CUSTOM_ALERT: '⚡ Alert triggered',
  CALENDAR: '📅 Calendar',
  EVENT_WARNING: '⏰ Market event',
  RBA_DECISION: '🏦 RBA decision',
  MORNING_BRIEF: '☀ Morning brief',
  BREAKING_WATCHLIST: '📰 Watchlist news',
  DAILY_DIGEST: '📊 Market close',
}

export const supported = () => typeof window !== 'undefined' && 'Notification' in window
export const permission = () => (supported() ? Notification.permission : 'unsupported')

export function getPrefs() {
  const defaults = { enabled: true, ...Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultOn])) }
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') } } catch { return defaults }
}

export function setPref(key, value) {
  const next = { ...getPrefs(), [key]: value }
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('maddex:notify-prefs', { detail: next }))
  return next
}

export async function requestPermission() {
  if (!supported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  window.dispatchEvent(new CustomEvent('maddex:notify-permission', { detail: result }))
  if (result === 'granted') setPref('enabled', true)
  return result === 'granted'
}

// Raw system notification. Clicking focuses the tab and, if given, opens a
// module through the app's navigation event.
export function fire({ title, body, tag, module }) {
  if (permission() !== 'granted') return null
  try {
    const n = new Notification(title, { body, tag, icon: '/icons/icon-mark-96.png', badge: '/icons/icon-mark-96.png', silent: false })
    n.onclick = () => {
      window.focus()
      n.close()
      if (module) window.dispatchEvent(new CustomEvent('maddex:navigate', { detail: { module } }))
    }
    return n
  } catch {
    // Some browsers (Android Chrome) only allow notifications from a service
    // worker; the in-app bell still has it.
    return null
  }
}

// Called by the store for every notification.
export function maybeNotify(notification, meta = null) {
  const category = TYPE_CATEGORY[notification.type]
  if (!category) return
  const prefs = getPrefs()
  if (!prefs.enabled || !prefs[category]) return
  if (typeof document !== 'undefined' && !document.hidden) return
  fire({
    title: meta?.browser?.title ?? TYPE_TITLE[notification.type] ?? 'Maddex',
    body: meta?.browser?.body ?? notification.message,
    tag: meta?.browser?.tag ?? `${notification.type}-${notification.id}`,
    module: meta?.browser?.module ?? null,
  })
}

// The friendly pre-prompt is offered once, on the user's first alert, and only
// while the browser has not been asked yet.
export function shouldOfferPrompt() {
  if (permission() !== 'default') return false
  try { return localStorage.getItem(PROMPT_KEY) !== '1' } catch { return false }
}
export function dismissPrompt() {
  try { localStorage.setItem(PROMPT_KEY, '1') } catch { /* private mode */ }
}
export function offerPrompt() {
  if (shouldOfferPrompt()) window.dispatchEvent(new CustomEvent('maddex:notify-offer'))
}
