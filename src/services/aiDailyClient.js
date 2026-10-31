// Reads the shared daily MaddenAI content from /api/ai-daily (see
// src/services/aiDaily.js for what is shared and why).
//
//   this browser's copy for today → the shared endpoint → yesterday's copy
//
// Waits for the tab to be visible before any request, and collapses
// concurrent requests for the same kind into one.

import { sydneyDay } from './aiDaily'
import { whenVisible } from '../utils/whenVisible'

export const DAILY_PREFIX = 'maddex_ai_daily_'
const keyFor = (kind, day) => `${DAILY_PREFIX}${kind}_${day}`
const yesterday = () => sydneyDay(new Date(Date.now() - 86_400_000))

export function readDaily(kind, day = sydneyDay()) {
  try { return JSON.parse(localStorage.getItem(keyFor(kind, day)) ?? 'null') } catch { return null }
}

export function clearDaily(kind) {
  try {
    for (const d of [sydneyDay(), yesterday()]) localStorage.removeItem(keyFor(kind, d))
  } catch { /* storage unavailable */ }
}

const inFlight = new Map()

// → { data, generatedAt, source: 'cache' | 'shared' | 'stale' }; throws when
// nothing at all is available.
export async function getDaily(kind) {
  const day = sydneyDay()
  const mine = readDaily(kind, day)
  if (mine) return { ...mine, source: 'cache' }
  if (inFlight.has(kind)) return inFlight.get(kind)
  const run = (async () => {
    await whenVisible()
    try {
      const r = await fetch(`/api/ai-daily?kind=${encodeURIComponent(kind)}&day=${day}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const payload = await r.json()
      const entry = { data: payload.data, generatedAt: payload.generatedAt }
      try { localStorage.setItem(keyFor(kind, payload.day ?? day), JSON.stringify(entry)) } catch { /* quota */ }
      return { ...entry, source: 'shared' }
    } catch (err) {
      const old = readDaily(kind, yesterday())
      if (old) return { ...old, source: 'stale' }
      throw err
    }
  })()
  inFlight.set(kind, run)
  try { return await run } finally { inFlight.delete(kind) }
}
