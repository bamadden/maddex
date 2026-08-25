import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { fetchYFBatch } from '../../services/api'
import {
  SHIPPING_ROUTES, FREIGHT_ROUTES, CHOKEPOINT_WARNINGS, TRADE_IMPACT_ZONES,
  TRADE_TIER_FILL, TRADE_TIER_STROKE, pointAlongRoute,
} from '../../data/globeRoutes'
import { EXCHANGES, subsolarPoint, DEFAULT_ROTATION } from '../../data/globeExchanges'

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const YF_SYMBOLS = [...new Set(EXCHANGES.map(e => e.ySymbol))]

// Base layer (always on, mutually exclusive) + overlay layers (can stack, each
// with its own on/off + opacity). Replaces the old single-select DISPLAY_MODES.
// Overlays are split into two panel sections: DATA (Markets/Heat/Crypto — get
// an opacity slider) and ROUTE (Shipping/Freight/Trade Impact — on/off only).
const BASE_LAYERS = ['EARTH', 'DARK']
const DATA_OVERLAY_KEYS = ['MARKETS', 'HEAT', 'CRYPTO']
const ROUTE_OVERLAY_KEYS = ['SHIPPING', 'FREIGHT', 'TRADE_IMPACT']
// New on/off-only layers — seismic events, population-density fill, the
// day/night terminator, and a purely decorative satellite orbit ring.
const VISUAL_OVERLAY_KEYS = ['SEISMIC', 'POPULATION', 'DAYNIGHT', 'SATELLITE']
const ALL_OVERLAY_KEYS = [...DATA_OVERLAY_KEYS, ...ROUTE_OVERLAY_KEYS, ...VISUAL_OVERLAY_KEYS]
const OVERLAY_LABELS = {
  MARKETS: 'Markets', HEAT: 'Heat map', CRYPTO: 'Crypto',
  SHIPPING: 'Shipping routes', FREIGHT: 'Air freight', TRADE_IMPACT: 'Trade impact zones',
  SEISMIC: 'Seismic (M4.0+)', POPULATION: 'Population density', DAYNIGHT: 'Day / night', SATELLITE: 'Satellite orbit',
}
const DEFAULT_OVERLAYS = {
  MARKETS:      { active: true,  opacity: 100 },
  HEAT:         { active: false, opacity: 70 },
  CRYPTO:       { active: false, opacity: 70 },
  SHIPPING:     { active: true,  opacity: 100 },
  FREIGHT:      { active: false, opacity: 100 },
  TRADE_IMPACT: { active: false, opacity: 100 },
  SEISMIC:      { active: false, opacity: 100 },
  POPULATION:   { active: false, opacity: 100 },
  DAYNIGHT:     { active: false, opacity: 100 },
  SATELLITE:    { active: false, opacity: 100 },
}

// Top ~50 most populous countries (2024-25 UN estimates, millions) — keyed
// by ISO-3166-1 numeric id (matches world-atlas topojson feature.id, same
// key space as CONTINENT_BY_COUNTRY_ID above). Used by the POPULATION
// density visual layer; countries not listed fall back to grey.
const POPULATION_MILLIONS_BY_COUNTRY_ID = {
  356: 1441, 156: 1425, 840: 340, 360: 282, 586: 241, 566: 224, 76: 217, 50: 173,
  643: 144, 484: 130, 392: 124, 231: 128, 608: 117, 818: 113, 180: 102, 704: 100,
  364: 89, 792: 85, 276: 84, 764: 72, 826: 68, 250: 68, 834: 67, 710: 60,
  380: 59, 404: 55, 104: 54, 170: 52, 410: 52, 729: 48, 800: 48, 724: 48,
  12: 46, 32: 46, 368: 45, 4: 42, 887: 34, 124: 39, 616: 37, 504: 37,
  24: 36, 804: 36, 860: 35, 458: 34, 604: 34, 682: 36, 508: 33, 862: 29,
  384: 29, 36: 26,
}

function isDaylit(lon, lat, subLon, subLat) {
  const phi0 = subLat * RAD, lambda0 = subLon * RAD
  const phi = lat * RAD, lambda = lon * RAD
  return (Math.sin(phi) * Math.sin(phi0) + Math.cos(phi) * Math.cos(phi0) * Math.cos(lambda - lambda0)) > 0
}

// Auto-rotate speed is degrees/frame.
const AUTO_ROTATE_SPEED = 0.06

const RAD = Math.PI / 180

// ─────────────────────────────────────────────────────────────────────────────
// EARTH layer — continent lookup + natural-earth tones
// ─────────────────────────────────────────────────────────────────────────────

const CONTINENT_COLORS = {
  EUROPE: '#8fa876',
  AFRICA: '#c4a265',
  ASIA: '#a8896b',
  NORTH_AMERICA: '#7a9e6e',
  SOUTH_AMERICA: '#6b9e6e',
  OCEANIA: '#c4956a',
  ANTARCTICA: '#e8e8e8',
}
const EARTH_DEFAULT_COLOR = '#7d8f78'

// ISO 3166-1 numeric id (matches world-atlas topojson feature.id) → continent
const CONTINENT_BY_COUNTRY_ID = {
  4: 'ASIA', 8: 'EUROPE', 12: 'AFRICA', 16: 'OCEANIA', 20: 'EUROPE', 24: 'AFRICA',
  28: 'NORTH_AMERICA', 31: 'ASIA', 32: 'SOUTH_AMERICA', 36: 'OCEANIA', 40: 'EUROPE',
  44: 'NORTH_AMERICA', 48: 'ASIA', 50: 'ASIA', 52: 'NORTH_AMERICA', 56: 'EUROPE', 64: 'ASIA',
  68: 'SOUTH_AMERICA', 70: 'EUROPE', 72: 'AFRICA', 76: 'SOUTH_AMERICA', 84: 'NORTH_AMERICA',
  86: 'ASIA', 90: 'OCEANIA', 96: 'ASIA', 100: 'EUROPE',
  104: 'ASIA', 108: 'AFRICA', 112: 'EUROPE', 116: 'ASIA', 120: 'AFRICA', 124: 'NORTH_AMERICA',
  132: 'AFRICA', 136: 'NORTH_AMERICA', 140: 'AFRICA', 144: 'ASIA',
  148: 'AFRICA', 152: 'SOUTH_AMERICA', 156: 'ASIA', 158: 'ASIA', 170: 'SOUTH_AMERICA', 174: 'AFRICA',
  175: 'AFRICA', 178: 'AFRICA', 180: 'AFRICA', 184: 'OCEANIA',
  188: 'NORTH_AMERICA', 191: 'EUROPE', 192: 'NORTH_AMERICA', 196: 'EUROPE', 203: 'EUROPE', 204: 'AFRICA',
  208: 'EUROPE', 212: 'NORTH_AMERICA', 214: 'NORTH_AMERICA', 218: 'SOUTH_AMERICA', 818: 'AFRICA',
  222: 'NORTH_AMERICA', 226: 'AFRICA', 232: 'AFRICA', 233: 'EUROPE', 231: 'AFRICA',
  238: 'SOUTH_AMERICA', 242: 'OCEANIA', 246: 'EUROPE', 250: 'EUROPE', 262: 'AFRICA', 266: 'AFRICA',
  268: 'ASIA', 270: 'AFRICA', 275: 'ASIA', 276: 'EUROPE', 288: 'AFRICA', 292: 'EUROPE',
  296: 'OCEANIA', 300: 'EUROPE', 308: 'NORTH_AMERICA', 316: 'OCEANIA', 320: 'NORTH_AMERICA', 324: 'AFRICA',
  328: 'SOUTH_AMERICA', 332: 'NORTH_AMERICA', 336: 'EUROPE', 340: 'NORTH_AMERICA', 344: 'ASIA',
  348: 'EUROPE', 352: 'EUROPE', 356: 'ASIA', 360: 'ASIA', 364: 'ASIA', 368: 'ASIA',
  372: 'EUROPE', 376: 'ASIA', 380: 'EUROPE', 388: 'NORTH_AMERICA', 392: 'ASIA', 398: 'ASIA',
  400: 'ASIA', 404: 'AFRICA', 408: 'ASIA', 410: 'ASIA', 414: 'ASIA',
  417: 'ASIA', 418: 'ASIA', 422: 'ASIA', 426: 'AFRICA', 428: 'EUROPE', 430: 'AFRICA',
  434: 'AFRICA', 438: 'EUROPE', 440: 'EUROPE', 442: 'EUROPE', 446: 'ASIA',
  450: 'AFRICA', 454: 'AFRICA', 458: 'ASIA', 462: 'ASIA', 466: 'AFRICA', 470: 'EUROPE',
  478: 'AFRICA', 480: 'AFRICA', 484: 'NORTH_AMERICA', 492: 'EUROPE', 496: 'ASIA', 498: 'EUROPE',
  499: 'EUROPE', 504: 'AFRICA', 508: 'AFRICA', 512: 'ASIA', 516: 'AFRICA', 520: 'OCEANIA',
  524: 'ASIA', 528: 'EUROPE', 540: 'OCEANIA', 548: 'OCEANIA', 554: 'OCEANIA',
  558: 'NORTH_AMERICA', 562: 'AFRICA', 566: 'AFRICA', 578: 'EUROPE', 583: 'OCEANIA',
  584: 'OCEANIA', 585: 'OCEANIA', 586: 'ASIA', 591: 'NORTH_AMERICA', 598: 'OCEANIA',
  600: 'SOUTH_AMERICA', 604: 'SOUTH_AMERICA', 608: 'ASIA', 616: 'EUROPE', 620: 'EUROPE', 624: 'AFRICA',
  626: 'ASIA', 630: 'NORTH_AMERICA', 634: 'ASIA', 638: 'AFRICA', 642: 'EUROPE', 643: 'EUROPE',
  646: 'AFRICA', 659: 'NORTH_AMERICA', 662: 'NORTH_AMERICA',
  670: 'NORTH_AMERICA', 674: 'EUROPE', 678: 'AFRICA',
  682: 'ASIA', 686: 'AFRICA', 688: 'EUROPE', 690: 'AFRICA', 694: 'AFRICA',
  702: 'ASIA', 703: 'EUROPE', 705: 'EUROPE', 706: 'AFRICA', 710: 'AFRICA',
  716: 'AFRICA', 724: 'EUROPE', 728: 'AFRICA', 729: 'AFRICA', 740: 'SOUTH_AMERICA', 748: 'AFRICA',
  752: 'EUROPE', 756: 'EUROPE', 760: 'ASIA', 762: 'ASIA', 764: 'ASIA', 768: 'AFRICA',
  776: 'OCEANIA', 780: 'NORTH_AMERICA', 784: 'ASIA', 788: 'AFRICA',
  792: 'ASIA', 795: 'ASIA', 798: 'OCEANIA', 800: 'AFRICA', 804: 'EUROPE',
  807: 'EUROPE', 826: 'EUROPE', 834: 'AFRICA', 840: 'NORTH_AMERICA',
  854: 'AFRICA', 858: 'SOUTH_AMERICA', 860: 'ASIA', 862: 'SOUTH_AMERICA', 882: 'OCEANIA',
  887: 'ASIA', 894: 'AFRICA',
  10: 'ANTARCTICA', 304: 'NORTH_AMERICA', 732: 'AFRICA',
  704: 'ASIA', // Vietnam
}

function earthFillColor(numericId) {
  const continent = CONTINENT_BY_COUNTRY_ID[numericId]
  return (continent && CONTINENT_COLORS[continent]) || EARTH_DEFAULT_COLOR
}

// ─────────────────────────────────────────────────────────────────────────────
// CRYPTO layer — adoption tiers + top crypto hubs
// ─────────────────────────────────────────────────────────────────────────────

const CRYPTO_TIER_COLORS = {
  'very-high': '#2D8A50',
  high: '#1a5c35',
  medium: '#1A3A6A',
  low: '#6B2323',
  banned: '#A83232',
}
const CRYPTO_TIER_INFO = {
  'very-high': { label: 'Very High Adoption', legal: 'Legal' },
  high: { label: 'High Adoption', legal: 'Legal' },
  medium: { label: 'Medium Adoption', legal: 'Legal' },
  low: { label: 'Low Adoption', legal: 'Restricted' },
  banned: { label: 'Minimal Adoption', legal: 'Banned' },
}
// Illustrative adoption tiers by ISO numeric id — same synthetic-data spirit
// as the HEAT layer's index-based colouring.
const CRYPTO_TIER_BY_COUNTRY_ID = {
  222: 'very-high', 566: 'very-high', 704: 'very-high', 608: 'very-high', 804: 'very-high', 356: 'very-high',
  840: 'high', 76: 'high', 792: 'high', 32: 'high', 764: 'high', 360: 'high',
  36: 'medium', 826: 'medium', 276: 'medium', 124: 'medium', 250: 'medium', 702: 'medium', 392: 'medium', 410: 'medium',
  156: 'low', 643: 'low', 12: 'low', 818: 'low', 504: 'low', 68: 'low', 218: 'low',
  50: 'banned', 524: 'banned', 4: 'banned', 634: 'banned',
}

const CRYPTO_CITIES = [
  { name: 'Miami',            lon: -80.1918, lat: 25.7617 },
  { name: 'New York',         lon: -74.0060, lat: 40.7128 },
  { name: 'London',           lon: -0.1278,  lat: 51.5074 },
  { name: 'Singapore',        lon: 103.8198, lat: 1.3521 },
  { name: 'Dubai',            lon: 55.2708,  lat: 25.2048 },
  { name: 'Zug',              lon: 8.5150,   lat: 47.1662 },
  { name: 'Lisbon',           lon: -9.1393,  lat: 38.7223 },
  { name: 'Buenos Aires',     lon: -58.3816, lat: -34.6037 },
  { name: 'Lagos',            lon: 3.3792,   lat: 6.5244 },
  { name: 'Ho Chi Minh City', lon: 106.6297, lat: 10.8231 },
]

// Representative points for the very-high-adoption countries — origins for
// the rising-particle overlay.
const CRYPTO_PARTICLE_ORIGINS = [
  { lon: -89.2182, lat: 13.6929 }, // San Salvador
  { lon: 3.3792,   lat: 6.5244 },  // Lagos
  { lon: 106.6297, lat: 10.8231 }, // Ho Chi Minh City
  { lon: 120.9842, lat: 14.5995 }, // Manila
  { lon: 30.5234,  lat: 50.4501 }, // Kyiv
  { lon: 77.2090,  lat: 28.6139 }, // New Delhi
]
const PARTICLE_CYCLE = 4000 // ms for one full rise-and-reset
const PARTICLES_PER_ORIGIN = 4
const PARTICLE_RISE = 46 // px travelled upward over one cycle

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function minutesNow(tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(new Date())
  const get = (t) => parts.find(p => p.type === t)?.value
  const hour = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)
  const weekday = get('weekday')
  return { minutes: hour * 60 + minute, isWeekend: weekday === 'Sat' || weekday === 'Sun' }
}

function isExchangeOpen(ex) {
  const { minutes, isWeekend } = minutesNow(ex.tz)
  if (isWeekend) return false
  const openMin = ex.open[0] * 60 + ex.open[1]
  const closeMin = ex.close[0] * 60 + ex.close[1]
  return minutes >= openMin && minutes < closeMin
}

function heatColor(pct) {
  if (pct == null) return '#0B1628'
  if (pct > 1) return '#1a5c35'
  if (pct >= 0) return '#2D8A50'
  if (pct >= -0.3) return '#1A3A6A'
  if (pct >= -1) return '#6B2323'
  return '#A83232'
}

// True when [lon, lat] sits on the hemisphere currently facing the viewer.
// d3.geoPath already clips polygon/line geometry to the front hemisphere, but
// point features (exchange dots, crypto hub markers) are projected directly
// via `projection([lon, lat])`, which does NOT apply clipAngle — so point
// visibility has to be tested manually with this spherical dot-product check.
function isPointVisible(lon, lat, rotation) {
  const phi0 = -rotation[1] * RAD
  const lambda0 = -rotation[0] * RAD
  const phi = lat * RAD
  const lambda = lon * RAD
  // Small buffer (0.1 rather than 0) past the exact silhouette edge — right
  // at dot-product ≈ 0, tiny rotation/rounding changes flip a point in and
  // out of visibility every frame, which read as label flicker at the rim.
  return (Math.sin(phi) * Math.sin(phi0) + Math.cos(phi) * Math.cos(phi0) * Math.cos(lambda - lambda0)) > 0.1
}

// Samples a route (multi-waypoint great circle) into screen-space points for
// hover hit-testing — null entries mark points currently on the far
// hemisphere, so consecutive-pair checks below just skip those segments.
function sampleRouteScreenPoints(points, projection, rotation, n = 24) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const geo = pointAlongRoute(points, i / n)
    if (!isPointVisible(geo[0], geo[1], rotation)) { pts.push(null); continue }
    const p = projection(geo)
    pts.push(p ? [p[0], p[1]] : null)
  }
  return pts
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx, cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MaddexGlobe({ onCountryClick, onExchangeClick, earthquakes } = {}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const [size, setSize] = useState({ width: 800, height: 500 })
  const [topology, setTopology] = useState(null)
  const [baseLayer, setBaseLayer] = useState(() => {
    try {
      const saved = localStorage.getItem('maddex_globe_base')
      return BASE_LAYERS.includes(saved) ? saved : 'EARTH'
    } catch { return 'EARTH' }
  })
  const [overlays, setOverlays] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('maddex_globe_overlays') ?? 'null')
      if (saved && typeof saved === 'object') return { ...DEFAULT_OVERLAYS, ...saved }
    } catch { /* ignore */ }
    return DEFAULT_OVERLAYS
  })
  const [isPlaying, setIsPlaying] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [compassAngle, setCompassAngle] = useState(0)

  const [tooltip, setTooltip] = useState(null) // { x, y, text }
  const [pinnedCountry, setPinnedCountry] = useState(null)
  const [pinnedExchange, setPinnedExchange] = useState(null)
  const [pinnedRoute, setPinnedRoute] = useState(null)
  // Default collapsed — persisted as "is it open", inverted from the
  // component's own "is it collapsed" naming, per the storage key spec.
  const [legendCollapsed, setLegendCollapsed] = useState(() => {
    try { return localStorage.getItem('maddex_globe_legend_open') !== 'true' } catch { return true }
  })
  const [layerPanelCollapsed, setLayerPanelCollapsed] = useState(false)

  // Live index quotes — own queryKey (own symbol set) so it doesn't collide
  // with GlobalModule's separate ['yfBatch','indices'] query.
  const { data: quotes } = useQuery({
    queryKey: ['yfBatch', 'globeExchanges'],
    queryFn: () => fetchYFBatch(YF_SYMBOLS),
    staleTime: 60_000,
    retry: 1,
  })

  // ── Mutable, non-React-state animation values (kept out of React state so
  // the RAF loop can run at 60fps without triggering re-renders every frame) ──
  const rotationRef = useRef(DEFAULT_ROTATION.slice())
  const zoomKRef = useRef(1) // pure scale factor — globe centre never moves
  const draggingRef = useRef(false)
  const dragLastRef = useRef({ x: 0, y: 0 })
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const hoveredCountryRef = useRef(null)
  const hoveredExchangeRef = useRef(null)
  const hoveredRouteRef = useRef(null) // { id, kind: 'SHIPPING'|'FREIGHT' }
  const exchangeScreenPosRef = useRef({}) // id -> { x, y, r }
  const quakeScreenPosRef = useRef({}) // id -> { x, y, r }
  const hoveredQuakeRef = useRef(null)
  const earthquakesRef = useRef(earthquakes)
  useEffect(() => { earthquakesRef.current = earthquakes }, [earthquakes])
  const pinnedCountryRef = useRef(null)
  const pinnedExchangeRef = useRef(null)
  const pinnedRouteRef = useRef(null)
  const baseLayerRef = useRef(baseLayer)
  const overlaysRef = useRef(overlays)
  const quotesRef = useRef(quotes)
  const isPlayingRef = useRef(isPlaying)
  const searchMatchIdsRef = useRef(new Set())
  const searchMatchRouteIdsRef = useRef(new Set())
  // Static star field — generated once on mount and never re-randomized so
  // the background doesn't flicker frame to frame (Math.random must not run
  // during render, so this is seeded in an effect rather than inline).
  const starFieldRef = useRef([])
  useEffect(() => {
    starFieldRef.current = Array.from({ length: 280 }, () => ({
      rx: Math.random(),
      ry: Math.random(),
      r: 0.5 + Math.random(),
      o: 0.3 + Math.random() * 0.3,
    }))
  }, [])
  useEffect(() => { baseLayerRef.current = baseLayer }, [baseLayer])
  useEffect(() => { overlaysRef.current = overlays }, [overlays])
  useEffect(() => { quotesRef.current = quotes }, [quotes])
  useEffect(() => { pinnedCountryRef.current = pinnedCountry }, [pinnedCountry])
  useEffect(() => { pinnedExchangeRef.current = pinnedExchange }, [pinnedExchange])
  useEffect(() => { pinnedRouteRef.current = pinnedRoute }, [pinnedRoute])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Persist layer choices
  useEffect(() => {
    try { localStorage.setItem('maddex_globe_base', baseLayer) } catch { /* ignore */ }
  }, [baseLayer])
  useEffect(() => {
    try { localStorage.setItem('maddex_globe_overlays', JSON.stringify(overlays)) } catch { /* ignore */ }
  }, [overlays])

  // Compass rose angle = -(rotation[0] - DEFAULT_ROTATION[0]) — i.e. negative
  // lambda measured relative to the home/default orientation, so N points up
  // exactly when the globe sits at its default Australia-centred rotation,
  // and spins as the globe is dragged/rotated away from it. Polled at low
  // frequency — a compass needle doesn't need 60fps — rather than mirroring
  // rotation into React state every animation frame.
  useEffect(() => {
    const id = setInterval(() => {
      const delta = rotationRef.current[0] - DEFAULT_ROTATION[0]
      const a = ((-delta % 360) + 360) % 360
      setCompassAngle(prev => (Math.abs(prev - a) > 0.05 ? a : prev))
    }, 100)
    return () => clearInterval(id)
  }, [])

  // Load world atlas once
  useEffect(() => {
    let cancelled = false
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(t => { if (!cancelled) setTopology(t) })
      .catch(e => console.warn('[MaddexGlobe] atlas load failed:', e.message))
    return () => { cancelled = true }
  }, [])

  const countries = useMemo(() => topology
    ? topojson.feature(topology, topology.objects.countries).features
    : [], [topology])
  const graticule = useMemo(() => d3.geoGraticule().step([30, 30])(), [])
  // Precomputed once per topology load — geoCentroid is too costly to call
  // per-feature every RAF frame (used by the DAYNIGHT terminator layer).
  const countryCentroids = useMemo(() => {
    const map = {}
    for (const f of countries) map[f.id] = d3.geoCentroid(f)
    return map
  }, [countries])
  const maxPopulation = useMemo(() => Math.max(...Object.values(POPULATION_MILLIONS_BY_COUNTRY_ID)), [])

  // country id -> today's %change (from whichever exchange is in that country)
  const heatByCountry = useMemo(() => {
    const map = {}
    if (!quotes) return map
    for (const ex of EXCHANGES) {
      const q = quotes[ex.ySymbol]
      if (q?.dayChangePct != null && map[ex.countryId] == null) {
        map[ex.countryId] = q.dayChangePct
      }
    }
    return map
  }, [quotes])

  // Unified search index — countries, exchanges, and both route layers, so
  // one input can jump to any of them.
  const searchIndex = useMemo(() => {
    const items = countries.map(f => ({ type: 'country', id: f.id, label: f.properties?.name ?? '', feature: f }))
    for (const ex of EXCHANGES) items.push({ type: 'exchange', id: ex.id, label: `${ex.label} — ${ex.city}`, ex })
    for (const r of SHIPPING_ROUTES) items.push({ type: 'route', id: r.id, label: r.name, route: r, kind: 'SHIPPING' })
    for (const r of FREIGHT_ROUTES) items.push({ type: 'route', id: r.id, label: r.name, route: r, kind: 'FREIGHT' })
    return items
  }, [countries])

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return searchIndex.filter(item => item.label.toLowerCase().includes(q)).slice(0, 5)
  }, [searchQuery, searchIndex])

  // Live match highlighting on the globe as the user types — kept in a ref so
  // drawFrame (which runs outside React's render cycle) can read it every frame.
  useEffect(() => {
    searchMatchIdsRef.current = new Set(searchMatches.filter(m => m.type === 'country').map(m => m.id))
    searchMatchRouteIdsRef.current = new Set(searchMatches.filter(m => m.type === 'route').map(m => m.id))
  }, [searchMatches])

  // Debounced ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    let raf = null
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setSize({ width, height }))
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [])

  const { width, height } = size
  const radius = Math.max(10, Math.min(width, height) / 2 - 12) // small padding at min zoom

  // ── d3-zoom: wheel + touch only, so mousedown stays dedicated to rotation.
  // Only `transform.k` (the pure scale factor) is used — transform.x/y are
  // discarded so the globe always scales toward its own centre and never
  // drifts, regardless of where the cursor/pinch happens to be. ──
  useEffect(() => {
    if (!canvasRef.current) return
    const zoomBehavior = d3.zoom()
      .scaleExtent([1, 5])
      .filter((event) => event.type === 'wheel' || event.type.startsWith('touch'))
      .on('zoom', (event) => {
        zoomKRef.current = event.transform.k
      })
    d3.select(canvasRef.current).call(zoomBehavior)
  }, [])

  // ── Draw ─────────────────────────────────────────────────────────────────
  const drawFrame = useCallback((now) => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const base = baseLayerRef.current
    const ovl = overlaysRef.current
    const marketsOn    = ovl.MARKETS?.active ?? false
    const heatOn       = ovl.HEAT?.active ?? false
    const cryptoOn     = ovl.CRYPTO?.active ?? false
    const populationOn = ovl.POPULATION?.active ?? false
    const daynightOn   = ovl.DAYNIGHT?.active ?? false
    const seismicOn    = ovl.SEISMIC?.active ?? false
    const satelliteOn  = ovl.SATELLITE?.active ?? false
    const [subLon, subLat] = daynightOn ? subsolarPoint(new Date()) : [0, 0]
    const zoomK = zoomKRef.current
    const rotation = rotationRef.current
    const cx = width / 2
    const cy = height / 2
    const scaledRadius = radius * zoomK

    const projection = d3.geoOrthographic()
      .scale(scaledRadius)
      .translate([cx, cy])
      .clipAngle(90)
      .rotate(rotation)
    const path = d3.geoPath(projection, ctx)

    const isDark = base === 'DARK'
    const isEarth = base === 'EARTH'

    // Star field — static background dots outside the globe/atmosphere, drawn
    // first so everything else sits on top. Positions are generated once
    // (starFieldRef) and never re-randomized, so the field doesn't flicker.
    const atmR = scaledRadius + 20
    for (const s of starFieldRef.current) {
      const sx = s.rx * width
      const sy = s.ry * height
      const d = Math.hypot(sx - cx, sy - cy)
      if (d < atmR + 4) continue // don't draw stars over the globe/glow
      ctx.beginPath()
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${s.o})`
      ctx.fill()
    }

    // Atmosphere glow — radial gradient ring just outside the globe, blue at
    // the inner edge fading to fully transparent at the outer edge.
    const atmGrad = ctx.createRadialGradient(cx, cy, scaledRadius * 0.94, cx, cy, atmR)
    atmGrad.addColorStop(0, 'rgba(45,150,255,0.38)')
    atmGrad.addColorStop(1, 'rgba(26,127,232,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, atmR, 0, Math.PI * 2)
    ctx.fillStyle = atmGrad
    ctx.fill()

    // Ocean sphere with subtle radial gradient for depth
    const oceanGrad = ctx.createRadialGradient(cx, cy, scaledRadius * 0.1, cx, cy, scaledRadius)
    if (isDark) {
      oceanGrad.addColorStop(0, '#020508')
      oceanGrad.addColorStop(1, '#020508')
    } else {
      oceanGrad.addColorStop(0, '#1a3a6e')
      oceanGrad.addColorStop(1, '#0a1628')
    }
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = oceanGrad; ctx.fill()

    // Grid lines every 30° lat/long — geoPath clips to the visible hemisphere
    // automatically, same as country polygons.
    ctx.beginPath(); path(graticule)
    ctx.strokeStyle = 'rgba(30,70,140,0.12)'
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Countries — geoPath + clipAngle(90) clips polygon geometry to the
    // visible hemisphere automatically; back-side countries render nothing.
    // Base fill (EARTH continents / DARK near-black) first, then HEAT/CRYPTO
    // overlays blended on top at their own opacity where they have data —
    // this is what lets HEAT/CRYPTO stack with the EARTH or DARK base and
    // with each other, instead of being mutually-exclusive display modes.
    const hoveredId = hoveredCountryRef.current
    const pinnedId = pinnedCountryRef.current
    const searchIds = searchMatchIdsRef.current
    for (const feature of countries) {
      const numericId = parseInt(feature.id)

      ctx.beginPath(); path(feature)
      ctx.fillStyle = isEarth ? earthFillColor(numericId) : '#060D1A'
      ctx.fill()

      if (heatOn) {
        const hc = heatColor(heatByCountry[numericId])
        if (heatByCountry[numericId] != null) {
          ctx.globalAlpha = (ovl.HEAT.opacity ?? 70) / 100
          ctx.beginPath(); path(feature)
          ctx.fillStyle = hc
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
      if (cryptoOn) {
        const tier = CRYPTO_TIER_BY_COUNTRY_ID[numericId]
        if (tier) {
          ctx.globalAlpha = (ovl.CRYPTO.opacity ?? 70) / 100
          ctx.beginPath(); path(feature)
          ctx.fillStyle = CRYPTO_TIER_COLORS[tier]
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
      if (populationOn) {
        const popM = POPULATION_MILLIONS_BY_COUNTRY_ID[numericId]
        ctx.beginPath(); path(feature)
        ctx.fillStyle = popM != null ? d3.interpolateBlues(0.25 + 0.65 * (popM / maxPopulation)) : '#3a3a3a'
        ctx.fill()
      }
      // Day/night terminator — dims the night-side fill to ~40% brightness
      // via a translucent black overlay rather than parsing/multiplying the
      // underlying colour, which stays correct regardless of what other
      // overlays already tinted this country.
      if (daynightOn) {
        const centroid = countryCentroids[feature.id]
        if (centroid && !isDaylit(centroid[0], centroid[1], subLon, subLat)) {
          ctx.globalAlpha = 0.6
          ctx.beginPath(); path(feature)
          ctx.fillStyle = '#000000'
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }

      const isSel = feature.id === hoveredId || feature.id === pinnedId
      const isSearchMatch = searchIds.size > 0 && searchIds.has(feature.id)
      let borderColor
      if (isSel || isSearchMatch) borderColor = '#F0D060' // bright gold — selection/search
      else borderColor = 'rgba(255,255,255,0.2)'
      ctx.strokeStyle = borderColor
      ctx.lineWidth = (isSel || isSearchMatch) ? 1.6 : 0.5
      ctx.stroke()
    }

    // Sphere outline + rim light
    ctx.beginPath(); path({ type: 'Sphere' })
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()

    // TRADE IMPACT overlay — filled tension-zone polygons, drawn under the
    // shipping/freight route lines (per spec) so routes stay visible on top.
    if (ovl.TRADE_IMPACT?.active) {
      for (const zone of TRADE_IMPACT_ZONES) {
        const feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...zone.coords, zone.coords[0]]] } }
        ctx.beginPath(); path(feature)
        ctx.fillStyle = TRADE_TIER_FILL[zone.tier]
        ctx.fill()
        ctx.strokeStyle = TRADE_TIER_STROKE[zone.tier]
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // SHIPPING overlay — animated dashed great-circle lanes + moving dots +
    // chokepoint warning markers. d3.geoPath resamples LineString geometry
    // along the sphere automatically, so route.points just needs waypoints.
    if (ovl.SHIPPING?.active) {
      const shippingAlpha = (ovl.SHIPPING.opacity ?? 100) / 100
      const hoveredRoute = hoveredRouteRef.current
      const pinnedRouteVal = pinnedRouteRef.current
      for (const route of SHIPPING_ROUTES) {
        const feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: route.points } }
        const isHovered = hoveredRoute?.kind === 'SHIPPING' && hoveredRoute.id === route.id
        const isPinned = pinnedRouteVal?.kind === 'SHIPPING' && pinnedRouteVal.id === route.id
        const disrupted = route.status === 'DISRUPTED'

        ctx.beginPath()
        ctx.setLineDash([4, 4])
        ctx.lineDashOffset = -(now / 40) % 8
        path(feature)
        ctx.strokeStyle = (isHovered || isPinned)
          ? '#F0D060'
          : disrupted ? `rgba(200,60,60,${0.7 * shippingAlpha})` : `rgba(26,127,232,${0.4 * shippingAlpha})`
        ctx.lineWidth = (isHovered || isPinned) ? 2.2 : 1.5
        ctx.stroke()
        ctx.setLineDash([])

        // 2-3 gold dots cycling continuously along the route
        const cycle = 6000
        for (let i = 0; i < 3; i++) {
          const t = ((now + (i / 3) * cycle) % cycle) / cycle
          const pt = pointAlongRoute(route.points, t)
          if (!isPointVisible(pt[0], pt[1], rotation)) continue
          const p = projection(pt)
          if (!p) continue
          ctx.beginPath()
          ctx.arc(p[0], p[1], 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(201,168,76,${0.9 * shippingAlpha})`
          ctx.fill()
        }
      }

      for (const cp of CHOKEPOINT_WARNINGS) {
        if (!isPointVisible(cp.lon, cp.lat, rotation)) continue
        const p = projection([cp.lon, cp.lat])
        if (!p) continue
        ctx.font = '11px "IBM Plex Mono", monospace'
        ctx.fillStyle = '#ff6d00'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('⚠', p[0], p[1])
      }
    }

    // FREIGHT overlay — thin great-circle arcs + an animated plane glyph
    // rotated to follow the heading of travel.
    if (ovl.FREIGHT?.active) {
      const freightAlpha = (ovl.FREIGHT.opacity ?? 100) / 100
      for (const route of FREIGHT_ROUTES) {
        const feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: route.points } }
        const isHovered = hoveredRouteRef.current?.kind === 'FREIGHT' && hoveredRouteRef.current.id === route.id
        const isPinned = pinnedRouteRef.current?.kind === 'FREIGHT' && pinnedRouteRef.current.id === route.id

        ctx.beginPath(); path(feature)
        ctx.strokeStyle = (isHovered || isPinned) ? '#F0D060' : `rgba(201,168,76,${0.3 * freightAlpha})`
        ctx.lineWidth = (isHovered || isPinned) ? 2 : 1
        ctx.stroke()

        const cycle = 8000
        const t = (now % cycle) / cycle
        const pt = pointAlongRoute(route.points, t)
        if (!isPointVisible(pt[0], pt[1], rotation)) continue
        const p = projection(pt)
        if (!p) continue
        const pt2 = pointAlongRoute(route.points, Math.min(1, t + 0.01))
        const p2 = projection(pt2)
        const angle = p2 ? Math.atan2(p2[1] - p[1], p2[0] - p[0]) : 0
        ctx.save()
        ctx.translate(p[0], p[1])
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.moveTo(5, 0); ctx.lineTo(-4, -3); ctx.lineTo(-2, 0); ctx.lineTo(-4, 3)
        ctx.closePath()
        ctx.fillStyle = `rgba(201,168,76,${0.9 * freightAlpha})`
        ctx.fill()
        ctx.restore()
      }
    }

    // CRYPTO overlay extras — rising particles from high-adoption hubs + top
    // crypto cities, all hemisphere-clipped like the exchange markers below.
    if (cryptoOn) {
      const cryptoAlpha = (ovl.CRYPTO.opacity ?? 70) / 100
      for (const origin of CRYPTO_PARTICLE_ORIGINS) {
        if (!isPointVisible(origin.lon, origin.lat, rotation)) continue
        const p = projection([origin.lon, origin.lat])
        if (!p) continue
        const [ox, oy] = p
        for (let i = 0; i < PARTICLES_PER_ORIGIN; i++) {
          const phase = (i / PARTICLES_PER_ORIGIN) * PARTICLE_CYCLE
          const t = ((now + phase) % PARTICLE_CYCLE) / PARTICLE_CYCLE
          const py = oy - t * PARTICLE_RISE
          const px = ox + Math.sin(t * Math.PI * 2 + i) * 3
          ctx.beginPath()
          ctx.arc(px, py, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(201,168,76,${0.3 * cryptoAlpha})`
          ctx.fill()
        }
      }

      for (const city of CRYPTO_CITIES) {
        if (!isPointVisible(city.lon, city.lat, rotation)) continue
        const p = projection([city.lon, city.lat])
        if (!p) continue
        const [px, py] = p
        ctx.globalAlpha = cryptoAlpha
        ctx.beginPath()
        ctx.moveTo(px, py - 4)
        ctx.lineTo(px + 4, py)
        ctx.lineTo(px, py + 4)
        ctx.lineTo(px - 4, py)
        ctx.closePath()
        ctx.fillStyle = '#C9A84C'
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(6,13,26,0.6)'
        ctx.stroke()
        ctx.font = '9px "IBM Plex Mono", monospace'
        ctx.fillStyle = '#C9A84C'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(`₿ ${city.name}`, px + 7, py)
        ctx.globalAlpha = 1
      }
    }

    // Exchange markers — only drawn when the MARKETS overlay is active, so it
    // behaves like a real toggleable layer rather than "every mode but DARK".
    const nextScreenPos = {}
    if (marketsOn) {
      const marketsAlpha = (ovl.MARKETS.opacity ?? 100) / 100
      for (const ex of EXCHANGES) {
        if (!isPointVisible(ex.lon, ex.lat, rotation)) continue
        const p = projection([ex.lon, ex.lat])
        if (!p) continue
        const [px, py] = p
        nextScreenPos[ex.id] = { x: px, y: py, r: 8 }

        const open = isExchangeOpen(ex)
        const isHov = hoveredExchangeRef.current === ex.id || pinnedExchangeRef.current === ex.id

        ctx.globalAlpha = marketsAlpha

        // Pulse: three concentric rings expanding outward from the marker,
        // staggered ~0.3s apart, one full cycle every 2s, fading gold→clear.
        if (open) {
          for (let ring = 0; ring < 3; ring++) {
            const cycleMs = 2000
            const t = (((now + ex.lat * 137 - ring * 300) % cycleMs) + cycleMs) % cycleMs / cycleMs
            const ringR = 4 + t * 4 * 4 // expands to ~4x base radius
            const ringAlpha = (1 - t) * 0.65
            if (ringAlpha <= 0.01) continue
            ctx.beginPath()
            ctx.arc(px, py, ringR, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(201,168,76,${ringAlpha * marketsAlpha})`
            ctx.lineWidth = 1.4
            ctx.stroke()
          }
        }

        const r = isHov ? 5.2 : 4
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fillStyle = open ? '#C9A84C' : '#3D5070'
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(6,13,26,0.6)'
        ctx.stroke()

        // Labels past a zoom threshold — background pill so they stay
        // readable over any country/overlay colour underneath.
        if (zoomK > 1.8) {
          ctx.font = '8px "IBM Plex Mono", monospace'
          const textW = ctx.measureText(ex.label).width
          const padX = 5, padY = 2, gap = 7
          ctx.fillStyle = 'rgba(6,13,26,0.8)'
          ctx.strokeStyle = 'rgba(201,168,76,0.3)'
          ctx.lineWidth = 1
          const pillX = px + gap - padX
          const pillY = py - 8 / 2 - padY
          const pillW = textW + padX * 2
          const pillH = 8 + padY * 2
          ctx.beginPath()
          ctx.rect(pillX, pillY, pillW, pillH)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#C9A84C'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(ex.label, px + gap, py)
        }
        ctx.globalAlpha = 1
      }
    }
    exchangeScreenPosRef.current = nextScreenPos

    // Seismic markers — USGS significant earthquakes (M4.0+, last 7 days),
    // red circles sized by magnitude, only on the visible hemisphere.
    const nextQuakePos = {}
    if (seismicOn && earthquakesRef.current?.length) {
      for (const q of earthquakesRef.current) {
        if (!isPointVisible(q.lon, q.lat, rotation)) continue
        const p = projection([q.lon, q.lat])
        if (!p) continue
        const [px, py] = p
        const r = 2 + Math.max(0, q.mag) * 1.3
        nextQuakePos[q.id] = { x: px, y: py, r: r + 2 }
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(220,40,40,0.45)'
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(255,90,90,0.9)'
        ctx.stroke()
      }
    }
    quakeScreenPosRef.current = nextQuakePos

    // Satellite orbit — purely decorative animated ring. Drawn as a screen-
    // space ellipse around the globe (vertical squash fakes a ~45° orbital
    // inclination) with a dot advancing along it based on the RAF timestamp.
    if (satelliteOn) {
      const orbitR = scaledRadius * 1.18
      const inclination = 0.7 // vertical squash factor ≈ cos(45°)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1, inclination)
      ctx.beginPath()
      ctx.setLineDash([3, 5])
      ctx.arc(0, 0, orbitR, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(201,168,76,0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
      const orbitAngle = (now / 4000) % (Math.PI * 2)
      const sx = Math.cos(orbitAngle) * orbitR
      const sy = Math.sin(orbitAngle) * orbitR
      ctx.beginPath()
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#F0D060'
      ctx.shadowColor = 'rgba(240,208,96,0.8)'
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // Vignette — subtle depth cue around the globe's edge, screen-space,
    // independent of zoom/rotation, drawn last so it sits above everything.
    const vignette = ctx.createRadialGradient(cx, cy, scaledRadius * 0.75, cx, cy, scaledRadius * 1.15)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.1)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, width, height)
  }, [width, height, radius, countries, graticule, heatByCountry, countryCentroids, maxPopulation])

  // ── RAF loop: rotation + redraw ──────────────────────────────────────────
  useEffect(() => {
    function frame(now) {
      if (isPlayingRef.current && !draggingRef.current) {
        rotationRef.current = [
          rotationRef.current[0] + AUTO_ROTATE_SPEED,
          rotationRef.current[1],
          0,
        ]
      }

      // Hit-testing against the latest mouse position, once per frame
      hitTest()

      drawFrame(now)

      rafRef.current = requestAnimationFrame(frame)
    }

    function hitTest() {
      const ovl = overlaysRef.current
      const { x: mx, y: my } = mouseRef.current
      const projection = d3.geoOrthographic()
        .scale(radius * zoomKRef.current).translate([width / 2, height / 2]).clipAngle(90).rotate(rotationRef.current)

      // Exchange markers take priority (only hit-testable when MARKETS is on
      // — exchangeScreenPosRef is only populated while that overlay draws)
      let exId = null
      if (ovl.MARKETS?.active) {
        for (const [id, pos] of Object.entries(exchangeScreenPosRef.current)) {
          const dx = mx - pos.x, dy = my - pos.y
          if (dx * dx + dy * dy <= pos.r * pos.r) { exId = id; break }
        }
      }
      hoveredExchangeRef.current = exId

      // Seismic markers — checked next, only when SEISMIC is on and the
      // mouse isn't already over an exchange marker.
      let quakeId = null
      if (!exId && ovl.SEISMIC?.active) {
        for (const [id, pos] of Object.entries(quakeScreenPosRef.current)) {
          const dx = mx - pos.x, dy = my - pos.y
          if (dx * dx + dy * dy <= pos.r * pos.r) { quakeId = id; break }
        }
      }
      hoveredQuakeRef.current = quakeId

      // Route hover — only checked when a route overlay is on, and only when
      // the mouse isn't already over an exchange marker.
      let routeHit = null
      if (!exId && !quakeId) {
        const threshold = 6
        if (ovl.SHIPPING?.active) {
          for (const route of SHIPPING_ROUTES) {
            const pts = sampleRouteScreenPoints(route.points, projection, rotationRef.current)
            for (let i = 0; i < pts.length - 1; i++) {
              const a = pts[i], b = pts[i + 1]
              if (!a || !b) continue
              if (distToSegment(mx, my, a[0], a[1], b[0], b[1]) <= threshold) {
                routeHit = { id: route.id, kind: 'SHIPPING', route }
                break
              }
            }
            if (routeHit) break
          }
        }
        if (!routeHit && ovl.FREIGHT?.active) {
          for (const route of FREIGHT_ROUTES) {
            const pts = sampleRouteScreenPoints(route.points, projection, rotationRef.current)
            for (let i = 0; i < pts.length - 1; i++) {
              const a = pts[i], b = pts[i + 1]
              if (!a || !b) continue
              if (distToSegment(mx, my, a[0], a[1], b[0], b[1]) <= threshold) {
                routeHit = { id: route.id, kind: 'FREIGHT', route }
                break
              }
            }
            if (routeHit) break
          }
        }
      }
      hoveredRouteRef.current = routeHit ? { id: routeHit.id, kind: routeHit.kind } : null

      // Same hemisphere-visibility check used for rendering point markers —
      // without it, `projection.invert()` near the sphere's silhouette edge
      // can resolve to a back-hemisphere lon/lat that still happens to fall
      // inside a (non-rendered) country polygon, bleeding its tooltip through.
      let countryId = null
      if (!exId && !quakeId && !routeHit) {
        const lonLat = projection.invert([mx, my])
        if (lonLat && Math.abs(lonLat[0]) <= 180 && isPointVisible(lonLat[0], lonLat[1], rotationRef.current)) {
          for (const feature of countries) {
            if (d3.geoContains(feature, lonLat)) { countryId = feature.id; break }
          }
        }
      }
      hoveredCountryRef.current = countryId

      // Tooltip content (only updates React state — cheap, not every RAF tick
      // needs a redraw, React will batch/skip identical updates)
      if (exId) {
        const ex = EXCHANGES.find(e => e.id === exId)
        const q = quotesRef.current?.[ex.ySymbol]
        const chg = q?.dayChangePct
        const text = `${ex.label} · ${ex.city}${q?.price != null ? ` · ${q.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}${chg != null ? ` (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%)` : ''} · ${isExchangeOpen(ex) ? 'OPEN' : 'CLOSED'}`
        setTooltip({ x: mx, y: my, text })
      } else if (quakeId) {
        const q = earthquakesRef.current?.find(e => String(e.id) === quakeId)
        if (q) {
          setTooltip({ x: mx, y: my, text: `M${q.mag.toFixed(1)} · ${q.depthKm.toFixed(0)}km depth · ${q.place}` })
        }
      } else if (routeHit) {
        const detail = routeHit.kind === 'SHIPPING' ? routeHit.route.teu : routeHit.route.tonnage
        const status = routeHit.route.status ?? 'ACTIVE'
        setTooltip({ x: mx, y: my, text: `${routeHit.route.name} · ${detail} · ${status}` })
      } else if (countryId) {
        const n = parseInt(countryId)
        let text = `Country #${n}`
        const feature = countries.find(f => f.id === countryId)
        if (feature?.properties?.name) text = feature.properties.name
        if (ovl.HEAT?.active && heatByCountry[n] != null) {
          text += ` · ${heatByCountry[n] >= 0 ? '+' : ''}${heatByCountry[n].toFixed(2)}%`
        }
        if (ovl.CRYPTO?.active) {
          const tier = CRYPTO_TIER_BY_COUNTRY_ID[n]
          const info = tier ? CRYPTO_TIER_INFO[tier] : null
          text += info ? ` · ${info.label} · ${info.legal}` : ' · No data'
        }
        setTooltip({ x: mx, y: my, text })
      } else if (pinnedRouteRef.current) {
        // Keeps a search-selected route's info panel showing (repositioned
        // live as the globe rotates) until the user pins something else.
        const pr = pinnedRouteRef.current
        const routeList = pr.kind === 'SHIPPING' ? SHIPPING_ROUTES : FREIGHT_ROUTES
        const route = routeList.find(r => r.id === pr.id)
        const mid = route ? pointAlongRoute(route.points, 0.5) : null
        const p = mid && isPointVisible(mid[0], mid[1], rotationRef.current) ? projection(mid) : null
        if (route && p) {
          const detail = pr.kind === 'SHIPPING' ? route.teu : route.tonnage
          setTooltip({ x: p[0], y: p[1], text: `${route.name} · ${detail} · ${route.status ?? 'ACTIVE'}` })
        } else {
          setTooltip(null)
        }
      } else {
        setTooltip(null)
      }
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [drawFrame, width, height, radius, countries, heatByCountry])

  // ── Pointer handlers (rotation drag) ────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    draggingRef.current = true
    dragLastRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  function getLocalPos(e, container) {
    if (!container) return { x: -9999, y: -9999 }
    const rect = container.getBoundingClientRect()
    const point = e.touches?.[0] ?? e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  useEffect(() => {
    function onMove(e) {
      mouseRef.current = getLocalPos(e, containerRef.current)
      if (!draggingRef.current) return
      const { x, y } = dragLastRef.current
      const dLambda = (e.clientX - x) * 0.3
      const dPhi = -(e.clientY - y) * 0.3
      rotationRef.current = [
        rotationRef.current[0] + dLambda,
        Math.max(-85, Math.min(85, rotationRef.current[1] + dPhi)),
        0,
      ]
      dragLastRef.current = { x: e.clientX, y: e.clientY }
    }
    function onUp() {
      draggingRef.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  const handleClick = useCallback(() => {
    if (hoveredExchangeRef.current) {
      setPinnedExchange(hoveredExchangeRef.current)
      setPinnedCountry(null)
      setPinnedRoute(null)
      onExchangeClick?.(hoveredExchangeRef.current)
    } else if (hoveredCountryRef.current) {
      const numericId = parseInt(hoveredCountryRef.current, 10)
      setPinnedCountry(hoveredCountryRef.current)
      setPinnedExchange(null)
      setPinnedRoute(null)
      onCountryClick?.(numericId)
    } else {
      setPinnedCountry(null)
      setPinnedExchange(null)
      setPinnedRoute(null)
    }
  }, [onCountryClick, onExchangeClick])

  function selectBase(layer) {
    setBaseLayer(layer)
  }

  function toggleOverlay(key) {
    setOverlays(prev => ({
      ...prev,
      [key]: { ...prev[key], active: !prev[key].active },
    }))
  }

  function setOverlayOpacity(key, value) {
    setOverlays(prev => ({
      ...prev,
      [key]: { ...prev[key], opacity: value },
    }))
  }

  function togglePlaying() {
    setIsPlaying(p => !p)
  }

  // Animates rotationRef toward `target` over `duration`ms. Auto-rotate is
  // transiently suspended (via the ref only, not the React state) so the two
  // don't fight over rotationRef during the tween.
  function tweenRotation(target, duration = 800) {
    const start = rotationRef.current.slice()
    const interpolate = d3.interpolate(start, target)
    const startTime = performance.now()
    const wasPlaying = isPlayingRef.current
    isPlayingRef.current = false

    function tick(now) {
      const t = Math.min((now - startTime) / duration, 1)
      rotationRef.current = interpolate(d3.easeCubicInOut(t))
      if (t < 1) requestAnimationFrame(tick)
      else isPlayingRef.current = wasPlaying
    }
    requestAnimationFrame(tick)
  }

  function resetView() {
    tweenRotation(DEFAULT_ROTATION)
  }

  // "AU FOCUS" — DEFAULT_ROTATION is already Australia-centred (see its
  // definition above), so this reuses the exact same smooth tween resetView
  // does, plus pins Australia (id 36) so its border highlights gold, same
  // treatment a search-selected country gets.
  function focusAustralia() {
    setPinnedCountry(36)
    setPinnedExchange(null)
    setPinnedRoute(null)
    tweenRotation(DEFAULT_ROTATION, 1500)
  }

  // Compass cardinal-point clicks — snap the globe to face that direction.
  function handleCompassSnap(dir) {
    const [lambda, phi] = rotationRef.current
    if (dir === 'N') tweenRotation([lambda, 0, 0])
    else if (dir === 'S') tweenRotation([lambda, 180, 0])
    else if (dir === 'E') tweenRotation([lambda - 90, phi, 0])
    else if (dir === 'W') tweenRotation([lambda + 90, phi, 0])
  }

  function rotateToCountry(feature) {
    const [lon, lat] = d3.geoCentroid(feature)
    tweenRotation([-lon, -lat, 0])
  }

  function selectSearchResult(item) {
    if (item.type === 'country') {
      setPinnedCountry(item.id)
      setPinnedExchange(null)
      setPinnedRoute(null)
      rotateToCountry(item.feature)
    } else if (item.type === 'exchange') {
      setPinnedExchange(item.id)
      setPinnedCountry(null)
      setPinnedRoute(null)
      tweenRotation([-item.ex.lon, -item.ex.lat, 0])
      onExchangeClick?.(item.id)
    } else if (item.type === 'route') {
      setPinnedRoute({ id: item.id, kind: item.kind })
      setPinnedCountry(null)
      setPinnedExchange(null)
      const midPoint = pointAlongRoute(item.route.points, 0.5)
      tweenRotation([-midPoint[0], -midPoint[1], 0])
      // The RAF hitTest loop shows/repositions the pinned-route tooltip every
      // frame once pinnedRouteRef updates (see hitTest), so no manual
      // one-shot tooltip placement is needed here.
    }
    setSearchQuery('')
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      if (searchMatches.length > 0) selectSearchResult(searchMatches[0])
    } else if (e.key === 'Escape') {
      setSearchQuery('')
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-terminal-bg"
      style={{ overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        className="cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onClick={handleClick}
        onMouseLeave={() => { mouseRef.current = { x: -9999, y: -9999 } }}
      />

      {!topology && (
        <div className="absolute inset-0 flex items-center justify-center text-2xs text-terminal-text-dim animate-pulse pointer-events-none">
          LOADING WORLD ATLAS...
        </div>
      )}

      {/* Layer panel — bottom-left. Base radio select, then two collapsible
          sections: DATA OVERLAYS (opacity sliders) and ROUTE OVERLAYS
          (on/off only, per spec). Panel itself can collapse to a small tab. */}
      {layerPanelCollapsed ? (
        <button
          type="button"
          onClick={() => setLayerPanelCollapsed(false)}
          className="absolute bottom-3 left-3 z-10 bg-terminal-panel/90 border border-terminal-border px-2 py-1 font-mono text-[8px] tracking-widest text-terminal-gold hover:border-terminal-gold pointer-events-auto"
        >
          LAYERS ▸
        </button>
      ) : (
        <div
          className="absolute bottom-3 left-3 z-10 border border-terminal-border-gold px-2.5 py-2 backdrop-blur-md w-40 max-h-[70vh] overflow-y-auto pointer-events-auto"
          style={{ background: 'rgba(6,13,26,0.8)' }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[8px] tracking-widest text-terminal-gold">LAYERS</span>
            <button
              type="button"
              onClick={() => setLayerPanelCollapsed(true)}
              className="text-terminal-text-dim hover:text-terminal-gold leading-none px-1"
              title="Collapse"
            >−</button>
          </div>

          <div className="text-[8px] font-mono text-terminal-gold tracking-widest mb-1">BASE LAYERS</div>
          <div className="flex gap-1 mb-2.5">
            {BASE_LAYERS.map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => selectBase(layer)}
                className={`flex-1 font-mono text-[8px] tracking-widest px-1.5 py-1 transition-colors ${
                  baseLayer === layer
                    ? 'bg-terminal-gold text-terminal-bg'
                    : 'bg-terminal-bg border border-terminal-border text-terminal-text-dim hover:border-terminal-gold'
                }`}
              >
                {layer}
              </button>
            ))}
          </div>

          <div className="text-[8px] font-mono text-terminal-gold tracking-widest mb-1">DATA OVERLAYS</div>
          <div className="flex flex-col gap-1.5 mb-2.5">
            {DATA_OVERLAY_KEYS.map((key) => {
              const ovl = overlays[key]
              return (
                <div key={key}>
                  <label className="flex items-center gap-1.5 font-mono text-[8px] tracking-widest text-terminal-text-dim cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ovl.active}
                      onChange={() => toggleOverlay(key)}
                      className="accent-terminal-gold"
                    />
                    <span className={ovl.active ? 'text-terminal-gold' : ''}>{OVERLAY_LABELS[key]}</span>
                  </label>
                  {ovl.active && (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={ovl.opacity}
                      onChange={(e) => setOverlayOpacity(key, Number(e.target.value))}
                      className="w-full h-1 mt-0.5 accent-terminal-gold"
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="text-[8px] font-mono text-terminal-gold tracking-widest mb-1">ROUTE OVERLAYS</div>
          <div className="flex flex-col gap-1.5 mb-2.5">
            {ROUTE_OVERLAY_KEYS.map((key) => {
              const ovl = overlays[key]
              return (
                <label key={key} className="flex items-center gap-1.5 font-mono text-[8px] tracking-widest text-terminal-text-dim cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ovl.active}
                    onChange={() => toggleOverlay(key)}
                    className="accent-terminal-gold"
                  />
                  <span className={ovl.active ? 'text-terminal-gold' : ''}>{OVERLAY_LABELS[key]}</span>
                </label>
              )
            })}
          </div>

          <div className="text-[8px] font-mono text-terminal-gold tracking-widest mb-1">VISUAL OVERLAYS</div>
          <div className="flex flex-col gap-1.5">
            {VISUAL_OVERLAY_KEYS.map((key) => {
              const ovl = overlays[key]
              return (
                <label key={key} className="flex items-center gap-1.5 font-mono text-[8px] tracking-widest text-terminal-text-dim cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ovl.active}
                    onChange={() => toggleOverlay(key)}
                    className="accent-terminal-gold"
                  />
                  <span className={ovl.active ? 'text-terminal-gold' : ''}>{OVERLAY_LABELS[key]}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Floating pill layer toggles — top-centre. Quick multi-select access to
          the layers most people reach for; the LAYERS panel (bottom-left)
          still covers opacity sliders and the rarer route overlays. EARTH is
          the base layer (click re-selects it; DARK stays panel-only), the
          rest are independently stackable overlays. */}
      <div className="absolute top-14 md:top-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 pointer-events-auto flex-wrap justify-center max-w-[90%]">
        {[
          { key: 'EARTH', active: baseLayer === 'EARTH', onClick: () => selectBase('EARTH') },
          { key: 'MARKETS', active: overlays.MARKETS.active, onClick: () => toggleOverlay('MARKETS') },
          { key: 'HEAT', active: overlays.HEAT.active, onClick: () => toggleOverlay('HEAT') },
          { key: 'CRYPTO', active: overlays.CRYPTO.active, onClick: () => toggleOverlay('CRYPTO') },
          { key: 'SHIPPING', active: overlays.SHIPPING.active, onClick: () => toggleOverlay('SHIPPING') },
        ].map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={pill.onClick}
            className={`font-mono text-[9px] tracking-widest px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors ${
              pill.active
                ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold'
                : 'text-terminal-text-dim border-terminal-border-gold hover:text-terminal-gold hover:border-terminal-gold'
            }`}
            style={{ background: pill.active ? undefined : 'rgba(6,13,26,0.7)' }}
          >
            {pill.key}
          </button>
        ))}
        <button
          type="button"
          onClick={focusAustralia}
          title="Rotate to Australia and highlight it"
          className={`font-mono text-[9px] tracking-widest px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors ${
            pinnedCountry === 36
              ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold'
              : 'text-terminal-text-dim border-terminal-border-gold hover:text-terminal-gold hover:border-terminal-gold'
          }`}
          style={{ background: pinnedCountry === 36 ? undefined : 'rgba(6,13,26,0.7)' }}
        >
          🇦🇺 AU FOCUS
        </button>
      </div>

      {/* Search — top-left. Matches countries, exchanges, and both route
          layers; selecting a country/exchange rotates to it, a route
          highlights gold and shows its tooltip. */}
      <div className="absolute top-3 left-3 z-10 w-40">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search country..."
          className="w-full font-mono text-[10px] px-2 py-1 bg-terminal-panel border border-terminal-border text-terminal-text-bright placeholder:text-terminal-text-dim focus:outline-none focus:border-terminal-gold"
        />
        {searchMatches.length > 0 && (
          <div className="mt-1 bg-terminal-panel border border-terminal-border max-h-40 overflow-y-auto">
            {searchMatches.map((item) => (
              <button
                key={`${item.type}:${item.id}`}
                type="button"
                onClick={() => selectSearchResult(item)}
                className="block w-full text-left px-2 py-1 font-mono text-[10px] text-terminal-text-dim hover:bg-terminal-accent/30 hover:text-terminal-gold"
              >
                <span className="text-terminal-text-dim/60 mr-1">
                  {item.type === 'country' ? '🌍' : item.type === 'exchange' ? '🏛' : item.kind === 'SHIPPING' ? '🚢' : '✈'}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Single DOM tooltip, repositioned on hover */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-terminal-panel border border-terminal-gold/50 px-2 py-1.5 text-2xs text-terminal-text-bright font-mono shadow-lg"
          style={{ left: Math.min(tooltip.x + 12, width - 180), top: Math.max(tooltip.y - 30, 4) }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Bottom-right stack: pause/reset controls always at the true
          bottom, the compass rose above them, the legend above that —
          column-reverse keeps all three from overlapping regardless of how
          many legend entries are showing. z-20 keeps the whole stack above
          every other globe element, including route/overlay graphics. */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col-reverse items-end gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={togglePlaying}
            title={isPlaying ? 'Pause rotation' : 'Resume rotation'}
            className="w-6 h-6 flex items-center justify-center bg-terminal-panel/85 border border-terminal-border/70 text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold backdrop-blur-sm transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              {isPlaying ? (
                <>
                  <rect x="2" y="1" width="2.2" height="8" fill="currentColor" />
                  <rect x="5.8" y="1" width="2.2" height="8" fill="currentColor" />
                </>
              ) : (
                <polygon points="2,1 9,5 2,9" fill="currentColor" />
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset view"
            className="w-6 h-6 flex items-center justify-center bg-terminal-panel/85 border border-terminal-border/70 text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold backdrop-blur-sm transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="5" y1="0" x2="5" y2="1.8" stroke="currentColor" strokeWidth="1" />
              <line x1="5" y1="8.2" x2="5" y2="10" stroke="currentColor" strokeWidth="1" />
              <line x1="0" y1="5" x2="1.8" y2="5" stroke="currentColor" strokeWidth="1" />
              <line x1="8.2" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>

        <CompassRose angle={compassAngle} onSnap={handleCompassSnap} />

        <GlobeLegend
          overlays={overlays}
          collapsed={legendCollapsed}
          onToggleCollapse={() => setLegendCollapsed(c => {
            const next = !c
            try { localStorage.setItem('maddex_globe_legend_open', String(!next)) } catch { /* ignore */ }
            return next
          })}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified legend — one panel covering whichever overlays are currently
// active, instead of separate per-layer panels that could occupy the same
// screen position and hide each other (the original bug: HEAT and CRYPTO
// legends both anchored to the same spot, so having both on hid one).
// ─────────────────────────────────────────────────────────────────────────────

const LEGEND_SWATCHES = {
  MARKETS: [
    ['🟢', 'Open exchange'],
    ['⚫', 'Closed exchange'],
  ],
  HEAT: [
    ['#A83232', '< -1%'], ['#6B2323', '-1 to -0.3%'], ['#1A3A6A', 'Flat'], ['#2D8A50', '0 to 1%'], ['#1a5c35', '> 1%'],
  ],
  CRYPTO: [
    ['#2D8A50', 'Very High'], ['#1a5c35', 'High'], ['#1A3A6A', 'Medium'], ['#6B2323', 'Low'], ['#A83232', 'Banned'],
  ],
  SHIPPING: [
    ['🔵', 'Active route'], ['🔴', 'Disrupted'], ['⚠', 'Tension zone'],
  ],
  FREIGHT: [
    ['🟡', 'Air cargo route'],
  ],
  TRADE_IMPACT: [
    ['🔴', 'High tension'], ['🟠', 'Elevated'], ['🔵', 'Monitoring'],
  ],
}
const LEGEND_TITLES = {
  MARKETS: 'MARKETS', HEAT: "TODAY'S INDEX %", CRYPTO: 'CRYPTO ADOPTION',
  SHIPPING: 'SHIPPING', FREIGHT: 'AIR FREIGHT', TRADE_IMPACT: 'TRADE IMPACT',
}

function GlobeLegend({ overlays, collapsed, onToggleCollapse }) {
  const active = ALL_OVERLAY_KEYS.filter(k => overlays[k]?.active)
  if (active.length === 0) return null

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className="font-mono text-[8px] tracking-widest text-terminal-gold bg-[rgba(6,13,26,0.92)] border border-terminal-border rounded-sm px-2 py-1 hover:border-terminal-gold"
      >
        LEGEND ▸
      </button>
    )
  }

  return (
    <div className="bg-[rgba(6,13,26,0.92)] border border-terminal-border rounded-sm p-3 min-w-[160px] font-mono">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[8px] tracking-widest text-terminal-gold">LEGEND</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-terminal-text-dim hover:text-terminal-gold leading-none px-1"
          title="Collapse"
        >−</button>
      </div>
      <div className="flex flex-col gap-2">
        {active.map((key) => (
          <div key={key}>
            <div className="text-[7px] text-terminal-text-dim tracking-widest mb-1">{LEGEND_TITLES[key]}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {LEGEND_SWATCHES[key].map(([swatch, label]) => (
                <div key={label} className="flex items-center gap-1">
                  {swatch.startsWith('#')
                    ? <span style={{ width: 8, height: 8, background: swatch, display: 'inline-block', flexShrink: 0 }} />
                    : <span className="text-[9px] leading-none">{swatch}</span>
                  }
                  <span className="text-[7px] text-terminal-text-dim whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Compass rose — 56x56, N (gold, larger) + S/E/W (muted). Rotates via CSS
// transform as `angle = -rotation[0]` changes, so dragging the globe visibly
// spins the needle. Each cardinal point is independently clickable (snaps the
// globe to face that direction using the same 800ms tween as the reset
// button) and highlights on hover.
// ─────────────────────────────────────────────────────────────────────────────

const COMPASS_DIRS = [
  { id: 'N', x: 0, y: -18, big: true },
  { id: 'S', x: 0, y: 18, big: false },
  { id: 'E', x: 18, y: 0, big: false },
  { id: 'W', x: -18, y: 0, big: false },
]

function CompassRose({ angle, onSnap }) {
  const [hoverDir, setHoverDir] = useState(null)

  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{ width: 56, height: 56, background: 'rgba(6,13,26,0.85)', border: '1px solid rgba(201,168,76,0.2)', zIndex: 10 }}
    >
      <svg
        width="48" height="48" viewBox="-24 -24 48 48"
        style={{ transform: `rotate(${angle}deg)`, transition: 'transform 100ms linear' }}
      >
        <line x1="0" y1="-21" x2="0" y2="21" stroke="#637899" strokeWidth="0.5" opacity="0.5" />
        <line x1="-21" y1="0" x2="21" y2="0" stroke="#637899" strokeWidth="0.5" opacity="0.5" />

        {COMPASS_DIRS.map((d) => {
          const color = d.big ? '#C9A84C' : '#637899'
          const angleRad = Math.atan2(d.y, d.x)
          const tipX = d.x + Math.cos(angleRad) * (d.big ? 5 : 3.5)
          const tipY = d.y + Math.sin(angleRad) * (d.big ? 5 : 3.5)
          const baseX = d.x - Math.cos(angleRad) * (d.big ? 4 : 3)
          const baseY = d.y - Math.sin(angleRad) * (d.big ? 4 : 3)
          const perpX = -Math.sin(angleRad) * (d.big ? 2.6 : 1.8)
          const perpY = Math.cos(angleRad) * (d.big ? 2.6 : 1.8)
          const labelX = d.x + Math.cos(angleRad) * (d.big ? 9 : 7)
          const labelY = d.y + Math.sin(angleRad) * (d.big ? 9 : 7)

          return (
            <g
              key={d.id}
              onClick={() => onSnap(d.id)}
              onMouseEnter={() => setHoverDir(d.id)}
              onMouseLeave={() => setHoverDir(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={d.x} cy={d.y} r={d.big ? 8 : 6.5}
                fill="#000"
                fillOpacity={hoverDir === d.id ? 0.18 : 0}
                style={{ transition: 'fill-opacity 100ms' }}
              />
              <polygon
                points={`${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`}
                fill={color}
              />
              <text
                x={labelX} y={labelY}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={d.big ? 9 : 7}
                fontWeight={d.big ? 700 : 400}
                fontFamily="IBM Plex Mono, monospace"
                fill={color}
              >
                {d.id}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
