import axios from 'axios'

// ─── Internal cache ───────────────────────────────────────────────────────────

const _cache = new Map()
const setCache = (k, v, ttlMs) => _cache.set(k, { v, exp: Date.now() + ttlMs })
const getCache = (k) => { const e = _cache.get(k); return (e && Date.now() < e.exp) ? e.v : null }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))  // eslint-disable-line no-unused-vars

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

// Last-known fallback values (Jun 2026) — shown when stooq is unavailable
const STOOQ_FALLBACK = {
  // Global indices
  '^axjo': { last: 8820,  open: 8800,  high: 8850,  low: 8780,  vol: 0, change:  20, pct: 0.23, name: 'ASX 200',      currency: 'AUD', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^aord': { last: 8620,  open: 8600,  high: 8650,  low: 8580,  vol: 0, change:  20, pct: 0.23, name: 'All Ords',      currency: 'AUD', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^spx':  { last: 5870,  open: 5850,  high: 5895,  low: 5840,  vol: 0, change:  20, pct: 0.34, name: 'S&P 500',      currency: 'USD', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^ndx':  { last: 21400, open: 21300, high: 21500, low: 21250,  vol: 0, change: 100, pct: 0.47, name: 'NASDAQ-100',   currency: 'USD', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^dji':  { last: 42900, open: 42800, high: 43100, low: 42700,  vol: 0, change: 100, pct: 0.23, name: 'Dow Jones',    currency: 'USD', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^ukx':  { last: 8720,  open: 8700,  high: 8740,  low: 8690,  vol: 0, change:  20, pct: 0.23, name: 'FTSE 100',     currency: 'GBP', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^dax':  { last: 23500, open: 23400, high: 23600, low: 23300,  vol: 0, change: 100, pct: 0.43, name: 'DAX',          currency: 'EUR', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^nkx':  { last: 38200, open: 38100, high: 38400, low: 38000,  vol: 0, change: 100, pct: 0.26, name: 'Nikkei 225',  currency: 'JPY', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^hsi':  { last: 23100, open: 23000, high: 23200, low: 22900,  vol: 0, change: 100, pct: 0.43, name: 'Hang Seng',   currency: 'HKD', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  '^nz50': { last: 12800, open: 12780, high: 12840, low: 12760,  vol: 0, change:  20, pct: 0.16, name: 'NZX 50',      currency: 'NZD', isOpen: false, fallback: true, timestamp: '2026-06-13' },
  // ASX blue chips (Jun 2026 prices in AUD — stooq returns AUD for .au symbols, no conversion needed)
  'bhp.au':  { last: 63.50,  open: 63.00, high: 64.20, low: 62.80, vol: 8500000,  change:  0.50, pct:  0.79, name: 'BHP Group',         currency: 'AUD', isOpen: false, fallback: true },
  'cba.au':  { last: 170.00, open: 169.00, high: 171.50, low: 168.50, vol: 3200000, change:  1.00, pct:  0.59, name: 'CommBank',         currency: 'AUD', isOpen: false, fallback: true },
  'csl.au':  { last: 270.00, open: 268.00, high: 272.00, low: 267.00, vol: 900000,  change:  2.00, pct:  0.75, name: 'CSL Ltd',          currency: 'AUD', isOpen: false, fallback: true },
  'wow.au':  { last: 38.00,  open: 37.80, high: 38.40,  low: 37.60,  vol: 3000000,  change:  0.20, pct:  0.53, name: 'Woolworths',       currency: 'AUD', isOpen: false, fallback: true },
  'anz.au':  { last: 33.00,  open: 32.80, high: 33.30,  low: 32.70,  vol: 6000000,  change:  0.20, pct:  0.61, name: 'ANZ Banking',      currency: 'AUD', isOpen: false, fallback: true },
  'nab.au':  { last: 42.00,  open: 41.70, high: 42.30,  low: 41.50,  vol: 5500000,  change:  0.30, pct:  0.72, name: 'NAB',              currency: 'AUD', isOpen: false, fallback: true },
  'wbc.au':  { last: 35.00,  open: 34.80, high: 35.30,  low: 34.70,  vol: 5000000,  change:  0.20, pct:  0.57, name: 'Westpac Banking',  currency: 'AUD', isOpen: false, fallback: true },
  'mqg.au':  { last: 245.00, open: 243.00, high: 247.00, low: 242.00, vol: 1200000, change:  2.00, pct:  0.82, name: 'Macquarie Group',  currency: 'AUD', isOpen: false, fallback: true },
  'rio.au':  { last: 125.00, open: 124.00, high: 126.00, low: 123.50, vol: 2100000,  change:  1.00, pct:  0.81, name: 'Rio Tinto',        currency: 'AUD', isOpen: false, fallback: true },
  'tls.au':  { last: 4.50,   open: 4.47,  high: 4.53,   low: 4.45,   vol: 22000000, change:  0.03, pct:  0.67, name: 'Telstra',          currency: 'AUD', isOpen: false, fallback: true },
  'fmg.au':  { last: 19.00,  open: 18.80, high: 19.20,  low: 18.70,  vol: 9500000,  change:  0.20, pct:  1.06, name: 'Fortescue',        currency: 'AUD', isOpen: false, fallback: true },
  'wes.au':  { last: 82.00,  open: 81.50, high: 82.50,  low: 81.20,  vol: 2000000,  change:  0.50, pct:  0.61, name: 'Wesfarmers',       currency: 'AUD', isOpen: false, fallback: true },
  'gmg.au':  { last: 38.00,  open: 37.70, high: 38.40,  low: 37.60,  vol: 3500000,  change:  0.30, pct:  0.80, name: 'Goodman Group',    currency: 'AUD', isOpen: false, fallback: true },
  'rea.au':  { last: 262.00, open: 260.00, high: 264.00, low: 259.00, vol: 450000,   change:  2.00, pct:  0.77, name: 'REA Group',        currency: 'AUD', isOpen: false, fallback: true },
  'min.au':  { last: 32.00,  open: 31.70, high: 32.40,  low: 31.50,  vol: 4000000,  change:  0.30, pct:  0.95, name: 'Mineral Resources', currency: 'AUD', isOpen: false, fallback: true },
  'nem.au':  { last: 75.00,  open: 74.00, high: 76.00,  low: 73.50,  vol: 1800000,  change:  1.00, pct:  1.35, name: 'Newmont',          currency: 'AUD', isOpen: false, fallback: true },
  'sto.au':  { last: 8.00,   open: 7.95,  high: 8.10,   low: 7.90,   vol: 8000000,  change:  0.05, pct:  0.63, name: 'Santos',           currency: 'AUD', isOpen: false, fallback: true },
  'wds.au':  { last: 27.00,  open: 26.80, high: 27.30,  low: 26.70,  vol: 5000000,  change:  0.20, pct:  0.75, name: 'Woodside Energy',  currency: 'AUD', isOpen: false, fallback: true },
  'agl.au':  { last: 13.00,  open: 12.90, high: 13.15,  low: 12.85,  vol: 6000000,  change:  0.10, pct:  0.78, name: 'AGL Energy',       currency: 'AUD', isOpen: false, fallback: true },
  'all.au':  { last: 58.00,  open: 57.60, high: 58.50,  low: 57.40,  vol: 1500000,  change:  0.40, pct:  0.69, name: 'Aristocrat',       currency: 'AUD', isOpen: false, fallback: true },
  // US large caps
  'aapl.us': { last: 213.00, open: 212.00, high: 214.50, low: 211.50, vol: 45000000,  change:  1.00, pct:  0.47, name: 'Apple',           currency: 'USD', isOpen: false, fallback: true },
  'nvda.us': { last: 137.00, open: 135.00, high: 138.50, low: 134.50, vol: 95000000,  change:  2.00, pct:  1.48, name: 'NVIDIA',          currency: 'USD', isOpen: false, fallback: true },
  'msft.us': { last: 445.00, open: 443.00, high: 447.00, low: 442.00, vol: 18000000,  change:  2.00, pct:  0.45, name: 'Microsoft',       currency: 'USD', isOpen: false, fallback: true },
  'tsla.us': { last: 340.00, open: 335.00, high: 345.00, low: 333.00, vol: 80000000,  change:  5.00, pct:  1.49, name: 'Tesla',           currency: 'USD', isOpen: false, fallback: true },
  'amzn.us': { last: 220.00, open: 218.00, high: 222.00, low: 217.50, vol: 35000000,  change:  2.00, pct:  0.92, name: 'Amazon',          currency: 'USD', isOpen: false, fallback: true },
  'meta.us': { last: 605.00, open: 600.00, high: 608.00, low: 598.00, vol: 12000000,  change:  5.00, pct:  0.83, name: 'Meta',            currency: 'USD', isOpen: false, fallback: true },
  'goog.us': { last: 178.00, open: 176.50, high: 179.50, low: 176.00, vol: 22000000,  change:  1.50, pct:  0.85, name: 'Alphabet',        currency: 'USD', isOpen: false, fallback: true },
  'googl.us':{ last: 178.00, open: 176.50, high: 179.50, low: 176.00, vol: 22000000,  change:  1.50, pct:  0.85, name: 'Alphabet',        currency: 'USD', isOpen: false, fallback: true },
  'nflx.us': { last: 1120.00, open: 1110.00, high: 1130.00, low: 1105.00, vol: 3000000, change: 10.00, pct:  0.90, name: 'Netflix',       currency: 'USD', isOpen: false, fallback: true },
  'amd.us':  { last: 148.00, open: 145.00, high: 150.00, low: 144.00, vol: 40000000,  change:  3.00, pct:  2.07, name: 'AMD',             currency: 'USD', isOpen: false, fallback: true },
  'intc.us': { last: 22.50,  open: 22.20,  high: 22.80,  low: 22.00,  vol: 30000000,  change:  0.30, pct:  1.35, name: 'Intel',           currency: 'USD', isOpen: false, fallback: true },
  'jpm.us':  { last: 248.00, open: 246.00, high: 250.00, low: 245.00, vol: 8000000,   change:  2.00, pct:  0.81, name: 'JPMorgan',        currency: 'USD', isOpen: false, fallback: true },
  'bac.us':  { last: 44.50,  open: 44.00,  high: 45.00,  low: 43.80,  vol: 35000000,  change:  0.50, pct:  1.14, name: 'Bank of America', currency: 'USD', isOpen: false, fallback: true },
  'gs.us':   { last: 572.00, open: 568.00, high: 575.00, low: 566.00, vol: 2000000,   change:  4.00, pct:  0.70, name: 'Goldman Sachs',   currency: 'USD', isOpen: false, fallback: true },
  'ms.us':   { last: 132.00, open: 130.00, high: 133.00, low: 129.50, vol: 10000000,  change:  2.00, pct:  1.54, name: 'Morgan Stanley',  currency: 'USD', isOpen: false, fallback: true },
  'v.us':    { last: 338.00, open: 335.00, high: 340.00, low: 334.00, vol: 5500000,   change:  3.00, pct:  0.90, name: 'Visa',            currency: 'USD', isOpen: false, fallback: true },
  'ma.us':   { last: 535.00, open: 530.00, high: 538.00, low: 528.00, vol: 3000000,   change:  5.00, pct:  0.95, name: 'Mastercard',      currency: 'USD', isOpen: false, fallback: true },
  'unh.us':  { last: 495.00, open: 492.00, high: 498.00, low: 490.00, vol: 3500000,   change:  3.00, pct:  0.61, name: 'UnitedHealth',    currency: 'USD', isOpen: false, fallback: true },
  'jnj.us':  { last: 159.00, open: 158.00, high: 160.00, low: 157.50, vol: 8000000,   change:  1.00, pct:  0.63, name: 'Johnson & Johnson', currency: 'USD', isOpen: false, fallback: true },
  'xom.us':  { last: 124.00, open: 122.50, high: 125.00, low: 122.00, vol: 15000000,  change:  1.50, pct:  1.23, name: 'ExxonMobil',      currency: 'USD', isOpen: false, fallback: true },
  'cvx.us':  { last: 170.00, open: 168.00, high: 171.00, low: 167.50, vol: 9000000,   change:  2.00, pct:  1.20, name: 'Chevron',         currency: 'USD', isOpen: false, fallback: true },
  // S&P 500 / Dow extra constituents
  'brk-b.us':{ last: 480.00, open: 477.00, high: 482.00, low: 476.00, vol: 4000000,   change:  3.00, pct:  0.63, name: 'Berkshire Hathaway B', currency: 'USD', isOpen: false, fallback: true },
  'pg.us':   { last: 170.00, open: 168.50, high: 171.00, low: 168.00, vol: 7000000,   change:  1.50, pct:  0.89, name: 'P&G',             currency: 'USD', isOpen: false, fallback: true },
  'hd.us':   { last: 375.00, open: 372.00, high: 377.00, low: 371.00, vol: 3000000,   change:  3.00, pct:  0.81, name: 'Home Depot',      currency: 'USD', isOpen: false, fallback: true },
  'avgo.us': { last: 245.00, open: 242.00, high: 247.00, low: 241.00, vol: 8000000,   change:  3.00, pct:  1.24, name: 'Broadcom',        currency: 'USD', isOpen: false, fallback: true },
  'mrk.us':  { last: 130.00, open: 128.50, high: 131.00, low: 128.00, vol: 10000000,  change:  1.50, pct:  1.17, name: 'Merck',           currency: 'USD', isOpen: false, fallback: true },
  'abbv.us': { last: 195.00, open: 193.00, high: 196.50, low: 192.50, vol: 7000000,   change:  2.00, pct:  1.04, name: 'AbbVie',          currency: 'USD', isOpen: false, fallback: true },
  // NASDAQ 100 extra
  'cost.us': { last: 975.00, open: 968.00, high: 980.00, low: 966.00, vol: 1500000,   change:  7.00, pct:  0.72, name: 'Costco',          currency: 'USD', isOpen: false, fallback: true },
  'adbe.us': { last: 450.00, open: 445.00, high: 453.00, low: 444.00, vol: 3000000,   change:  5.00, pct:  1.12, name: 'Adobe',           currency: 'USD', isOpen: false, fallback: true },
  'qcom.us': { last: 185.00, open: 182.00, high: 187.00, low: 181.00, vol: 6000000,   change:  3.00, pct:  1.65, name: 'Qualcomm',        currency: 'USD', isOpen: false, fallback: true },
  'txn.us':  { last: 210.00, open: 207.00, high: 212.00, low: 206.50, vol: 5000000,   change:  3.00, pct:  1.45, name: 'Texas Instruments',currency: 'USD', isOpen: false, fallback: true },
  'intu.us': { last: 700.00, open: 694.00, high: 705.00, low: 692.00, vol: 1200000,   change:  6.00, pct:  0.86, name: 'Intuit',          currency: 'USD', isOpen: false, fallback: true },
  'amgn.us': { last: 318.00, open: 315.00, high: 320.00, low: 314.00, vol: 2500000,   change:  3.00, pct:  0.95, name: 'Amgen',           currency: 'USD', isOpen: false, fallback: true },
  'amat.us': { last: 205.00, open: 202.00, high: 207.00, low: 201.00, vol: 4000000,   change:  3.00, pct:  1.49, name: 'Applied Materials',currency: 'USD', isOpen: false, fallback: true },
  'mu.us':   { last: 135.00, open: 132.00, high: 137.00, low: 131.00, vol: 12000000,  change:  3.00, pct:  2.27, name: 'Micron',          currency: 'USD', isOpen: false, fallback: true },
  // Dow 30 extra
  'cat.us':  { last: 370.00, open: 366.00, high: 372.00, low: 365.00, vol: 2500000,   change:  4.00, pct:  1.09, name: 'Caterpillar',     currency: 'USD', isOpen: false, fallback: true },
  'crm.us':  { last: 320.00, open: 316.00, high: 323.00, low: 315.00, vol: 4000000,   change:  4.00, pct:  1.27, name: 'Salesforce',      currency: 'USD', isOpen: false, fallback: true },
  'mcd.us':  { last: 310.00, open: 307.00, high: 312.00, low: 306.00, vol: 3000000,   change:  3.00, pct:  0.98, name: 'McDonald\'s',     currency: 'USD', isOpen: false, fallback: true },
  'axp.us':  { last: 295.00, open: 292.00, high: 297.00, low: 291.00, vol: 2000000,   change:  3.00, pct:  1.03, name: 'American Express',currency: 'USD', isOpen: false, fallback: true },
  'ba.us':   { last: 210.00, open: 206.00, high: 213.00, low: 205.00, vol: 6000000,   change:  4.00, pct:  1.94, name: 'Boeing',          currency: 'USD', isOpen: false, fallback: true },
  'hon.us':  { last: 215.00, open: 212.00, high: 217.00, low: 211.50, vol: 3000000,   change:  3.00, pct:  1.41, name: 'Honeywell',       currency: 'USD', isOpen: false, fallback: true },
  'ibm.us':  { last: 225.00, open: 222.00, high: 227.00, low: 221.00, vol: 3500000,   change:  3.00, pct:  1.35, name: 'IBM',             currency: 'USD', isOpen: false, fallback: true },
  'trv.us':  { last: 265.00, open: 262.00, high: 267.00, low: 261.00, vol: 1200000,   change:  3.00, pct:  1.15, name: 'Travelers',       currency: 'USD', isOpen: false, fallback: true },
  'wmt.us':  { last: 95.00,  open: 94.00,  high: 96.00,  low: 93.50,  vol: 15000000,  change:  1.00, pct:  1.07, name: 'Walmart',         currency: 'USD', isOpen: false, fallback: true },
  'mmm.us':  { last: 140.00, open: 138.00, high: 141.00, low: 137.50, vol: 3000000,   change:  2.00, pct:  1.45, name: '3M',              currency: 'USD', isOpen: false, fallback: true },
  'dis.us':  { last: 102.00, open: 100.00, high: 103.00, low: 99.50,  vol: 12000000,  change:  2.00, pct:  2.00, name: 'Walt Disney',     currency: 'USD', isOpen: false, fallback: true },
  'ko.us':   { last: 73.00,  open: 72.50,  high: 73.50,  low: 72.00,  vol: 15000000,  change:  0.50, pct:  0.69, name: 'Coca-Cola',       currency: 'USD', isOpen: false, fallback: true },
  'vz.us':   { last: 40.00,  open: 39.50,  high: 40.30,  low: 39.30,  vol: 25000000,  change:  0.50, pct:  1.27, name: 'Verizon',         currency: 'USD', isOpen: false, fallback: true },
  'nke.us':  { last: 92.00,  open: 90.50,  high: 93.00,  low: 90.00,  vol: 10000000,  change:  1.50, pct:  1.66, name: 'Nike',            currency: 'USD', isOpen: false, fallback: true },
  'dow.us':  { last: 52.00,  open: 51.00,  high: 52.50,  low: 50.80,  vol: 8000000,   change:  1.00, pct:  1.96, name: 'Dow Inc',         currency: 'USD', isOpen: false, fallback: true },
  'wba.us':  { last: 12.50,  open: 12.20,  high: 12.70,  low: 12.10,  vol: 10000000,  change:  0.30, pct:  2.46, name: 'Walgreens',       currency: 'USD', isOpen: false, fallback: true },
  // FTSE 100 proxies (US-listed)
  'shel.us': { last: 72.00,  open: 71.00,  high: 72.50,  low: 70.80,  vol: 5000000,   change:  1.00, pct:  1.41, name: 'Shell',           currency: 'USD', isOpen: false, fallback: true },
  'azn.us':  { last: 85.00,  open: 84.00,  high: 85.80,  low: 83.50,  vol: 3000000,   change:  1.00, pct:  1.19, name: 'AstraZeneca',     currency: 'USD', isOpen: false, fallback: true },
  'hsba.us': { last: 44.00,  open: 43.50,  high: 44.50,  low: 43.30,  vol: 2000000,   change:  0.50, pct:  1.15, name: 'HSBC',            currency: 'USD', isOpen: false, fallback: true },
  'ulvr.us': { last: 55.00,  open: 54.50,  high: 55.50,  low: 54.20,  vol: 1000000,   change:  0.50, pct:  0.92, name: 'Unilever',        currency: 'USD', isOpen: false, fallback: true },
  'bp.us':   { last: 35.00,  open: 34.50,  high: 35.30,  low: 34.30,  vol: 6000000,   change:  0.50, pct:  1.45, name: 'BP',              currency: 'USD', isOpen: false, fallback: true },
  'gsk.us':  { last: 42.00,  open: 41.50,  high: 42.40,  low: 41.30,  vol: 3000000,   change:  0.50, pct:  1.20, name: 'GSK',             currency: 'USD', isOpen: false, fallback: true },
  'bhp.us':  { last: 55.00,  open: 54.50,  high: 55.50,  low: 54.20,  vol: 2000000,   change:  0.50, pct:  0.92, name: 'BHP ADR',         currency: 'USD', isOpen: false, fallback: true },
  'dge.us':  { last: 28.00,  open: 27.50,  high: 28.30,  low: 27.40,  vol: 1500000,   change:  0.50, pct:  1.82, name: 'Diageo',          currency: 'USD', isOpen: false, fallback: true },
  'lloy.us': { last: 3.20,   open: 3.15,   high: 3.24,   low: 3.12,   vol: 5000000,   change:  0.05, pct:  1.59, name: 'Lloyds Banking',  currency: 'USD', isOpen: false, fallback: true },
  'barc.us': { last: 16.00,  open: 15.70,  high: 16.20,  low: 15.60,  vol: 4000000,   change:  0.30, pct:  1.91, name: 'Barclays',        currency: 'USD', isOpen: false, fallback: true },
  'vod.us':  { last: 10.00,  open: 9.80,   high: 10.10,  low: 9.75,   vol: 8000000,   change:  0.20, pct:  2.04, name: 'Vodafone',        currency: 'USD', isOpen: false, fallback: true },
  'bats.us': { last: 40.00,  open: 39.50,  high: 40.30,  low: 39.40,  vol: 1500000,   change:  0.50, pct:  1.27, name: 'BAT',             currency: 'USD', isOpen: false, fallback: true },
  'ng.us':   { last: 22.00,  open: 21.70,  high: 22.20,  low: 21.60,  vol: 1000000,   change:  0.30, pct:  1.38, name: 'National Grid',   currency: 'USD', isOpen: false, fallback: true },
  'pru.us':  { last: 32.00,  open: 31.50,  high: 32.30,  low: 31.40,  vol: 1500000,   change:  0.50, pct:  1.59, name: 'Prudential',      currency: 'USD', isOpen: false, fallback: true },
  // Nikkei 225 proxies (US-listed ADRs)
  'tm.us':   { last: 185.00, open: 183.00, high: 186.50, low: 182.50, vol: 3000000,   change:  2.00, pct:  1.09, name: 'Toyota',          currency: 'USD', isOpen: false, fallback: true },
  'sny.us':  { last: 12.50,  open: 12.30,  high: 12.60,  low: 12.20,  vol: 2000000,   change:  0.20, pct:  1.63, name: 'Sony Corp',       currency: 'USD', isOpen: false, fallback: true },
  'hmc.us':  { last: 32.00,  open: 31.50,  high: 32.30,  low: 31.30,  vol: 2500000,   change:  0.50, pct:  1.59, name: 'Honda',           currency: 'USD', isOpen: false, fallback: true },
  'sony.us': { last: 22.00,  open: 21.70,  high: 22.30,  low: 21.60,  vol: 1500000,   change:  0.30, pct:  1.38, name: 'Sony Group',      currency: 'USD', isOpen: false, fallback: true },
  'ntt.us':  { last: 24.00,  open: 23.70,  high: 24.20,  low: 23.60,  vol: 1000000,   change:  0.30, pct:  1.27, name: 'NTT',             currency: 'USD', isOpen: false, fallback: true },
  'mfg.us':  { last: 4.80,   open: 4.75,   high: 4.83,   low: 4.73,   vol: 5000000,   change:  0.05, pct:  1.05, name: 'Mizuho Financial',currency: 'USD', isOpen: false, fallback: true },
  'mufg.us': { last: 12.00,  open: 11.80,  high: 12.10,  low: 11.75,  vol: 3000000,   change:  0.20, pct:  1.70, name: 'Mitsubishi UFJ', currency: 'USD', isOpen: false, fallback: true },
  // ASX extra
  'xro.au':  { last: 165.00, open: 163.00, high: 167.00, low: 162.00, vol: 1500000,   change:  2.00, pct:  1.24, name: 'Xero',            currency: 'AUD', isOpen: false, fallback: true },
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
  return out
}

export async function fetchYahooQuote(symbol) {
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
    const cached = getCache(url)
    if (cached) return cached
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
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
    // Fall back to last-known values so components always have something to display
    const stooqSym = yfToStooq(symbol)
    const fb = STOOQ_FALLBACK[stooqSym]
    if (fb) {
      console.warn(`[MADDEN API] ⚠ Using fallback for ${symbol}`)
      const q = {
        ...fb, symbol,
        price:       fb.last,
        dayChange:   fb.change ?? 0,
        dayChangePct: fb.pct ?? 0,
        prevClose:   fb.last - (fb.change ?? 0),
        fallback:    true,
      }
      return q
    }
    return null
  }
}

export async function fetchYahooHistory(symbol, range = '3mo') {
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
    const cached = getCache(url)
    if (cached) return cached
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } })
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
  return out
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

// fetchYFQuote: delegates to Yahoo for stocks, stooq for indices
export const fetchYFQuote = async (symbol) => {
  const stooqSym = yfToStooq(symbol)
  if (stooqSym.startsWith('^')) {
    try {
      const data = await fetchStooqQuote(stooqSym)
      return { ...data, symbol }
    } catch (e) {
      const fb = STOOQ_FALLBACK[stooqSym]
      if (fb) return { ...fb, symbol }
      throw e
    }
  }
  const q = await fetchYahooQuote(symbol)
  if (q) return q
  const fb = STOOQ_FALLBACK[stooqSym] ?? STOOQ_FALLBACK[symbol.toLowerCase()]
  if (fb) { console.warn(`[MADDEN API] Using fallback for ${symbol}`); return { ...fb, symbol } }
  throw new Error(`No data for ${symbol}`)
}

// fetchYFBatch: INDICES ONLY via stooq — used by IndicesTable
export const fetchYFBatch = async (symbols) => {
  const results = await Promise.allSettled(symbols.map(s => fetchStooqQuote(yfToStooq(s))))
  const out = {}
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i]
    if (results[i].status === 'fulfilled') {
      out[sym] = { ...results[i].value, symbol: sym }
    } else {
      const fb = STOOQ_FALLBACK[yfToStooq(sym)]
      if (fb) { out[sym] = { ...fb, symbol: sym }; console.warn(`[MADDEN API] Stooq fallback ${sym}`) }
      else console.warn(`[MADDEN API] Stooq fail ${sym}:`, results[i].reason?.message)
    }
  }
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

// ─── Frankfurter FX (via proxy → /api/frankfurter) ───────────────────────────

export const fetchFxRates = async (base = 'AUD') => {
  const { data } = await axios.get(`/api/frankfurter/latest?from=${base}`)
  if (!data?.rates) throw new Error('Frankfurter: no rates in response')
  console.log('[MADDEN API] Frankfurter /latest?from=' + base + ':', Object.keys(data.rates).length, 'currencies')
  return data.rates
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

const RSS_FEEDS = [
  { url: 'https://www.afr.com/rss',                                       source: 'AFR'     },
  { url: 'https://feeds.reuters.com/reuters/businessNews',                source: 'Reuters' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',        source: 'CNBC'    },
]

// Separate world/geo news feeds for the Global Intelligence module
export const GEO_RSS_FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/worldNews',          source: 'Reuters World' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',         source: 'BBC World'     },
  { url: 'https://feeds.reuters.com/reuters/topNews',            source: 'Reuters Top'   },
]

const NEWS_EXCLUDE_WORDS = new Set([
  'THE', 'AND', 'FOR', 'FROM', 'WITH', 'THAT', 'THIS', 'ARE', 'WAS', 'HAS',
  'HAVE', 'HAD', 'NOT', 'BUT', 'ITS', 'NEW', 'TOP', 'ALL', 'MORE', 'CAN',
  'CEO', 'CFO', 'COO', 'IPO', 'GDP', 'CPI', 'FED', 'SEC', 'USA', 'USD',
  'EUR', 'GBP', 'JPY', 'ETF', 'NFP', 'PMI', 'ISM', 'IMF', 'WHO', 'ESG',
  'AI', 'YOY', 'QOQ', 'YTD', 'TTM', 'PE', 'EPS', 'ROE', 'US', 'EU', 'UK',
  'UN', 'NATO', 'OPEC', 'GOP', 'DOJ', 'DOE', 'IRS', 'FTC', 'FCC', 'FDIC',
])

const inferNewsTag = (title, categories = []) => {
  const text = `${title} ${categories.join(' ')}`.toLowerCase()
  if (/bitcoin|ethereum|crypto|blockchain|defi|solana|web3/i.test(text))                            return 'CRYPTO'
  if (/rba|asx|asx200|australia|australian|aud|cpi|rba|macquarie|commbank|bhp|rio|csiro/i.test(text)) return 'AU'
  if (/fed|fomc|inflation|cpi|interest rate|yield|treasury|macro|recession|gdp|fiscal/i.test(text)) return 'MACRO'
  if (/oil|energy|crude|natural gas|opec|exxon|chevron|petroleum/i.test(text))                      return 'ENERGY'
  if (/forex|dollar|euro|yen|currency|fx|exchange rate/i.test(text))                                return 'FX'
  if (/merger|acquisition|buyout|deal|takeover/i.test(text))                                        return 'M&A'
  if (/earnings|revenue|profit|eps|guidance|quarterly|q[1-4] 20/i.test(text))                       return 'EARNINGS'
  if (/bond|yield|debt|treasur|rate hike|rate cut/i.test(text))                                     return 'RATES'
  if (/china|europe|asia|japan|india|global|international|emerging market/i.test(text))             return 'INTL'
  return 'EQUITY'
}

const extractTickers = (title, description = '') => {
  const text    = `${title} ${description}`
  const matches = text.match(/\b[A-Z]{2,5}\b/g) || []
  return [...new Set(matches.filter((w) => !NEWS_EXCLUDE_WORDS.has(w)))].slice(0, 4)
}

const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)
}

export const fetchNews = async () => {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(({ url, source }) =>
      axios.get(RSS2JSON_BASE, { params: { rss_url: url, count: 20 } })
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
      const tag     = inferNewsTag(item.title, item.categories)
      items.push({
        id:       id++,
        time:     pubDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        pubDate,
        source,
        tag,
        headline: item.title?.trim() || '(No title)',
        summary:  stripHtml(item.description || item.content),
        link:     item.link,
        tickers:  extractTickers(item.title, item.description),
        priority: ['AFR', 'ASX', 'RBA'].includes(source) || tag === 'AU' ? 0 : 1,
      })
    }
  }
  items.sort((a, b) => a.priority - b.priority || b.pubDate - a.pubDate)
  console.log('[MADDEN API] RSS2JSON news:', items.length, 'articles')
  return items
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
      axios.get(RSS2JSON_BASE, { params: { rss_url: url, count: 25 } })
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

export const askClaude = async (messages, onToken) => {
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
      system: `You are MADDEN AI, an elite Australian financial markets analyst specialising in ASX equities, AUD currency pairs, RBA monetary policy, and Australian macroeconomic conditions. Cover global markets from an Australian investor perspective. Quote all prices and values in AUD. Be concise and data-driven. Use professional financial language. When analysing stocks, consider franking credits, commodity exposure, China trade links, and ASX sector dynamics. Never give personal financial advice. Format responses compactly for terminal display. Lead with the most important insight.`,
      messages,
    }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${err}`)
  }
  const reader   = response.body.getReader()
  const decoder  = new TextDecoder()
  let fullText   = ''
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
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          fullText += evt.delta.text
          onToken?.(evt.delta.text, fullText)
        }
      } catch {}
    }
  }
  return fullText
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLargeNum(n) {
  if (!n || isNaN(n)) return '—'
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
  return n.toString()
}
