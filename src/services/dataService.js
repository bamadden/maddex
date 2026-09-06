// Unified data-fetching layer — wraps the per-source functions in api.js
// with a consistent primary → fallback → stale-cache strategy so the UI
// never has to show a blank panel or a bare "RETRY" button when *any* data
// (even old) is available.
//
// Every exported function here resolves to the same shape:
//   { data, stale, source, cachedAt }
//   - source: 'primary' | 'fallback' | 'cache'
//   - stale:  true only when `source === 'cache'` (served from localStorage
//             because both primary and fallback failed this time)
//   - cachedAt: ms epoch of when that cached copy was captured (only set
//             when stale)
//
// Callers that just want the payload can do `const { data } = await
// fetchEquityQuotes([...])`; callers that want to show a "DELAYED" badge
// check `.stale`.

import axios from 'axios'
import {
  fetchBatch, fetchYFBatch, fetchFxRates, fetchCryptoMarkets,
} from './api'
import { warnIfBareASX } from '../utils/tickerGuard'

const CACHE_PREFIX = 'maddex_ds_'
const DEFAULT_TIMEOUT_MS = 8000

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // storage full/unavailable — caching is best-effort, not required
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}

// The core strategy: primary → fallback → last-known-cached value (flagged
// stale) → only throws if there has NEVER been a successful fetch for this
// key (i.e. there's genuinely nothing at all to show).
async function withFallback({ cacheKey, primary, fallback, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  try {
    const data = await withTimeout(primary(), timeoutMs, `${cacheKey} (primary)`)
    writeCache(cacheKey, data)
    return { data, stale: false, source: 'primary' }
  } catch (primaryErr) {
    console.warn(`[dataService] primary failed for "${cacheKey}":`, primaryErr.message)

    if (fallback) {
      try {
        const data = await withTimeout(fallback(), timeoutMs, `${cacheKey} (fallback)`)
        writeCache(cacheKey, data)
        return { data, stale: false, source: 'fallback' }
      } catch (fallbackErr) {
        console.warn(`[dataService] fallback failed for "${cacheKey}":`, fallbackErr.message)
      }
    }

    const cached = readCache(cacheKey)
    if (cached) {
      console.warn(`[dataService] serving stale cache for "${cacheKey}" from`, new Date(cached.ts).toISOString())
      return { data: cached.data, stale: true, source: 'cache', cachedAt: cached.ts }
    }

    throw primaryErr
  }
}

// ─── Equities (ASX + US) — Financial Modeling Prep, direct from browser ──────
// No secondary fallback provider is wired in, so a primary failure falls
// straight through to the stale-cache safety net.
export async function fetchEquityQuotes(symbols) {
  if (!symbols?.length) return { data: {}, stale: false, source: 'primary' }

  // Every equity quote in the app comes through here, which makes it the one
  // place worth checking that ASX names carry their .AX suffix. Without it the
  // vendor returns the US listing at a USD price and says nothing — see
  // utils/tickerGuard.js. Dev-only, and a warning rather than a throw, because
  // a few of these codes are genuine US tickers too.
  warnIfBareASX(symbols, 'fetchEquityQuotes')

  const cacheKey = `equities:${[...symbols].sort().join(',')}`
  return withFallback({
    cacheKey,
    primary: () => fetchBatch(symbols),
  })
}

// ─── Indices — Financial Modeling Prep, direct from browser ──────────────────
// fetchYFBatch already has its own internal localStorage fallback (see
// fetchIndexQuotes in api.js) — it can silently resolve with per-quote
// `fallback: true` markers even when the live request 429s, which means it
// "succeeds" from withFallback's point of view and never reaches our own
// stale-cache path. Check for those markers explicitly so the UI still shows
// an honest DELAYED badge instead of silently passing off old data as live.
export async function fetchIndexQuotesUnified(symbols) {
  if (!symbols?.length) return { data: {}, stale: false, source: 'primary' }
  const cacheKey = `indices:${[...symbols].sort().join(',')}`
  const result = await withFallback({
    cacheKey,
    primary: () => fetchYFBatch(symbols),
  })
  if (!result.stale && result.data && Object.values(result.data).some(q => q?.fallback)) {
    return { ...result, stale: true, source: 'inner-fallback' }
  }
  return result
}

// ─── Crypto — CoinGecko primary, Binance fallback ────────────────────────────

const BINANCE_BASE = 'https://api.binance.com/api/v3'

// CoinGecko coin id -> Binance USDT pair, for the coins this app tracks.
const BINANCE_SYMBOL_MAP = {
  bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', ripple: 'XRPUSDT', solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT', cardano: 'ADAUSDT', dogecoin: 'DOGEUSDT',
  'avalanche-2': 'AVAXUSDT', polkadot: 'DOTUSDT', 'matic-network': 'MATICUSDT',
  chainlink: 'LINKUSDT', litecoin: 'LTCUSDT',
}

// Binance has no AUD pairs for most of these, so the fallback is priced in
// USD — tagged `currency: 'USD'` (rather than silently mislabelling it AUD)
// so a consumer can convert or display it honestly.
async function fetchBinanceMarkets() {
  const symbols = Object.values(BINANCE_SYMBOL_MAP)
  const { data } = await axios.get(`${BINANCE_BASE}/ticker/24hr`, {
    params: { symbols: JSON.stringify(symbols) },
    timeout: DEFAULT_TIMEOUT_MS,
  })
  const bySymbol = Object.fromEntries((data ?? []).map(d => [d.symbol, d]))
  return Object.entries(BINANCE_SYMBOL_MAP).map(([id, sym]) => {
    const t = bySymbol[sym]
    if (!t) return null
    return {
      id,
      symbol: sym.replace('USDT', '').toLowerCase(),
      name: id,
      currency: 'USD',
      current_price: parseFloat(t.lastPrice),
      price_change_percentage_24h: parseFloat(t.priceChangePercent),
      total_volume: parseFloat(t.quoteVolume),
      high_24h: parseFloat(t.highPrice),
      low_24h: parseFloat(t.lowPrice),
      market_cap: null,
      sparkline_in_7d: null,
    }
  }).filter(Boolean)
}

export async function fetchCryptoMarketsUnified(currency = 'aud') {
  const cacheKey = `crypto:${currency}`
  return withFallback({
    cacheKey,
    primary: () => fetchCryptoMarkets(currency).then(r => r.data),
    fallback: fetchBinanceMarkets,
  })
}

// ─── FX rates — Frankfurter primary (already has its own proxy + direct
// fallback baked in — see fetchFxRates in api.js); this adds the final
// stale-cache safety net for total failure ───────────────────────────────────
export async function fetchFxRatesUnified(base = 'AUD') {
  const cacheKey = `fx:${base}`
  return withFallback({
    cacheKey,
    primary: () => fetchFxRates(base),
  })
}
