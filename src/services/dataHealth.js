// Feed freshness and the official-statistics check, read from the caches the
// services themselves write. One source for Settings → Data Sources (the full
// panel) and the Dashboard's one-line status, so the two never disagree.

import { licenceOff } from '../data/sourceLicence.js'

// [label, localStorage key, timestamp field, expected refresh in minutes,
// licence id when the source can be switched off]
export const FEEDS = [
  ['FX rates', 'maddex_live_fx_rates', 'timestamp', 60],
  ['Crypto', 'maddex_live_crypto_prices', 'timestamp', 30],
  ['Fear & Greed', 'maddex_live_fear_greed', 'timestamp', 24 * 60],
  ['Gold', 'maddex_live_gold_price', 'timestamp', 60],
  ['DeFi TVL', 'maddex_defi_protocols_25', 'at', 120, 'defillama'],
  ['BTC mempool', 'maddex_defi_btc_onchain_v2', 'at', 60],
  ['Earthquakes', 'maddex_live_earthquakes_4.5', 'timestamp', 180],
]

const readLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') } catch { return null } }

// A feed is fresh within three of its refresh intervals; one that has never
// loaded on this device is neither fresh nor stale. Sources switched off for
// licensing are left out: they never load, and are not a fault.
export function feedHealth({ now = Date.now(), read = readLocal } = {}) {
  return FEEDS.filter(([, , , , licence]) => !licence || !licenceOff(licence)).map(([label, key, field, freshMins]) => {
    const at = read(key)?.[field] ?? null
    return { label, at, fresh: at != null && now - at < freshMins * 60_000 * 3 }
  })
}

// → { fresh, stale: [labels], notLoaded, stats: { match, drift, unavailable, at } | null, ok }
export function healthSummary(feeds, check) {
  const loaded = feeds.filter((f) => f.at != null)
  const stale = loaded.filter((f) => !f.fresh).map((f) => f.label)
  const rows = check?.rows ?? []
  const stats = rows.length ? {
    match: rows.filter((r) => r.status === 'match').length,
    drift: rows.filter((r) => r.status === 'drift').length,
    unavailable: rows.filter((r) => r.status !== 'match' && r.status !== 'drift').length,
    total: rows.length,
    at: check.fetchedAt ?? null,
  } : null
  return { fresh: loaded.length - stale.length, stale, notLoaded: feeds.length - loaded.length, stats, ok: !stale.length && !(stats?.drift) }
}

// The feeds the Overview shows, read from React Query's cache: what the
// panels are actually displaying, rather than the older per-service caches
// above (which the unified data paths no longer write). A feed is fresh when
// its last fetch succeeded and was not a cached fallback copy.
export const SCREEN_FEEDS = [
  ['Indices', ['yfBatch', 'indices']],
  ['FX (ECB)', ['fxRates']],
  ['Crypto', ['cryptoMarkets', 'aud']],
  ['Calendar', ['econCalendar']],
  ['News', ['news']],
]

// queries: [{ label, state }] where state is a React Query state or undefined
export function queryHealth(queries) {
  return queries.map(({ label, state }) => {
    const at = state?.dataUpdatedAt || null
    const d = state?.data
    const fallback = d?.stale === true || d?.source === 'fallback' || d?.source === 'stale'
    return { label, at, fresh: at != null && state.status !== 'error' && !fallback }
  })
}
