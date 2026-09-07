// What the app remembers about a user's first days.
//
// All of it is localStorage rather than the Supabase profile, deliberately.
// The existing post-signup flow keys off `profile.onboarding_complete`, which
// means it cannot run at all until an account exists — and the welcome screen
// is the thing a person sees BEFORE deciding whether to make one. A first
// impression gated behind sign-up is not a first impression.

const WELCOMED_KEY = 'maddex_welcomed'
const FIRST_SEEN_KEY = 'maddex_first_seen'
const TIPS_KEY = 'maddex_tips_dismissed'
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

// ─── Contextual tips ────────────────────────────────────────────────────────

function readTips() {
  try {
    const parsed = JSON.parse(read(TIPS_KEY, '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export const isTipDismissed = (id) => readTips().includes(id)

export function dismissTip(id) {
  const list = readTips()
  if (list.includes(id)) return list
  const next = [...list, id]
  write(TIPS_KEY, JSON.stringify(next))
  return next
}

export function resetTips() {
  write(TIPS_KEY, '[]')
}

// One tip per module, shown on first visit only. Each says something a user
// cannot discover by looking — a keyboard shortcut, a hidden interaction —
// rather than narrating what is already on screen.
export const MODULE_TIPS = {
  markets:   { id: 'tip-markets',   text: 'Hover a sector tile and click ⛶ for the full sector deep dive.' },
  screener:  { id: 'tip-screener',  text: 'Type a screen in plain English — "PE under 15 and yield over 4%".' },
  portfolio: { id: 'tip-portfolio', text: 'The TRANSACTIONS tab records buys, sells and dividends, and derives realised P&L.' },
  news:      { id: 'tip-news',      text: 'Stories about your watchlist are marked in gold and float to the top.' },
  calendar:  { id: 'tip-calendar',  text: 'Set a reminder on any event, or export the whole calendar as .ics.' },
  global:    { id: 'tip-global',    text: 'Drag to spin the map; scroll to zoom. Layers toggle on the left rail.' },
  crypto:    { id: 'tip-crypto',    text: 'Crypto is live data — CoinGecko, updated every few minutes.' },
  scanner:   { id: 'tip-scanner',   text: 'Ask the command bar to "scan for oversold" to jump straight to a tab.' },
}

// Shown once, anywhere, on the very first session after the welcome.
export const GLOBAL_TIPS = [
  { id: 'tip-command', text: 'Press / or ⌘K to open the command bar from anywhere.' },
]

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
