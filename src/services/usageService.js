// ─── Plan usage, per calendar month ─────────────────────────────────────────
//
// 'maddex_usage_YYYY_MM' = { aiQueries, researchNotes, alerts, aiByDay, briefDays }
// A new month is a new key, so counts reset on the 1st without any job. Two
// older months are kept for reference; the rest are pruned.
//
// Local to this browser — it enforces the plan's daily/monthly caps on this
// device and shows the user their usage. Server-side metering arrives with
// billing.

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
export const recordAiQuery = () => update((u) => ({
  ...u, aiQueries: u.aiQueries + 1, aiByDay: { ...u.aiByDay, [localDay()]: (u.aiByDay[localDay()] ?? 0) + 1 },
}))

export const recordResearchNote = () => update((u) => ({ ...u, researchNotes: u.researchNotes + 1 }))
export const recordAlertCreated = () => update((u) => ({ ...u, alerts: u.alerts + 1 }))

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
