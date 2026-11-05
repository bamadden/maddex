// Which holdings are linked to a shipping route, and through what — a
// description of exposure, never an estimate of gain or loss. Until 5 Nov
// this showed each holding's "estimated impact" in A$: a seeded random
// shock (3–6% for HIGH) applied to DEMO prices, plus forecasts of oil
// moves, CPI effects and RBA odds. All of that is gone (Phase 5 audit,
// docs/audit/global.md).

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

// How the link was found, not how large it is.
export const EXPOSURE_LABEL = {
  NAMED: 'NAMED FOR THIS ROUTE',
  SECTOR: 'SECTOR LINK',
  NONE: 'NO DIRECT LINK FOUND',
}

function linkFor(symbolBare, chokepoint) {
  if (chokepoint.asxStocks?.includes(`${symbolBare}.AX`)) return 'NAMED'
  return exposureFor(symbolBare, chokepoint) === 'LOW' ? 'NONE' : 'SECTOR'
}

// Reads the portfolio (madden_portfolio_v2): each ASX holding and the kind of
// link Maddex's editorial mapping finds between it and the route.
export function portfolioExposure(chokepoint, storage = globalThis.localStorage) {
  let holdings = []
  try { holdings = JSON.parse(storage.getItem('madden_portfolio_v2') ?? '[]') } catch { /* empty */ }
  return holdings.filter((h) => h.type === 'asx').map((h) => {
    const exposure = linkFor(h.symbol, chokepoint)
    const sector = SECTOR_BY_SYMBOL[h.symbol] ?? null
    const reason = exposure === 'NAMED'
      ? (chokepoint.asxNote ?? `Listed among the ASX companies linked to ${chokepoint.name}.`)
      : exposure === 'SECTOR'
        ? `${sector} is a sector linked to trade through ${chokepoint.name}${chokepoint.commodity ? ` (${chokepoint.commodity.toLowerCase()})` : ''}.`
        : 'No direct link to this route in Maddex\'s mapping.'
    return { symbol: h.symbol, name: h.name, exposure, sector, reason }
  })
}

const IS_ENERGY_ROUTE = new Set(['Strait of Hormuz', 'Suez Canal', 'Strait of Malacca', 'Panama Canal'])

// How a disruption on the route reaches Australian prices: channels only,
// with no sizes, probabilities or forecasts.
export function costChannels(chokepoint) {
  const energy = IS_ENERGY_ROUTE.has(chokepoint.name)
  return [
    energy
      ? { title: 'ENERGY', text: `${chokepoint.name} carries crude oil and LNG cargoes, so disruption there bears on global energy prices.` }
      : { title: 'ENERGY', text: `${chokepoint.name} is not a major energy route; its effects run mainly through freight and container costs.` },
    { title: 'FREIGHT AND IMPORT PRICES', text: 'Longer routes and higher insurance raise shipping costs, which feed into the prices of imported goods.' },
    { title: 'WHERE IT IS MEASURED', text: 'Import prices and the CPI are published by the ABS; the RBA reports on inflation in its statements and minutes.' },
  ]
}
