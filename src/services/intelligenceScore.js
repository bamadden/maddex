// TERMINAL INTELLIGENCE — how much of the terminal this user has set up, out
// of 100, and what to do next. Each part is checked from the user's own state
// on this device; none is guessed.

import { getInvestorProfile } from './investorProfile'
import { getProgress } from './gettingStarted'
import { loadAlerts } from './alertsService'

export const SHORTCUTS_SEEN_KEY = 'maddex_shortcuts_seen'

export function intelligenceScore({ watchlist = [], priceAlerts = [] } = {}) {
  let holdings = []
  try { holdings = JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]') } catch { /* none */ }
  const profile = getInvestorProfile()
  const profileDone = !!(profile?.focus && profile?.timeHorizon && profile?.sectors?.length)
  const alerts = priceAlerts.length + (loadAlerts()?.length ?? 0)
  const briefRead = getProgress().done.includes('brief')
  const notifOn = typeof Notification !== 'undefined' && Notification.permission === 'granted'
  let shortcuts = false
  try { shortcuts = localStorage.getItem(SHORTCUTS_SEEN_KEY) === '1' } catch { /* private mode */ }

  const parts = [
    { id: 'watchlist', pts: 20, done: watchlist.length >= 5, label: 'Watchlist with 5+ stocks', hint: `Add ${Math.max(0, 5 - watchlist.length)} more stock${5 - watchlist.length === 1 ? '' : 's'} to your watchlist`, action: { module: 'watchlist' } },
    { id: 'portfolio', pts: 20, done: holdings.length > 0, label: 'Portfolio holdings', hint: 'Add your holdings — rate impact, dividends and the daily digest are written around them', action: { module: 'portfolio' } },
    { id: 'profile', pts: 15, done: profileDone, label: 'Investor profile', hint: 'Set up your investor profile to personalise MaddenAI', action: { settings: 'INVESTOR PROFILE' } },
    { id: 'alerts', pts: 15, done: alerts > 0, label: 'Price alerts', hint: 'Set a price alert on a stock you watch', action: { module: 'watchlist' } },
    { id: 'brief', pts: 10, done: briefRead, label: 'Morning brief', hint: 'Open the morning brief — it generates at 7am on weekdays', action: { module: 'brief' } },
    { id: 'notifications', pts: 10, done: notifOn, label: 'Browser notifications', hint: 'Allow notifications so alerts reach you when the tab is in the background', action: { settings: 'NOTIFICATIONS' } },
    { id: 'shortcuts', pts: 10, done: shortcuts, label: 'Keyboard shortcuts', hint: 'Press ? to see the keyboard shortcuts', action: { shortcuts: true } },
  ]
  return { score: parts.filter((p) => p.done).reduce((s, p) => s + p.pts, 0), parts }
}
