import * as d3 from 'd3'

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING layer — major container lanes, great-circle waypoints [lon, lat].
// Shared between MaddexGlobe (renders/animates them) and GlobalModule's
// CountryPanel (lists routes relevant to a clicked country) — lives in its
// own data module rather than a component file so both can import it without
// tripping the fast-refresh only-export-components rule.
// ─────────────────────────────────────────────────────────────────────────────

export const SHIPPING_ROUTES = [
  { id: 'trans-pacific',  name: 'Trans-Pacific',                      teu: '45,000 TEU/day',            status: 'ACTIVE',
    points: [[121.47, 31.23], [-118.24, 34.05]] }, // Shanghai -> Los Angeles
  { id: 'asia-europe',    name: 'Asia-Europe (via Suez)',              teu: '38,000 TEU/day',            status: 'DISRUPTED',
    points: [[103.82, 1.35], [43.3, 12.6], [32.55, 30.5], [4.48, 51.92]] }, // Singapore -> Bab-el-Mandeb -> Suez -> Rotterdam
  { id: 'asia-australia', name: 'Asia-Australia',                      teu: '12,000 TEU/day',            status: 'ACTIVE',
    points: [[103.82, 1.35], [151.21, -33.87]] }, // Singapore -> Sydney
  { id: 'trans-atlantic', name: 'Trans-Atlantic',                      teu: '18,000 TEU/day',            status: 'ACTIVE',
    points: [[-74.01, 40.71], [-0.13, 51.51]] }, // New York -> London
  { id: 'indian-ocean',   name: 'Indian Ocean',                        teu: '9,000 TEU/day',             status: 'ACTIVE',
    points: [[72.84, 18.94], [31.02, -29.86], [144.96, -37.81]] }, // Mumbai -> Durban -> Melbourne
  { id: 'cape-good-hope', name: 'Cape of Good Hope (Asia-Europe alt)', teu: '14,000 TEU/day',            status: 'CONGESTED',
    points: [[103.82, 1.35], [18.42, -34.36], [4.48, 51.92]] }, // Singapore -> Cape -> Rotterdam
  { id: 'red-sea-suez',   name: 'Red Sea / Suez Canal Corridor',       teu: '31,000 TEU/day (diverted)', status: 'DISRUPTED',
    points: [[43.3, 12.6], [35.0, 20.5], [32.55, 30.5]], warningAt: [43.3, 12.6] }, // Bab-el-Mandeb -> Suez
]

// FREIGHT layer — major air-cargo corridors, great-circle endpoints.
export const FREIGHT_ROUTES = [
  { id: 'hkg-lax', name: 'Hong Kong – Los Angeles', tonnage: '2.3M tonnes/yr', points: [[113.92, 22.31], [-118.41, 33.94]] },
  { id: 'fra-ord', name: 'Frankfurt – Chicago',     tonnage: '0.9M tonnes/yr', points: [[8.57, 50.03], [-87.90, 41.97]] },
  { id: 'dxb-lhr', name: 'Dubai – London',          tonnage: '1.1M tonnes/yr', points: [[55.36, 25.25], [-0.45, 51.47]] },
  { id: 'sin-syd', name: 'Singapore – Sydney',      tonnage: '0.6M tonnes/yr', points: [[103.99, 1.36], [151.18, -33.94]] },
  { id: 'nrt-lax', name: 'Tokyo – Los Angeles',     tonnage: '0.8M tonnes/yr', points: [[140.39, 35.77], [-118.41, 33.94]] },
]

// Key disruption points, drawn as ⚠ markers whenever the SHIPPING overlay is on.
export const CHOKEPOINT_WARNINGS = [
  { name: 'Red Sea / Bab-el-Mandeb', lon: 43.3,  lat: 12.6, status: 'DISRUPTED' },
  { name: 'Panama Canal',            lon: -79.6, lat: 9.08, status: 'CONGESTED' },
  { name: 'Taiwan Strait',           lon: 119.5, lat: 24.0, status: 'ELEVATED TENSION' },
]

// TRADE IMPACT overlay — filled tension-zone polygons, [lon, lat] rings.
export const TRADE_IMPACT_ZONES = [
  { id: 'scs',      name: 'South China Sea',          tier: 'high',       coords: [[105, 23], [121, 23], [121, 3],  [105, 3]] },
  { id: 'redsea',   name: 'Red Sea',                  tier: 'high',       coords: [[32, 30],  [43, 20],  [43, 12],  [32, 15]] },
  { id: 'hormuz',   name: 'Strait of Hormuz',         tier: 'high',       coords: [[54, 27],  [58, 27],  [58, 24],  [54, 24]] },
  { id: 'taiwan',   name: 'Taiwan Strait',            tier: 'high',       coords: [[117, 26], [122, 26], [122, 22], [117, 22]] },
  { id: 'blacksea', name: 'Black Sea',                tier: 'high',       coords: [[27, 47],  [42, 47],  [42, 41],  [27, 41]] },
  { id: 'eastmed',  name: 'Eastern Mediterranean',    tier: 'elevated',   coords: [[23, 37],  [36, 37],  [36, 31],  [23, 31]] },
  { id: 'korea',    name: 'Korean Peninsula waters',  tier: 'elevated',   coords: [[124, 40], [132, 40], [132, 33], [124, 33]] },
  { id: 'arctic',   name: 'Arctic shipping routes',   tier: 'monitoring', coords: [[30, 78],  [170, 78], [170, 70], [30, 70]] },
]
export const TRADE_TIER_FILL = {
  high:       'rgba(168,50,50,0.20)',
  elevated:   'rgba(201,140,50,0.15)',
  monitoring: 'rgba(50,100,180,0.10)',
}
export const TRADE_TIER_STROKE = {
  high:       'rgba(168,50,50,0.5)',
  elevated:   'rgba(201,140,50,0.45)',
  monitoring: 'rgba(50,100,180,0.4)',
}
export const TRADE_TIER_LABEL = { high: 'High tension', elevated: 'Elevated', monitoring: 'Monitoring' }

// Great-circle distance/interpolation along a multi-waypoint route — used
// both to draw the animated dots/plane (a point at fraction t of the whole
// route) and to project a route's midpoint for its tooltip.
export function pointAlongRoute(points, t) {
  const segLens = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const d = d3.geoDistance(points[i], points[i + 1])
    segLens.push(d)
    total += d
  }
  if (total === 0) return points[0]
  let target = Math.max(0, Math.min(1, t)) * total
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i] || i === segLens.length - 1) {
      const localT = segLens[i] > 0 ? Math.min(1, target / segLens[i]) : 0
      return d3.geoInterpolate(points[i], points[i + 1])(localT)
    }
    target -= segLens[i]
  }
  return points[points.length - 1]
}
