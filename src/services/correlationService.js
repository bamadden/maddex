// Deterministic seeded PRNG + hash, same technique used elsewhere in this
// app's mock layer (mulberry32).
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Default ASX top 10 + the wider set the asset picker can add from.
export const CORRELATION_UNIVERSE = [
  { id: 'BHP', label: 'BHP', name: 'BHP Group', klass: 'materials' },
  { id: 'RIO', label: 'RIO', name: 'Rio Tinto', klass: 'materials' },
  { id: 'FMG', label: 'FMG', name: 'Fortescue', klass: 'materials' },
  { id: 'CBA', label: 'CBA', name: 'Commonwealth Bank', klass: 'financials' },
  { id: 'NAB', label: 'NAB', name: 'National Australia Bank', klass: 'financials' },
  { id: 'WBC', label: 'WBC', name: 'Westpac Banking Corp', klass: 'financials' },
  { id: 'ANZ', label: 'ANZ', name: 'ANZ Group Holdings', klass: 'financials' },
  { id: 'CSL', label: 'CSL', name: 'CSL Limited', klass: 'healthcare' },
  { id: 'WES', label: 'WES', name: 'Wesfarmers', klass: 'consdisc' },
  { id: 'WOW', label: 'WOW', name: 'Woolworths Group', klass: 'consstaples' },
  { id: 'TLS', label: 'TLS', name: 'Telstra Group', klass: 'comms' },
  { id: 'XRO', label: 'XRO', name: 'Xero Limited', klass: 'tech' },
  { id: 'WTC', label: 'WTC', name: 'WiseTech Global', klass: 'tech' },
  { id: 'REA', label: 'REA', name: 'REA Group', klass: 'comms' },
  { id: 'GMG', label: 'GMG', name: 'Goodman Group', klass: 'realestate' },
  { id: '^AXJO', label: 'ASX 200', name: 'ASX 200 Index', klass: 'index-au' },
  { id: '^GSPC', label: 'S&P 500', name: 'S&P 500 Index', klass: 'index-us' },
  { id: 'BTC', label: 'BTC', name: 'Bitcoin', klass: 'crypto' },
  { id: 'AUDUSD', label: 'AUD/USD', name: 'AUD/USD', klass: 'currency' },
  { id: 'GOLD', label: 'GOLD', name: 'Gold Spot', klass: 'commodity-gold' },
  { id: 'OIL', label: 'OIL', name: 'Brent Crude Oil', klass: 'commodity-oil' },
  { id: 'IRON_ORE', label: 'IRON ORE', name: 'Iron Ore 62% Fe', klass: 'commodity-iron' },
]

export const DEFAULT_ASSET_IDS = ['BHP', 'RIO', 'FMG', 'CBA', 'NAB', 'WBC', 'ANZ', 'CSL', 'WES', 'WOW']

export const PERIODS = ['1M', '3M', '6M', '1Y', '2Y']

// Real-world-ish anchor pairs, kept as sanity checks against the otherwise
// hash-derived matrix.
const PINNED = {
  'BHP|RIO': 0.84,
  'BHP|FMG': 0.78,
  'BHP|IRON_ORE': 0.71,
  'RIO|IRON_ORE': 0.74,
  'FMG|IRON_ORE': 0.81,
  'BHP|CBA': 0.21,
  'CBA|NAB': 0.82,
  'CBA|WBC': 0.79,
  'NAB|WBC': 0.85,
  'CBA|ANZ': 0.80,
  'BTC|^GSPC': 0.31,
  'GOLD|AUDUSD': 0.18,
  'OIL|AUDUSD': 0.24,
}

// Looks up an asset's metadata, synthesising a plausible entry for any
// symbol not in CORRELATION_UNIVERSE (e.g. a watchlist stock added via the
// picker) so the matrix never breaks on an unknown id.
export function assetInfo(id) {
  const found = CORRELATION_UNIVERSE.find((a) => a.id === id)
  if (found) return found
  return { id, label: id.replace(/\.AX$/i, ''), name: id, klass: 'other' }
}

// Same-class pairs run hotter; a handful of cross-class relationships are
// hand-tuned since they're financially meaningful (materials vs iron ore,
// crypto vs equities, commodities vs AUD). Everything else falls back to a
// modest, mostly-uncorrelated hash-derived band.
function classAffinity(ka, kb) {
  if (ka === kb) return [0.55, 0.9]
  const pair = [ka, kb].sort().join('|')
  const table = {
    'commodity-iron|materials': [0.55, 0.85],
    'commodity-gold|financials': [-0.1, 0.2],
    'commodity-oil|currency': [0.1, 0.35],
    'crypto|index-us': [0.15, 0.45],
    'crypto|tech': [0.1, 0.4],
    'financials|index-au': [0.5, 0.8],
    'materials|index-au': [0.4, 0.7],
    'index-au|index-us': [0.4, 0.7],
  }
  return table[pair] ?? [-0.25, 0.35]
}

// Longer lookback periods trend correlations toward the middle of their
// class-derived band (more data smooths out noise); shorter periods add
// more spread either side.
const PERIOD_SPREAD = { '1M': 1.35, '3M': 1.15, '6M': 1.0, '1Y': 0.85, '2Y': 0.7 }

export function correlationFor(idA, idB, period = '6M') {
  if (idA === idB) return 1
  const a = assetInfo(idA), b = assetInfo(idB)
  const key1 = `${a.id}|${b.id}`, key2 = `${b.id}|${a.id}`
  const pinned = PINNED[key1] ?? PINNED[key2]

  const rng = mulberry32(hashStr(`${key1}_${period}`))
  const [lo, hi] = classAffinity(a.klass, b.klass)
  const base = pinned ?? (lo + rng() * (hi - lo))

  const spread = PERIOD_SPREAD[period] ?? 1
  const jitter = (rng() - 0.5) * 0.15 * spread
  return Math.max(-0.98, Math.min(0.98, base + jitter))
}

export function strengthLabel(r) {
  const abs = Math.abs(r)
  const dir = r >= 0 ? 'Positive' : 'Negative'
  if (abs >= 0.7) return `Strong ${dir}`
  if (abs >= 0.4) return `Moderate ${dir}`
  if (abs >= 0.15) return `Weak ${dir}`
  return 'No Correlation'
}

export function whatThisMeans(idA, idB, r) {
  const a = assetInfo(idA), b = assetInfo(idB)
  const pct = Math.abs(r * 100).toFixed(0)
  const dir = r >= 0 ? 'rises' : 'falls'
  return `When ${a.label} rises 1%, ${b.label} typically ${dir} ${pct}%.`
}

// Deep blue (r=+1) -> white (r=0) -> deep red (r=-1) — matches the
// existing static CorrelationMatrix's palette.
export function cellColor(r) {
  const t = Math.max(-1, Math.min(1, r))
  if (t >= 0) {
    const c = Math.round(255 - t * (255 - 30))
    return `rgb(${c}, ${Math.round(255 - t * (255 - 90))}, 255)`
  }
  const c = Math.round(255 - (-t) * (255 - 30))
  return `rgb(255, ${Math.round(255 - (-t) * (255 - 60))}, ${c})`
}

// Bivariate points constructed from independent normals so the scatter's
// visual spread actually matches the stated coefficient r.
function randNormal(rng) {
  const u1 = Math.max(1e-6, rng()), u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
export function generateScatterPoints(idA, idB, period, n = 40) {
  const rng = mulberry32(hashStr(`scatter_${idA}_${idB}_${period}`))
  const r = correlationFor(idA, idB, period)
  const points = []
  for (let i = 0; i < n; i++) {
    const x = randNormal(rng)
    const y = r * x + Math.sqrt(1 - r * r) * randNormal(rng)
    points.push({ x, y })
  }
  return points
}

// Average pairwise correlation across a set of asset ids -> a 0-100
// diversification score (lower average correlation = higher score).
export function diversificationScore(ids, period = '6M') {
  const unique = [...new Set(ids)]
  if (unique.length < 2) return { score: 100, label: 'DIVERSIFIED', avgCorrelation: 0 }
  let sum = 0, count = 0
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      sum += Math.abs(correlationFor(unique[i], unique[j], period))
      count++
    }
  }
  const avg = sum / count
  const score = Math.round(Math.max(0, Math.min(100, (1 - avg) * 100)))
  const label = score >= 70 ? 'DIVERSIFIED' : score >= 45 ? 'MODERATE' : 'CONCENTRATED'
  return { score, label, avgCorrelation: avg }
}

// Suggests the universe asset that would add the LEAST average correlation
// to an existing holding set — a simple, defensible diversification tip.
export function suggestDiversifier(holdingIds, period = '6M') {
  const held = new Set(holdingIds)
  let best = null
  for (const candidate of CORRELATION_UNIVERSE) {
    if (held.has(candidate.id)) continue
    const avg = holdingIds.reduce((s, id) => s + Math.abs(correlationFor(id, candidate.id, period)), 0) / holdingIds.length
    if (!best || avg < best.avg) best = { id: candidate.id, label: candidate.label, avg }
  }
  return best
}
