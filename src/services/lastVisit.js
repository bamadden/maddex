// "Since your last visit" — what changed between the previous session and
// now. Every figure is computed here from stored snapshots and the verified
// constants; nothing is estimated.
//
// A visit is a browser session. The first Overview mount in a session reads
// the previous session's snapshot (kept until the session ends) and starts a
// new one; later mounts in the same session reuse the same "previous" so a
// tab switch does not reset the comparison.

const KEY = 'maddex_last_visit'
const SESSION_KEY = 'maddex_visit_prev'

const read = (s, k) => { try { return JSON.parse(s?.getItem(k) ?? 'null') } catch { return null } }
const write = (s, k, v) => { try { s?.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

// → the previous visit's snapshot, or null on a first visit.
export function beginVisit({ storage = globalThis.localStorage, session = globalThis.sessionStorage, now = Date.now() } = {}) {
  const already = read(session, SESSION_KEY)
  if (already) return already.prev
  const prev = read(storage, KEY)
  write(session, SESSION_KEY, { prev })
  write(storage, KEY, { at: now, asx200: null, portfolioValue: null })
  return prev
}

// Fills in this visit's figures as they load (the next visit compares
// against them).
export function recordVisit(patch, { storage = globalThis.localStorage } = {}) {
  const cur = read(storage, KEY) ?? { at: Date.now() }
  write(storage, KEY, { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)) })
}

const dayOf = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const pct = (a, b) => (a != null && b ? ((a - b) / b) * 100 : null)

// prev: the previous snapshot; now: { at, asx200, portfolioValue };
// constants: VERIFIED_CONSTANTS; alerts: alert history ({ at, symbol, type });
// changes: DATED_CHANGES. → [{ kind, text, value? }]
export function sinceLastVisit(prev, now, { constants, alerts = [], changes = [] } = {}) {
  if (!prev?.at) return []
  const since = dayOf(prev.at)
  const items = []

  const rba = constants?.rba
  for (const d of rba?.decisions ?? []) {
    if (d.date > since) items.push({ kind: 'rba', text: `RBA ${d.decision.toLowerCase()} to ${d.rate.toFixed(2)}% on ${d.date}` })
  }
  const au = constants?.au ?? {}
  const releases = [
    [au.cpiLastRelease, `CPI ${au.cpiPeriod}: ${au.cpi}% y/y (ABS)`],
    [au.unemploymentLastRelease, `Unemployment ${au.unemploymentPeriod}: ${au.unemployment}% (ABS)`],
    [au.gdpLastRelease, `GDP ${au.gdpPeriod}: ${au.gdpQoQ}% q/q, ${au.gdpAnnual}% y/y (ABS)`],
  ]
  for (const [date, text] of releases) if (date && date > since) items.push({ kind: 'release', text: `${text}, released ${date}` })

  const asx = pct(now?.asx200, prev.asx200)
  if (asx != null) items.push({ kind: 'market', text: `ASX 200 ${asx >= 0 ? '+' : ''}${asx.toFixed(2)}% (${prev.asx200.toFixed(1)} → ${now.asx200.toFixed(1)})`, value: asx })
  const port = pct(now?.portfolioValue, prev.portfolioValue)
  if (port != null) items.push({ kind: 'portfolio', text: `Your holdings ${port >= 0 ? '+' : ''}${port.toFixed(2)}% (A$${Math.round(prev.portfolioValue).toLocaleString('en-AU')} → A$${Math.round(now.portfolioValue).toLocaleString('en-AU')})`, value: port })

  const fired = alerts.filter((a) => Date.parse(a.at) > prev.at)
  if (fired.length) items.push({ kind: 'alerts', text: `${fired.length} alert${fired.length === 1 ? '' : 's'} triggered: ${[...new Set(fired.map((a) => a.symbol).filter(Boolean))].slice(0, 4).join(', ') || 'see the bell'}` })

  for (const c of changes) {
    const t = Date.parse(c.effective)
    if (t > prev.at && t <= (now?.at ?? Date.now())) items.push({ kind: 'scheduled', text: c.what })
  }
  return items
}
