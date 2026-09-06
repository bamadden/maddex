import axios from 'axios'
import { getMockFMPRow, getMockFMPHistory } from './mockData'

// ─── Internal cache ───────────────────────────────────────────────────────────

const _cache = new Map()
const setCache = (k, v, ttlMs) => _cache.set(k, { v, exp: Date.now() + ttlMs })
const getCache = (k) => { const e = _cache.get(k); return (e && Date.now() < e.exp) ? e.v : null }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Stooq (via Vite proxy → /api/stooq → stooq.com) ─────────────────────────
// Free financial data — no API key, no rate limits, CSV format.
// Quote endpoint: /q/l/?s={sym}&f=sd2t2ohlcv&h&e=csv
// History endpoint: /q/d/l/?s={sym}&d1={YYYYMMDD}&d2={YYYYMMDD}&i=d

const STOOQ_BASE = '/api/stooq'

// ─── Financial Modeling Prep — equities + indices (replaces Yahoo Finance) ───
// CORS-enabled, called directly from the browser — no proxy needed.
// The 'demo' fallback key is a placeholder only: FMP retired demo-key access
// (confirmed directly — every /quote/ call returns "Invalid API KEY" even for
// AAPL), so live data requires a real free key in VITE_FMP_API_KEY (sign up
// at financialmodelingprep.com, no card required, 250 req/day). Every
// function below degrades to the app's existing stale-cache/DATA UNAVAILABLE
// handling when the key is invalid — nothing crashes, it just shows no data
// until a real key is set.
const FMP_BASE = 'https://financialmodelingprep.com/api/v3'
const FMP_KEY  = import.meta.env.VITE_FMP_API_KEY || 'demo'

// No working equities key configured yet — Yahoo (IP rate-limited), FMP, and
// Twelve Data were all tried this session; FMP/TD both gate ASX symbols and
// batch quotes behind a paid plan even with a real key. Until a Polygon.io
// key (or another vendor that actually covers ASX) lands, every quote/
// history call below is served from src/services/mockData.js instead of
// hitting the network — clearly flagged to the user via the DEMO badge
// (USING_MOCK_DATA, read by ModuleStates.jsx's <DemoBadge/>). The instant a
// real key is added to any of these env vars, this flips to live data with
// no other code changes needed.
const HAS_LIVE_DATA_KEY = !!(
  import.meta.env.VITE_POLYGON_KEY ||
  import.meta.env.VITE_TD_API_KEY ||
  import.meta.env.VITE_FMP_API_KEY
)
export const USING_MOCK_DATA = !HAS_LIVE_DATA_KEY

// Range→days mapping for the historical endpoint (FMP takes a day count, not
// a Yahoo-style range string like '3mo').
const RANGE_TO_DAYS = {
  '1d': 2, '5d': 8, '7d': 10, '1mo': 33, '3mo': 93, '6mo': 186, '1y': 370, '5y': 1830,
}

async function fetchFMPQuote(symbol) {
  if (!HAS_LIVE_DATA_KEY) {
    const mock = getMockFMPRow(symbol)
    if (mock) return mock
    throw new Error(`No mock data for ${symbol}`)
  }
  // A key being *configured* doesn't mean it *works* — FMP/TD both gate ASX
  // symbols and batch quotes behind a paid plan even with a real key, so a
  // "live" environment (e.g. Vercel with a key set) can still fail every
  // request. Fall back to mock instead of surfacing that as DATA
  // UNAVAILABLE — the DEMO badge won't show in this specific path (it only
  // tracks key-presence, not live-connectivity), but the app stays usable.
  try {
    const r = await fetch(
      `${FMP_BASE}/quote/${encodeURIComponent(symbol)}?apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) throw new Error(`FMP ${r.status}`)
    const data = await r.json()
    if (!data?.[0]) throw new Error('No FMP data')
    const q = data[0]
    return {
      symbol: q.symbol,
      shortName: q.name,
      regularMarketPrice: q.price,
      regularMarketChange: q.change,
      regularMarketChangePercent: q.changesPercentage,
      regularMarketPreviousClose: q.previousClose,
      regularMarketOpen: q.open,
      regularMarketDayHigh: q.dayHigh,
      regularMarketDayLow: q.dayLow,
      regularMarketVolume: q.volume,
      averageVolume: q.avgVolume,
      marketCap: q.marketCap,
      trailingPE: q.pe,
      epsTrailingTwelveMonths: q.eps,
      fiftyTwoWeekHigh: q.yearHigh,
      fiftyTwoWeekLow: q.yearLow,
      sharesOutstanding: q.sharesOutstanding,
      exchange: q.exchange,
      priceAvg50: q.priceAvg50,
      priceAvg200: q.priceAvg200,
      currency: symbol.endsWith('.AX') ? 'AUD' : 'USD',
    }
  } catch (e) {
    const mock = getMockFMPRow(symbol)
    if (mock) return mock
    throw e
  }
}

async function fetchFMPBatch(symbols) {
  if (!symbols?.length) return []
  if (!HAS_LIVE_DATA_KEY) {
    return symbols.map(getMockFMPRow).filter(Boolean)
  }
  try {
    const joined = symbols.map(s => encodeURIComponent(s)).join(',')
    const r = await fetch(
      `${FMP_BASE}/quote/${joined}?apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!r.ok) throw new Error(`FMP batch ${r.status}`)
    const data = await r.json()
    if (!data?.length) throw new Error('Empty FMP batch response')
    return data.map(q => ({
      symbol: q.symbol,
      shortName: q.name,
      regularMarketPrice: q.price,
      regularMarketChange: q.change,
      regularMarketChangePercent: q.changesPercentage,
      regularMarketPreviousClose: q.previousClose,
      regularMarketOpen: q.open,
      regularMarketDayHigh: q.dayHigh,
      regularMarketDayLow: q.dayLow,
      regularMarketVolume: q.volume,
      averageVolume: q.avgVolume,
      marketCap: q.marketCap,
      trailingPE: q.pe,
      epsTrailingTwelveMonths: q.eps,
      fiftyTwoWeekHigh: q.yearHigh,
      fiftyTwoWeekLow: q.yearLow,
      sharesOutstanding: q.sharesOutstanding,
      exchange: q.exchange,
      priceAvg50: q.priceAvg50,
      priceAvg200: q.priceAvg200,
      currency: q.symbol.endsWith('.AX') ? 'AUD' : 'USD',
    }))
  } catch (e) {
    const mockRows = symbols.map(getMockFMPRow).filter(Boolean)
    if (mockRows.length) return mockRows
    throw e
  }
}

async function fetchFMPHistory(symbol, days = 93) {
  if (!HAS_LIVE_DATA_KEY) {
    return getMockFMPHistory(symbol, days)
  }
  try {
    const r = await fetch(
      `${FMP_BASE}/historical-price-full/${encodeURIComponent(symbol)}?timeseries=${days}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!r.ok) throw new Error(`FMP history ${r.status}`)
    const data = await r.json()
    const hist = data.historical || []
    if (!hist.length) throw new Error('Empty FMP history response')
    return hist.slice().reverse().map(d => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }))
  } catch (e) {
    const mockHist = getMockFMPHistory(symbol, days)
    if (mockHist.length) return mockHist
    throw e
  }
}

// Map Yahoo Finance symbol keys → Stooq symbol format
const YF_TO_STOOQ = {
  '^AXJO': '^axjo', '^GSPC': '^spx',  '^IXIC': '^ndx',  '^DJI':   '^dji',
  '^FTSE': '^ukx',  '^GDAXI': '^dax', '^N225': '^nkx',  '^HSI':   '^hsi',
  '^NZ50': '^nz50',
}

function yfToStooq(sym) {
  if (YF_TO_STOOQ[sym]) return YF_TO_STOOQ[sym]
  const s = sym.toUpperCase()
  if (s.endsWith('.AX')) return s.slice(0, -3).toLowerCase() + '.au'
  if (s.endsWith('.AU') || s.endsWith('.US')) return sym.toLowerCase()
  if (sym.startsWith('^')) return sym.toLowerCase()
  return sym.toLowerCase() + '.us'
}

// ─── Individual stock quotes and history (FMP-backed) ─────────────────────────
// Single source of truth for all equity data (non-index).
// Pass symbols in Yahoo-style format: BHP.AX (ASX), AAPL (US) — FMP accepts
// the same symbol format, so no translation layer was needed.
// Prices returned in native currency: AUD for .AX, USD for US stocks.
// Apply toAUD() at display time — never during fetch.

// ASX/US tracked-stock lists — shared by TopMovers and MarketSentimentBanner
// (same lists + queryKey so both consume one cached fetch).
export const ASX_STOCKS = [
  'BHP.AX','CBA.AX','CSL.AX','WOW.AX','ANZ.AX','NAB.AX','WBC.AX','MQG.AX','RIO.AX','TLS.AX',
  'FMG.AX','WES.AX','GMG.AX','REA.AX','MIN.AX','NEM.AX','STO.AX','WDS.AX','AGL.AX','ALL.AX',
]
export const US_STOCKS = [
  'AAPL','NVDA','MSFT','TSLA','AMZN','META','GOOG','NFLX','AMD','INTC',
  'JPM','BAC','GS','MS','V','MA','UNH','JNJ','XOM','CVX',
]

// fetchBatch: one FMP batch call gets price + fundamentals together (unlike
// Yahoo, which needed a v8 chart call per symbol plus a separate v7 batch
// enrichment call) — much simpler than the old two-phase implementation.
// Output shape is unchanged from the Yahoo-backed version so every existing
// caller (TopMovers, dataService.fetchEquityQuotes, etc.) needs no changes.
export async function fetchBatch(symbols) {
  if (!symbols?.length) return {}
  let rows
  try {
    rows = await fetchFMPBatch(symbols)
  } catch (e) {
    console.error('[MADDEN API] fetchBatch (FMP) failed:', e.message)
    throw new Error('All quotes unavailable', { cause: e })
  }
  const out = {}
  for (const q of rows) {
    if (q.regularMarketPrice == null) continue
    out[q.symbol] = fmpQuoteToLegacyShape(q)
  }
  if (symbols.length > 0 && Object.keys(out).length === 0) {
    throw new Error('All quotes unavailable')
  }
  console.log(`[MADDEN API] ✓ FMP batch: ${Object.keys(out).length}/${symbols.length} symbols`)
  return out
}

// Reshapes an fetchFMPQuote/fetchFMPBatch row into the exact object shape
// fetchYahooQuote used to return, so every field existing components read
// (price, last, pct, change, dayChangePct, marketCap, trailingPE, etc.)
// keeps working unchanged.
function fmpQuoteToLegacyShape(q) {
  const price = q.regularMarketPrice
  const prevClose = q.regularMarketPreviousClose
  const dayChange = q.regularMarketChange ?? (prevClose != null ? price - prevClose : null)
  const dayChangePct = q.regularMarketChangePercent ?? (prevClose ? ((price - prevClose) / prevClose) * 100 : null)
  return {
    symbol: q.symbol,
    price,
    prevClose,
    open: q.regularMarketOpen,
    high: q.regularMarketDayHigh,
    low: q.regularMarketDayLow,
    volume: q.regularMarketVolume,
    avgVolume: q.averageVolume,
    currency: q.currency,
    exchange: q.exchange,
    week52High: q.fiftyTwoWeekHigh,
    week52Low: q.fiftyTwoWeekLow,
    dayChange,
    dayChangePct,
    marketCap: q.marketCap,
    trailingPE: q.trailingPE,
    epsTrailing: q.epsTrailingTwelveMonths,
    sharesOutstanding: q.sharesOutstanding,
    ma50: q.priceAvg50,
    ma200: q.priceAvg200,
    name: q.shortName ?? q.symbol,
    lastUpdated: new Date().toISOString(),
    isOpen: null, // FMP's basic quote doesn't carry market-open state
    // Backward-compat aliases used by existing components
    last: price,
    pct: dayChangePct,
    change: dayChange,
    vol: q.regularMarketVolume,
    timestamp: new Date().toISOString().slice(0, 10),
    fallback: false,
  }
}

// ─── FMP quote — batched fundamentals ─────────────────────────────────────────
// Kept as its own export (used as a DetailModal enrichment fallback, same
// role fetchYahooQuoteBatch used to play) — one FMP call, keyed by symbol.
export async function fetchYahooQuoteBatch(symbols) {
  if (!symbols?.length) return {}
  const cacheKey = `fmp-quote-batch:${symbols.slice().sort().join(',')}`
  const cached = getCache(cacheKey)
  if (cached) return cached
  try {
    const rows = await fetchFMPBatch(symbols)
    const out = {}
    for (const q of rows) out[q.symbol] = fmpQuoteToLegacyShape(q)
    console.log(`[MADDEN API] ✓ FMP quote batch (enrichment): ${Object.keys(out).length}/${symbols.length} symbols`)
    setCache(cacheKey, out, 5 * 60_000)
    return out
  } catch (e) {
    console.error('[MADDEN API] fetchYahooQuoteBatch (FMP) failed:', e.message)
    return {}
  }
}

export async function fetchYahooQuote(symbol) {
  try {
    const cacheKey = `fmp-quote:${symbol}`
    const cached = getCache(cacheKey)
    if (cached) return cached
    const q = fmpQuoteToLegacyShape(await fetchFMPQuote(symbol))
    if (q.price == null || q.prevClose == null) throw new Error('No price data')
    console.log(`[MADDEN API] ✓ FMP ${symbol}: ${q.price} ${q.currency} (${q.dayChangePct >= 0 ? '+' : ''}${q.dayChangePct?.toFixed(2)}%)`)
    setCache(cacheKey, q, 60_000)
    return q
  } catch (e) {
    console.error(`[MADDEN API] fetchYahooQuote (FMP) failed for ${symbol}:`, e.message)
    // No hardcoded fallback — callers must treat null as DATA UNAVAILABLE and offer retry.
    return null
  }
}

export async function fetchYahooHistory(symbol, range = '3mo', interval = '1d') {
  try {
    const cacheKey = `fmp-history:${symbol}:${range}:${interval}`
    const cached = getCache(cacheKey)
    if (cached) return cached
    const days = RANGE_TO_DAYS[range] ?? 93
    const rows = await fetchFMPHistory(symbol, days)
    const chartData = rows.map((d) => {
      if (d.close == null || isNaN(d.close) || d.close <= 0) return null
      const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
      return {
        date: label,
        rawDate: d.date,
        close: parseFloat(d.close.toFixed(4)),
        price: parseFloat(d.close.toFixed(4)), // backward compat
        open: d.open != null ? parseFloat(d.open.toFixed(4)) : d.close,
        high: d.high != null ? parseFloat(d.high.toFixed(4)) : d.close,
        low: d.low != null ? parseFloat(d.low.toFixed(4)) : d.close,
        volume: d.volume ?? 0,
        currency: symbol.endsWith('.AX') ? 'AUD' : 'USD',
      }
    }).filter(Boolean).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    console.log(`[MADDEN API] ✓ FMP history ${symbol} ${range}: ${chartData.length} pts, ${chartData[0]?.date} → ${chartData[chartData.length - 1]?.date}`)
    setCache(cacheKey, chartData, 5 * 60_000)
    return chartData
  } catch (e) {
    console.error(`[MADDEN API] fetchYahooHistory (FMP) failed for ${symbol}:`, e.message)
    return []
  }
}

// Currency conversion — apply at display time, never at fetch time
export function toAUD(price, currency, audUsdRate) {
  if (price == null || isNaN(price)) return null
  if (currency === 'AUD') return price
  if (currency === 'USD' && audUsdRate > 0) return price / audUsdRate
  return price
}

// Convenience batch — used by WatchlistModule, PortfolioModule etc.
export async function fetchYahooBatch(symbols) {
  const results = await Promise.all(symbols.map(fetchYahooQuote))
  const out = {}
  symbols.forEach((sym, i) => { if (results[i]) out[sym] = results[i] })
  // Every symbol failed — throw so the query flips to isError and the UI
  // shows DATA UNAVAILABLE + retry instead of silently rendering "No data".
  if (symbols.length > 0 && Object.keys(out).length === 0) {
    throw new Error('All quotes unavailable')
  }
  return out
}

// ─── FMP quote — full fundamental data (was Yahoo quoteSummary) ───────────────
// FMP's basic /quote/ endpoint doesn't carry the deeper fields Yahoo's
// quoteSummary did (sector, industry, description, employees, ROE/ROA, debt
// ratios, analyst targets, etc.) — those come back null and DetailModal's
// existing pick() helper already renders '—' for any null field, so nothing
// breaks, it's just a less rich detail view until those fields are sourced
// from a separate endpoint.
export async function fetchQuoteSummary(symbol) {
  const cacheKey = `fmp-summary:${symbol}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  const q = await fetchFMPQuote(symbol)
  const price = q.regularMarketPrice
  const prevClose = q.regularMarketPreviousClose

  const qs = {
    // Price
    price,
    prevClose,
    change:      q.regularMarketChange,
    changePct:   q.regularMarketChangePercent ?? (price && prevClose ? ((price - prevClose) / prevClose) * 100 : null),
    volume:      q.regularMarketVolume,
    dayHigh:     q.regularMarketDayHigh,
    dayLow:      q.regularMarketDayLow,
    open:        q.regularMarketOpen,
    marketCap:   q.marketCap,
    currency:    q.currency ?? null,
    exchange:    q.exchange ?? null,
    name:        q.shortName ?? null,
    quoteType:   null,
    // Summary Detail
    trailingPE:   q.trailingPE,
    forwardPE:    null,
    divYield:     null,
    payoutRatio:  null,
    beta:         null,
    week52High:   q.fiftyTwoWeekHigh,
    week52Low:    q.fiftyTwoWeekLow,
    ma50:         q.priceAvg50,
    ma200:        q.priceAvg200,
    avgVolume:    q.averageVolume,
    avgVolume10d: null,
    ps:           null,
    // Key Statistics
    enterpriseValue:   null,
    profitMargins:     null,
    sharesOutstanding: q.sharesOutstanding,
    sharesShort:       null,
    shortRatio:        null,
    shortPctFloat:     null,
    bookValue:         null,
    pb:                null,
    netIncome:         null,
    epsTrailing:       q.epsTrailingTwelveMonths,
    epsForward:        null,
    peg:               null,
    evRevenue:         null,
    evEbitda:          null,
    week52Change:      null,
    lastDividend:      null,
    lastDividendDate:  null,
    // Financial Data
    revenue:          null,
    revenuePerShare:  null,
    roa:              null,
    roe:              null,
    grossProfit:      null,
    freeCashflow:     null,
    operatingCF:      null,
    earningsGrowth:   null,
    revenueGrowth:    null,
    grossMargins:     null,
    ebitdaMargins:    null,
    operatingMargins: null,
    totalDebt:        null,
    totalCash:        null,
    debtToEquity:     null,
    currentRatio:     null,
    targetHigh:       null,
    targetLow:        null,
    targetMean:       null,
    recMean:          null,
    recKey:           null,
    analystCount:     null,
    // Profile — not available from FMP's basic /quote/ endpoint
    sector:      null,
    industry:    null,
    description: null,
    employees:   null,
    website:     null,
    city:        null,
    country:     null,
  }

  console.log(`[MADDEN API] ✓ FMP summary ${symbol}: PE=${qs.trailingPE?.toFixed?.(1)}, cap=${qs.marketCap ? (qs.marketCap/1e9).toFixed(0)+'B' : '—'}`)
  setCache(cacheKey, qs, 5 * 60_000)
  return qs
}

// ─── Stooq — indices only ─────────────────────────────────────────────────────

function parseStooqQuoteCsv(text, requestedSym) {
  const lines   = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error(`Stooq: empty response for ${requestedSym}`)
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  const vals    = lines[1].split(',').map(v => v.trim())
  const row     = {}
  headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
  const close  = parseFloat(row.close)
  const open   = parseFloat(row.open)
  const high   = parseFloat(row.high)
  const low    = parseFloat(row.low)
  const vol    = parseInt(row.volume ?? '0', 10) || 0
  if (!isFinite(close) || close <= 0 || row.close === 'N/D') throw new Error(`Stooq: N/D for ${requestedSym}`)
  const safeOpen = isFinite(open) && open > 0 ? open : close
  const change   = safeOpen > 0 ? close - safeOpen : 0
  const pct      = safeOpen > 0 ? (change / safeOpen) * 100 : 0
  const displayName = requestedSym.replace(/\.(us|au)$/i, '').replace(/^\^/, '').toUpperCase()
  return {
    symbol:     requestedSym,
    name:       displayName,
    last:       close,
    open:       safeOpen,
    high:       isFinite(high) && high > 0 ? high : close,
    low:        isFinite(low)  && low  > 0 ? low  : close,
    vol,
    change,
    pct,
    prevClose:  safeOpen,
    week52High: null,
    week52Low:  null,
    isLive:     true,
    isOpen:     false,
    timestamp:  row.date ?? null,
    exchange:   null,
    currency:   null,
    fallback:   false,
  }
}

// Not called anywhere currently — Stooq's CSV quote endpoint started 404ing
// (see fetchIndexQuotes above, which replaced it for indices). Kept, and
// exported, in case Stooq is usable again or needed for a different symbol
// type later.
export async function fetchStooqQuote(stooqSym) {
  const url = `${STOOQ_BASE}/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=csv`
  const cached = getCache(url)
  if (cached) return cached
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!r.ok) throw new Error(`Stooq HTTP ${r.status}`)
    const text = await r.text()
    const data = parseStooqQuoteCsv(text, stooqSym)
    console.log(`[MADDEN API] ✓ Stooq ${stooqSym}: ${data.last}`)
    setCache(url, data, 60_000)
    return data
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// ─── Index quotes — FMP batch quote ───────────────────────────────────────────
// Index quotes now go through the same FMP /quote/ batch endpoint as stocks —
// FMP accepts index symbols in Yahoo's own ^SYM / NNNNNN.SS format (^AXJO,
// ^GSPC, 000001.SS, etc.), so YF_INDICES needs no symbol translation. Cached
// for 2 minutes (shorter than the 5-minute stock-fundamentals cache) since
// index levels move continuously during trading hours.
const INDEX_QUOTE_CACHE_MS = 2 * 60_000

// Last-known-good index quotes, persisted across page loads and outages — a
// localStorage-backed fallback means a real prior quote (marked stale via its
// own timestamp) shows instead of a dead "RETRY" button when FMP is down or
// rate-limited.
const INDEX_FALLBACK_KEY = 'maddex_index_quote_fallback'

function readIndexFallback() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_FALLBACK_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeIndexFallback(out) {
  try {
    const existing = readIndexFallback()
    localStorage.setItem(INDEX_FALLBACK_KEY, JSON.stringify({ ...existing, ...out }))
  } catch {
    // storage unavailable/full — fallback caching is best-effort, not required
  }
}

export async function fetchIndexQuotes(symbols) {
  if (!symbols?.length) return {}
  const cacheKey = `index:fmp:${symbols.slice().sort().join(',')}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const rows = await fetchFMPBatch(symbols)
    const out = {}
    for (const q of rows) {
      if (!q?.symbol || q.regularMarketPrice == null) continue
      const price = q.regularMarketPrice
      const change = q.regularMarketChange ?? null
      const pct = q.regularMarketChangePercent ?? null
      out[q.symbol] = {
        symbol:      q.symbol,
        last:        price,
        price,
        change,
        pct,
        dayChange:    change,
        dayChangePct: pct,
        currency:    q.currency ?? null,
        exchange:    q.exchange ?? null,
        name:        q.shortName ?? q.symbol,
        isOpen:      null, // FMP's basic quote doesn't carry market-open state
        timestamp:   new Date().toISOString().slice(0, 10),
        fallback:    false,
      }
    }
    if (Object.keys(out).length === 0) throw new Error('Empty quote response')
    console.log(`[MADDEN API] ✓ FMP index quotes: ${Object.keys(out).length}/${symbols.length} symbols`)
    setCache(cacheKey, out, INDEX_QUOTE_CACHE_MS)
    writeIndexFallback(out)
    return out
  } catch (e) {
    const fallback = readIndexFallback()
    const out = {}
    for (const sym of symbols) {
      if (fallback[sym]) out[sym] = { ...fallback[sym], fallback: true }
    }
    if (Object.keys(out).length === 0) throw e
    console.warn(`[MADDEN API] FMP index quotes failed (${e.message}) — using cached fallback for ${Object.keys(out).length}/${symbols.length} symbols`)
    return out
  }
}

// fetchYFQuote: single index or stock quote — FMP for both.
// No hardcoded fallback — on total failure, throw so callers show DATA UNAVAILABLE.
export const fetchYFQuote = async (symbol) => {
  if (symbol.startsWith('^') || /^\d+\.SS$/.test(symbol)) {
    const out = await fetchIndexQuotes([symbol])
    const data = out[symbol]
    if (data) return data
    throw new Error(`No data for ${symbol}`)
  }
  const q = await fetchYahooQuote(symbol)
  if (q) return q
  throw new Error(`No data for ${symbol}`)
}

// fetchYFBatch: INDICES via FMP batch quote — used by IndicesTable,
// TickerTape, MarketSentimentBanner, MaddexGlobe (all index-symbol-only callers).
// Symbols that fail are simply omitted — no fake data — so consumers render
// their own "unavailable" state for the missing key.
export const fetchYFBatch = async (symbols) => {
  const out = await fetchIndexQuotes(symbols)
  for (const sym of symbols) {
    if (!out[sym]) console.error(`[MADDEN API] Index fetch failed: ${sym}`)
  }
  if (Object.keys(out).length === 0) throw new Error('All index quotes unavailable')
  return out
}

function parseStooqHistoryCsv(text) {
  const lines   = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers  = lines[0].toLowerCase().split(',').map(h => h.trim())
  const dateIdx  = headers.indexOf('date')
  const openIdx  = headers.indexOf('open')
  const highIdx  = headers.indexOf('high')
  const lowIdx   = headers.indexOf('low')
  const closeIdx = headers.indexOf('close')
  const volIdx   = headers.indexOf('volume')
  if (dateIdx < 0 || closeIdx < 0) return []
  return lines.slice(1).map(line => {
    const v      = line.split(',').map(c => c.trim())
    const close  = parseFloat(v[closeIdx])
    if (!isFinite(close) || close <= 0 || v[closeIdx] === 'N/D') return null
    const open   = openIdx  >= 0 ? parseFloat(v[openIdx])  : close
    const high   = highIdx  >= 0 ? parseFloat(v[highIdx])  : close
    const low    = lowIdx   >= 0 ? parseFloat(v[lowIdx])   : close
    const vol    = volIdx   >= 0 ? parseInt(v[volIdx], 10) : 0
    const rawDate = v[dateIdx]
    const date   = new Date(rawDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
    return {
      date,
      price:  parseFloat(close.toFixed(4)),
      close:  parseFloat(close.toFixed(4)),
      open:   isFinite(open) ? parseFloat(open.toFixed(4))  : close,
      high:   isFinite(high) ? parseFloat(high.toFixed(4))  : close,
      low:    isFinite(low)  ? parseFloat(low.toFixed(4))   : close,
      volume: isFinite(vol)  ? vol : 0,
    }
  }).filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date))
}

function rangeToStooqDates(range) {
  const days = { '1d': 3, '5d': 8, '1mo': 33, '3mo': 93, '6mo': 186, '1y': 367, '5y': 1830 }
  const n    = days[range] ?? 93
  const d2   = new Date()
  const d1   = new Date(Date.now() - n * 86400000)
  const fmt  = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return { d1: fmt(d1), d2: fmt(d2) }
}

// Not called anywhere currently — see fetchStooqQuote above for why.
export async function fetchStooqHistory(symbol, { range = '3mo' } = {}) {
  const stooqSym    = yfToStooq(symbol)
  const { d1, d2 } = rangeToStooqDates(range)
  const url = `${STOOQ_BASE}/q/d/l/?s=${encodeURIComponent(stooqSym)}&d1=${d1}&d2=${d2}&i=d`
  const cached = getCache(url)
  if (cached) return cached
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!r.ok) throw new Error(`Stooq history HTTP ${r.status}`)
    const text = await r.text()
    const data = parseStooqHistoryCsv(text)
    if (data.length === 0) throw new Error(`Stooq: no history for ${stooqSym}`)
    console.log(`[MADDEN API] ✓ Stooq history ${stooqSym} ${range}:`, data.length, 'points')
    setCache(url, data, 5 * 60_000)
    return data
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// fetchYFHistory: indices and stocks both via FMP's historical-price-full
// endpoint, which handles index symbols (^AXJO, 000001.SS, etc.) the same way
// it handles stock tickers, so no symbol translation is needed.
export const fetchYFHistory = async (symbol, { range = '3mo', interval = '1d' } = {}) => {
  return fetchYahooHistory(symbol, range, interval)
}

// transformYFHistory is now a passthrough — fetchYFHistory returns pre-parsed data
export const transformYFHistory = (data) => (Array.isArray(data) ? data : [])

// Timeframe → range string (kept for backwards compat with DetailModal)
export const toYFRange = (timeframe) => {
  const map = {
    '1D': { range: '1d',  interval: '1d' },
    '5D': { range: '5d',  interval: '1d' },
    '1M': { range: '1mo', interval: '1d' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1d' },
    '1Y': { range: '1y',  interval: '1d' },
    '5Y': { range: '5y',  interval: '1d' },
    // Weekly candles beyond five years — daily over a full history is tens of
    // thousands of points to draw a line nobody reads at that density.
    'ALL': { range: 'max', interval: '1wk' },
  }
  return map[timeframe] ?? { range: '3mo', interval: '1d' }
}

// Index configuration — consumers use YF-style symbol keys; stooq translation is internal
export const YF_INDICES = [
  { symbol: '^AXJO',  label: 'ASX 200',    sublabel: 'ASX · AUD', isAud: true,  primary: true  },
  { symbol: '^AORD',  label: 'All Ords',   sublabel: 'ASX · AUD', isAud: true,  primary: false },
  { symbol: '^GSPC',  label: 'S&P 500',    sublabel: 'USD · pts', isAud: false, primary: false },
  { symbol: '^IXIC',  label: 'NASDAQ',     sublabel: 'USD · pts', isAud: false, primary: false },
  { symbol: '^DJI',   label: 'Dow Jones',  sublabel: 'USD · pts', isAud: false, primary: false },
  { symbol: '^FTSE',  label: 'FTSE 100',   sublabel: 'GBP · pts', isAud: false, primary: false },
  { symbol: '^GDAXI', label: 'DAX',        sublabel: 'EUR · pts', isAud: false, primary: false },
  { symbol: '^N225',  label: 'Nikkei 225', sublabel: 'JPY · pts', isAud: false, primary: false },
  { symbol: '^HSI',   label: 'Hang Seng',  sublabel: 'HKD · pts', isAud: false, primary: false },
  { symbol: '000001.SS', label: 'Shanghai', sublabel: 'CNY · pts', isAud: false, primary: false },
  { symbol: '^NZ50',  label: 'NZX 50',     sublabel: 'NZD · pts', isAud: false, primary: false },
]

// ─── CoinGecko (unchanged — no key required) ──────────────────────────────────

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

let _lastCG = 0
const cgThrottle = async () => {
  const now  = Date.now()
  const wait = Math.max(0, _lastCG + 2100 - now)
  if (wait > 0) await sleep(wait)
  _lastCG = Date.now()
}

export const COIN_IDS = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  BNB:   'binancecoin',
  XRP:   'ripple',
  ADA:   'cardano',
  AVAX:  'avalanche-2',
  DOGE:  'dogecoin',
  DOT:   'polkadot',
  MATIC: 'matic-network',
  LINK:  'chainlink',
  LTC:   'litecoin',
}

export const fetchCryptoMarkets = async (currency = 'aud', page = 1) => {
  await cgThrottle()
  const { data } = await axios.get(`${COINGECKO_BASE}/coins/markets`, {
    params: {
      vs_currency: currency,
      order: 'market_cap_desc',
      per_page: 20,
      page,
      sparkline: true,
      price_change_percentage: '24h,7d,30d',
    },
  })
  console.log('[MADDEN API] CoinGecko /coins/markets:', data?.length, 'coins vs', currency)
  return { data, currency }
}

export const fetchTrendingCoins = async () => {
  await cgThrottle()
  const { data } = await axios.get(`${COINGECKO_BASE}/search/trending`)
  console.log('[MADDEN API] CoinGecko trending:', data?.coins?.length, 'coins')
  return data
}

export const fetchFxHistory = async (from = 'AUD', to = 'USD', days = 30) => {
  const end   = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data } = await axios.get(`/api/frankfurter/${start}..${end}?from=${from}&to=${to}`)
  console.log('[MADDEN API] Frankfurter FX history', `${from}/${to}:`, Object.keys(data?.rates ?? {}).length, 'days')
  return data
}

export const fetchCoinHistory = async (coinId, currency = 'aud', days = 90) => {
  await cgThrottle()
  const { data } = await axios.get(`${COINGECKO_BASE}/coins/${coinId}/market_chart`, {
    params: { vs_currency: currency, days },
  })
  console.log('[MADDEN API] CoinGecko /market_chart', coinId + ':', data?.prices?.length, 'points')
  return data
}

export const fetchCoinOHLC = async (coinId, days = 30, currency = 'aud') => {
  await cgThrottle()
  const { data } = await axios.get(`${COINGECKO_BASE}/coins/${coinId}/ohlc`, {
    params: { vs_currency: currency, days },
  })
  console.log('[MADDEN API] CoinGecko /ohlc', coinId + ':', data?.length, 'candles')
  return data
}

export const transformCoinOHLC = (data) => {
  if (!Array.isArray(data)) return []
  return data.map(([ts, open, high, low, close]) => ({
    date:  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    time:  Math.floor(ts / 1000), // unix seconds — for lightweight-charts consumers
    open:  parseFloat(open.toFixed(2)),
    high:  parseFloat(high.toFixed(2)),
    low:   parseFloat(low.toFixed(2)),
    close: parseFloat(close.toFixed(2)),
    price: parseFloat(close.toFixed(2)),
  }))
}

export const fetchFearGreed = async () => {
  try {
    const { data } = await axios.get('https://api.alternative.me/fng/?limit=30', { timeout: 8000 })
    console.log('[MADDEN API] Alternative.me fear/greed:', data?.data?.[0]?.value)
    return data
  } catch (e) {
    console.warn('[MADDEN API] Alternative.me fear/greed failed, using mock value 42 (Fear):', e.message)
    const now = Math.floor(Date.now() / 1000)
    return {
      data: Array.from({ length: 30 }, (_, i) => ({
        value: '42',
        value_classification: 'Fear',
        timestamp: String(now - i * 86400),
      })),
    }
  }
}

export const fetchCryptoGlobal = async () => {
  await cgThrottle()
  const { data } = await axios.get(`${COINGECKO_BASE}/global`)
  console.log('[MADDEN API] CoinGecko /global: active_coins', data?.data?.active_cryptocurrencies)
  return data?.data
}

export const transformCryptoMarkets = (items, currency = 'aud') =>
  items.map((c, i) => ({
    // Position in the already market-cap-sorted response, not CoinGecko's
    // own market_cap_rank field — that field is frequently null or stale
    // for thinly-traded coins and produces duplicate/gappy ranks in the table.
    rank:      i + 1,
    symbol:    c.symbol.toUpperCase(),
    name:      c.name,
    price:     c.current_price,
    pct24h:    c.price_change_percentage_24h ?? 0,
    pct7d:     c.price_change_percentage_7d_in_currency ?? 0,
    pct30d:    c.price_change_percentage_30d_in_currency ?? null,
    marketCap: c.market_cap ?? null,
    mktCap:    formatLargeNum(c.market_cap ?? 0),
    volume:    c.total_volume ?? null,
    vol24h:    formatLargeNum(c.total_volume ?? 0),
    currency:  currency.toUpperCase(),
    ath:       c.ath ?? null,
    athPct:    c.ath_change_percentage ?? null,
    atl:       c.atl ?? null,
    atlPct:    c.atl_change_percentage ?? null,
    fdv:       c.fully_diluted_valuation ?? null,
    circulatingSupply: c.circulating_supply ?? null,
    maxSupply:         c.max_supply ?? null,
    high24h:   c.high_24h ?? null,
    low24h:    c.low_24h ?? null,
    sparkline: c.sparkline_in_7d?.price ?? null,
    image:     c.image ?? null,
  }))

export const transformCoinHistory = ({ prices }) => {
  const step = prices.length > 200 ? Math.ceil(prices.length / 90) : 1
  return prices
    .filter((_, i) => i % step === 0)
    .map(([ts, price]) => ({
      date:  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: parseFloat(price.toFixed(2)),
    }))
}

export const transformFearGreed = ({ data }) => ({
  value:    parseInt(data[0].value, 10),
  label:    data[0].value_classification,
  prev:     parseInt(data[1]?.value ?? 50, 10),
  weekAgo:  parseInt(data[7]?.value ?? 50, 10),
  monthAgo: parseInt(data[29]?.value ?? 50, 10),
})

// ─── Frankfurter FX (via proxy → /api/frankfurter, direct fallback) ──────────
// Frankfurter has CORS enabled, so a direct browser call works if the proxy
// (Vite dev middleware / Vercel rewrite) is down or misconfigured.
// api.frankfurter.app now 301-redirects to api.frankfurter.dev/v1 — calling
// the new host directly skips that extra hop (the proxy targets below still
// point at .app, which still works via the redirect, so this only matters
// for the direct-fallback path).

const FRANKFURTER_DIRECT   = 'https://api.frankfurter.dev/v1'
const FRANKFURTER_ATTEMPTS = 3
const FRANKFURTER_RETRY_MS = 2000

async function frankfurterAttempt(url, label) {
  const start = Date.now()
  try {
    const { data } = await axios.get(url, { timeout: 8000 })
    const ms = Date.now() - start
    console.log(`[MADDEN API] Frankfurter [${label}] ${url} → 200 OK (${ms}ms)`)
    return data
  } catch (e) {
    const ms     = Date.now() - start
    const status = e.response?.status ?? 'NETWORK ERROR'
    console.warn(`[MADDEN API] Frankfurter [${label}] ${url} → ${status} (${ms}ms) — ${e.message}`)
    throw e
  }
}

export const fetchFxRates = async (base = 'AUD') => {
  const proxyUrl  = `/api/frankfurter/latest?from=${base}`
  const directUrl = `${FRANKFURTER_DIRECT}/latest?from=${base}`
  let lastErr = null

  for (let i = 1; i <= FRANKFURTER_ATTEMPTS; i++) {
    try {
      const data = await frankfurterAttempt(proxyUrl, `proxy ${i}/${FRANKFURTER_ATTEMPTS}`)
      if (!data?.rates) throw new Error('No rates in response')
      console.log('[MADDEN API] Frankfurter (proxy) /latest?from=' + base + ':', Object.keys(data.rates).length, 'currencies')
      return data.rates
    } catch (e) {
      lastErr = e
      if (i < FRANKFURTER_ATTEMPTS) await sleep(FRANKFURTER_RETRY_MS)
    }
  }

  // Proxy exhausted — fall back to a direct browser call (Frankfurter allows CORS)
  try {
    const data = await frankfurterAttempt(directUrl, 'direct fallback')
    if (!data?.rates) throw new Error('No rates in response')
    console.log('[MADDEN API] Frankfurter (direct) /latest?from=' + base + ':', Object.keys(data.rates).length, 'currencies')
    return data.rates
  } catch (e) {
    console.error('[MADDEN API] Frankfurter unavailable after', FRANKFURTER_ATTEMPTS, 'proxy attempts + direct fallback')
    throw lastErr ?? e
  }
}

export const FX_PAIR_DEFS = [
  { pair: 'AUD/USD', compute: (r) => r.USD,          spread: 0.0003 },
  { pair: 'AUD/EUR', compute: (r) => r.EUR,          spread: 0.0003 },
  { pair: 'AUD/GBP', compute: (r) => r.GBP,          spread: 0.0003 },
  { pair: 'AUD/JPY', compute: (r) => r.JPY,          spread: 0.03   },
  { pair: 'AUD/NZD', compute: (r) => r.NZD,          spread: 0.0003 },
  { pair: 'AUD/CAD', compute: (r) => r.CAD,          spread: 0.0003 },
  { pair: 'AUD/CHF', compute: (r) => r.CHF,          spread: 0.0003 },
  { pair: 'AUD/CNY', compute: (r) => r.CNY,          spread: 0.002  },
  { pair: 'AUD/SGD', compute: (r) => r.SGD,          spread: 0.0005 },
  { pair: 'EUR/USD', compute: (r) => r.USD / r.EUR,  spread: 0.0002 },
  { pair: 'GBP/USD', compute: (r) => r.USD / r.GBP, spread: 0.0003 },
  { pair: 'USD/JPY', compute: (r) => r.JPY / r.USD, spread: 0.02   },
]

export const transformFxRates = (rates) =>
  FX_PAIR_DEFS.map(({ pair, compute, spread }) => {
    const mid = compute(rates)
    if (!mid || isNaN(mid)) return null
    return {
      pair,
      bid: parseFloat((mid - spread / 2).toFixed(4)),
      ask: parseFloat((mid + spread / 2).toFixed(4)),
      mid: parseFloat(mid.toFixed(4)),
      change: 0,
      pct: 0,
    }
  }).filter(Boolean)

export const fetchMetalsRates = async () => {
  try {
    const { data } = await axios.get('/api/frankfurter/latest?from=USD&to=XAU,XAG')
    if (data?.rates?.XAU) {
      console.log('[MADDEN API] Frankfurter metals XAU/USD:', (1 / data.rates.XAU).toFixed(2))
      return data.rates
    }
  } catch { /* Frankfurter is ECB fiat-only and carries no XAU — see liveDataService.getGoldPrice */ }

  const key = import.meta.env.VITE_EXCHANGERATE_API_KEY
  if (!key) return null
  try {
    const { data } = await axios.get(`https://v6.exchangerate-api.com/v6/${key}/latest/AUD`)
    if (data.result !== 'success') return null
    console.log('[MADDEN API] ExchangeRate-API metals XAU/AUD:', (1 / (data.conversion_rates?.XAU ?? 1)).toFixed(2))
    return data.conversion_rates
  } catch { return null }
}

export const extractMetals = (rates) => {
  if (!rates) return []
  const metals = []
  if (rates.XAU) metals.push({ name: 'GOLD (XAU/AUD)',   price: (1 / rates.XAU).toFixed(2) })
  if (rates.XAG) metals.push({ name: 'SILVER (XAG/AUD)', price: (1 / rates.XAG).toFixed(2) })
  return metals
}

// ─── RBA Statistics API (via proxy → /api/rba) ───────────────────────────────

export const fetchRBACashRate = async () => {
  const { data } = await axios.get('/api/rba/statistics/tables/a2-1/latest')
  console.log('[MADDEN API] RBA cash rate a2-1:', data)
  return data
}

export const transformRBACashRate = (raw) => {
  const tryRows = (rows) => {
    if (!Array.isArray(rows) || !rows.length) return null
    const sorted = [...rows].sort((a, b) => new Date(b.date ?? b.Date ?? 0) - new Date(a.date ?? a.Date ?? 0))
    const latest = sorted[0]
    const rate   = parseFloat(latest.value ?? latest.Value ?? latest.rate ?? latest.Rate)
    const date   = latest.date ?? latest.Date ?? latest.releaseDate ?? ''
    if (!isNaN(rate) && rate > 0) return { rate, date }
    return null
  }
  if (Array.isArray(raw)) return tryRows(raw)
  if (Array.isArray(raw?.data)) return tryRows(raw.data)
  if (Array.isArray(raw?.series?.[0]?.data)) return tryRows(raw.series[0].data)
  return null
}

export const fetchRBABondYields = async () => {
  const { data } = await axios.get('/api/rba/statistics/tables/f2-1/latest')
  console.log('[MADDEN API] RBA bond yields f2-1:', data)
  return data
}

export const transformRBABondYields = (raw) => {
  const MATURITY_PATTERNS = [
    { label: '2Y',  re: /2.year|2yr|2 year|FCMYGBAG2D/i  },
    { label: '3Y',  re: /3.year|3yr|3 year|FCMYGBAG3D/i  },
    { label: '5Y',  re: /5.year|5yr|5 year|FCMYGBAG5D/i  },
    { label: '10Y', re: /10.year|10yr|10 year|FCMYGBAG10D/i },
  ]
  const series = raw?.series ?? (Array.isArray(raw) ? raw : null)
  if (Array.isArray(series)) {
    const results = []
    for (const { label, re } of MATURITY_PATTERNS) {
      const match = series.find((s) =>
        re.test(s.description ?? s.seriesDescription ?? s.id ?? s.seriesId ?? '')
      )
      if (match) {
        const rows   = match.data ?? match.observations ?? []
        const sorted = [...rows].sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))
        const val    = parseFloat(sorted[0]?.value ?? sorted[0]?.Value)
        if (!isNaN(val)) results.push({ maturity: label, yield: val })
      }
    }
    if (results.length >= 2) return results
  }
  return null
}

export const fetchRBARate = fetchRBACashRate

// ─── News via RSS2JSON ────────────────────────────────────────────────────────

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json'

export const NEWS_SOURCES = [
  // Australian — authoritative financial sources only
  { url: 'https://www.afr.com/rss',                                          name: 'AFR',              category: 'AU'          },
  { url: 'https://www.smh.com.au/rss/business.xml',                          name: 'SMH Business',     category: 'AU'          },
  { url: 'https://www.rba.gov.au/rss/rss-cb-speeches.xml',                   name: 'RBA Speeches',     category: 'AU'          },
  { url: 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml',             name: 'RBA Releases',     category: 'AU'          },
  // US Financial
  { url: 'https://feeds.reuters.com/reuters/businessNews',                    name: 'Reuters Business', category: 'US'          },
  { url: 'https://feeds.reuters.com/reuters/markets',                         name: 'Reuters Markets',  category: 'US'          },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',            name: 'CNBC Top News',    category: 'US'          },
  { url: 'https://www.cnbc.com/id/15839135/device/rss/rss.html',             name: 'CNBC Markets',     category: 'US'          },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories',              name: 'MarketWatch',      category: 'US'          },
  { url: 'https://finance.yahoo.com/news/rssindex',                           name: 'Yahoo Finance',    category: 'US'          },
  { url: 'https://www.investing.com/rss/news.rss',                           name: 'Investing.com',    category: 'US'          },
  // Global
  { url: 'http://feeds.bbci.co.uk/news/business/rss.xml',                    name: 'BBC Business',     category: 'GLOBAL'      },
  { url: 'https://www.theguardian.com/business/economics/rss',               name: 'Guardian Econ',    category: 'GLOBAL'      },
  { url: 'https://www.economist.com/finance-and-economics/rss.xml',          name: 'The Economist',    category: 'GLOBAL'      },
  // Crypto
  { url: 'https://cointelegraph.com/rss',                                    name: 'CoinTelegraph',    category: 'CRYPTO'      },
  { url: 'https://coindesk.com/arc/outboundfeeds/rss/',                      name: 'CoinDesk',         category: 'CRYPTO'      },
  // Commodities & Energy
  { url: 'https://oilprice.com/rss/main',                                    name: 'OilPrice.com',     category: 'COMMODITIES' },
  { url: 'https://www.mining.com/feed/',                                      name: 'Mining.com',       category: 'COMMODITIES' },
  // Asia Pacific
  { url: 'https://asia.nikkei.com/rss/feed/nar',                             name: 'Nikkei Asia',      category: 'ASIA'        },
]

// Financial relevance filter — articles must match at least one term to pass through
export const FINANCIAL_KEYWORDS = [
  'market', 'markets', 'stock', 'stocks', 'share', 'shares', 'equity', 'equities',
  'fund', 'invest', 'investor', 'portfolio', 'trading', 'trader',
  'asx', 'nasdaq', 'nyse', 's&p', 'dow', 'nikkei', 'ftse', 'hang seng',
  'rba', 'federal reserve', 'fed', 'fomc', 'central bank', 'reserve bank',
  'interest rate', 'rate cut', 'rate hike', 'monetary policy',
  'inflation', 'cpi', 'gdp', 'unemployment', 'jobs data', 'payrolls',
  'dollar', 'aud', 'usd', 'eur', 'jpy', 'currency', 'forex', 'exchange rate',
  'bitcoin', 'crypto', 'ethereum', 'blockchain', 'defi', 'stablecoin',
  'gold', 'silver', 'oil', 'crude', 'commodity', 'iron ore', 'lng', 'copper', 'opec',
  'earnings', 'revenue', 'profit', 'dividend', 'eps', 'quarterly',
  'ipo', 'merger', 'acquisition', 'takeover', 'deal',
  'bond', 'yield', 'treasury', 'debt', 'deficit', 'surplus',
  'tariff', 'trade war', 'sanctions', 'export', 'import',
  'bank', 'banking', 'financial', 'economic', 'economy', 'recession', 'growth',
  'bhp', 'cba', 'csl', 'westpac', 'anz', 'nab', 'macquarie', 'rio tinto',
  'apple', 'nvidia', 'microsoft', 'tesla', 'amazon', 'meta', 'alphabet',
  'energy', 'mining', 'resources', 'real estate', 'reit', 'property',
]

function isFinanciallyRelevant(title, description = '') {
  const text = `${title} ${description}`.toLowerCase()
  return FINANCIAL_KEYWORDS.some(kw => text.includes(kw))
}

// ─── News categories (tabs) — an article can match more than one ────────────
export const NEWS_CATEGORIES = ['ALL', 'AU', 'US', 'CRYPTO', 'COMMODITIES', 'MACRO', 'FX', 'GEOPOLITICAL', 'TECH', 'EARNINGS', 'ASIA']

const NEWS_CATEGORY_RE = {
  AU:           /\bASX\b|\bRBA\b|australia|australian|\bAUD\b|commonwealth bank|bhp|csl|westpac|\bANZ\b|\bNAB\b|woolworths|macquarie|reserve bank|\bAPRA\b|\bASIC\b|asx200/i,
  US:           /\bFed\b|federal reserve|\bS&P 500\b|\bNASDAQ\b|\bDow\b|wall street|\bNYSE\b|\bSEC\b|quarterly results|\bIPO\b/i,
  CRYPTO:       /bitcoin|\bBTC\b|ethereum|\bETH\b|crypto|blockchain|defi|\bNFT\b|solana|binance|coinbase|stablecoin|web3/i,
  COMMODITIES:  /iron ore|\bgold\b|\bsilver\b|\boil\b|\bLNG\b|natural gas|copper|wheat|\bcoal\b|commodity|\bOPEC\b|\bcrude\b|\bBrent\b|\bWTI\b/i,
  FX:           /\bAUD\/USD\b|currency|forex|\bdollar\b|\beuro\b|\byen\b|\bpound\b|exchange rate|central bank|interest rate|monetary policy/i,
  MACRO:        /inflation|\bCPI\b|\bGDP\b|unemployment|\bjobs\b|recession|fiscal|\bbudget\b|treasury|deficit|surplus|trade balance/i,
  GEOPOLITICAL: /china|trade war|sanctions?|tariff|conflict|\bwar\b|ukraine|russia|middle east|taiwan|north korea|elections?/i,
  TECH:         /\bAI\b|artificial intelligence|technology|semiconductor|\bchip\b|apple|google|microsoft|meta|amazon|tesla|innovation/i,
  EARNINGS:     /\bearnings\b|quarterly results|annual results|guidance|forecast|\bbeat\b|\bmiss\b|\bEPS\b|profit warning/i,
  ASIA:         /\bjapan\b|nikkei|hong kong|\bchina\b|shanghai|hang seng|singapore|\bindia\b|sensex|nifty|korea|seoul|\bASEAN\b/i,
}

function classifyNewsCategories(title, description = '', sourceCategory = null) {
  const text = `${title} ${description}`
  const cats = Object.entries(NEWS_CATEGORY_RE)
    .filter(([, re]) => re.test(text))
    .map(([key]) => key)
  if (sourceCategory && sourceCategory !== 'GLOBAL' && !cats.includes(sourceCategory)) {
    cats.push(sourceCategory)
  }
  return cats
}

// ─── Sentiment (keyword-derived, not a model call) ───────────────────────────
const BULLISH_RE = /surge|soar|rall(y|ies)|jump(s|ed)?|record high|upgrade|outperform|ris(e|es|ing)|climbs?|beats?|strong|gains?\b|positive|growth|bullish/i
const BEARISH_RE = /plunge|crash|slump|tumbl|drop(s|ped)?|falls?|misses?|downgrade|underperform|declin|weak|recession|sell-?off|warning|loss\b|cut(s|ting)?\b/i

function inferSentiment(title, description = '') {
  const text = `${title} ${description}`
  const bull = BULLISH_RE.test(text)
  const bear = BEARISH_RE.test(text)
  if (bull && !bear) return 'BULLISH'
  if (bear && !bull) return 'BEARISH'
  return 'NEUTRAL'
}

// ─── Dedup by headline similarity (Jaccard word overlap > 80%) ───────────────
const normalizeHeadline = (h) => h.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

function headlineSimilarity(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 3))
  const wb = new Set(b.split(' ').filter(w => w.length > 3))
  if (!wa.size || !wb.size) return 0
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / Math.max(wa.size, wb.size)
}

function dedupeByHeadline(items) {
  const seen = []
  return items.filter((item) => {
    const norm = normalizeHeadline(item.headline)
    if (seen.some(h => headlineSimilarity(norm, h) > 0.8)) return false
    seen.push(norm)
    return true
  })
}

// Separate world/geo news feeds for the Global Intelligence module
export const GEO_RSS_FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/worldNews',          source: 'Reuters World' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',         source: 'BBC World'     },
  { url: 'https://feeds.reuters.com/reuters/topNews',            source: 'Reuters Top'   },
]

// ─── Ticker whitelist — only flag known listed symbols ────────────────────────
export const TICKER_WHITELIST = new Set([
  // ASX
  'BHP','CBA','CSL','WOW','ANZ','NAB','WBC','MQG','RIO','TLS','FMG','WES','GMG',
  'ALL','MIN','WDS','XRO','REA','COL','TCL','QBE','SHL','IAG','MPL','ORG','APA',
  'ASX','BXB','CPU','DXS','EVN','GPT','JHX','LLC','MGR','NCM','NST','ORI','PLS',
  'RMD','SGP','SUN','TAH','TWE','AMC','AMP','ANN','APE','ARB','AUB','AWC','BAP',
  'BEN','BOQ','BSL','CAR','CGF','CHC','COH','CTD','CWY','DMP','EBO','ELD','FLT',
  'GUD','HVN','IFL','IGO','ILU','JBH','LOV','LYC','MFG','MND','MPB','MTS','NEM',
  'SKI','STO','VCX','WHC','WPR',
  // US
  'AAPL','NVDA','MSFT','TSLA','AMZN','META','GOOG','GOOGL','JPM','V','MA','BAC',
  'XOM','CVX','JNJ','WMT','PG','HD','AVGO','MRK','ABBV','NFLX','AMD','ADBE',
  'CRM','COST','QCOM','TXN','INTU','CSCO','AMGN','CAT','GS','MS','BLK','SPGI',
  'ISRG','RTX','AXP','SYK','LOW','VRTX','NOW','UBER','LYFT','SNAP','SHOP','SQ',
  'PYPL','COIN','HOOD','RBLX','PLTR','RIVN','LCID','NIO','BABA','JD','PDD','BIDU',
  'TMUS','VZ','T','DIS','CMCSA','CHTR','FOX','PARA',
  // Crypto
  'BTC','ETH','SOL','BNB','XRP','ADA','AVAX','DOT','LINK','MATIC','DOGE','SHIB',
  'UNI','AAVE','CRO',
])

const inferNewsTag = (title, categories = []) => {
  const text = `${title} ${categories.join(' ')}`.toLowerCase()
  if (/bitcoin|ethereum|crypto|blockchain|defi|solana|web3/i.test(text))                            return 'CRYPTO'
  if (/rba|asx|asx200|australia|australian|aud|macquarie|commbank|bhp|rio/i.test(text))             return 'AU'
  if (/fed|fomc|inflation|cpi|interest rate|yield|treasury|macro|recession|gdp|fiscal/i.test(text)) return 'MACRO'
  if (/oil|energy|crude|natural gas|opec|exxon|chevron|petroleum/i.test(text))                      return 'ENERGY'
  if (/forex|dollar|euro|yen|currency|fx|exchange rate/i.test(text))                                return 'FX'
  if (/merger|acquisition|buyout|deal|takeover/i.test(text))                                        return 'M&A'
  if (/earnings|revenue|profit|eps|guidance|quarterly|q[1-4] 20/i.test(text))                       return 'EARNINGS'
  if (/bond|yield|debt|treasur|rate hike|rate cut/i.test(text))                                     return 'RATES'
  if (/ai\b|artificial intelligence|semiconductor|chip stocks|tech\b/i.test(text))                  return 'TECH'
  if (/china|europe|asia|japan|india|global|international|emerging market/i.test(text))             return 'INTL'
  return 'EQUITY'
}

const extractTickers = (title, description = '') => {
  const text    = `${title} ${description}`
  const matches = text.match(/\b[A-Z]{2,5}\b/g) ?? []
  return [...new Set(matches.filter((w) => TICKER_WHITELIST.has(w)))].slice(0, 4)
}

const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)
}

export const fetchNews = async () => {
  const fetchedAt = Date.now()
  const sourceHealth = {}
  NEWS_SOURCES.forEach(s => { sourceHealth[s.name] = 'failed' })

  const results = await Promise.allSettled(
    NEWS_SOURCES.map(({ url, name, category }) =>
      axios.get(RSS2JSON_BASE, { params: { rss_url: url }, timeout: 8000 })
        .then(({ data }) => ({ data, source: name, sourceCategory: category }))
    )
  )

  // A missing or unparseable date used to be replaced with a RANDOM time in
  // the last 10 minutes. That silently made ~half of every date-less article
  // look newer than 5 minutes, which is what drove the breaking-news
  // notification spam (and corrupted the NEW/BREAKING badges and feed order).
  // Fall back to fetch time instead, and flag it so recency-sensitive
  // consumers can exclude estimates rather than trusting them.
  function validatePubDate(dateStr) {
    const now = new Date()
    if (!dateStr) return { pubDate: new Date(fetchedAt), dateEstimated: true }
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime()) || parsed > now) return { pubDate: new Date(fetchedAt), dateEstimated: true }
    return { pubDate: parsed, dateEstimated: false }
  }

  function diversifyFeed(articles, maxPerSource = 5) {
    const counts = {}
    return articles.filter(a => {
      const n = counts[a.source] || 0
      if (n >= maxPerSource) return false
      counts[a.source] = n + 1
      return true
    })
  }

  let id = 1
  const items = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { data, source, sourceCategory } = result.value
    if (data.status !== 'ok' || !Array.isArray(data.items)) continue
    sourceHealth[source] = 'ok'
    for (const item of data.items) {
      const { pubDate, dateEstimated } = validatePubDate(item.pubDate)
      const ageMs   = Date.now() - pubDate.getTime()
      if (ageMs > 7 * 86400000) continue // skip articles older than 7 days
      const tag     = inferNewsTag(item.title, item.categories)
      items.push({
        id:             id++,
        time:           pubDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        pubDate,
        dateEstimated,
        fetchedAt,
        source,
        sourceCategory,
        tag,
        categories:     classifyNewsCategories(item.title, item.description, sourceCategory),
        sentiment:      inferSentiment(item.title, item.description),
        headline:       item.title?.trim() || '(No title)',
        summary:        stripHtml(item.description || item.content),
        link:           item.link,
        tickers:        extractTickers(item.title, item.description),
        priority:       ['AFR', 'RBA Speeches', 'RBA Releases'].includes(source) || tag === 'AU' ? 0 : 1,
      })
    }
  }

  const financial = items.filter(item => isFinanciallyRelevant(item.headline, item.summary))
  const deduped = dedupeByHeadline(financial)
  deduped.sort((a, b) => b.pubDate - a.pubDate) // strict date sort first
  const diverse = diversifyFeed(deduped, 5)      // max 5 per source
  diverse.sort((a, b) => a.priority - b.priority || b.pubDate - a.pubDate)
  const articles = diverse.slice(0, 500)

  const liveCount = Object.values(sourceHealth).filter(v => v === 'ok').length
  console.log(`[MADDEN API] News: ${articles.length} articles from ${liveCount}/${NEWS_SOURCES.length} sources`)
  return { articles, sourceHealth }
}

// ─── OpenSky Network (via proxy → /api/opensky) ──────────────────────────────

export const fetchFlightData = async () => {
  const { data } = await axios.get('/api/opensky/api/states/all', {
    params:  { lamin: -45, lomin: 110, lamax: -10, lomax: 155 },
    timeout: 20000,
  })
  console.log('[MADDEN API] OpenSky states:', data?.states?.length, 'aircraft')
  return data
}

export const transformFlightData = (raw) => {
  if (!raw?.states) return { total: 0, byCountry: [], airborne: 0, timestamp: raw?.time }
  const states   = raw.states
  const airborne = states.filter((s) => s[8] === false)
  const countryMap = {}
  for (const s of airborne) {
    const country = s[2] || 'Unknown'
    countryMap[country] = (countryMap[country] ?? 0) + 1
  }
  const byCountry = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([country, count]) => ({ country, count }))
  return { total: states.length, airborne: airborne.length, byCountry, timestamp: raw.time }
}

export const fetchGeoNews = async () => {
  const results = await Promise.allSettled(
    GEO_RSS_FEEDS.map(({ url, source }) =>
      axios.get(RSS2JSON_BASE, { params: { rss_url: url } })
        .then(({ data }) => ({ data, source }))
    )
  )
  let id = 1
  const items = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { data, source } = result.value
    if (data.status !== 'ok' || !Array.isArray(data.items)) continue
    for (const item of data.items) {
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date()
      items.push({
        id:       id++,
        time:     pubDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
        pubDate,
        source,
        headline: item.title?.trim() || '(No title)',
        summary:  stripHtml(item.description || item.content),
        link:     item.link,
      })
    }
  }
  items.sort((a, b) => b.pubDate - a.pubDate)
  console.log('[MADDEN API] Geo news:', items.length, 'articles')
  return items
}


// ─── Anthropic Claude (streaming) ────────────────────────────────────────────
// Calls go through /api/claude (a Vercel serverless function in prod, a
// Vite dev-server proxy locally — see vite.config.js) rather than straight
// to api.anthropic.com. This keeps the Anthropic key server-side only; it
// is never bundled into client code.

export const MADDEX_SYSTEM_PROMPT = `You are MaddenAI, the financial intelligence analyst embedded in the Maddex terminal, built by Madden Group Holdings. You provide sharp, professional market analysis and commentary.

IMPORTANT RULES:

1. ALWAYS begin every response with this disclaimer on its own line:
   "⚠ General information only — not financial advice. Always do your own research before making any investment decisions."
   Style it small and muted. Never skip this. Never bury it at the end.

2. LIVE PRICE AWARENESS
   When an asset is passed to you with a current price (via the context header), use it. When a user asks about an asset without providing a price and you don't have live data, do NOT respond with "price not provided" placeholders or N/A fields. Instead:
   - Give a real, substantive response using your knowledge
   - State clearly that you don't have the live price at this moment
   - Offer genuine analysis on fundamentals, macro context, key levels from your training data, and sentiment — all clearly labelled as based on your last known data, not live
   - Never return a skeleton response full of N/A values — that is worse than useless to the user

3. RESPONSE FORMAT
   Write in clean, flowing prose. No rigid template with forced fields like "SENTIMENT: ◆Overall: N/A". Use headers where helpful but keep the response readable and natural, like a smart analyst talking to a client — not a form being filled out.

   Structure (adapt as needed, don't force all sections every time):
   - 1-2 sentence summary / direct answer to what they asked
   - Price action & key levels (if relevant)
   - Key drivers (2-4 bullet points max, substantive)
   - Outlook (1 paragraph, direct view)
   - Risk (1-2 key risks only)

   Keep responses concise — aim for 200-350 words unless the user asks for depth. No padding. No filler.

4. DIRECTNESS
   Give a view. If someone asks "will BTC go up" — give your best assessment based on available information, clearly caveated as analysis not advice. Don't hedge every sentence into meaninglessness. A response that says "it depends" without a lean is not useful.

5. AUSTRALIAN INVESTOR LENS
   - Default to AUD pricing when available
   - Reference ASX, RBA, ASIC context where relevant
   - Mention AUD/USD impact on USD-denominated assets
   - Reference Australian market hours and timing context

6. NEVER:
   - Return N/A fields or skeleton templates
   - Say "provide current price for full analysis" as the main response — give value first, then optionally note that live price would sharpen the analysis
   - Claim to provide financial advice
   - Use the phrase "as an AI language model"
   - Use excessive asterisks, hashtags, or markdown formatting — the terminal renders plain text and light HTML only

7. FORMATTING AND UNITS
   The terminal renders plain text and light HTML only. Do not use markdown tables, code fences, heading hashes, or bold asterisk runs — they render literally and look broken. Use short capitalised headers on their own line and simple dashes for bullets.
   - Currency: write A$ for Australian dollars and US$ for US dollars whenever both could be meant. Never write a bare $ on a cross-market comparison.
   - Prices: quote to the instrument's normal convention — ASX equities to cents (A$32.45), FX to four decimals (0.6521), crypto to a sensible precision for the coin's magnitude.
   - Percentages: one or two decimal places, always signed on a change (+1.4%, -0.8%).
   - Large numbers: compress to B/M/K with two decimals (A$1.24B, 4.35M shares).
   - Dates: Australian format, day before month (5 September 2026). Times: include the exchange timezone (AEST/AEDT for ASX, ET for US).
   - Key levels: give actual numbers, never "near resistance" alone. A level without a price is not useful.

8. AUSTRALIAN MARKET AND REGULATORY CONTEXT
   - ASX trades 10:00 to 16:00 AEST/AEDT with an opening auction and a closing single-price auction shortly after 16:00; equities settle T+2. The benchmark is the S&P/ASX 200, with the All Ordinaries as the broader measure.
   - The index is heavily weighted to financials and materials, so bank margins and iron ore prices move the index far more than they would move a US benchmark. Say so when it is the actual driver.
   - RBA sets the cash rate across eight scheduled meetings a year and publishes a quarterly Statement on Monetary Policy. Where it matters, distinguish market-implied pricing from economist consensus — they often disagree.
   - APRA is the prudential regulator for banks, insurers and superannuation. Its capital rules and mortgage serviceability buffer feed directly into bank lending margins and credit growth.
   - ASIC regulates market conduct and licensing. The distinction between general information and personal advice is an ASIC one and it governs how you answer — see section 10.
   - Tax context worth raising as general background only, never as tax advice: franking credits and dividend imputation on Australian dividends, the 50% CGT discount on assets held longer than twelve months, and superannuation as the dominant long-term wrapper for most Australians.
   - Many large ASX companies earn offshore, so a stronger AUD reduces translated earnings. Mention the currency channel when discussing them.

9. ASSET CLASS GUIDANCE
   EQUITIES: lead with the business and its earnings drivers, not just the chart. For ASX names cover franking where dividends matter, and flag liquidity risk on small caps — a wide spread matters more to a retail investor than a valuation argument. For US names held by Australians, always note the unhedged AUD exposure.
   CRYPTO: trades 24/7, so there is no open or close to anchor to and weekend moves are real. Reference AUD pairs where possible. Be explicit about volatility and position sizing, and never present a token as equivalent in risk to a listed equity. Treat regulatory status in Australia as unsettled rather than asserting a definitive classification.
   FX: AUD/USD behaves as a global risk and China proxy more than a pure rates trade. Cover the RBA-Fed differential, commodity terms of trade, and the fact that most Australian investors carry unhedged USD exposure through offshore equities whether or not they intend to.
   MACRO AND RATES: connect the data to the transmission channel rather than reciting the print. For Australia the chain that matters is usually cash rate to mortgage serviceability to consumption to domestic earnings, and separately China stimulus to iron ore to the materials sector.

10. COMPLIANCE AND LANGUAGE
   - Everything you produce is general information only. You are not licensed to give personal financial advice and must never present output as such.
   - You do not know the user's income, existing holdings, time horizon, tax residency, or risk tolerance. Never assume them and never tailor a recommendation as if you did.
   - Do not write "you should buy" or "you should sell". Give the view as analysis: what the bull case rests on, what would break it, and what the risk is.
   - Never guarantee a return, promise an outcome, or state a future price as fact. Probabilistic language is fine; certainty is not.
   - Label speculative, illiquid, or high-risk exposures plainly rather than softening them.
   - Past performance is not indicative of future results — reflect this in how you frame any track record.
   - If asked directly for a personal recommendation, give the substantive analysis, then note that a personal recommendation requires a licensed adviser who knows their full circumstances.`

import { EXPERIENCE_CONTEXT } from '../lib/profileUtils'

// Stable content first, per-user variation last: prompt caching is a prefix
// match, so the long shared block has to lead for the cached prefix to be
// byte-identical across users. Nothing volatile (dates, prices, watchlists)
// belongs in here — that goes in the user message.
export function buildSystemPrompt(experienceLevel) {
  const ctx = EXPERIENCE_CONTEXT[experienceLevel] || EXPERIENCE_CONTEXT.INTERMEDIATE
  return `${MADDEX_SYSTEM_PROMPT}\n\nUSER CONTEXT: ${ctx}`
}

// The error body reaching the browser has a different shape depending on
// which /api/claude backend served the request: the Vite dev proxy forwards
// Anthropic's error straight through ({"error":{"message":"..."}}), while
// the deployed Vercel function (api/claude.js) wraps that same text as a
// JSON *string* inside another object ({"error":"{\"error\":{...}}"}) since
// it does `res.json({ error: errText })` on the raw response body. Unwrap
// up to a couple of JSON layers so both shapes resolve to the same message
// instead of the prod path silently falling back to a generic one.
function extractAnthropicErrorMessage(text) {
  let cur = text
  for (let i = 0; i < 3; i++) {
    let obj
    try { obj = JSON.parse(cur) } catch { return null }
    if (obj?.error?.message) return obj.error.message
    if (typeof obj?.message === 'string') return obj.message
    if (typeof obj?.error === 'string') { cur = obj.error; continue }
    return null
  }
  return null
}

export const askClaude = async (messages, onToken, options = {}) => {
  const startTime  = Date.now()
  const systemPrompt = options.systemPrompt ?? (options.experienceLevel ? buildSystemPrompt(options.experienceLevel) : MADDEX_SYSTEM_PROMPT)
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: options.maxTokens ?? 1024,
      stream:     true,
      system:     systemPrompt,
      messages,
    }),
  })
  if (!response.ok) {
    const errText = await response.text()
    console.error('[MADDEN API] Claude API error:', errText)
    throw new Error(extractAnthropicErrorMessage(errText) ?? 'AI service is currently unavailable — please try again shortly.')
  }
  const reader     = response.body.getReader()
  const decoder    = new TextDecoder()
  let fullText     = ''
  let inputTokens  = 0
  let outputTokens = 0
  let cacheRead    = 0
  let cacheCreated = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6)
      if (json === '[DONE]') continue
      try {
        const evt = JSON.parse(json)
        if (evt.type === 'message_start') {
          const usage  = evt.message?.usage
          inputTokens  = usage?.input_tokens ?? 0
          cacheRead    = usage?.cache_read_input_tokens ?? 0
          cacheCreated = usage?.cache_creation_input_tokens ?? 0
        }
        if (evt.type === 'message_delta' && evt.usage) {
          outputTokens = evt.usage.output_tokens ?? 0
        }
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          fullText += evt.delta.text
          onToken?.(evt.delta.text, fullText)
        }
      } catch { /* partial SSE frame — the next chunk completes it */ }
    }
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  // cached_read > 0 means the system prefix was served from cache. Staying at
  // 0 across repeated calls means the prefix is either changing between calls
  // or shorter than the model's minimum cacheable prefix (1024 tokens on
  // claude-sonnet-4-6), which is a silent no-op rather than an error.
  console.log('[CLAUDE CACHE STATS]', {
    cached_read:    cacheRead,
    cached_created: cacheCreated,
    uncached:       inputTokens,
    output:         outputTokens,
  })
  return { text: fullText, inputTokens, outputTokens, cacheRead, cacheCreated, elapsed }
}

// Shared helper for every "ask MaddenAI to generate structured JSON" feature
// (research notes, morning brief, stress-test commentary, sector drivers,
// sentiment, earnings previews, the NL portfolio builder) — one place to get
// the prompt out, strip the ```json fences Claude sometimes adds despite
// being told not to, and parse. Throws the same clean, already-unwrapped
// error askClaude() throws on an API failure; throws a distinct message on
// a JSON parse failure so callers can tell the two apart if they want to.
export async function askClaudeJSON(prompt, options = {}) {
  const { text } = await askClaude(
    [{ role: 'user', content: prompt }],
    null,
    { maxTokens: options.maxTokens ?? 1500, systemPrompt: options.systemPrompt ?? 'You are MaddenAI, the financial intelligence analyst embedded in the Maddex terminal. Always respond with ONLY valid JSON — no markdown, no commentary outside the JSON object.' },
  )
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.error('[MADDEN API] Failed to parse Claude JSON response:', cleaned)
    throw new Error(`MaddenAI returned an unexpected response — please try again. (${e.message})`, { cause: e })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLargeNum(n) {
  if (!n || isNaN(n)) return '—'
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
  return n.toString()
}
