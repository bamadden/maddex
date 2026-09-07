// What the watchlist remembers between visits.
//
// Three separate keys rather than one blob, deliberately: a corrupt or
// outgrown column list should not take the sort order down with it, and each
// reader can fall back to its own default independently. Same shape as
// watchlistMeta.js next door — read/write helpers, every access wrapped,
// nothing throws into a render.

const SORT_KEY    = 'maddex_watchlist_sort'
const COLUMNS_KEY = 'maddex_watchlist_columns'
const ORDER_KEY   = 'maddex_watchlist_order'

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch { return fallback }
}

const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota, private mode */ }
  return value
}

// ─── Sort ────────────────────────────────────────────────────────────────────
//
// `column: null` is a real, restorable state and not an absence: it means
// "manual order", which is what makes drag-to-reorder possible. Saving it is
// the difference between a user who dragged their rows into an order finding
// that order next visit and finding it re-sorted by name.

const VALID_DIR = new Set(['asc', 'desc'])

export function loadSort(validColumns = []) {
  const s = read(SORT_KEY, null)
  if (!s) return { column: null, direction: 'asc' }
  const column = s.column === null || validColumns.includes(s.column) ? s.column ?? null : null
  return { column, direction: VALID_DIR.has(s.direction) ? s.direction : 'asc' }
}

export const saveSort = (column, direction) => write(SORT_KEY, { column: column ?? null, direction })

// ─── Column visibility ───────────────────────────────────────────────────────
//
// Stored as an explicit map of key -> boolean, not as a list of hidden
// columns. A list of hidden columns silently turns ON any column added in a
// later release, which is how a table someone carefully trimmed grows two new
// columns after an update. A map leaves unknown keys to the caller's default.

export function loadColumns(defaults) {
  const stored = read(COLUMNS_KEY, null)
  if (!stored) return { ...defaults }
  const out = { ...defaults }
  for (const [k, v] of Object.entries(stored)) {
    if (k in defaults && typeof v === 'boolean') out[k] = v
  }
  return out
}

export const saveColumns = (columns) => write(COLUMNS_KEY, columns)

// ─── Manual order ────────────────────────────────────────────────────────────
//
// The store already persists the watchlist array, and drag-to-reorder mutates
// that array — so order survives a reload without this. What this adds is a
// record PER GROUP, so the stock block and the crypto block each keep their
// own arrangement even though they live in one flat array underneath.
//
// Symbols not in the saved order sort to the end in their existing order, so
// adding a ticker never silently reshuffles the ones already placed.
export function loadOrder(group) {
  const all = read(ORDER_KEY, {})
  return Array.isArray(all[group]) ? all[group] : null
}

export function saveOrder(group, symbols) {
  const all = read(ORDER_KEY, {})
  return write(ORDER_KEY, { ...all, [group]: symbols })
}

export function applyOrder(symbols, order) {
  if (!order?.length) return symbols
  const rank = new Map(order.map((s, i) => [s, i]))
  return [...symbols].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity))
}
