// Data health (WS1 step 4): how current each registered dataset is today.
// The gate fails a build past a dataset's maximum age, but a deployed build
// keeps ageing; this is computed on the reader's Sydney date, so a figure
// that passes its maximum age between deploys shows as past it.
import { HEALTH } from '../data/registryHealth.js'
import { sydneyISO } from './dateUtils.js'

const dayMs = 86_400_000
export const ageDays = (asOf, today) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / dayMs)

// 'demo' (simulated, not about the world), 'undated', 'past' (older than its
// maximum age) or 'current'.
export function datasetState(h, today = sydneyISO()) {
  if (h.cls === 'demo') return { ...h, state: 'demo', age: null }
  if (!h.asOf) return { ...h, state: 'undated', age: null }
  const age = ageDays(h.asOf, today)
  return { ...h, state: age > h.maxAgeDays ? 'past' : 'current', age }
}

export function moduleHealth(moduleId, today = sydneyISO()) {
  const rows = HEALTH.filter((h) => h.modules.includes(moduleId)).map((h) => datasetState(h, today))
  const attention = rows.filter((r) => r.state === 'past' || r.state === 'undated').length
  return { rows, attention, total: rows.length }
}

export const STATE_TEXT = {
  current: 'within its maximum age',
  past: 'past its maximum age',
  undated: 'no as-of date yet',
  demo: 'simulated (DEMO)',
}
