// Static reference data for the intelligence map.
//
// Split out of DeckGLMap.jsx deliberately: the component is already large
// with eight layer definitions, and these tables are read far more often
// than they are executed. Keeping them here means the map file stays about
// rendering and this file stays about facts.
//
// Everything here is illustrative reference data for a demo terminal, not a
// live feed — the live layers (earthquakes, weather, flights) come from the
// public APIs wired up in the component itself.

import { getMockFMPRow } from '../../services/mockData'
import { routeFor } from '../../data/shippingRoutes'

const EXCHANGE_BASE = [
  { id: 'ASX',  city: 'Sydney',    flag: '🇦🇺', lon: 151.2093, lat: -33.8688, index: 'ASX 200',        openHour: 10,   closeHour: 16,   tz: 'Australia/Sydney',
    topStocks: ['BHP', 'CBA', 'CSL', 'WES', 'ANZ'] },
  { id: 'NYSE', city: 'New York',  flag: '🇺🇸', lon: -74.0060, lat: 40.7128,  index: 'S&P 500',        openHour: 9.5,  closeHour: 16,   tz: 'America/New_York',
    topStocks: ['AAPL', 'MSFT', 'NVDA', 'JPM', 'JNJ'] },
  { id: 'LSE',  city: 'London',    flag: '🇬🇧', lon: -0.1276,  lat: 51.5074,  index: 'FTSE 100',       openHour: 8,    closeHour: 16.5, tz: 'Europe/London',   
    topStocks: ['SHEL', 'AZN', 'HSBA', 'ULVR', 'BP'] },
  { id: 'TSE',  city: 'Tokyo',     flag: '🇯🇵', lon: 139.6917, lat: 35.6895,  index: 'Nikkei 225',     openHour: 9,    closeHour: 15.5, tz: 'Asia/Tokyo',      
    topStocks: ['7203', '6758', '9984', '8306', '6501'] },
  { id: 'HKEX', city: 'Hong Kong', flag: '🇭🇰', lon: 114.1694, lat: 22.3193,  index: 'Hang Seng',      openHour: 9.5,  closeHour: 16,   tz: 'Asia/Hong_Kong',  
    topStocks: ['0700', '9988', '0939', '1299', '0005'] },
  { id: 'SSE',  city: 'Shanghai',  flag: '🇨🇳', lon: 121.4737, lat: 31.2304,  index: 'SSE Composite',  openHour: 9.5,  closeHour: 15,   tz: 'Asia/Shanghai',   
    topStocks: ['600519', '601398', '601857', '600036', '601288'] },
  { id: 'FSE',  city: 'Frankfurt', flag: '🇩🇪', lon: 8.6821,   lat: 50.1109,  index: 'DAX',            openHour: 9,    closeHour: 17.5, tz: 'Europe/Berlin',   
    topStocks: ['SAP', 'SIE', 'ALV', 'DTE', 'MBG'] },
  { id: 'BSE',  city: 'Mumbai',    flag: '🇮🇳', lon: 72.8777,  lat: 19.0760,  index: 'SENSEX',         openHour: 9.25, closeHour: 15.5, tz: 'Asia/Kolkata',    
    topStocks: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'] },
  { id: 'SGX',  city: 'Singapore', flag: '🇸🇬', lon: 103.8198, lat: 1.3521,   index: 'STI',            openHour: 9,    closeHour: 17,   tz: 'Asia/Singapore',  
    topStocks: ['D05', 'O39', 'U11', 'Z74', 'C6L'] },
  { id: 'TSX',  city: 'Toronto',   flag: '🇨🇦', lon: -79.3832, lat: 43.6532,  index: 'TSX',            openHour: 9.5,  closeHour: 16,   tz: 'America/Toronto', 
    topStocks: ['RY', 'TD', 'ENB', 'CNR', 'BN'] },
  { id: 'NZX',  city: 'Auckland',  flag: '🇳🇿', lon: 174.7633, lat: -36.8485, index: 'NZX 50',         openHour: 10,   closeHour: 17,   tz: 'Pacific/Auckland',
    topStocks: ['FPH', 'AIA', 'MEL', 'SPK', 'MCY'] },
  { id: 'TASE', city: 'Tel Aviv',  flag: '🇮🇱', lon: 34.7818,  lat: 32.0853,  index: 'TA-35',          openHour: 9.5,  closeHour: 17.5, tz: 'Asia/Jerusalem',  
    topStocks: ['TEVA', 'NICE', 'ESLT', 'POLI', 'LUMI'] },
]

// Index level and day change come from the terminal's quote layer, not from
// the numbers typed into the table above. Those were written early and never
// updated — the map showed the ASX 200 at 8,247 and the Nikkei at 38,420 with
// the rest of the terminal at 8,850 and 66,754. Exchanges whose index the
// quote layer does not carry (SENSEX, STI, TSX, TA-35) show no level rather
// than a stale one. `demo` marks the source; the panel labels it.
const EXCHANGE_INDEX = { ASX: '^AXJO', NYSE: '^GSPC', LSE: '^FTSE', TSE: '^N225', HKEX: '^HSI', SSE: '000001.SS', FSE: '^GDAXI', NZX: '^NZ50' }

// Editorial map content, reviewed 16 Nov 2026 (Ben's decision: re-read from a
// sourced feed or remove). What remains is places, names and lanes, plus the
// shipping zones, whose status and text now come from the dated, sourced
// chokepoint table (data/shippingRoutes). Removed: the zones' own narratives
// and start dates, the geopolitical event cards, cable capacities and owners,
// base descriptions, route risk ratings, site risk lists and an unsourced
// export figure. None had a source or date.
export const INTEL_MAP_REVIEWED = '2026-11-16'

export const EXCHANGES = EXCHANGE_BASE.map((e) => {
  const sym = EXCHANGE_INDEX[e.id]
  const q = sym ? getMockFMPRow(sym) : null
  return {
    ...e,
    indexSymbol: sym ?? null,
    value: q?.regularMarketPrice ?? null,
    change: q ? Math.round(q.regularMarketChangePercent * 100) / 100 : null,
    demo: true,
  }
})

// AU routes: `value` is A$b of AU EXPORTS to that market, ABS 2024-25 (see
// verifiedConstants.auTrade); null where no sourced figure is held. The
// non-AU routes are illustrative.
// Arcs. AU values are the ABS's 2024-25 export totals (verifiedConstants.auTrade);
// other arcs carry no value (the typed, illustrative values were removed 16 Nov
// 2026), and no arc lists goods (no source).
export const TRADE_ROUTES = [
  { id: 'AU-CN',   from: [151.2, -33.9], to: [121.5, 31.2],  value: 188.7, color: [201, 168, 76], thickness: 6 },
  { id: 'AU-JP',   from: [151.2, -33.9], to: [139.7, 35.7],  value: 69.7, color: [201, 168, 76], thickness: 3 },
  { id: 'AU-KR',   from: [151.2, -33.9], to: [126.9, 37.6],  value: 41.3, color: [201, 168, 76], thickness: 2.5 },
  { id: 'AU-IN',   from: [151.2, -33.9], to: [72.9, 19.1],   value: 35.0, color: [201, 168, 76], thickness: 2 },
  { id: 'AU-US',   from: [151.2, -33.9], to: [-74.0, 40.7],  value: 54.6, color: [45, 138, 80],  thickness: 2 },
  { id: 'AU-UK',   from: [151.2, -33.9], to: [-0.1, 51.5],   value: null, color: [45, 138, 80],  thickness: 1.5 },
  { id: 'AU-SG',   from: [151.2, -33.9], to: [103.8, 1.4],   value: null, color: [201, 168, 76], thickness: 1.5 },
  { id: 'US-CN',   from: [-74.0, 40.7],  to: [121.5, 31.2],  value: null, color: [100, 140, 200], thickness: 5 },
  { id: 'EU-CN',   from: [8.7, 50.1],    to: [121.5, 31.2],  value: null, color: [100, 140, 200], thickness: 4 },
  { id: 'RED-SEA', from: [8.7, 50.1],    to: [72.9, 19.1],   value: null, color: [168, 50, 50],  thickness: 3, disrupted: routeFor('red-sea')?.status === 'DISRUPTED' },
]

// AU-only subset, used by Australia focus mode so the arc layer doesn't have
// to be refiltered on every render.
export const AU_TRADE_ROUTES = TRADE_ROUTES.filter((r) => r.id.startsWith('AU-'))

// Each zone's status, text and sources are the chokepoint table's entry for
// it (routeFor), so the map and the route table cannot disagree. Geometry and
// the lanes and goods that pass through are reference facts.
const ZONES = [
  { id: 'hormuz', name: 'Strait of Hormuz', coordinates: [56.3, 26.6], radius: 300000, showBrent: true,
    affectedRoutes: ['Gulf crude', 'Qatar LNG', 'Oil tankers'], commodities: ['Crude Oil', 'LNG', 'Fertiliser'] },
  { id: 'taiwan', name: 'Taiwan Strait', coordinates: [120.5, 24.5], radius: 220000,
    affectedRoutes: ['Trans-Pacific', 'Intra-Asia'], commodities: ['Semiconductors', 'Containers', 'Electronics'] },
  { id: 'malacca', name: 'Strait of Malacca', coordinates: [103.5, 1.5], radius: 120000,
    affectedRoutes: ['AU-Asia LNG', 'Oil tankers'], commodities: ['LNG', 'Crude Oil'] },
  { id: 'suez', name: 'Suez Canal and Red Sea', coordinates: [32.5, 30.5], radius: 80000,
    affectedRoutes: ['EU-Asia', 'EU-East Africa'], commodities: ['Containers', 'Crude Oil'] },
  { id: 'panama', name: 'Panama Canal', coordinates: [-79.9, 9.1], radius: 60000,
    affectedRoutes: ['US East Coast-Asia', 'LNG tankers'], commodities: ['LNG', 'Containers', 'Grain'] },
]
export const SHIPPING_DISRUPTIONS = ZONES.map((z) => {
  const r = routeFor(z.id)
  if (!r) return null
  return {
    ...z,
    title: `${r.name} — ${r.status}`,
    detail: r.note,
    impact: r.commodity,
    asxStocks: (r.asxStocks ?? []).map((t) => t.replace(/\.AX$/, '')),
    asxNote: r.asxNote ?? null,
    sources: r.sources ?? [],
    asOf: r.asOf,
  }
}).filter(Boolean)

// Where each commodity is produced, and by whom: places and company names
// only. The production volumes, shares of world supply and producer ranks
// typed here had no source or date and were removed (16 Nov 2026).
export const COMMODITY_SITES = [
  { id: 'pilbara-iron',    lon: 117.7, lat: -22.5, commodity: 'Iron Ore',     country: 'Australia',    companies: ['BHP', 'RIO', 'FMG'],        asx: ['BHP', 'RIO', 'FMG'], color: [180, 80, 40] },
  { id: 'qld-coal',        lon: 148.5, lat: -23.5, commodity: 'Thermal Coal', country: 'Australia',    companies: ['WHC', 'NHC'],               asx: ['WHC', 'NHC'],        color: [60, 60, 60] },
  { id: 'nw-lng',          lon: 115.8, lat: -21.9, commodity: 'LNG',          country: 'Australia',    companies: ['WDS', 'STO'],               asx: ['WDS', 'STO'],        color: [80, 140, 200] },
  { id: 'kalgoorlie-gold', lon: 121.4, lat: -30.8, commodity: 'Gold',         country: 'Australia',    companies: ['NST', 'EVN', 'NEM'],        asx: ['NST', 'EVN'],        color: [255, 215, 0] },
  { id: 'pilbara-lithium', lon: 119.2, lat: -21.5, commodity: 'Lithium',      country: 'Australia',    companies: ['PLS', 'MIN', 'IGO'],        asx: ['PLS', 'MIN'],        color: [140, 200, 140] },
  { id: 'chile-copper',    lon: -70.6, lat: -29.0, commodity: 'Copper',       country: 'Chile',        companies: ['Codelco', 'BHP', 'Anglo'], asx: ['BHP', 'S32'],        color: [200, 100, 50] },
  { id: 'saudi-oil',       lon: 49.6,  lat: 26.3,  commodity: 'Crude Oil',    country: 'Saudi Arabia', companies: ['Saudi Aramco'],           asx: ['WDS', 'STO'],        color: [40, 40, 40] },
  { id: 'china-re',        lon: 110.0, lat: 40.0,  commodity: 'Rare Earths',  country: 'China',        companies: ['China Northern RE'],      asx: ['LYC'],               color: [100, 200, 100] },
  { id: 'ukraine-wheat',   lon: 32.0,  lat: 49.0,  commodity: 'Wheat',        country: 'Ukraine',      companies: ['Various'],                asx: ['GNC'],               color: [220, 180, 60], disrupted: true },
]

// Geopolitical event cards (war, tensions, slowdown, policy risk) were
// editorial summaries with no source or date, and were removed on 16 Nov 2026.
export const GEOPOLITICAL_EVENTS = []

// Paths are [lat, lon] pairs as sourced; the map layer flips them to the
// [lon, lat] order deck.gl expects.
export const UNDERSEA_CABLES = [
  { name: 'Southern Cross NEXT',  path: [[-33.9, 151.2], [21.3, -157.8], [37.7, -122.4]] },
  { name: 'Australia-Japan Cable', path: [[-33.9, 151.2], [1.4, 103.8], [35.7, 139.7]] },
  { name: 'INDIGO-West',           path: [[-31.9, 115.8], [4.2, 73.5], [19.1, 72.9]] },
]

export const MILITARY_BASES = [
  { name: 'Pine Gap',             lon: 133.7, lat: -23.8, country: 'AU / US',      type: 'Intelligence' },
  { name: 'RAAF Darwin',          lon: 130.9, lat: -12.4, country: 'Australia',    type: 'Air Base' },
  { name: 'Guam (Andersen AFB)',  lon: 144.9, lat: 13.6,  country: 'United States', type: 'Air / Naval' },
  { name: 'Diego Garcia',         lon: 72.4,  lat: -7.3,  country: 'UK / US',      type: 'Naval / Air' },
]

// Major AU production regions, labelled only in Australia focus mode.
export const AU_SITES = [
  { name: 'Pilbara',      commodity: 'Iron Ore', icon: '⛏', lon: 117.7, lat: -22.5 },
  { name: 'Bowen Basin',  commodity: 'Coal',     icon: '🪨', lon: 148.5, lat: -23.5 },
  { name: 'NW Shelf',     commodity: 'LNG',      icon: '⚡', lon: 115.8, lat: -21.9 },
  { name: 'Kalgoorlie',   commodity: 'Gold',     icon: '🥇', lon: 121.4, lat: -30.8 },
  { name: 'Olympic Dam',  commodity: 'Cu / U',   icon: '☢', lon: 136.9, lat: -30.4 },
  { name: 'Cooper Basin', commodity: 'Gas',      icon: '🔥', lon: 140.0, lat: -27.5 },
]

// Used by the NIGHT map style's city-lights heatmap.
export const MAJOR_CITIES = [
  { lon: 151.2, lat: -33.9, pop: 5.3 }, { lon: 144.9, lat: -37.8, pop: 5.1 },
  { lon: 153.0, lat: -27.5, pop: 2.6 }, { lon: 115.9, lat: -31.9, pop: 2.1 },
  { lon: -74.0, lat: 40.7, pop: 8.3 },  { lon: -118.2, lat: 34.1, pop: 3.9 },
  { lon: -87.6, lat: 41.9, pop: 2.7 },  { lon: -95.4, lat: 29.8, pop: 2.3 },
  { lon: -79.4, lat: 43.7, pop: 2.9 },  { lon: -99.1, lat: 19.4, pop: 9.2 },
  { lon: -46.6, lat: -23.5, pop: 12.3 }, { lon: -58.4, lat: -34.6, pop: 3.1 },
  { lon: -0.1, lat: 51.5, pop: 9.0 },   { lon: 2.35, lat: 48.9, pop: 2.1 },
  { lon: 13.4, lat: 52.5, pop: 3.7 },   { lon: 12.5, lat: 41.9, pop: 2.8 },
  { lon: -3.7, lat: 40.4, pop: 3.2 },   { lon: 37.6, lat: 55.8, pop: 12.5 },
  { lon: 28.98, lat: 41.0, pop: 15.5 }, { lon: 31.2, lat: 30.0, pop: 9.5 },
  { lon: 3.4, lat: 6.5, pop: 14.8 },    { lon: 28.0, lat: -26.2, pop: 5.6 },
  { lon: 139.7, lat: 35.7, pop: 13.9 }, { lon: 126.98, lat: 37.6, pop: 9.7 },
  { lon: 121.5, lat: 31.2, pop: 26.3 }, { lon: 116.4, lat: 39.9, pop: 21.5 },
  { lon: 114.2, lat: 22.3, pop: 7.4 },  { lon: 103.8, lat: 1.35, pop: 5.9 },
  { lon: 100.5, lat: 13.8, pop: 10.5 }, { lon: 106.8, lat: -6.2, pop: 10.6 },
  { lon: 72.9, lat: 19.1, pop: 20.7 },  { lon: 77.2, lat: 28.6, pop: 32.9 },
  { lon: 88.4, lat: 22.6, pop: 15.1 },  { lon: 67.0, lat: 24.9, pop: 16.8 },
  { lon: 55.3, lat: 25.2, pop: 3.5 },   { lon: 51.4, lat: 35.7, pop: 9.1 },
  { lon: 174.8, lat: -36.8, pop: 1.7 }, { lon: 121.0, lat: 14.6, pop: 13.5 },
]

// Colours for the shipping zones, by the route status in data/shippingRoutes
// (dated, sourced). Geopolitical events are coloured by their kind alone: no
// severity is attached to them (16 Nov 2026). The CRITICAL / HIGH / MEDIUM
// labels typed here, and the ones MaddenAI was asked to assign each day,
// were ratings with no source; they are gone.
export const STATUS_COLOUR = {
  DISRUPTED: [168, 50, 50],
  MONITORED: [201, 168, 76],
  OPEN:      [100, 140, 200],
}
export const EVENT_KIND_COLOUR = [140, 150, 170]

// Whether an exchange is trading right now, in its own local time.
export function isExchangeOpen(exchange) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: exchange.tz }))
  const hour = local.getHours() + local.getMinutes() / 60
  const isWeekday = local.getDay() > 0 && local.getDay() < 6
  return isWeekday && hour >= exchange.openHour && hour < exchange.closeHour
}

// Minutes until the next open or close, so the panel can count down rather
// than only saying open/closed.
export function sessionCountdown(exchange) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: exchange.tz }))
  const hour = local.getHours() + local.getMinutes() / 60
  const open = isExchangeOpen(exchange)
  if (open) return { open: true, mins: Math.round((exchange.closeHour - hour) * 60) }

  const day = local.getDay()
  let hoursAway = exchange.openHour - hour
  if (hoursAway <= 0) hoursAway += 24
  // Skip the weekend rather than counting down to a Saturday open.
  if (day === 6) hoursAway += 24
  if (day === 0 && hour >= exchange.openHour) hoursAway += 0
  if (day === 5 && exchange.openHour - hour <= 0) hoursAway += 48
  return { open: false, mins: Math.round(hoursAway * 60) }
}

export function formatCountdown(mins) {
  if (mins == null || !isFinite(mins) || mins < 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─── AI narrative overlay ───────────────────────────────────────────────────
//
// The rows above are a fixed skeleton: coordinates, radii, affected routes,
// ASX exposure. Those are structure, and structure must not move — a map
// whose chokepoints wander between page loads is not a map, and a model
// asked for coordinates will happily place the Strait of Malacca in the
// wrong ocean.
//
// What does go stale is the prose. "Freight rates +340% on Asia-Europe
// routes" was true when it was written and is an assertion with a number in
// it that nobody is checking now.
//
// So MaddenAI refreshes only the narrative fields, matched onto existing rows
// by id or name. An AI item that matches nothing is ignored rather than
// appended: it would have no coordinates to draw at. A row that matches
// nothing keeps the prose it already had. The overlay can only ever improve
// the words on a row that already exists.

// Loose match — the model returns "Red Sea" or "red-sea" or "Red Sea Crisis"
// for the same place, and none of those are worth a failed lookup.
const slug = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

function findMatch(row, aiRows) {
  const keys = [slug(row.id), slug(row.name), slug(row.title)].filter(Boolean)
  return aiRows.find((a) => {
    const cand = [slug(a.id), slug(a.name), slug(a.title)].filter(Boolean)
    return cand.some((c) => keys.some((k) => c === k || c.includes(k) || k.includes(c)))
  })
}

// `fields` names exactly which properties the model is allowed to replace.
// An allowlist rather than a spread: the point is that it can rewrite the
// narrative and cannot touch a coordinate.
export function overlayNarrative(rows, aiRows, fields) {
  if (!Array.isArray(aiRows) || !aiRows.length) return rows
  return rows.map((row) => {
    const m = findMatch(row, aiRows)
    if (!m) return row
    const patch = {}
    // Prose only: a model-written string holding a digit is dropped, so the
    // AI can never put a figure, date or share on the map.
    for (const f of fields) if (typeof m[f] === 'string' && m[f].trim() && !/\d/.test(m[f])) patch[f] = m[f]
    return Object.keys(patch).length ? { ...row, ...patch, aiNarrative: true } : row
  })
}

// The map's status line. Only a real feed (USGS) is counted as live; the
// other layers are named by class, never added to a live-source count.
export const MAP_SOURCE_CLASS = { LIVE: 'live feed', REFERENCE: 'hand-entered reference', AI: 'AI-written text', TILES: 'map tiles' }
export function mapStatusLine(sources) {
  const live = sources.filter((s) => s.cls === 'LIVE')
  const liveOk = live.filter((s) => s.ok).length
  const head = live.length === 0 ? 'NO LIVE FEED' : liveOk === live.length ? `LIVE: ${live.map((s) => s.label.split(' ')[0].toUpperCase()).join(', ')}` : `LIVE FEED DOWN: ${live.filter((s) => !s.ok).map((s) => s.label.split(' ')[0].toUpperCase()).join(', ')}`
  const rest = sources.some((s) => s.cls === 'REFERENCE') ? ' · OTHER LAYERS HAND-ENTERED' : ''
  return { text: head + rest, liveOk: liveOk === live.length, liveTotal: live.length }
}

export const SHIPPING_NARRATIVE_FIELDS = ['title', 'detail', 'impact', 'auExports']
export const GEO_NARRATIVE_FIELDS = ['summary', 'marketImpact']

// ─── Australia focus ────────────────────────────────────────────────────────
//
// Where Australia's export earnings come out of the ground, for AU FOCUS. The
// one dollar figure is sourced (Resources and Energy Quarterly); the rest is
// location, commodity and the ASX-listed producers — reference facts, not
// estimates. Browse Basin is deliberately absent: it is undeveloped; the
// producing LNG hub in the north-west is the North West Shelf at Karratha.
export const AU_KEY_SITES = [
  { id: 'au-pilbara', name: 'Pilbara', region: 'WA', commodity: 'Iron ore', lon: 118.6, lat: -22.3,
    asx: ['BHP', 'RIO', 'FMG'], note: 'Iron ore mining region; exports through Port Hedland and Dampier.' },
  { id: 'au-bowen', name: 'Bowen Basin', region: 'QLD', commodity: 'Coal (mostly metallurgical)', lon: 148.2, lat: -22.5,
    asx: ['BHP', 'WHC'], note: 'Steelmaking coal for Japan, India, Korea and China.' },
  { id: 'au-nws', name: 'North West Shelf', region: 'WA (Karratha)', commodity: 'LNG', lon: 116.8, lat: -20.7,
    asx: ['WDS'], note: 'Australia\'s original LNG export hub, on the Carnarvon Basin.' },
  { id: 'au-curtis', name: 'Curtis Island', region: 'QLD (Gladstone)', commodity: 'LNG (coal-seam gas)', lon: 151.25, lat: -23.8,
    asx: ['STO', 'ORG'], note: 'Three export LNG plants fed by Surat and Bowen coal-seam gas.' },
  { id: 'au-cooper', name: 'Cooper Basin', region: 'SA / QLD', commodity: 'Gas and oil', lon: 140.6, lat: -27.9,
    asx: ['STO', 'BPT'], note: 'Onshore gas supplying the east-coast market.' },
  { id: 'au-kalgoorlie', name: 'Kalgoorlie goldfields', region: 'WA', commodity: 'Gold', lon: 121.5, lat: -30.75,
    asx: ['NST', 'EVN'], note: 'Home of the Super Pit; WA produces most of Australia\'s gold.' },
]

// How much each country matters to AUSTRALIA, for the map's AU IMPACT view —
// 3 high, 2 medium, 1 low. Trade weights follow verifiedConstants.auTrade
// (ABS 2024-25); the rest is editorial judgement on the channel, stated in
// `why`. Keys are Natural Earth NAME values (exact forms).
export const AU_IMPACT = {
  'China':                    { score: 3, why: 'Largest trade partner — biggest export market and import source' },
  'United States of America': { score: 3, why: 'Alliance, capital flows; #2 import source, #3 export market' },
  'Japan':                    { score: 3, why: '#2 export market' },
  'South Korea':              { score: 2, why: '#4 export market' },
  'India':                    { score: 2, why: '#5 export market' },
  'Singapore':                { score: 2, why: '#4 import source' },
  'Taiwan':                   { score: 2, why: 'Sits on the shipping lanes for North Asian trade' },
  'Saudi Arabia':             { score: 2, why: 'Oil prices and Gulf shipping' },
  'Iran':                     { score: 2, why: 'Strait of Hormuz — oil and LNG prices' },
  'United Arab Emirates':     { score: 2, why: 'Oil prices and Gulf shipping' },
  'Qatar':                    { score: 2, why: 'LNG competitor and Gulf shipping' },
  'Russia':                   { score: 2, why: 'Energy and grain markets' },
  'Indonesia':                { score: 1, why: 'Nearest large neighbour; regional stability' },
  'New Zealand':              { score: 1, why: 'Closest economic partner (CER)' },
  'Thailand':                 { score: 1, why: '#5 import source' },
  'United Kingdom':           { score: 1, why: 'Investment and financial ties' },
  'Malaysia':                 { score: 1, why: 'Fuel and regional trade' },
  'Vietnam':                  { score: 1, why: 'Growing export market' },
}

// ─── Financial districts ────────────────────────────────────────────────────
//
// The card shown when the map is zoomed into a financial centre. Institutions
// are reference facts (who is headquartered or sits in the city), not
// addresses — a street-level claim is one more thing to go stale. `exchange`
// is the EXCHANGES id whose hours give the session status; `index` is the
// symbol the card reads today's move from (demo data in this build, labelled).
// Note ANZ and NAB are Melbourne-headquartered, not Sydney.
export const FINANCIAL_DISTRICTS = [
  { id: 'syd', name: 'SYDNEY CBD', lon: 151.2093, lat: -33.8679, exchange: 'ASX', index: '^AXJO', indexLabel: 'ASX 200', tz: 'Australia/Sydney',
    institutions: ['ASX — Australian Securities Exchange', 'Reserve Bank of Australia', 'Commonwealth Bank HQ', 'Westpac HQ', 'Macquarie Group HQ', 'AMP and the major fund managers'] },
  { id: 'mel', name: 'MELBOURNE CBD', lon: 144.9631, lat: -37.8150, exchange: 'ASX', index: '^AXJO', indexLabel: 'ASX 200', tz: 'Australia/Melbourne',
    institutions: ['BHP global HQ', 'NAB HQ (Docklands)', 'ANZ HQ (Docklands)', 'Telstra HQ', 'AustralianSuper and the large industry funds'] },
  { id: 'per', name: 'PERTH CBD', lon: 115.8575, lat: -31.9545, exchange: 'ASX', index: '^AXJO', indexLabel: 'ASX 200', tz: 'Australia/Perth',
    institutions: ['Woodside Energy HQ', 'Wesfarmers HQ', 'Fortescue HQ', 'Northern Star Resources HQ', 'Mineral Resources HQ — the mining services hub'] },
  { id: 'nyc', name: 'LOWER MANHATTAN', lon: -74.0113, lat: 40.7069, exchange: 'NYSE', index: '^GSPC', indexLabel: 'S&P 500', tz: 'America/New_York',
    institutions: ['New York Stock Exchange', 'Federal Reserve Bank of New York', 'Goldman Sachs HQ', 'JPMorgan Chase HQ (Midtown)', 'Nasdaq (Times Square)'] },
  { id: 'ldn', name: 'CITY OF LONDON', lon: -0.0886, lat: 51.5142, exchange: 'LSE', index: '^FTSE', indexLabel: 'FTSE 100', tz: 'Europe/London',
    institutions: ['London Stock Exchange', 'Bank of England', 'Lloyd\'s of London', 'HSBC and Barclays HQs (Canary Wharf)'] },
  { id: 'tyo', name: 'NIHONBASHI / MARUNOUCHI', lon: 139.7745, lat: 35.6845, exchange: 'TSE', index: '^N225', indexLabel: 'Nikkei 225', tz: 'Asia/Tokyo',
    institutions: ['Tokyo Stock Exchange (Kabutocho)', 'Bank of Japan', 'MUFG, SMFG and Mizuho HQs'] },
  { id: 'hkg', name: 'CENTRAL, HONG KONG', lon: 114.1588, lat: 22.2823, exchange: 'HKEX', index: '^HSI', indexLabel: 'Hang Seng', tz: 'Asia/Hong_Kong',
    institutions: ['Hong Kong Exchanges and Clearing', 'Hong Kong Monetary Authority', 'HSBC Asia-Pacific HQ', 'Bank of China Tower'] },
  { id: 'sin', name: 'RAFFLES PLACE, SINGAPORE', lon: 103.8514, lat: 1.2840, exchange: 'SGX', index: null, indexLabel: null, tz: 'Asia/Singapore',
    institutions: ['Singapore Exchange (SGX)', 'Monetary Authority of Singapore', 'DBS, OCBC and UOB HQs'] },
]

// ─── Trade-route notes (AU FOCUS arcs) ──────────────────────────────────────
//
// The ABS value on each arc is sourced (verifiedConstants.auTrade). These are
// the editorial parts of the route card: the sea lanes most of the trade
// uses, and a three-line risk read. The ratings are judgement, labelled
// EDITORIAL on the card, and say why.
export const ROUTE_NOTES = {
  'China': {
    lanes: 'From WA ports through the Lombok and Makassar straits, then the South China Sea; east-coast cargoes via the Coral Sea and Philippine waters.' },
  'Japan': {
    lanes: 'North through the Lombok/Makassar straits or east of the Philippines; LNG from the North West Shelf and Gladstone.' },
  'United States': {
    lanes: 'Across the Pacific; much of the value is gold and services, which move by air and wire rather than ship.' },
  'South Korea': {
    lanes: 'North via the Lombok/Makassar straits; iron ore, coal and LNG to the steel and power sectors.' },
  'India': {
    lanes: 'West across the Indian Ocean, often through the Sunda Strait or around Sumatra.' },
}

// Two coordinates to a great-circle distance in km.
export function greatCircleKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ─── Resource regions: the extra card lines ─────────────────────────────────
//
// `price` names a verifiedConstants.commodities key (dated, sourced); null
// where the terminal holds no price for what the region produces (Bowen is
// mostly METALLURGICAL coal and only a thermal price is held, so none is
// shown rather than the wrong one). `sector` is the Screener sector for SEE
// RELATED STOCKS. (The per-site risk lists were removed 16 Nov 2026: no
// source.)
export const SITE_EXTRAS = {
  'au-pilbara':    { price: 'ironOreUSD', priceLabel: 'Iron ore 62% Fe', unit: 'US$/t', sector: 'Materials' },
  'au-bowen':      { price: null, priceLabel: 'Metallurgical coal', sector: 'Materials' },
  'au-nws':        { price: 'lngUSDPerMMBtu', priceLabel: 'LNG (JKM spot)', unit: 'US$/MMBtu', sector: 'Energy' },
  'au-curtis':     { price: 'lngUSDPerMMBtu', priceLabel: 'LNG (JKM spot)', unit: 'US$/MMBtu', sector: 'Energy' },
  'au-cooper':     { price: 'brentUSD', priceLabel: 'Brent crude (oil reference)', unit: 'US$/bbl', sector: 'Energy' },
  'au-kalgoorlie': { price: null, priceLabel: 'Gold', sector: 'Materials' },
}

// Where each central bank sits, for the map's decision markers.
export const CENTRAL_BANK_SITES = {
  AU: { bank: 'RBA', city: 'Sydney', lon: 151.2115, lat: -33.8675 },
  US: { bank: 'Fed', city: 'Washington', lon: -77.0465, lat: 38.8928 },
  EU: { bank: 'ECB', city: 'Frankfurt', lon: 8.7047, lat: 50.1096 },
  JP: { bank: 'BOJ', city: 'Tokyo', lon: 139.7712, lat: 35.6862 },
  UK: { bank: 'BoE', city: 'London', lon: -0.0886, lat: 51.5142 },
  CA: { bank: 'BoC', city: 'Ottawa', lon: -75.7009, lat: 45.4208 },
}
