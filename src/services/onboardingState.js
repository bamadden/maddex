// What the app remembers about a user's first days.
//
// All of it is localStorage rather than the Supabase profile, deliberately.
// The existing post-signup flow keys off `profile.onboarding_complete`, which
// means it cannot run at all until an account exists — and the welcome screen
// is the thing a person sees BEFORE deciding whether to make one. A first
// impression gated behind sign-up is not a first impression.

const WELCOMED_KEY = 'maddex_welcomed'
const FIRST_SEEN_KEY = 'maddex_first_seen'
const WHATS_NEW_VERSION_KEY = 'maddex_whats_new_version'

const read = (key, fallback = null) => {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
const write = (key, value) => {
  try { localStorage.setItem(key, value) } catch { /* private mode, quota */ }
}

// ─── Welcome ────────────────────────────────────────────────────────────────

export const hasBeenWelcomed = () => read(WELCOMED_KEY) != null

export function markWelcomed() {
  write(WELCOMED_KEY, new Date().toISOString())
  // The clock for "is this a new user" starts here rather than at sign-up,
  // because that is when this browser first saw the terminal.
  if (!read(FIRST_SEEN_KEY)) write(FIRST_SEEN_KEY, String(Date.now()))
}

// ─── New-user window ────────────────────────────────────────────────────────
//
// Contextual tips only run for the first week. A tip that keeps appearing
// after someone knows the app is not help, it is friction — and the muscle
// memory it builds is "dismiss without reading", which is exactly the habit
// that makes a genuinely important notice invisible later.
const NEW_USER_DAYS = 7

export function isNewUser(now = Date.now()) {
  const first = Number(read(FIRST_SEEN_KEY, '0'))
  if (!first) return true          // never recorded — treat as new
  return now - first < NEW_USER_DAYS * 86400000
}

export function daysSinceFirstSeen(now = Date.now()) {
  const first = Number(read(FIRST_SEEN_KEY, '0'))
  return first ? Math.floor((now - first) / 86400000) : 0
}

// ─── Contextual tooltips ────────────────────────────────────────────────────
//
// One tooltip per module, on the first visit during the first week, anchored
// to the element it is about. Each says something you cannot see by looking —
// a shortcut, a hidden interaction, how the data behaves — and every claim has
// been checked against the code: a tooltip that is wrong teaches the user to
// stop reading tooltips.
//
// Seen state: { [moduleId]: true } under 'maddex_tooltips_seen'. The previous
// list-of-ids key is carried over once so nobody is re-shown a dismissed tip.
const TOOLTIPS_KEY = 'maddex_tooltips_seen'
const LEGACY_TIPS_KEY = 'maddex_tips_dismissed'

// target: CSS selector of the element the arrow points at. Without one (or if
// it is not on screen) the tooltip sits in the module's corner, unanchored.
export const TOOLTIPS = {
  // Waits for the first-run layout picker to be dealt with — over the picker
  // the EDIT button it points at is dimmed out of reach.
  dashboard: { text: 'Press EDIT, then drag widgets to customise your layout.', target: '[data-tip="dashboard-edit"]',
    ready: () => { try { return localStorage.getItem('maddex_dashboard_setup_done') === 'true' } catch { return true } } },
  markets:   { text: 'Click any stock for a deep dive.', target: '[data-tip="markets-movers"]' },
  global:    { text: 'Press F with the pointer over the map to search any location.', target: '[data-tip="global-search"]' },
  fx:        { text: "RBA figures are checked against the RBA's own data — the LIVE CHECK badge flags any change after a decision.", target: '[data-tip="rba-hero"]' },
  maddenai:  { text: 'Press A to open MaddenAI from anywhere.', target: '[data-tour="ai-panel"]', placement: 'left' },
  screener:  { text: "MATCH % ranks results by how far past the screen's thresholds each stock sits — every column sorts." },
  portfolio: { text: 'The TRANSACTIONS tab records buys, sells and dividends, and derives realised P&L.' },
  news:      { text: 'Stories about your watchlist are marked in gold and float to the top.' },
  calendar:  { text: 'Set a reminder on any event, or export the whole calendar as .ics.' },
  crypto:    { text: 'Crypto is live data — CoinGecko, updated every few minutes.' },
  scanner:   { text: 'Ask the command bar to "scan for oversold" to jump straight to a tab.' },
}

function readSeen() {
  let seen
  try { seen = JSON.parse(read(TOOLTIPS_KEY, '{}')) ?? {} } catch { seen = {} }
  const legacy = read(LEGACY_TIPS_KEY)
  if (legacy != null) {
    try {
      for (const id of JSON.parse(legacy)) if (typeof id === 'string') seen[id.replace(/^tip-/, '')] = true
    } catch { /* unreadable legacy list is dropped */ }
    write(TOOLTIPS_KEY, JSON.stringify(seen))
    try { localStorage.removeItem(LEGACY_TIPS_KEY) } catch { /* private mode */ }
  }
  return seen && typeof seen === 'object' ? seen : {}
}

export const isTooltipSeen = (id) => Boolean(readSeen()[id])

export function markTooltipSeen(id) {
  const seen = readSeen()
  if (seen[id]) return
  write(TOOLTIPS_KEY, JSON.stringify({ ...seen, [id]: true }))
}

export const resetTooltips = () => write(TOOLTIPS_KEY, '{}')

// ─── What's new ─────────────────────────────────────────────────────────────
//
// Keyed to the VERSION, not to a timer.
//
// This previously re-showed every seven days whether or not anything had
// shipped, which is nagware: the same three features, over and over, training
// the reader to dismiss the modal without looking. That habit is expensive
// later, when the modal has something in it that matters.
export const shouldShowWhatsNew = (currentVersion) =>
  Boolean(currentVersion) && read(WHATS_NEW_VERSION_KEY) !== currentVersion

export const markWhatsNewSeen = (currentVersion) => write(WHATS_NEW_VERSION_KEY, currentVersion)
