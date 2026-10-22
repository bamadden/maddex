// Filter state for the Global intelligence panel: the categories, the
// persisted choice, and which ticker items each category keeps.

export const INTEL_FILTERS = ['ALL', 'LIVE', 'MACRO', 'GEO', 'SEISMIC', 'MARKETS']
const FILTER_KEY = 'maddex_intel_filter'

export function readIntelFilter() {
  try {
    const v = localStorage.getItem(FILTER_KEY)
    return INTEL_FILTERS.includes(v) ? v : 'ALL'
  } catch { return 'ALL' }
}
export function saveIntelFilter(v) {
  try { localStorage.setItem(FILTER_KEY, v) } catch { /* per-viewer convenience */ }
}

// Which ticker tags each filter keeps. AI lines span macro and geopolitics,
// so they show under both; LIVE keeps only items whose figure is real-time.
const TAGS_FOR = {
  MACRO: new Set(['MACRO', 'EVENT', 'FX', 'AI']),
  GEO: new Set(['AI']),
  SEISMIC: new Set(['SEISMIC']),
  MARKETS: new Set(['FX', 'CRYPTO', 'DEFI', 'EVENT']),
}
export const keepItem = (filter, item) => filter === 'ALL' || (filter === 'LIVE' ? item.live : TAGS_FOR[filter]?.has(item.tag))

