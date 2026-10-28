import { RATE_SENSITIVITY } from '../../data/sectorTaxonomy'
import { AU_ETFS } from '../../data/etfData'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import { SECTOR_BY_SYMBOL } from './sectorMap'

// Rate sensitivity for a holding, from the shared sector table
// (sectorTaxonomy.RATE_SENSITIVITY) — read by the Analytics tab's rate
// analysis and the stress test's RBA scenario, so the two give the same answer.
//
// The holdings' sector labels are mockData's short names; this maps them onto
// the GICS names the table is keyed by.
const TO_GICS = {
  Materials: 'Materials', Financials: 'Financials', Health: 'Health Care',
  'Cons Disc': 'Consumer Discretionary', Staples: 'Consumer Staples',
  Comms: 'Communication Services', 'Real Est': 'Real Estate', Industrials: 'Industrials',
  IT: 'Information Technology', Energy: 'Energy', Utilities: 'Utilities',
}

// A broad Australian-equity ETF, treated as the ASX 200's sector mix: the
// three sector weights verifiedConstants holds (STW factsheet), with the rest
// of the index spread evenly across the other eight sectors — an
// approximation, said so wherever it shows.
function asx200Shock() {
  const w = VERIFIED_CONSTANTS.au?.asx200SectorWeights ?? {}
  const known = { Financials: w.Financials, Materials: w.Materials, 'Health Care': w.Health }
  const knownTotal = Object.values(known).reduce((s, v) => s + (v ?? 0), 0)
  const others = Object.keys(RATE_SENSITIVITY).filter((s) => known[s] == null)
  const otherAvg = others.reduce((s, k) => s + RATE_SENSITIVITY[k].hikeShock, 0) / others.length
  const knownPart = Object.entries(known).reduce((s, [k, v]) => s + ((v ?? 0) / 100) * RATE_SENSITIVITY[k].hikeShock, 0)
  return knownPart + ((100 - knownTotal) / 100) * otherAvg
}

// → { sector, level, why, shock (% for a 25bp hike), basis }
export function holdingRate(h) {
  if (h.type === 'crypto') {
    return { sector: 'Crypto', level: null, why: 'No established relationship with the RBA cash rate', shock: 0, basis: 'not classified' }
  }
  const raw = SECTOR_BY_SYMBOL[h.symbol]
  if (raw === 'ETF') {
    const etf = AU_ETFS.find((e) => e.ticker === h.symbol)
    if (etf?.category === 'AU Equity') {
      return { sector: 'Broad AU market', level: 'MEDIUM', why: 'Tracks the ASX 200 — banks and miners dominate, so the effects partly offset', shock: asx200Shock(), basis: 'ASX 200 sector mix (approx.)' }
    }
    return { sector: etf?.category ?? 'ETF', level: 'LOW', why: 'Not directly exposed to the RBA; a firmer AUD would trim its value in A$', shock: 0, basis: 'offshore — currency only' }
  }
  if (h.type === 'us') {
    return { sector: raw ? `${raw} (US)` : 'US equity', level: 'LOW', why: 'Not directly exposed to the RBA; a firmer AUD would trim its value in A$', shock: 0, basis: 'offshore — currency only' }
  }
  const gics = TO_GICS[raw]
  const s = gics && RATE_SENSITIVITY[gics]
  if (!s) return { sector: raw ?? 'Unclassified', level: null, why: 'Sector not recognised', shock: 0, basis: 'not classified' }
  return { sector: raw, level: s.level, why: s.why, shock: s.hikeShock, basis: 'sector' }
}

// Portfolio-level: value-weighted estimated move and a one-word rating.
export function portfolioRate(holdings) {
  const live = holdings.filter((h) => h.mktVal != null && h.mktVal > 0)
  const total = live.reduce((s, h) => s + h.mktVal, 0)
  if (!total) return null
  const rows = live.map((h) => ({ h, r: holdingRate(h), weight: h.mktVal / total }))
  const shock = rows.reduce((s, x) => s + x.weight * x.r.shock, 0)
  // Bands on the value-weighted estimate for a 25bp hike. Materials alone sits
  // at −2% in the table, so LOW reaches to −1.5%: a book led by miners and a
  // bank should not read as rate-exposed.
  const rating = shock > 0.25 ? 'POSITIVE' : shock > -1.5 ? 'LOW' : shock > -3.5 ? 'MEDIUM' : 'HIGH'
  // The sectors carrying most of the book, for the sentence.
  const bySector = new Map()
  for (const x of rows) bySector.set(x.r.sector, (bySector.get(x.r.sector) ?? 0) + x.weight)
  const top = [...bySector.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  return { rows, shock, rating, total, top }
}
