// "Since your last visit" — what changed between the previous visit and now.
// Every figure is computed here from stored snapshots and the verified
// constants; nothing is estimated.
//
// A visit spans tabs (26 Nov 2026; it was one browser session, so a second
// tab reset it): it continues while the Dashboard was seen within the last
// VISIT_GAP_MS, and a later open starts a new one. "Since" is when the
// previous visit was last seen, not when it began, so what the reader already
// saw is not listed again. Each market figure is stored with its data class:
// a move between DEMO readings is labelled DEMO and not coloured as a real
// move, and a move whose class changed between visits is not shown.

import { formatDate, sydneyOffset } from '../utils/dateUtils.js'

const KEY = 'maddex_last_visit'
export const VISIT_GAP_MS = 30 * 60_000

const read = (s, k) => { try { return JSON.parse(s?.getItem(k) ?? 'null') } catch { return null } }
const write = (s, k, v) => { try { s?.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

// → the previous visit's snapshot, or null on a first visit. Opening the
// Dashboard again during the same visit (another tab, a module switch)
// returns the same previous visit.
export function beginVisit({ storage = globalThis.localStorage, now = Date.now() } = {}) {
  const cur = read(storage, KEY)
  if (cur && now - (cur.lastSeen ?? cur.at ?? 0) < VISIT_GAP_MS) {
    write(storage, KEY, { ...cur, lastSeen: now })
    return cur.prev ?? null
  }
  const prev = cur?.at ? (({ prev: _older, ...snap }) => snap)(cur) : null
  write(storage, KEY, { at: now, lastSeen: now, prev })
  return prev
}

// Fills in this visit's figures as they load and marks it as still seen (the
// next visit compares against them). patch: { asx200, asx200Cls,
// portfolioValue, portfolioKey }.
export function recordVisit(patch, { storage = globalThis.localStorage, now = Date.now() } = {}) {
  const cur = read(storage, KEY) ?? { at: now, prev: null }
  write(storage, KEY, { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)), lastSeen: now })
}

// When a release became public, in ms: its date at the agency's release time
// in Sydney (ABS 11:30; RBA decisions 14:30). Compared with the previous
// visit's time, so a release later on the same day is still listed.
export const releasedAt = (iso, time = '11:30') => (iso ? Date.parse(`${iso}T${time}:00${sydneyOffset(iso)}`) : null)

const pct = (a, b) => (a != null && b ? ((a - b) / b) * 100 : null)

// prev: the previous snapshot; now: { at, asx200, asx200Cls, portfolioValue,
// portfolioKey }; constants: VERIFIED_CONSTANTS; alerts: alert history
// ({ at, symbol }); changes: DATED_CHANGES. → [{ kind, text, value?, cls? }]
// (value colours an item as a move; it is set only for non-DEMO moves).
export function sinceLastVisit(prev, now, { constants, alerts = [], changes = [] } = {}) {
  if (!prev?.at) return []
  const since = prev.lastSeen ?? prev.at
  const until = now?.at ?? Date.now()
  const items = []

  const rba = constants?.rba
  let rbaListed = false
  for (const d of rba?.decisions ?? []) {
    if (releasedAt(d.date, '14:30') > since) { items.push({ kind: 'rba', text: `RBA ${d.decision.toLowerCase()} to ${d.rate.toFixed(2)}% on ${formatDate(d.date)}` }); rbaListed = true }
  }
  const au = constants?.au ?? {}
  const releases = [
    [au.cpiLastRelease, `CPI ${au.cpiPeriod}: ${au.cpi}% y/y (ABS)`],
    [au.unemploymentLastRelease, `Unemployment ${au.unemploymentPeriod}: ${au.unemployment}% (ABS)`],
    [au.gdpLastRelease, `GDP ${au.gdpPeriod}: ${au.gdpQoQ}% q/q, ${au.gdpAnnual}% y/y (ABS)`],
  ]
  for (const [date, text] of releases) {
    const t = releasedAt(date)
    if (t && t > since && t <= until) items.push({ kind: 'release', text: `${text}, released ${formatDate(date)}` })
  }

  // The ASX 200 move: only between readings of the same class; a DEMO move
  // is labelled and not coloured.
  const asx = pct(now?.asx200, prev.asx200)
  const sameClass = (prev.asx200Cls ?? null) === (now?.asx200Cls ?? null)
  if (asx != null && sameClass) {
    const demo = now?.asx200Cls === 'DEMO'
    items.push({ kind: 'market', cls: now?.asx200Cls ?? null, text: `ASX 200 ${asx >= 0 ? '+' : ''}${asx.toFixed(2)}% (${prev.asx200.toFixed(1)} → ${now.asx200.toFixed(1)})${demo ? ' · DEMO, simulated' : ''}`, ...(demo ? {} : { value: asx }) })
  }
  // Holdings: only when the same holdings, all priced, were valued both times
  // (a partial sum, or an added holding, is not a move).
  const port = prev.portfolioKey && prev.portfolioKey === now?.portfolioKey ? pct(now?.portfolioValue, prev.portfolioValue) : null
  if (port != null) items.push({ kind: 'portfolio', text: `Your holdings ${port >= 0 ? '+' : ''}${port.toFixed(2)}% (A$${Math.round(prev.portfolioValue).toLocaleString('en-AU')} → A$${Math.round(now.portfolioValue).toLocaleString('en-AU')})`, value: port })

  const fired = alerts.filter((a) => Date.parse(a.at) > since)
  if (fired.length) items.push({ kind: 'alerts', text: `${fired.length} alert${fired.length === 1 ? '' : 's'} triggered: ${[...new Set(fired.map((a) => a.symbol).filter(Boolean))].slice(0, 4).join(', ') || 'see the bell'}` })

  for (const c of changes) {
    const t = Date.parse(c.effective)
    if (!(t > since && t <= until)) continue
    if (rbaListed && /^RBA decision/i.test(c.what)) continue // listed above from the decision record
    items.push({ kind: 'change', text: c.what })
  }
  return items
}
