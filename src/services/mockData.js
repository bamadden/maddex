// ─── Demo/mock data layer ──────────────────────────────────────────────────
// Active only when no equities API key is configured (see USING_MOCK_DATA in
// api.js). Every function here returns data shaped EXACTLY like the real
// FMP-backed functions it stands in for, so it slots in at the lowest layer
// (fetchFMPQuote/fetchFMPBatch/fetchFMPHistory) and every consumer above that
// — TopMovers, Watchlist, Portfolio, SectorHeatmap, IndicesTable, DetailModal,
// etc. — works completely unchanged.
//
// Base prices below are a mix of genuinely live-fetched reference points
// (AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA, JPM, V, and the S&P500/NASDAQ/
// Dow/FTSE/Nikkei/HangSeng index levels — all pulled from FMP's working
// single-quote endpoint during this session) and reasoned approximations
// for everything FMP/TD gate behind a paid plan (every ASX symbol, plus
// DAX/ASX200/AllOrds/Shanghai/NZ50). This is demo data — the point is
// plausible order-of-magnitude realism, not live accuracy; the DEMO badge
// tells the user not to trust it as real.

const round2 = (n) => Math.round(n * 100) / 100

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

// Deterministic per-symbol PRNG — stable within a page load so a symbol's
// generated history/fields don't flicker between re-renders, but reseeded
// (via jitterFor's fresh Math.random() below) on every fresh page load.
function mulberry32(seed) {
  let s = seed | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ±0.5% random jitter on the base price/change, re-rolled once per symbol
// per page load (cached for the life of the module — i.e. until reload) so
// every component reading the same symbol in the same session agrees.
const _jitterCache = new Map()
function jitterFor(symbol) {
  if (_jitterCache.has(symbol)) return _jitterCache.get(symbol)
  const j = (Math.random() - 0.5) * 0.01 // -0.005..+0.005
  _jitterCache.set(symbol, j)
  return j
}

// ─── ASX Top 20 ────────────────────────────────────────────────────────────
// price/changePct are illustrative (ASX quotes are premium-gated on every
// vendor tried this session — no live reference available). marketCap in AUD.
export const MOCK_ASX_STOCKS = {
  'BHP.AX': { name: 'BHP Group',             price: 68.50,  changePct:  0.85, marketCap: 215_000_000_000, pe: 13.2, eps: 5.19,  divYield: 5.4, volume: 9_800_000,  week52High: 82.10,  week52Low: 52.30,  sector: 'Materials' },
  'CBA.AX': { name: 'Commonwealth Bank',     price: 172.00, changePct: -0.42, marketCap: 290_000_000_000, pe: 24.8, eps: 6.94,  divYield: 3.1, volume: 2_100_000,  week52High: 191.50, week52Low: 148.20, sector: 'Financials' },
  'CSL.AX': { name: 'CSL Limited',           price: 265.00, changePct:  1.30, marketCap: 145_000_000_000, pe: 33.4, eps: 7.93,  divYield: 1.3, volume: 780_000,    week52High: 302.40, week52Low: 218.60, sector: 'Health' },
  'WBC.AX': { name: 'Westpac Banking Corp',  price: 36.20,  changePct: -0.90, marketCap: 115_000_000_000, pe: 15.9, eps: 2.28,  divYield: 4.6, volume: 6_400_000,  week52High: 40.80,  week52Low: 29.40,  sector: 'Financials' },
  'NAB.AX': { name: 'National Australia Bank', price: 41.50, changePct: 0.55, marketCap: 110_000_000_000, pe: 15.1, eps: 2.75,  divYield: 4.4, volume: 4_200_000,  week52High: 45.20,  week52Low: 34.10,  sector: 'Financials' },
  'ANZ.AX': { name: 'ANZ Group Holdings',    price: 32.80,  changePct: -1.15, marketCap: 95_000_000_000,  pe: 12.6, eps: 2.60,  divYield: 5.8, volume: 5_100_000,  week52High: 36.90,  week52Low: 25.70,  sector: 'Financials' },
  'WES.AX': { name: 'Wesfarmers',            price: 82.40,  changePct:  2.05, marketCap: 92_000_000_000,  pe: 28.9, eps: 2.85,  divYield: 2.9, volume: 1_900_000,  week52High: 88.60,  week52Low: 63.20,  sector: 'Cons Disc' },
  'MQG.AX': { name: 'Macquarie Group',       price: 224.00, changePct:  1.65, marketCap: 90_000_000_000,  pe: 19.7, eps: 11.37, divYield: 3.2, volume: 620_000,    week52High: 248.00, week52Low: 172.50, sector: 'Financials' },
  'WOW.AX': { name: 'Woolworths Group',      price: 38.80,  changePct: -0.65, marketCap: 42_000_000_000,  pe: 26.3, eps: 1.47,  divYield: 3.0, volume: 3_600_000,  week52High: 44.90,  week52Low: 31.80,  sector: 'Staples' },
  'RIO.AX': { name: 'Rio Tinto',             price: 126.50, changePct:  1.05, marketCap: 45_000_000_000,  pe: 10.8, eps: 11.71, divYield: 6.1, volume: 2_800_000,  week52High: 142.30, week52Low: 105.60, sector: 'Materials' },
  'FMG.AX': { name: 'Fortescue',             price: 20.60,  changePct: -2.35, marketCap: 68_000_000_000,  pe: 9.4,  eps: 2.19,  divYield: 7.2, volume: 8_900_000,  week52High: 26.40,  week52Low: 16.80,  sector: 'Materials' },
  'TLS.AX': { name: 'Telstra Group',         price: 4.15,   changePct:  0.48, marketCap: 50_000_000_000,  pe: 22.1, eps: 0.19,  divYield: 4.5, volume: 22_000_000, week52High: 4.45,   week52Low: 3.62,   sector: 'Comms' },
  'GMG.AX': { name: 'Goodman Group',         price: 36.80,  changePct:  1.90, marketCap: 78_000_000_000,  pe: 31.5, eps: 1.17,  divYield: 1.0, volume: 4_100_000,  week52High: 42.90,  week52Low: 27.30,  sector: 'Real Est' },
  'QBE.AX': { name: 'QBE Insurance Group',   price: 21.40,  changePct: -0.80, marketCap: 28_000_000_000,  pe: 13.9, eps: 1.54,  divYield: 4.9, volume: 2_700_000,  week52High: 24.10,  week52Low: 16.90,  sector: 'Financials' },
  'COL.AX': { name: 'Coles Group',           price: 18.20,  changePct:  0.30, marketCap: 24_000_000_000,  pe: 22.8, eps: 0.80,  divYield: 3.7, volume: 4_500_000,  week52High: 20.10,  week52Low: 15.40,  sector: 'Staples' },
  'ALL.AX': { name: 'Aristocrat Leisure',    price: 58.90,  changePct:  2.70, marketCap: 48_000_000_000,  pe: 24.6, eps: 2.39,  divYield: 1.6, volume: 1_400_000,  week52High: 66.80,  week52Low: 42.50,  sector: 'Cons Disc' },
  'TCL.AX': { name: 'Transurban Group',      price: 13.40,  changePct: -0.55, marketCap: 45_000_000_000,  pe: 44.7, eps: 0.30,  divYield: 4.2, volume: 6_800_000,  week52High: 14.80,  week52Low: 11.60,  sector: 'Industrials' },
  'WTC.AX': { name: 'WiseTech Global',       price: 118.00, changePct:  3.00, marketCap: 38_000_000_000,  pe: 78.2, eps: 1.51,  divYield: 0.3, volume: 480_000,    week52High: 142.00, week52Low: 68.40,  sector: 'IT' },
  'XRO.AX': { name: 'Xero Limited',          price: 172.50, changePct: -1.20, marketCap: 28_000_000_000,  pe: 88.9, eps: 1.94,  divYield: 0.0, volume: 310_000,    week52High: 205.00, week52Low: 128.00, sector: 'IT' },
  'REA.AX': { name: 'REA Group',             price: 228.00, changePct:  1.45, marketCap: 24_000_000_000,  pe: 47.6, eps: 4.79,  divYield: 1.1, volume: 190_000,    week52High: 262.00, week52Low: 172.00, sector: 'Comms' },
}

// ─── US Top 10 ─────────────────────────────────────────────────────────────
// price/change/volume/52w for AAPL/NVDA/MSFT/GOOGL/AMZN/META/TSLA/JPM/V are
// live figures fetched from FMP's single-quote endpoint this session
// (2026-08-03) — genuinely accurate at the time, will drift over time same
// as any snapshot would. BRK.B has no free single-quote access on any
// vendor tried (symbol resolution issue) — approximated.
export const MOCK_US_STOCKS = {
  AAPL:  { name: 'Apple Inc.',            price: 308.91, changePct: -7.35,  marketCap: 4_537_071_141_960, pe: 26.9, eps: 11.48, divYield: 0.5, volume: 132_489_137, week52High: 344.57, week52Low: 201.68, sector: 'IT' },
  NVDA:  { name: 'NVIDIA Corporation',    price: 200.75, changePct:  2.93,  marketCap: 4_900_000_000_000, pe: 42.1, eps: 4.77,  divYield: 0.0, volume: 139_961_152, week52High: 236.54, week52Low: 164.07, sector: 'IT' },
  MSFT:  { name: 'Microsoft Corporation', price: 464.72, changePct:  3.02,  marketCap: 3_450_000_000_000, pe: 34.6, eps: 13.43, divYield: 0.7, volume: 60_845_971,  week52High: 553.72, week52Low: 349.20, sector: 'IT' },
  GOOGL: { name: 'Alphabet Inc.',         price: 356.13, changePct:  6.73,  marketCap: 4_310_000_000_000, pe: 24.2, eps: 14.72, divYield: 0.4, volume: 46_498_023,  week52High: 408.61, week52Low: 190.12, sector: 'Comms' },
  AMZN:  { name: 'Amazon.com, Inc.',      price: 271.58, changePct: 15.32,  marketCap: 2_850_000_000_000, pe: 38.7, eps: 7.02,  divYield: 0.0, volume: 129_054_771, week52High: 278.56, week52Low: 196.00, sector: 'Cons Disc' },
  META:  { name: 'Meta Platforms, Inc.',  price: 556.71, changePct:  3.28,  marketCap: 1_400_000_000_000, pe: 22.5, eps: 24.74, divYield: 0.3, volume: 24_261_457,  week52High: 796.25, week52Low: 520.26, sector: 'Comms' },
  TSLA:  { name: 'Tesla, Inc.',           price: 311.21, changePct:  0.76,  marketCap: 1_000_000_000_000, pe: 168.2, eps: 1.85, divYield: 0.0, volume: 36_630_560,  week52High: 498.83, week52Low: 297.38, sector: 'Cons Disc' },
  'BRK.B': { name: 'Berkshire Hathaway',  price: 485.00, changePct:  0.40,  marketCap: 1_050_000_000_000, pe: 11.8, eps: 41.10, divYield: 0.0, volume: 3_200_000,   week52High: 512.00, week52Low: 402.00, sector: 'Financials' },
  JPM:   { name: 'JPMorgan Chase & Co.',  price: 351.79, changePct:  0.27,  marketCap: 980_000_000_000,   pe: 14.4, eps: 24.43, divYield: 1.9, volume: 6_583_546,   week52High: 359.30, week52Low: 279.10, sector: 'Financials' },
  V:     { name: 'Visa Inc.',             price: 366.13, changePct: -0.04,  marketCap: 700_000_000_000,   pe: 30.1, eps: 12.16, divYield: 0.7, volume: 4_869_821,   week52High: 373.97, week52Low: 293.89, sector: 'Financials' },
}

// ─── Indices ────────────────────────────────────────────────────────────────
// ^GSPC/^IXIC/^DJI/^FTSE/^N225/^HSI are live FMP figures from this session.
// ^AXJO/^AORD/^GDAXI/000001.SS/^NZ50 are premium-gated on every vendor tried
// — approximated from known real-world levels with a plausible growth drift.
export const MOCK_INDICES = {
  '^AXJO':     { name: 'ASX 200',      price: 9650.0,  changePct: 0.42,  currency: 'AUD' },
  '^AORD':     { name: 'All Ords',     price: 9950.0,  changePct: 0.38,  currency: 'AUD' },
  '^GSPC':     { name: 'S&P 500',      price: 7489.72, changePct: 0.70,  currency: 'USD' },
  '^IXIC':     { name: 'NASDAQ',       price: 25373.85, changePct: 1.00, currency: 'USD' },
  '^DJI':      { name: 'Dow Jones',    price: 52485.03, changePct: 0.53, currency: 'USD' },
  '^FTSE':     { name: 'FTSE 100',     price: 10868.05, changePct: -0.27, currency: 'GBP' },
  '^GDAXI':    { name: 'DAX',          price: 26800.0, changePct: 0.31,  currency: 'EUR' },
  '^N225':     { name: 'Nikkei 225',   price: 63754.9, changePct: -0.94, currency: 'JPY' },
  '^HSI':      { name: 'Hang Seng',    price: 25931.39, changePct: 0.18, currency: 'HKD' },
  '000001.SS': { name: 'Shanghai',     price: 3850.0,  changePct: -0.22, currency: 'CNY' },
  '^NZ50':     { name: 'NZX 50',       price: 13400.0, changePct: 0.24,  currency: 'NZD' },
}

// ─── Crypto Top 20 ──────────────────────────────────────────────────────────
// Built for structural completeness (CoinGecko-shaped, matches
// transformCryptoMarkets' expected input). NOT wired into the live crypto
// path — CoinGecko already returns real, live, unrestricted data with no
// key required, so there is nothing to paper over there. Kept here only as
// an available last-resort fallback if CoinGecko itself is ever down.
export const MOCK_CRYPTO = [
  { id: 'bitcoin',      symbol: 'btc',   name: 'Bitcoin',      current_price: 63000,  price_change_percentage_24h: 0.9,  market_cap: 1_250_000_000_000 },
  { id: 'ethereum',     symbol: 'eth',   name: 'Ethereum',     current_price: 3200,   price_change_percentage_24h: 1.6,  market_cap: 385_000_000_000 },
  { id: 'ripple',       symbol: 'xrp',   name: 'XRP',          current_price: 1.85,   price_change_percentage_24h: -0.8, market_cap: 108_000_000_000 },
  { id: 'binancecoin',  symbol: 'bnb',   name: 'BNB',          current_price: 640,    price_change_percentage_24h: 0.4,  market_cap: 93_000_000_000 },
  { id: 'solana',       symbol: 'sol',   name: 'Solana',       current_price: 210,    price_change_percentage_24h: 2.3,  market_cap: 99_000_000_000 },
  { id: 'cardano',      symbol: 'ada',   name: 'Cardano',      current_price: 0.62,   price_change_percentage_24h: -1.1, market_cap: 22_000_000_000 },
  { id: 'dogecoin',     symbol: 'doge',  name: 'Dogecoin',     current_price: 0.18,   price_change_percentage_24h: 3.1,  market_cap: 26_000_000_000 },
  { id: 'avalanche-2',  symbol: 'avax',  name: 'Avalanche',    current_price: 32.5,   price_change_percentage_24h: 1.2,  market_cap: 13_500_000_000 },
  { id: 'polkadot',     symbol: 'dot',   name: 'Polkadot',     current_price: 6.4,    price_change_percentage_24h: -0.5, market_cap: 9_000_000_000 },
  { id: 'chainlink',    symbol: 'link',  name: 'Chainlink',    current_price: 14.8,   price_change_percentage_24h: 0.9,  market_cap: 9_800_000_000 },
  { id: 'litecoin',     symbol: 'ltc',   name: 'Litecoin',     current_price: 92.0,   price_change_percentage_24h: -0.3, market_cap: 6_900_000_000 },
  { id: 'matic-network', symbol: 'matic', name: 'Polygon',     current_price: 0.55,   price_change_percentage_24h: 1.7,  market_cap: 5_400_000_000 },
  { id: 'shiba-inu',    symbol: 'shib',  name: 'Shiba Inu',    current_price: 0.0000185, price_change_percentage_24h: 2.6, market_cap: 10_900_000_000 },
  { id: 'tron',         symbol: 'trx',   name: 'TRON',         current_price: 0.21,   price_change_percentage_24h: 0.6,  market_cap: 18_200_000_000 },
  { id: 'uniswap',      symbol: 'uni',   name: 'Uniswap',      current_price: 9.6,    price_change_percentage_24h: -1.4, market_cap: 5_800_000_000 },
  { id: 'stellar',      symbol: 'xlm',   name: 'Stellar',      current_price: 0.31,   price_change_percentage_24h: 0.8,  market_cap: 9_200_000_000 },
  { id: 'cosmos',       symbol: 'atom',  name: 'Cosmos',       current_price: 8.1,    price_change_percentage_24h: -0.7, market_cap: 3_100_000_000 },
  { id: 'monero',       symbol: 'xmr',   name: 'Monero',       current_price: 168.0,  price_change_percentage_24h: 1.1,  market_cap: 3_100_000_000 },
  { id: 'ethereum-classic', symbol: 'etc', name: 'Ethereum Classic', current_price: 24.5, price_change_percentage_24h: -0.9, market_cap: 3_600_000_000 },
  { id: 'filecoin',     symbol: 'fil',   name: 'Filecoin',     current_price: 4.9,    price_change_percentage_24h: 1.9,  market_cap: 2_800_000_000 },
]

function lookupBase(symbol) {
  return MOCK_ASX_STOCKS[symbol] || MOCK_US_STOCKS[symbol] || MOCK_INDICES[symbol] || null
}

const NYSE_SYMBOLS = new Set(['JPM', 'V', 'BRK.B'])
function exchangeFor(symbol) {
  if (MOCK_ASX_STOCKS[symbol]) return 'ASX'
  if (MOCK_INDICES[symbol]) return null
  return NYSE_SYMBOLS.has(symbol) ? 'NYSE' : 'NASDAQ'
}

// Returns the same shape fetchFMPQuote/fetchFMPBatch return (pre-legacy-shape
// reshaping) so it slots in as a drop-in replacement for a single row.
export function getMockFMPRow(symbol) {
  const base = lookupBase(symbol)
  if (!base) return null
  const j = jitterFor(symbol)
  const price = round2(base.price * (1 + j))
  const changePct = round2(base.changePct + j * 100)
  const prevClose = round2(price / (1 + changePct / 100))
  const change = round2(price - prevClose)
  const open = round2(prevClose + change * 0.3)
  const dayLow = round2(Math.min(price, prevClose, open) - Math.abs(change) * 0.15)
  const dayHigh = round2(Math.max(price, prevClose, open) + Math.abs(change) * 0.15)
  return {
    symbol,
    shortName: base.name,
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePct,
    regularMarketPreviousClose: prevClose,
    regularMarketOpen: open,
    regularMarketDayHigh: dayHigh,
    regularMarketDayLow: dayLow,
    regularMarketVolume: base.volume ?? null,
    averageVolume: base.volume ? Math.round(base.volume * 0.92) : null,
    marketCap: base.marketCap ?? null,
    trailingPE: base.pe ?? null,
    epsTrailingTwelveMonths: base.eps ?? null,
    fiftyTwoWeekHigh: base.week52High ?? null,
    fiftyTwoWeekLow: base.week52Low ?? null,
    sharesOutstanding: base.marketCap && price ? Math.round(base.marketCap / price) : null,
    exchange: exchangeFor(symbol),
    priceAvg50: round2(price * 0.985),
    priceAvg200: round2(price * 0.95),
    currency: base.currency ?? (MOCK_ASX_STOCKS[symbol] ? 'AUD' : (MOCK_US_STOCKS[symbol] ? 'USD' : 'USD')),
  }
}

// Returns 'days' trading days (Mon-Fri) of OHLCV, oldest first, ending today —
// same shape fetchFMPHistory returns. The final close matches the same
// jittered current price getMockFMPRow uses, so a chart + a quote for the
// same symbol agree.
export function getMockFMPHistory(symbol, days = 30) {
  const base = lookupBase(symbol)
  if (!base) return []
  const rng = mulberry32(hashStr(symbol) ^ 0x9e3779b9)
  const j = jitterFor(symbol)
  const endPrice = base.price * (1 + j)

  const closes = [endPrice]
  for (let i = 1; i < days; i++) {
    const dailyRet = (rng() - 0.5) * 0.024 // ~±1.2% typical daily move
    closes.push(closes[closes.length - 1] / (1 + dailyRet))
  }
  closes.reverse() // oldest first, closes[last] === endPrice

  const dates = []
  let d = new Date()
  while (dates.length < days) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) dates.unshift(new Date(d))
    d = new Date(d.getTime() - 86400000)
  }

  return dates.map((dt, i) => {
    const close = closes[i]
    const prevC = i > 0 ? closes[i - 1] : close * 0.998
    const open = prevC
    const high = Math.max(open, close) * (1 + rng() * 0.006)
    const low = Math.min(open, close) * (1 - rng() * 0.006)
    return {
      date: dt.toISOString().slice(0, 10),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: base.volume ? Math.round(base.volume * (0.7 + rng() * 0.6)) : 0,
    }
  })
}
