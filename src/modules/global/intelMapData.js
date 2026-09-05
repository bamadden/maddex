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

export const EXCHANGES = [
  { id: 'ASX',  city: 'Sydney',    flag: '🇦🇺', lon: 151.2093, lat: -33.8688, index: 'ASX 200',        value: 8247.3,  change: 0.42,  openHour: 10,   closeHour: 16,   tz: 'Australia/Sydney',  volume: 4.2e9,  marketCap: 2.1e12,
    topStocks: ['BHP', 'CBA', 'CSL', 'WES', 'ANZ'] },
  { id: 'NYSE', city: 'New York',  flag: '🇺🇸', lon: -74.0060, lat: 40.7128,  index: 'S&P 500',        value: 5842.3,  change: 0.32,  openHour: 9.5,  closeHour: 16,   tz: 'America/New_York',  volume: 24.8e9, marketCap: 45.2e12,
    topStocks: ['AAPL', 'MSFT', 'NVDA', 'JPM', 'JNJ'] },
  { id: 'LSE',  city: 'London',    flag: '🇬🇧', lon: -0.1276,  lat: 51.5074,  index: 'FTSE 100',       value: 8624.1,  change: -0.21, openHour: 8,    closeHour: 16.5, tz: 'Europe/London',     volume: 8.4e9,  marketCap: 3.8e12,
    topStocks: ['SHEL', 'AZN', 'HSBA', 'ULVR', 'BP'] },
  { id: 'TSE',  city: 'Tokyo',     flag: '🇯🇵', lon: 139.6917, lat: 35.6895,  index: 'Nikkei 225',     value: 38420.5, change: 0.75,  openHour: 9,    closeHour: 15.5, tz: 'Asia/Tokyo',        volume: 3.8e9,  marketCap: 6.2e12,
    topStocks: ['7203', '6758', '9984', '8306', '6501'] },
  { id: 'HKEX', city: 'Hong Kong', flag: '🇭🇰', lon: 114.1694, lat: 22.3193,  index: 'Hang Seng',      value: 18242.1, change: -0.46, openHour: 9.5,  closeHour: 16,   tz: 'Asia/Hong_Kong',    volume: 5.1e9,  marketCap: 4.1e12,
    topStocks: ['0700', '9988', '0939', '1299', '0005'] },
  { id: 'SSE',  city: 'Shanghai',  flag: '🇨🇳', lon: 121.4737, lat: 31.2304,  index: 'SSE Composite',  value: 3284.2,  change: -0.38, openHour: 9.5,  closeHour: 15,   tz: 'Asia/Shanghai',     volume: 28.4e9, marketCap: 8.4e12,
    topStocks: ['600519', '601398', '601857', '600036', '601288'] },
  { id: 'FSE',  city: 'Frankfurt', flag: '🇩🇪', lon: 8.6821,   lat: 50.1109,  index: 'DAX',            value: 18842.3, change: 0.66,  openHour: 9,    closeHour: 17.5, tz: 'Europe/Berlin',     volume: 3.2e9,  marketCap: 2.0e12,
    topStocks: ['SAP', 'SIE', 'ALV', 'DTE', 'MBG'] },
  { id: 'BSE',  city: 'Mumbai',    flag: '🇮🇳', lon: 72.8777,  lat: 19.0760,  index: 'SENSEX',         value: 81242.4, change: 0.42,  openHour: 9.25, closeHour: 15.5, tz: 'Asia/Kolkata',      volume: 2.1e9,  marketCap: 3.2e12,
    topStocks: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'] },
  { id: 'SGX',  city: 'Singapore', flag: '🇸🇬', lon: 103.8198, lat: 1.3521,   index: 'STI',            value: 3412.8,  change: 0.18,  openHour: 9,    closeHour: 17,   tz: 'Asia/Singapore',    volume: 1.2e9,  marketCap: 0.8e12,
    topStocks: ['D05', 'O39', 'U11', 'Z74', 'C6L'] },
  { id: 'TSX',  city: 'Toronto',   flag: '🇨🇦', lon: -79.3832, lat: 43.6532,  index: 'TSX',            value: 22847.6, change: 0.28,  openHour: 9.5,  closeHour: 16,   tz: 'America/Toronto',   volume: 4.8e9,  marketCap: 2.8e12,
    topStocks: ['RY', 'TD', 'ENB', 'CNR', 'BN'] },
  { id: 'NZX',  city: 'Auckland',  flag: '🇳🇿', lon: 174.7633, lat: -36.8485, index: 'NZX 50',         value: 12284.3, change: 0.15,  openHour: 10,   closeHour: 17,   tz: 'Pacific/Auckland',  volume: 0.3e9,  marketCap: 0.15e12,
    topStocks: ['FPH', 'AIA', 'MEL', 'SPK', 'MCY'] },
  { id: 'TASE', city: 'Tel Aviv',  flag: '🇮🇱', lon: 34.7818,  lat: 32.0853,  index: 'TA-35',          value: 2124.8,  change: -0.32, openHour: 9.5,  closeHour: 17.5, tz: 'Asia/Jerusalem',    volume: 0.8e9,  marketCap: 0.2e12,
    topStocks: ['TEVA', 'NICE', 'ESLT', 'POLI', 'LUMI'] },
]

export const TRADE_ROUTES = [
  { id: 'AU-CN',   from: [151.2, -33.9], to: [121.5, 31.2],  value: 296, exports: 'Iron Ore, Coal, LNG, Gold',  color: [201, 168, 76], thickness: 6 },
  { id: 'AU-JP',   from: [151.2, -33.9], to: [139.7, 35.7],  value: 89,  exports: 'LNG, Coal, Beef',            color: [201, 168, 76], thickness: 3 },
  { id: 'AU-KR',   from: [151.2, -33.9], to: [126.9, 37.6],  value: 67,  exports: 'Iron Ore, LNG, Coal',        color: [201, 168, 76], thickness: 2.5 },
  { id: 'AU-IN',   from: [151.2, -33.9], to: [72.9, 19.1],   value: 42,  exports: 'Coal, Gold, Education',      color: [201, 168, 76], thickness: 2 },
  { id: 'AU-US',   from: [151.2, -33.9], to: [-74.0, 40.7],  value: 45,  exports: 'Beef, Wine, Tourism',        color: [45, 138, 80],  thickness: 2 },
  { id: 'AU-UK',   from: [151.2, -33.9], to: [-0.1, 51.5],   value: 38,  exports: 'Resources, Finance',         color: [45, 138, 80],  thickness: 1.5 },
  { id: 'AU-SG',   from: [151.2, -33.9], to: [103.8, 1.4],   value: 28,  exports: 'LNG, Education',             color: [201, 168, 76], thickness: 1.5 },
  { id: 'US-CN',   from: [-74.0, 40.7],  to: [121.5, 31.2],  value: 690, exports: 'Tech, Agriculture',          color: [100, 140, 200], thickness: 5 },
  { id: 'EU-CN',   from: [8.7, 50.1],    to: [121.5, 31.2],  value: 480, exports: 'Machinery, Vehicles',        color: [100, 140, 200], thickness: 4 },
  { id: 'RED-SEA', from: [8.7, 50.1],    to: [72.9, 19.1],   value: 200, exports: 'EU-Asia shipping',           color: [168, 50, 50],  thickness: 3, disrupted: true },
]

// AU-only subset, used by Australia focus mode so the arc layer doesn't have
// to be refiltered on every render.
export const AU_TRADE_ROUTES = TRADE_ROUTES.filter((r) => r.id.startsWith('AU-'))

export const SHIPPING_DISRUPTIONS = [
  { id: 'red-sea', name: 'Red Sea', coordinates: [43.0, 13.5], radius: 450000, severity: 'CRITICAL', severityScore: 92,
    title: 'Houthi Attacks — Red Sea',
    detail: 'Ongoing attacks on commercial shipping. Major carriers diverting around the Cape of Good Hope. Adds roughly 14 days and about US$1M in fuel to EU-Asia routes.',
    impact: 'Freight rates +340% on Asia-Europe routes',
    affectedRoutes: ['EU-Asia', 'Oil tankers', 'Container ships'],
    commodities: ['Containers', 'Crude Oil', 'LNG'],
    asxImpact: [{ ticker: 'WDS', why: 'LNG shipping cost and route risk' }, { ticker: 'STO', why: 'Oil price sensitivity' }],
    startDate: '2023-11-19' },
  { id: 'taiwan', name: 'Taiwan Strait', coordinates: [120.5, 24.5], radius: 220000, severity: 'HIGH', severityScore: 74,
    title: 'Taiwan Strait — Military Tension',
    detail: 'Elevated PLA naval activity. Roughly half of global container traffic transits this strait annually, and the semiconductor supply chain runs through it.',
    impact: 'Insurance premiums elevated. Rerouting preparation underway.',
    affectedRoutes: ['Trans-Pacific', 'Intra-Asia'],
    commodities: ['Semiconductors', 'Containers', 'Electronics'],
    asxImpact: [{ ticker: 'WTC', why: 'Logistics software exposure' }, { ticker: 'BHP', why: 'China demand channel' }],
    startDate: '2024-01-01' },
  { id: 'malacca', name: 'Strait of Malacca', coordinates: [103.5, 1.5], radius: 120000, severity: 'MEDIUM', severityScore: 48,
    title: 'Strait of Malacca — Piracy Risk',
    detail: 'Elevated piracy risk on a lane carrying 80,000+ ships a year. The primary bottleneck for Australian LNG heading to North Asia.',
    impact: 'Minor delays. Security escorts recommended.',
    affectedRoutes: ['AU-Asia LNG', 'Oil tankers'],
    commodities: ['LNG', 'Crude Oil'],
    asxImpact: [{ ticker: 'WDS', why: 'Primary LNG export lane' }],
    startDate: '2024-06-01' },
  { id: 'suez', name: 'Suez Canal', coordinates: [32.5, 30.5], radius: 80000, severity: 'MEDIUM', severityScore: 55,
    title: 'Suez Canal — Reduced Traffic',
    detail: 'Traffic down about 42% against pre-conflict levels as vessels divert. Canal authority revenue falling sharply.',
    impact: 'Knock-on effects for global freight rates',
    affectedRoutes: ['EU-Asia', 'EU-East Africa'],
    commodities: ['Containers', 'Crude Oil'],
    asxImpact: [{ ticker: 'QAN', why: 'Fuel cost pass-through' }],
    startDate: '2023-12-01' },
  { id: 'panama', name: 'Panama Canal', coordinates: [-79.9, 9.1], radius: 60000, severity: 'LOW', severityScore: 30,
    title: 'Panama Canal — Water Levels',
    detail: 'Low water levels limiting daily transits from 38 vessels to about 24. El Niño impacts persisting.',
    impact: 'US-Asia shipping diverted. Minor delays.',
    affectedRoutes: ['US East Coast-Asia', 'LNG tankers'],
    commodities: ['LNG', 'Containers', 'Grain'],
    asxImpact: [],
    startDate: '2023-09-01' },
]

export const COMMODITY_SITES = [
  { id: 'pilbara-iron',    lon: 117.7, lat: -22.5, commodity: 'Iron Ore',     country: 'Australia',    production: 900,  unit: 'Mt/yr',  globalSharePct: 38, auRank: 1, companies: ['BHP', 'RIO', 'FMG'],        asx: ['BHP', 'RIO', 'FMG'], color: [180, 80, 40] },
  { id: 'qld-coal',        lon: 148.5, lat: -23.5, commodity: 'Thermal Coal', country: 'Australia',    production: 400,  unit: 'Mt/yr',  globalSharePct: 6,  auRank: 2, companies: ['WHC', 'NHC'],               asx: ['WHC', 'NHC'],        color: [60, 60, 60] },
  { id: 'nw-lng',          lon: 115.8, lat: -21.9, commodity: 'LNG',          country: 'Australia',    production: 88,   unit: 'Mt/yr',  globalSharePct: 21, auRank: 2, companies: ['WDS', 'STO'],               asx: ['WDS', 'STO'],        color: [80, 140, 200] },
  { id: 'kalgoorlie-gold', lon: 121.4, lat: -30.8, commodity: 'Gold',         country: 'Australia',    production: 320,  unit: 't/yr',   globalSharePct: 9,  auRank: 2, companies: ['NST', 'EVN', 'NEM'],        asx: ['NST', 'EVN'],        color: [255, 215, 0] },
  { id: 'pilbara-lithium', lon: 119.2, lat: -21.5, commodity: 'Lithium',      country: 'Australia',    production: 84,   unit: 'kt/yr',  globalSharePct: 47, auRank: 1, companies: ['PLS', 'MIN', 'IGO'],        asx: ['PLS', 'MIN'],        color: [140, 200, 140] },
  { id: 'chile-copper',    lon: -70.6, lat: -29.0, commodity: 'Copper',       country: 'Chile',        production: 5700, unit: 'kt/yr',  globalSharePct: 24, auRank: null, companies: ['Codelco', 'BHP', 'Anglo'], asx: ['BHP', 'S32'],        color: [200, 100, 50] },
  { id: 'saudi-oil',       lon: 49.6,  lat: 26.3,  commodity: 'Crude Oil',    country: 'Saudi Arabia', production: 9800, unit: 'kbd',    globalSharePct: 11, auRank: null, companies: ['Saudi Aramco'],           asx: ['WDS', 'STO'],        color: [40, 40, 40] },
  { id: 'china-re',        lon: 110.0, lat: 40.0,  commodity: 'Rare Earths',  country: 'China',        production: 240,  unit: 'kt/yr',  globalSharePct: 69, auRank: null, companies: ['China Northern RE'],      asx: ['LYC'],               color: [100, 200, 100] },
  { id: 'ukraine-wheat',   lon: 32.0,  lat: 49.0,  commodity: 'Wheat',        country: 'Ukraine',      production: 33,   unit: 'Mt/yr',  globalSharePct: 4,  auRank: null, companies: ['Various'],                asx: ['GNC'],               color: [220, 180, 60], disrupted: true },
]

export const GEOPOLITICAL_EVENTS = [
  { id: 'ukraine',     lon: 32.0,  lat: 49.0,  title: 'Russia-Ukraine War',       severity: 'CRITICAL', riskScore: 88, type: 'CONFLICT',
    summary: 'Ongoing conflict. Wheat and fertiliser disruption. Energy prices elevated.',
    marketImpact: 'EU energy costs, global food inflation, defence stocks bid',
    asxExposure: 'WDS, STO (LNG demand), GNC (wheat)',
    alliances: ['NATO (indirect)', 'Five Eyes intelligence sharing'],
    auTrade: { level: 'LOW', note: 'Limited direct trade; exposure is via commodity prices' } },
  { id: 'taiwan-geo',  lon: 120.9, lat: 23.7, title: 'China-Taiwan Tensions',     severity: 'HIGH',     riskScore: 76, type: 'GEOPOLITICAL',
    summary: 'Elevated military activity. Semiconductor supply chain risk.',
    marketImpact: 'Tech stocks sensitive. TSMC is the critical node.',
    asxExposure: 'Tech sector, WTC (supply chain software)',
    alliances: ['AUKUS', 'Quad', 'Five Eyes'],
    auTrade: { level: 'HIGH', note: 'A blockade would disrupt the lane carrying most AU-North Asia trade' } },
  { id: 'middle-east', lon: 34.8,  lat: 31.5, title: 'Middle East Conflict',      severity: 'HIGH',     riskScore: 71, type: 'CONFLICT',
    summary: 'Regional escalation risk. Oil supply disruption threat.',
    marketImpact: 'Oil prices elevated. Safe haven demand.',
    asxExposure: 'WDS, STO (oil price), gold miners',
    alliances: ['US-led coalition'],
    auTrade: { level: 'MEDIUM', note: 'Indirect — oil price and Red Sea shipping' } },
  { id: 'china-econ',  lon: 116.4, lat: 39.9, title: 'China Economic Slowdown',   severity: 'MEDIUM',   riskScore: 58, type: 'ECONOMIC',
    summary: 'Property sector stress. Consumer confidence low.',
    marketImpact: 'Commodity demand pressure. Australian exports at risk.',
    asxExposure: 'BHP, RIO, FMG, S32 — direct exposure',
    alliances: ['RCEP', 'ChAFTA (bilateral)'],
    auTrade: { level: 'HIGH', note: 'China takes roughly 38% of Australian exports' } },
  { id: 'us-election', lon: -77.0, lat: 38.9, title: 'US Policy Risk',            severity: 'MEDIUM',   riskScore: 52, type: 'POLITICAL',
    summary: 'Trade policy uncertainty. Tariff risk.',
    marketImpact: 'USD volatility. Trade-exposed sectors.',
    asxExposure: 'US-listed ADRs, tech sector',
    alliances: ['ANZUS', 'AUKUS', 'Five Eyes'],
    auTrade: { level: 'MEDIUM', note: 'Second-largest two-way trade partner' } },
]

// Paths are [lat, lon] pairs as sourced; the map layer flips them to the
// [lon, lat] order deck.gl expects.
export const UNDERSEA_CABLES = [
  { name: 'Southern Cross NEXT',  path: [[-33.9, 151.2], [21.3, -157.8], [37.7, -122.4]], capacity: '72 Tbps', owner: 'Telstra / Spark' },
  { name: 'Australia-Japan Cable', path: [[-33.9, 151.2], [1.4, 103.8], [35.7, 139.7]],   capacity: '40 Tbps', owner: 'Consortium' },
  { name: 'INDIGO-West',           path: [[-31.9, 115.8], [4.2, 73.5], [19.1, 72.9]],     capacity: '24 Tbps', owner: 'Google / Telstra' },
]

export const MILITARY_BASES = [
  { name: 'Pine Gap',             lon: 133.7, lat: -23.8, country: 'AU / US',      type: 'Intelligence', significance: 'Joint signals intelligence facility' },
  { name: 'RAAF Darwin',          lon: 130.9, lat: -12.4, country: 'Australia',    type: 'Air Base',     significance: 'US Marine rotation. Northern defence.' },
  { name: 'Guam (Andersen AFB)',  lon: 144.9, lat: 13.6,  country: 'United States', type: 'Air / Naval', significance: 'Key Pacific power projection hub' },
  { name: 'Diego Garcia',         lon: 72.4,  lat: -7.3,  country: 'UK / US',      type: 'Naval / Air',  significance: 'Indian Ocean strategic base' },
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

export const SEVERITY_COLOUR = {
  CRITICAL: [168, 50, 50],
  HIGH:     [200, 100, 50],
  MEDIUM:   [201, 168, 76],
  LOW:      [100, 140, 200],
}

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
