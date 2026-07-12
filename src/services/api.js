import axios from 'axios'

// ─── Internal cache ───────────────────────────────────────────────────────────

const _cache = new Map()
const setCache = (k, v, ttlMs) => _cache.set(k, { v, exp: Date.now() + ttlMs })
const getCache = (k) => { const e = _cache.get(k); return (e && Date.now() < e.exp) ? e.v : null }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Cache-busting for Yahoo requests: the timestamped URL goes out on the wire so
// no browser/CDN layer serves a stale response; the stable (timestamp-free) URL
// is the key for our own short-lived in-memory cache below.
const NO_CACHE_HEADERS = { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
const bust = (url) => `${url}&_t=${Date.now()}`

// ─── Stooq (via Vite proxy → /api/stooq → stooq.com) ─────────────────────────
// Free financial data — no API key, no rate limits, CSV format.
// Quote endpoint: /q/l/?s={sym}&f=sd2t2ohlcv&h&e=csv
// History endpoint: /q/d/l/?s={sym}&d1={YYYYMMDD}&d2={YYYYMMDD}&i=d

const STOOQ_BASE = '/api/stooq'
const YAHOO_BASE = '/api/yahoo'

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

// ─── Yahoo Finance — individual stock quotes and history ─────────────────────
// Single source of truth for all equity data (non-index).
// Pass symbols in Yahoo Finance format: BHP.AX (ASX), AAPL (US).
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

export async function fetchBatch(symbols) {
  const out = {}
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5)
    const results = await Promise.all(batch.map(fetchYahooQuote))
    batch.forEach((sym, j) => { if (results[j]) out[sym] = results[j] })
    if (i + 5 < symbols.length) await new Promise((r) => setTimeout(r, 300))
  }
  // Every symbol failed — throw so the query flips to isError and the UI
  // shows DATA UNAVAILABLE + retry instead of silently rendering "No data".
  if (symbols.length > 0 && Object.keys(out).length === 0) {
    throw new Error('All quotes unavailable')
  }
  return out
}

export async function fetchYahooQuote(symbol) {
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
    const cached = getCache(url)
    if (cached) return cached
    const res = await fetch(bust(url), { signal: AbortSignal.timeout(8000), headers: NO_CACHE_HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) throw new Error('No result')
    const meta = result.meta
    const price = meta.regularMarketPrice
    const prevClose = meta.previousClose ?? meta.chartPreviousClose
    if (!price || !prevClose) throw new Error('No price data')
    const dayChange    = price - prevClose
    const dayChangePct = ((price - prevClose) / prevClose) * 100
    const currency     = meta.currency ?? 'AUD'
    console.log(`[MADDEN API] ✓ Yahoo ${symbol}: ${price} ${currency} (${dayChangePct >= 0 ? '+' : ''}${dayChangePct.toFixed(2)}%)`)
    const q = {
      symbol,
      price,
      prevClose,
      open:        meta.regularMarketOpen,
      high:        meta.regularMarketDayHigh,
      low:         meta.regularMarketDayLow,
      volume:      meta.regularMarketVolume,
      currency,
      exchange:    meta.exchangeName,
      week52High:  meta.fiftyTwoWeekHigh,
      week52Low:   meta.fiftyTwoWeekLow,
      dayChange,
      dayChangePct,
      marketCap:   meta.marketCap,
      name:        meta.longName ?? meta.shortName ?? symbol,
      lastUpdated: new Date().toISOString(),
      isOpen:      meta.marketState === 'REGULAR',
      // Backward-compat aliases used by existing components
      last:        price,
      pct:         dayChangePct,
      change:      dayChange,
      vol:         meta.regularMarketVolume,
      timestamp:   new Date().toISOString().slice(0, 10),
      fallback:    false,
    }
    setCache(url, q, 60_000)
    return q
  } catch (e) {
    console.error(`[MADDEN API] fetchYahooQuote failed for ${symbol}:`, e.message)
    // No hardcoded fallback — callers must treat null as DATA UNAVAILABLE and offer retry.
    return null
  }
}

export async function fetchYahooHistory(symbol, range = '3mo') {
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
    const cached = getCache(url)
    if (cached) return cached
    const res = await fetch(bust(url), { signal: AbortSignal.timeout(15000), headers: NO_CACHE_HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) throw new Error('No result')
    const timestamps = result.timestamp ?? []
    const closes  = result.indicators?.quote?.[0]?.close  ?? []
    const opens   = result.indicators?.quote?.[0]?.open   ?? []
    const highs   = result.indicators?.quote?.[0]?.high   ?? []
    const lows    = result.indicators?.quote?.[0]?.low    ?? []
    const volumes = result.indicators?.quote?.[0]?.volume ?? []
    const currency = result.meta.currency ?? 'AUD'
    const chartData = timestamps.map((ts, i) => {
      const close = closes[i]
      if (close == null || isNaN(close) || close <= 0) return null
      const date = new Date(ts * 1000).toISOString().slice(0, 10)
      const label = new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
      return {
        date:   label,
        rawDate: date,
        close:  parseFloat(close.toFixed(4)),
        price:  parseFloat(close.toFixed(4)),  // backward compat
        open:   opens[i]   != null ? parseFloat((opens[i] ?? close).toFixed(4))  : close,
        high:   highs[i]   != null ? parseFloat((highs[i] ?? close).toFixed(4))  : close,
        low:    lows[i]    != null ? parseFloat((lows[i]  ?? close).toFixed(4))  : close,
        volume: volumes[i] ?? 0,
        currency,
      }
    }).filter(Boolean).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    console.log(`[MADDEN API] ✓ Yahoo history ${symbol} ${range}: ${chartData.length} pts, ${chartData[0]?.date} → ${chartData[chartData.length - 1]?.date}`)
    setCache(url, chartData, 5 * 60_000)
    return chartData
  } catch (e) {
    console.error(`[MADDEN API] fetchYahooHistory failed for ${symbol}:`, e.message)
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

// ─── Yahoo Finance quoteSummary — full fundamental data ───────────────────────

export async function fetchQuoteSummary(symbol) {
  const modules = 'price,summaryDetail,defaultKeyStatistics,financialData,assetProfile'
  const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`
  const cached = getCache(url)
  if (cached) return cached

  const res = await fetch(bust(url), { signal: AbortSignal.timeout(12000), headers: NO_CACHE_HEADERS })
  if (!res.ok) throw new Error(`quoteSummary HTTP ${res.status}`)
  const data = await res.json()
  const result = data?.quoteSummary?.result?.[0]
  if (!result) throw new Error('No quoteSummary result')

  const p  = result.price ?? {}
  const sd = result.summaryDetail ?? {}
  const ks = result.defaultKeyStatistics ?? {}
  const fd = result.financialData ?? {}
  const ap = result.assetProfile ?? {}

  const raw = (obj, key) => {
    const v = obj?.[key]
    if (v == null) return null
    if (typeof v === 'object' && 'raw' in v) return v.raw
    return (typeof v === 'number' || typeof v === 'string') ? v : null
  }
  const safe = (v) => (v != null && Number.isFinite(v) ? v : null)
  const r = (obj, key) => safe(raw(obj, key))

  const price     = r(p, 'regularMarketPrice')
  const prevClose = r(p, 'regularMarketPreviousClose')

  const qs = {
    // Price
    price,
    prevClose,
    change:      r(p, 'regularMarketChange'),
    changePct:   price && prevClose ? ((price - prevClose) / prevClose) * 100 : null,
    volume:      r(p, 'regularMarketVolume'),
    dayHigh:     r(p, 'regularMarketDayHigh'),
    dayLow:      r(p, 'regularMarketDayLow'),
    open:        r(p, 'regularMarketOpen'),
    marketCap:   r(p, 'marketCap'),
    currency:    p.currency ?? null,
    exchange:    p.exchangeName ?? null,
    name:        p.shortName ?? p.longName ?? null,
    quoteType:   p.quoteType ?? null,
    // Summary Detail
    trailingPE:   r(sd, 'trailingPE'),
    forwardPE:    r(sd, 'forwardPE'),
    divYield:     r(sd, 'dividendYield'),
    payoutRatio:  r(sd, 'payoutRatio'),
    beta:         r(sd, 'beta'),
    week52High:   r(sd, 'fiftyTwoWeekHigh'),
    week52Low:    r(sd, 'fiftyTwoWeekLow'),
    ma50:         r(sd, 'fiftyDayAverage'),
    ma200:        r(sd, 'twoHundredDayAverage'),
    avgVolume:    r(sd, 'averageVolume'),
    avgVolume10d: r(sd, 'averageVolume10days'),
    ps:           r(sd, 'priceToSalesTrailing12Months'),
    // Key Statistics
    enterpriseValue:   r(ks, 'enterpriseValue'),
    profitMargins:     r(ks, 'profitMargins'),
    sharesOutstanding: r(ks, 'sharesOutstanding'),
    sharesShort:       r(ks, 'sharesShort'),
    shortRatio:        r(ks, 'shortRatio'),
    shortPctFloat:     r(ks, 'shortPercentOfFloat'),
    bookValue:         r(ks, 'bookValue'),
    pb:                r(ks, 'priceToBook'),
    netIncome:         r(ks, 'netIncomeToCommon'),
    epsTrailing:       r(ks, 'trailingEps'),
    epsForward:        r(ks, 'forwardEps'),
    peg:               r(ks, 'pegRatio'),
    evRevenue:         r(ks, 'enterpriseToRevenue'),
    evEbitda:          r(ks, 'enterpriseToEbitda'),
    week52Change:      r(ks, '52WeekChange'),
    lastDividend:      r(ks, 'lastDividendValue'),
    lastDividendDate:  raw(ks, 'lastDividendDate'),
    // Financial Data
    revenue:          r(fd, 'totalRevenue'),
    revenuePerShare:  r(fd, 'revenuePerShare'),
    roa:              r(fd, 'returnOnAssets'),
    roe:              r(fd, 'returnOnEquity'),
    grossProfit:      r(fd, 'grossProfits'),
    freeCashflow:     r(fd, 'freeCashflow'),
    operatingCF:      r(fd, 'operatingCashflow'),
    earningsGrowth:   r(fd, 'earningsGrowth'),
    revenueGrowth:    r(fd, 'revenueGrowth'),
    grossMargins:     r(fd, 'grossMargins'),
    ebitdaMargins:    r(fd, 'ebitdaMargins'),
    operatingMargins: r(fd, 'operatingMargins'),
    totalDebt:        r(fd, 'totalDebt'),
    totalCash:        r(fd, 'totalCash'),
    debtToEquity:     r(fd, 'debtToEquity'),
    currentRatio:     r(fd, 'currentRatio'),
    targetHigh:       r(fd, 'targetHighPrice'),
    targetLow:        r(fd, 'targetLowPrice'),
    targetMean:       r(fd, 'targetMeanPrice'),
    recMean:          r(fd, 'recommendationMean'),
    recKey:           fd.recommendationKey ?? null,
    analystCount:     r(fd, 'numberOfAnalystOpinions'),
    // Profile
    sector:      ap.sector ?? null,
    industry:    ap.industry ?? null,
    description: ap.longBusinessSummary ?? null,
    employees:   ap.fullTimeEmployees ?? null,
    website:     ap.website ?? null,
    city:        ap.city ?? null,
    country:     ap.country ?? null,
  }

  console.log(`[MADDEN API] ✓ quoteSummary ${symbol}: PE=${qs.trailingPE?.toFixed(1)}, cap=${qs.marketCap ? (qs.marketCap/1e9).toFixed(0)+'B' : '—'}, sector=${qs.sector}`)
  setCache(url, qs, 5 * 60_000)
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

async function fetchStooqQuote(stooqSym) {
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

// fetchYFQuote: delegates to Yahoo for stocks, stooq for indices.
// No hardcoded fallback — on total failure, throw so callers show DATA UNAVAILABLE.
export const fetchYFQuote = async (symbol) => {
  const stooqSym = yfToStooq(symbol)
  if (stooqSym.startsWith('^')) {
    const data = await fetchStooqQuote(stooqSym)
    return { ...data, symbol }
  }
  const q = await fetchYahooQuote(symbol)
  if (q) return q
  throw new Error(`No data for ${symbol}`)
}

// fetchYFBatch: INDICES via Yahoo Finance proxy — used by IndicesTable.
// Symbols that fail are simply omitted — no fake data — so consumers render
// their own "unavailable" state for the missing key.
export const fetchYFBatch = async (symbols) => {
  const results = await Promise.all(symbols.map(s => fetchYahooQuote(s)))
  const out = {}
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i]
    if (results[i]) {
      out[sym] = results[i]
    } else {
      console.error(`[MADDEN API] Index fetch failed: ${sym}`)
    }
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

async function fetchStooqHistory(symbol, { range = '3mo' } = {}) {
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

// fetchYFHistory: indices via stooq, stocks via Yahoo Finance
export const fetchYFHistory = async (symbol, { range = '3mo' } = {}) => {
  const stooqSym = yfToStooq(symbol)
  if (stooqSym.startsWith('^')) return fetchStooqHistory(symbol, { range })
  return fetchYahooHistory(symbol, range)
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
  }
  return map[timeframe] ?? { range: '3mo', interval: '1d' }
}

// Index configuration — consumers use YF-style symbol keys; stooq translation is internal
export const YF_INDICES = [
  { symbol: '^AXJO',  label: 'ASX 200',    sublabel: 'ASX · AUD', isAud: true,  primary: true  },
  { symbol: '^GSPC',  label: 'S&P 500',    sublabel: 'USD · pts', isAud: false, primary: false },
  { symbol: '^IXIC',  label: 'NASDAQ',     sublabel: 'USD · pts', isAud: false, primary: false },
  { symbol: '^DJI',   label: 'Dow Jones',  sublabel: 'USD · pts', isAud: false, primary: false },
  { symbol: '^FTSE',  label: 'FTSE 100',   sublabel: 'GBP · pts', isAud: false, primary: false },
  { symbol: '^GDAXI', label: 'DAX',        sublabel: 'EUR · pts', isAud: false, primary: false },
  { symbol: '^N225',  label: 'Nikkei 225', sublabel: 'JPY · pts', isAud: false, primary: false },
  { symbol: '^HSI',   label: 'Hang Seng',  sublabel: 'HKD · pts', isAud: false, primary: false },
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
    open:  parseFloat(open.toFixed(2)),
    high:  parseFloat(high.toFixed(2)),
    low:   parseFloat(low.toFixed(2)),
    close: parseFloat(close.toFixed(2)),
    price: parseFloat(close.toFixed(2)),
  }))
}

export const fetchFearGreed = async () => {
  const { data } = await axios.get('https://api.alternative.me/fng/?limit=30')
  console.log('[MADDEN API] Alternative.me fear/greed:', data?.data?.[0]?.value)
  return data
}

export const transformCryptoMarkets = (items, currency = 'aud') =>
  items.map((c) => ({
    rank:      c.market_cap_rank,
    symbol:    c.symbol.toUpperCase(),
    name:      c.name,
    price:     c.current_price,
    pct24h:    c.price_change_percentage_24h ?? 0,
    pct7d:     c.price_change_percentage_7d_in_currency ?? 0,
    pct30d:    c.price_change_percentage_30d_in_currency ?? null,
    marketCap: c.market_cap ?? null,
    mktCap:    formatLargeNum(c.market_cap ?? 0),
    vol24h:    formatLargeNum(c.total_volume ?? 0),
    currency:  currency.toUpperCase(),
    ath:       c.ath ?? null,
    athPct:    c.ath_change_percentage ?? null,
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

const FRANKFURTER_DIRECT   = 'https://api.frankfurter.app'
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
  } catch {}

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

  function validatePubDate(dateStr, sourceName) {
    const now = new Date()
    if (!dateStr) return new Date(now - Math.random() * 600000)
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime()) || parsed > now) return new Date(now - Math.random() * 600000)
    return parsed
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
      const pubDate = validatePubDate(item.pubDate, source)
      const ageMs   = Date.now() - pubDate.getTime()
      if (ageMs > 7 * 86400000) continue // skip articles older than 7 days
      const tag     = inferNewsTag(item.title, item.categories)
      items.push({
        id:             id++,
        time:           pubDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        pubDate,
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

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export const MADDEX_SYSTEM_PROMPT = `You are MADDEX AI, an elite financial markets analyst inside the Maddex terminal — a professional Bloomberg-style platform for Australian investors.

EXPERTISE:
- ASX equities, RBA monetary policy, AUD dynamics
- Australian macro: CPI, employment, GDP, housing
- Global macro impact on Australian markets
- Commodities: iron ore, LNG, gold, coal, copper
- Crypto markets in AUD terms
- Geopolitical risk and supply chain analysis

RESPONSE STYLE:
- Professional, precise, data-driven
- Lead with the most important insight immediately
- Use specific numbers — never vague language
- All prices in AUD unless asked for USD
- Under 200 words unless detailed analysis is requested
- Never use disclaimers about financial advice

CRITICAL FORMATTING — follow exactly:
- Never use markdown: no # ## * ** --- or any markdown syntax whatsoever
- Section headers in ALL CAPS followed by colon: ASSESSMENT: LEVELS: DRIVERS: OUTLOOK: RISK:
- Bullet points use only the ◆ symbol
- Prices formatted as A$63.50 or US$98.00
- Percentages as +1.2% or -0.8%
- Clean plain text only — no markdown

SENTIMENT SCORING — include in EVERY response:
Every response must include a SENTIMENT section with these scores on a 0-100 scale:
- Overall sentiment score: X/100
- Price momentum score: X/100 (based on recent price action)
- Volume conviction score: X/100 (based on volume vs average)
- Macro alignment score: X/100 (how well macro environment supports the asset)
- Risk score: X/100 (higher = more risk)

Format the sentiment section exactly like this:
SENTIMENT:
◆ Overall: XX/100 — BULLISH / NEUTRAL / BEARISH
◆ Momentum: XX/100
◆ Volume: XX/100
◆ Macro Alignment: XX/100
◆ Risk: XX/100

Score interpretation: 0-33 BEARISH · 34-66 NEUTRAL · 67-100 BULLISH
Derive scores from data in the prompt. If data is insufficient, show N/A.

ASSET ANALYSIS FORMAT — use exactly this structure:
[TICKER] A$[PRICE] [▲/▼][CHANGE]%

ASSESSMENT: One sentence on current price action

SENTIMENT:
◆ Overall: XX/100 — BULLISH/NEUTRAL/BEARISH
◆ Momentum: XX/100
◆ Volume: XX/100
◆ Macro Alignment: XX/100
◆ Risk: XX/100

LEVELS:
◆ Support: A$XX.XX / A$XX.XX
◆ Resistance: A$XX.XX / A$XX.XX

DRIVERS:
◆ Key factor 1
◆ Key factor 2
◆ Key factor 3

OUTLOOK: Brief directional view

RISK: Main downside scenario

For general market questions (ASX OUTLOOK, RBA NEXT MOVE etc) include:
MARKET SENTIMENT:
◆ Overall Market: XX/100 — RISK ON / RISK OFF / NEUTRAL
◆ Sector Momentum: XX/100
◆ Macro Environment: XX/100
◆ Global Risk: XX/100

IMPORTANT: Always use exact prices provided in the prompt. Never substitute estimated prices.`

import { EXPERIENCE_CONTEXT } from '../lib/profileUtils'

export function buildSystemPrompt(experienceLevel) {
  const ctx = EXPERIENCE_CONTEXT[experienceLevel] || EXPERIENCE_CONTEXT.INTERMEDIATE
  return `USER CONTEXT: ${ctx}\n\n${MADDEX_SYSTEM_PROMPT}`
}

export const askClaude = async (messages, onToken, options = {}) => {
  const startTime  = Date.now()
  const systemPrompt = options.systemPrompt ?? (options.experienceLevel ? buildSystemPrompt(options.experienceLevel) : MADDEX_SYSTEM_PROMPT)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':                                 ANTHROPIC_KEY,
      'anthropic-version':                         '2023-06-01',
      'content-type':                              'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      stream:     true,
      system:     systemPrompt,
      messages,
    }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${err}`)
  }
  const reader     = response.body.getReader()
  const decoder    = new TextDecoder()
  let fullText     = ''
  let inputTokens  = 0
  let outputTokens = 0
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
          inputTokens = evt.message?.usage?.input_tokens ?? 0
        }
        if (evt.type === 'message_delta' && evt.usage) {
          outputTokens = evt.usage.output_tokens ?? 0
        }
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          fullText += evt.delta.text
          onToken?.(evt.delta.text, fullText)
        }
      } catch {}
    }
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  return { text: fullText, inputTokens, outputTokens, elapsed }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLargeNum(n) {
  if (!n || isNaN(n)) return '—'
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
  return n.toString()
}
