// The order of the Overview's middle panels, kept per device. Market state
// stays first and data health last: they frame the screen. Anything stored
// that is no longer a panel is dropped, and a panel added since is appended,
// so an old saved order never hides a new panel.

export const OVERVIEW_PANELS = ['rba', 'holdings', 'watch', 'since', 'brief', 'coming']
const KEY = 'maddex_overview_order'

export function normaliseOrder(saved) {
  const kept = Array.isArray(saved) ? saved.filter((id, i) => OVERVIEW_PANELS.includes(id) && saved.indexOf(id) === i) : []
  return [...kept, ...OVERVIEW_PANELS.filter((id) => !kept.includes(id))]
}

export function readOrder(storage = globalThis.localStorage) {
  try { return normaliseOrder(JSON.parse(storage.getItem(KEY) ?? 'null')) } catch { return [...OVERVIEW_PANELS] }
}

export function saveOrder(order, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(order)) } catch { /* private mode: the order lasts this visit */ }
}

export function clearOrder(storage = globalThis.localStorage) {
  try { storage.removeItem(KEY) } catch { /* nothing stored */ }
}

// dir: -1 earlier, +1 later. At either end the order is unchanged.
export function moveId(order, id, dir) {
  const i = order.indexOf(id), j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
