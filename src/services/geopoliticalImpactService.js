import { getMockFMPRow } from './mockData'

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

export const STATUS_BADGE = { DISRUPTED: 'ACTIVE', MONITORED: 'MONITORING', OPEN: 'RESOLVED' }
export const RISK_LEVEL = { DISRUPTED: 'HIGH', MONITORED: 'MEDIUM', OPEN: 'LOW' }

// Illustrative GICS sector per major ASX symbol — same lightweight lookup
// pattern used by StressTest.jsx, kept independent here since the two
// features shouldn't have to share a module just to avoid ~20 lines of
// duplication.
const SECTOR_BY_SYMBOL = {
  BHP: 'Materials', RIO: 'Materials', FMG: 'Materials', MIN: 'Materials', S32: 'Materials', ILU: 'Materials',
  CBA: 'Financials', NAB: 'Financials', WBC: 'Financials', ANZ: 'Financials', MQG: 'Financials', QBE: 'Financials',
  WDS: 'Energy', STO: 'Energy', BPT: 'Energy', VEA: 'Energy',
  WES: 'Consumer Discretionary', WOW: 'Consumer Staples', COL: 'Consumer Staples', ALL: 'Consumer Discretionary',
  TLS: 'Communication', REA: 'Communication',
  CSL: 'Health Care',
  WTC: 'Technology', XRO: 'Technology', CPU: 'Technology', TNE: 'Technology',
  BXB: 'Industrials', QAN: 'Industrials', TCL: 'Industrials',
  GMG: 'Real Estate',
}

// Per-chokepoint sector sensitivity — how exposed each broad sector is to
// a disruption there, independent of whether a specific holding also
// appears in that chokepoint's own asxStocks list (which is treated as an
// automatic HIGH regardless of this table).
const SECTOR_SENSITIVITY = {
  'Strait of Hormuz':     { Energy: 'HIGH', Materials: 'LOW',    Financials: 'LOW' },
  'Suez Canal':           { Energy: 'MEDIUM', Materials: 'MEDIUM', 'Consumer Discretionary': 'MEDIUM', 'Consumer Staples': 'MEDIUM', Industrials: 'HIGH', Financials: 'LOW' },
  'Strait of Malacca':    { Energy: 'HIGH', Materials: 'HIGH',  Financials: 'LOW' },
  'Panama Canal':         { Energy: 'MEDIUM', Industrials: 'MEDIUM', Financials: 'LOW' },
  'Taiwan Strait':        { Technology: 'HIGH', Communication: 'MEDIUM', Financials: 'LOW' },
  'Bosphorus Strait':     { 'Consumer Staples': 'MEDIUM', Materials: 'LOW', Financials: 'LOW' },
  'Cape of Good Hope':    { Industrials: 'MEDIUM', Energy: 'LOW', Materials: 'LOW', Financials: 'LOW' },
}

function exposureFor(symbolBare, chokepoint) {
  if (chokepoint.asxStocks?.includes(`${symbolBare}.AX`)) return 'HIGH'
  const sector = SECTOR_BY_SYMBOL[symbolBare]
  const table = SECTOR_SENSITIVITY[chokepoint.name] ?? {}
  return table[sector] ?? 'LOW'
}

const EXPOSURE_SHOCK = { HIGH: [-0.06, -0.03], MEDIUM: [-0.02, -0.01], LOW: [0, 0] }

// Reads the real portfolio (madden_portfolio_v2) and computes each ASX
// holding's exposure to a given chokepoint disruption.
export function portfolioImpact(chokepoint) {
  let holdings = []
  try { holdings = JSON.parse(localStorage.getItem('madden_portfolio_v2') ?? '[]') } catch { /* empty */ }
  const asxHoldings = holdings.filter((h) => h.type === 'asx')

  const rows = asxHoldings.map((h) => {
    const exposure = exposureFor(h.symbol, chokepoint)
    const q = getMockFMPRow(`${h.symbol}.AX`)
    const value = q ? q.regularMarketPrice * h.shares : null
    const [lo, hi] = EXPOSURE_SHOCK[exposure]
    const rng = mulberry32(hashStr(`${chokepoint.name}_${h.symbol}`))
    const shockPct = lo + rng() * (hi - lo)
    const impactValue = value != null ? value * shockPct : null
    return { symbol: h.symbol, name: h.name, exposure, value, shockPct, impactValue }
  })

  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0)
  const totalImpact = rows.reduce((s, r) => s + (r.impactValue ?? 0), 0)
  return { rows, totalValue, totalImpact, totalImpactPct: totalValue > 0 ? (totalImpact / totalValue) * 100 : 0 }
}

const IS_ENERGY_ROUTE = new Set(['Strait of Hormuz', 'Suez Canal', 'Strait of Malacca', 'Panama Canal'])

export function macroImpact(chokepoint) {
  const isEnergy = IS_ENERGY_ROUTE.has(chokepoint.name)
  const severity = RISK_LEVEL[chokepoint.status]

  const oilSensitivity = isEnergy
    ? `${chokepoint.name} disruptions historically correlate with a ${severity === 'HIGH' ? '10-15%' : '3-6%'} move in oil price over the following 3 months.`
    : `${chokepoint.name} has limited direct oil-price sensitivity — its impact flows mainly through freight and container costs rather than energy markets.`

  const inflationImpact = chokepoint.status === 'DISRUPTED'
    ? 'Shipping cost increases typically flow through to AU CPI with a 2-3 month lag. Estimate +0.2-0.4% to AU CPI if the disruption continues 6+ months.'
    : chokepoint.status === 'MONITORED'
      ? 'Currently a watch item rather than an active cost pass-through — no material AU CPI impact yet unless conditions escalate.'
      : 'Route is operating normally — no current inflation impact.'

  const rbaImplication = chokepoint.status === 'DISRUPTED'
    ? 'If shipping/energy costs add to inflation, this reduces the probability of near-term RBA rate cuts. A sustained disruption could shift market-implied cut probability materially lower.'
    : 'No material shift to RBA policy expectations from this alone at current severity.'

  return { oilSensitivity, inflationImpact, rbaImplication }
}
