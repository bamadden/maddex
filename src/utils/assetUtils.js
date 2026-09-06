export function detectAssetType(symbol, meta = {}) {
  if (meta.type) return meta.type
  const s = symbol.toUpperCase()
  // Yahoo Finance format hints
  if (s.startsWith('^'))      return 'index'
  if (s.endsWith('-USD'))     return 'crypto'
  if (s.endsWith('.AX') || s.endsWith('.AU') || s.endsWith(':ASX')) return 'asx'
  const CRYPTO  = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT', 'MATIC', 'LINK', 'LTC']
  if (CRYPTO.includes(s)) return 'crypto'
  const FX      = ['AUDUSD', 'AUDEUR', 'AUDGBP', 'AUDJPY', 'AUDNZD', 'EURUSD', 'USDJPY', 'GBPUSD']
  if (FX.includes(s.replace('/', '')) || s.includes('/')) return 'fx'
  const INDICES = ['XJO', 'SPX', 'IXIC', 'DJI', 'UKX', 'DAX', 'N225', 'NDX', 'RUT', 'VIX', 'HSI', 'SSEC', 'AXJO', 'GSPC', 'NZ50']
  if (INDICES.includes(s)) return 'index'
  const METALS  = ['XAU', 'XAG', 'XPT', 'GOLD', 'SILVER']
  if (METALS.includes(s)) return 'commodity'
  const ASX_KNOWN = ['BHP', 'CBA', 'CSL', 'ANZ', 'WBC', 'NAB', 'WOW', 'RIO', 'MQG', 'TLS', 'WDS', 'STO', 'AGL', 'ORG', 'AMC', 'FMG', 'MIN', 'PLS']
  if (ASX_KNOWN.includes(s)) return 'asx'
  return 'us'
}

// Convert a symbol to Yahoo Finance format
// ASX stocks: BHP → BHP.AX, BHP:ASX → BHP.AX
// Indices:    XJO → ^AXJO, SPX → ^GSPC, etc.
// US stocks:  AAPL → AAPL
// Already-formatted symbols (^, .AX, -USD) are returned as-is
export function toYahooSymbol(symbol, type) {
  const s = symbol.toUpperCase().trim()

  // Already in Yahoo Finance format — passthrough
  if (s.startsWith('^'))  return s
  if (s.endsWith('-USD')) return s
  if (s.endsWith('.AX'))  return s

  // Old Twelve Data :ASX format → Yahoo .AX format
  if (s.endsWith(':ASX')) return s.replace(':ASX', '') + '.AX'

  // ASX by explicit type
  if (type === 'asx') return s + '.AX'

  // Old-style index symbols → Yahoo ^ format
  const INDEX_MAP = {
    XJO: '^AXJO', SPX: '^GSPC', IXIC: '^IXIC', DJI: '^DJI',
    UKX: '^FTSE', DAX: '^GDAXI', N225: '^N225', HSI: '^HSI', NZ50: '^NZ50',
  }
  if (INDEX_MAP[s]) return INDEX_MAP[s]

  return s
}

export const COIN_IDS_MAP = {
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

export function timeframeToDays(tf) {
  // 'ALL' is 10 years rather than a literal maximum: CoinGecko's free tier
  // caps history anyway, and an unbounded request is the one that gets rate
  // limited. Without this entry ALL fell through to the 30-day default and
  // showed a month of data under a label promising everything.
  const map = { '1D': 1, '5D': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825, ALL: 3650 }
  return map[tf] ?? 30
}
