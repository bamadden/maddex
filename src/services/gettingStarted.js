// ─── Getting started ────────────────────────────────────────────────────────
//
// Five first-week milestones, recorded when the user DOES the thing — not
// inferred from state. A fresh browser is seeded with a starter watchlist, so
// "has a watchlist" would read as done before the user had touched anything;
// the milestone is set by the add action itself.
//
// Shown as a progress row on the Settings link for the first seven days
// (isNewUser), and gone once all five are done — after a single "welcome
// aboard" that is itself recorded so it never repeats.

import { isNewUser } from './onboardingState'

const KEY = 'maddex_getting_started'
const EVENT = 'maddex:getting-started'

export const MILESTONES = [
  { id: 'watchlist', label: 'Added first watchlist stock' },
  { id: 'brief',     label: 'Viewed Morning Brief' },
  { id: 'portfolio', label: 'Added portfolio holding' },
  { id: 'alert',     label: 'Set a price alert' },
  { id: 'ai',        label: 'Tried MaddenAI' },
]

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}

function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function markMilestone(id) {
  if (!MILESTONES.some((m) => m.id === id)) return
  const cur = read()
  if (cur[id]) return
  write({ ...cur, [id]: new Date().toISOString() })
}

// Snapshot cached by raw string for useSyncExternalStore.
let lastRaw, lastSnap
export function getProgress() {
  let raw = null
  try { raw = localStorage.getItem(KEY) } catch { /* private mode */ }
  if (raw === lastRaw && lastSnap) return lastSnap
  lastRaw = raw
  const v = read()
  const done = MILESTONES.filter((m) => v[m.id]).map((m) => m.id)
  lastSnap = {
    done,
    count: done.length,
    total: MILESTONES.length,
    complete: done.length === MILESTONES.length,
    celebrated: Boolean(v.celebrated),
  }
  return lastSnap
}

export const markCelebrated = () => write({ ...read(), celebrated: new Date().toISOString() })

// The progress row shows for new users until everything is done and the
// completion message has been seen once.
export const shouldShowProgress = (p = getProgress()) => isNewUser() && !(p.complete && p.celebrated)

export function subscribeProgress(cb) {
  const onStorage = (e) => { if (e.key === KEY) cb() }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', onStorage) }
}
