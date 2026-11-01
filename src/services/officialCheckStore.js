// The latest RBA/ABS/US reconciliation and who is listening — small, so the
// app shell can hold it without loading the fetchers. runOfficialCheck loads
// services/officialStats on demand and runs the check (cached six hours).

const listeners = new Set()
let latest = null

export const getOfficialCheck = () => latest
export function subscribeOfficialCheck(cb) { listeners.add(cb); return () => listeners.delete(cb) }

export function publishOfficialCheck(result) {
  latest = result
  listeners.forEach((cb) => cb(latest))
  return latest
}

// One request in flight at a time — StrictMode mounts effects twice in dev,
// and a click on CHECK NOW during the startup check should join it.
let inflight = null
export function runOfficialCheck(opts = {}) {
  if (!inflight) {
    inflight = import('./officialStats.js').then((m) => m.doOfficialCheck(opts)).finally(() => { inflight = null })
  }
  return inflight
}
