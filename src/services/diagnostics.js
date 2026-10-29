// Local diagnostics: an error log and a performance log, for Settings → About.
//
// Both live in localStorage on this device only — nothing is sent anywhere
// unless the user presses REPORT BUG, which opens their own mail client with
// the log in the body for them to read before sending.
//
// ERRORS: unhandled errors and promise rejections, plus anything the error
// boundary catches, as { module, error, timestamp }. Fifty kept, newest first.
//
// PERFORMANCE: how long each module took from being chosen to its first
// render (module), and how long data requests through httpGet took (api).
// A rolling window of the most recent samples per kind.

const ERR_KEY = 'maddex_error_log'
const PERF_KEY = 'maddex_perf_log'
const ERR_MAX = 50
const PERF_MAX = { module: 60, api: 120 }
export const DIAGNOSTICS_CHANGED = 'maddex:diagnostics-changed'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d } catch { return d } }
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* quota or private mode */ }
  try { window.dispatchEvent(new Event(DIAGNOSTICS_CHANGED)) } catch { /* non-browser */ }
}

let currentModule = 'app'
export const setDiagnosticsModule = (m) => { currentModule = m || 'app' }

export function recordError(error, module = currentModule) {
  const message = String(error?.message ?? error ?? 'Unknown error').slice(0, 300)
  // Browser-extension and cross-origin script noise carries no location and
  // says "Script error." — nothing a reader or developer can act on.
  if (!message || message === 'Script error.' || /ResizeObserver loop/.test(message)) return
  const log = read(ERR_KEY, [])
  const last = log[0]
  // The same error firing in a loop is one entry with a count, not fifty.
  if (last && last.error === message && last.module === module) {
    last.count = (last.count ?? 1) + 1
    last.timestamp = new Date().toISOString()
    write(ERR_KEY, log)
    return
  }
  write(ERR_KEY, [{ module, error: message, stack: String(error?.stack ?? '').split('\n').slice(0, 4).join('\n'), timestamp: new Date().toISOString() }, ...log].slice(0, ERR_MAX))
}

export const getErrorLog = () => read(ERR_KEY, [])
export const clearErrorLog = () => write(ERR_KEY, [])

export function installErrorCapture() {
  if (typeof window === 'undefined' || window.__maddexDiag) return
  window.__maddexDiag = true
  window.addEventListener('error', (e) => recordError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => recordError(e.reason))
}

// A module switch, stamped where it happens (the store's setActiveModule) so
// the timer does not depend on effect order, and taken once so React's dev
// double-effects cannot count it twice.
let pendingSwitch = null
export function markModuleSwitch(id) { if (typeof id === 'string') pendingSwitch = { id, at: performance.now() } }
export function takeModuleSwitch(id) {
  if (pendingSwitch?.id !== id) return null
  const ms = performance.now() - pendingSwitch.at
  pendingSwitch = null
  return ms
}

export function recordTiming(kind, label, ms) {
  if (!Number.isFinite(ms) || ms < 0 || ms > 120_000) return
  const log = read(PERF_KEY, { module: [], api: [] })
  const list = [{ label, ms: Math.round(ms), at: Date.now() }, ...(log[kind] ?? [])].slice(0, PERF_MAX[kind] ?? 60)
  write(PERF_KEY, { ...log, [kind]: list })
}

export function perfSummary() {
  const log = read(PERF_KEY, { module: [], api: [] })
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x.ms, 0) / xs.length) : null)
  const mods = log.module ?? []
  const byModule = new Map()
  for (const m of mods) byModule.set(m.label, [...(byModule.get(m.label) ?? []), m.ms])
  const slowest = [...byModule.entries()]
    .map(([label, xs]) => ({ label, ms: Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) }))
    .sort((a, b) => b.ms - a.ms)[0] ?? null
  return { moduleAvg: avg(mods), moduleSamples: mods.length, slowest, apiAvg: avg(log.api ?? []), apiSamples: (log.api ?? []).length }
}

export const clearPerfLog = () => write(PERF_KEY, { module: [], api: [] })
