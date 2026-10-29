// ─── Plan usage, per calendar month ─────────────────────────────────────────
//
// 'maddex_usage_YYYY_MM' = { aiQueries, researchNotes, alerts, aiByDay, briefDays }
// A new month is a new key, so counts reset on the 1st without any job. Two
// older months are kept for reference; the rest are pruned.
//
// Local to this browser — it enforces the plan's daily/monthly caps on this
// device and shows the user their usage. Server-side metering arrives with
// billing.

import { getCurrentTier, LIMITS, TIER_LABEL, PRICES } from './plans'

const EVENT = 'maddex:usage'
const localDay = (d = new Date()) => d.toLocaleDateString('en-CA')
export const monthKey = (d = new Date()) => `maddex_usage_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`

const empty = () => ({ aiQueries: 0, researchNotes: 0, alerts: 0, aiByDay: {}, briefDays: [] })

export function getUsage(d = new Date()) {
  try {
    const v = JSON.parse(localStorage.getItem(monthKey(d)) ?? 'null')
    return v && typeof v === 'object' ? { ...empty(), ...v } : empty()
  } catch { return empty() }
}

function update(fn) {
  const next = fn(getUsage())
  try {
    localStorage.setItem(monthKey(), JSON.stringify(next))
    const keep = new Set([0, 1, 2].map((m) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - m); return monthKey(d) }))
    for (const k of Object.keys(localStorage)) if (k.startsWith('maddex_usage_') && !keep.has(k)) localStorage.removeItem(k)
  } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT))
  return next
}

export const subscribeUsage = (cb) => { window.addEventListener(EVENT, cb); return () => window.removeEventListener(EVENT, cb) }

export const aiQueriesToday = () => getUsage().aiByDay[localDay()] ?? 0
export const recordAiQuery = () => {
  const u = update((x) => ({
    ...x, aiQueries: x.aiQueries + 1, aiByDay: { ...x.aiByDay, [localDay()]: (x.aiByDay[localDay()] ?? 0) + 1 },
  }))
  nudgeAiQuestions(u.aiByDay[localDay()])
  return u
}

export const recordResearchNote = () => {
  const u = update((x) => ({ ...x, researchNotes: x.researchNotes + 1 }))
  if (u.researchNotes === 1) nudgeOnce('first-note', noteNudge())
  return u
}
export const recordAlertCreated = () => update((u) => ({ ...u, alerts: u.alerts + 1 }))

// ─── Upgrade moments ─────────────────────────────────────────────────────────
//
// A short prompt at the moment a plan limit becomes relevant — the first
// research note, the tenth MaddenAI question in a day, the third alert — once
// each, ever. Every number in the wording is read from services/plans, so a
// prompt cannot promise more than a plan gives. Shown by TrialNudges.
export const NUDGE_EVENT = 'maddex:nudge'
const NUDGE_SEEN = 'maddex_nudges_seen'
const lim = (v) => (v === Infinity ? 'unlimited' : String(v))

function nudgeOnce(id, card) {
  if (!card) return
  let seen = []
  try { seen = JSON.parse(localStorage.getItem(NUDGE_SEEN) ?? '[]') } catch { /* fresh */ }
  if (seen.includes(id)) return
  try { localStorage.setItem(NUDGE_SEEN, JSON.stringify([...seen, id])) } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent(NUDGE_EVENT, { detail: card }))
}

function noteNudge() {
  const tier = getCurrentTier()
  if (tier === 'apex' || tier === 'core') {
    // A live trial is Apex: say what happens after it, in plan terms.
    return { title: 'Your first research note', body: `Saved to your research. Research notes come with Prime (${lim(LIMITS.prime.researchNotesPerMonth)} a month, A$${PRICES.prime.monthly}/mo) and Apex (${lim(LIMITS.apex.researchNotesPerMonth)}); Core does not include them.`, upgrade: 'prime' }
  }
  return { title: 'Your first research note', body: `That's 1 of ${lim(LIMITS[tier].researchNotesPerMonth)} this month on ${TIER_LABEL[tier]}. Apex has no monthly limit.`, upgrade: 'apex' }
}

export function nudgeAiQuestions(countToday) {
  if (countToday !== 10) return
  const tier = getCurrentTier()
  if (tier === 'core') return // Core stops at 10 with its own limit prompt
  nudgeOnce(`ai-10-${new Date().toLocaleDateString('en-CA')}`, {
    title: `${countToday} MaddenAI questions today`,
    body: `Core allows ${lim(LIMITS.core.aiPerDay)} a day, Prime ${lim(LIMITS.prime.aiPerDay)}, Apex ${lim(LIMITS.apex.aiPerDay)}.${tier === 'prime' ? ' You are on Prime.' : ''}`,
    upgrade: tier === 'prime' ? 'apex' : 'prime',
  })
}

export function nudgeAlertCount(active) {
  if (active !== 3) return
  const tier = getCurrentTier()
  nudgeOnce('alerts-3', {
    title: `${active} price alerts set`,
    body: `${active} of ${lim(LIMITS[tier].alerts)} alert slots on ${tier === 'apex' ? 'Apex (and your trial)' : TIER_LABEL[tier]}. Prime allows ${lim(LIMITS.prime.alerts)} active alerts; Core does not include alerts.`,
    upgrade: tier === 'prime' ? 'apex' : 'prime',
  })
}

// Morning brief: Core gets three distinct days a week (Mon–Sun). A day once
// opened stays open — re-reading today's brief never costs a second "use".
function weekDays(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))   // Monday
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return localDay(d) })
}
// Brief days are stored across month keys, so read this week from both.
function briefDaysThisWeek() {
  const days = new Set(weekDays())
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1)
  return [...new Set([...getUsage().briefDays, ...getUsage(prev).briefDays])].filter((d) => days.has(d))
}
export function canOpenBriefToday(limit) {
  if (limit === Infinity) return true
  const seen = briefDaysThisWeek()
  return seen.includes(localDay()) || seen.length < limit
}
export const briefsUsedThisWeek = () => briefDaysThisWeek().length
export const recordBriefDay = () => update((u) => (u.briefDays.includes(localDay()) ? u : { ...u, briefDays: [...u.briefDays, localDay()] }))
