import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { fetchYFBatch } from '../../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

// 12 major exchanges — countryId is the ISO-3166-1 numeric code used by the
// world-atlas topojson so exchange data can drive per-country HEAT colouring.
const EXCHANGES = [
  { id: 'NYSE',   label: 'NYSE',      city: 'New York',  lat: 40.7128,  lon: -74.0060, tz: 'America/New_York',  open: [9, 30],  close: [16, 0],  countryId: 840, ySymbol: '^GSPC',   marketCapB: 28000 },
  { id: 'NASDAQ', label: 'NASDAQ',    city: 'New York',  lat: 40.7306,  lon: -73.9866, tz: 'America/New_York',  open: [9, 30],  close: [16, 0],  countryId: 840, ySymbol: '^IXIC',   marketCapB: 24000 },
  { id: 'LSE',    label: 'LSE',       city: 'London',    lat: 51.5074,  lon: -0.1278,  tz: 'Europe/London',     open: [8, 0],   close: [16, 30], countryId: 826, ySymbol: '^FTSE',   marketCapB: 3600 },
  { id: 'TSE',    label: 'TSE',       city: 'Tokyo',     lat: 35.6762,  lon: 139.6503, tz: 'Asia/Tokyo',        open: [9, 0],   close: [15, 30], countryId: 392, ySymbol: '^N225',   marketCapB: 6200 },
  { id: 'ASX',    label: 'ASX',       city: 'Sydney',    lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney',  open: [10, 0],  close: [16, 0],  countryId: 36,  ySymbol: '^AXJO',   marketCapB: 1900 },
  { id: 'HSI',    label: 'HSI',       city: 'Hong Kong', lat: 22.3193,  lon: 114.1694, tz: 'Asia/Hong_Kong',    open: [9, 30],  close: [16, 0],  countryId: 344, ySymbol: '^HSI',    marketCapB: 5500 },
  { id: 'SSE',    label: 'SSE',       city: 'Shanghai',  lat: 31.2304,  lon: 121.4737, tz: 'Asia/Shanghai',     open: [9, 30],  close: [15, 0],  countryId: 156, ySymbol: '000001.SS', marketCapB: 7000 },
  { id: 'SGX',    label: 'SGX',       city: 'Singapore', lat: 1.3521,   lon: 103.8198, tz: 'Asia/Singapore',    open: [9, 0],   close: [17, 0],  countryId: 702, ySymbol: '^STI',    marketCapB: 650 },
  { id: 'ENX',    label: 'EURONEXT',  city: 'Paris',     lat: 48.8566,  lon: 2.3522,   tz: 'Europe/Paris',      open: [9, 0],   close: [17, 30], countryId: 250, ySymbol: '^FCHI',   marketCapB: 4400 },
  { id: 'TSX',    label: 'TSX',       city: 'Toronto',   lat: 43.6532,  lon: -79.3832, tz: 'America/Toronto',   open: [9, 30],  close: [16, 0],  countryId: 124, ySymbol: '^GSPTSE', marketCapB: 3700 },
  { id: 'BSE',    label: 'BSE',       city: 'Mumbai',    lat: 18.9388,  lon: 72.8354,  tz: 'Asia/Kolkata',      open: [9, 15],  close: [15, 30], countryId: 356, ySymbol: '^BSESN',  marketCapB: 4300 },
  { id: 'KRX',    label: 'KRX',       city: 'Seoul',     lat: 37.5665,  lon: 126.9780, tz: 'Asia/Seoul',        open: [9, 0],   close: [15, 30], countryId: 410, ySymbol: '^KS11',   marketCapB: 1900 },
]

const YF_SYMBOLS = [...new Set(EXCHANGES.map(e => e.ySymbol))]

const DISPLAY_MODES = ['EARTH', 'MARKETS', 'HEAT', 'CRYPTO', 'DARK']

// Default starting orientation — Australia centred (lon 134°E, lat 25°S),
// matches the terminal's home market. Auto-rotate speed is degrees/frame.
const DEFAULT_ROTATION = [-134, 25, 0]
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

function cryptoFillColor(numericId) {
  const tier = CRYPTO_TIER_BY_COUNTRY_ID[numericId]
  return tier ? CRYPTO_TIER_COLORS[tier] : '#0B1628'
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
  return (Math.sin(phi) * Math.sin(phi0) + Math.cos(phi) * Math.cos(phi0) * Math.cos(lambda - lambda0)) > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MaddexGlobe({ onCountryClick, onExchangeClick } = {}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const [size, setSize] = useState({ width: 800, height: 500 })
  const [topology, setTopology] = useState(null)
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      const saved = localStorage.getItem('maddex_globe_mode')
      return DISPLAY_MODES.includes(saved) ? saved : 'EARTH'
    } catch { return 'EARTH' }
  })
  const [isPlaying, setIsPlaying] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [compassAngle, setCompassAngle] = useState(0)

  const [tooltip, setTooltip] = useState(null) // { x, y, text }
  const [pinnedCountry, setPinnedCountry] = useState(null)
  const [pinnedExchange, setPinnedExchange] = useState(null)

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
  const exchangeScreenPosRef = useRef({}) // id -> { x, y, r }
  const pinnedCountryRef = useRef(null)
  const pinnedExchangeRef = useRef(null)
  const displayModeRef = useRef(displayMode)
  const quotesRef = useRef(quotes)
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => { displayModeRef.current = displayMode }, [displayMode])
  useEffect(() => { quotesRef.current = quotes }, [quotes])
  useEffect(() => { pinnedCountryRef.current = pinnedCountry }, [pinnedCountry])
  useEffect(() => { pinnedExchangeRef.current = pinnedExchange }, [pinnedExchange])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

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
  const graticule = useMemo(() => d3.geoGraticule().step([20, 20])(), [])

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

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return countries.filter(f => f.properties?.name?.toLowerCase().includes(q)).slice(0, 6)
  }, [searchQuery, countries])

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

    const mode = displayModeRef.current
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

    const isDark = mode === 'DARK'
    const isEarth = mode === 'EARTH'

    // Atmosphere glow — stronger blue halo for EARTH, soft blue elsewhere
    const atmR = scaledRadius + 14
    const atmGrad = ctx.createRadialGradient(cx, cy, scaledRadius * 0.94, cx, cy, atmR)
    if (isEarth) {
      atmGrad.addColorStop(0, 'rgba(40,100,190,0)')
      atmGrad.addColorStop(0.6, 'rgba(40,100,190,0.25)')
      atmGrad.addColorStop(1, 'rgba(60,130,220,0.45)')
    } else {
      atmGrad.addColorStop(0, 'rgba(26,58,106,0)')
      atmGrad.addColorStop(0.7, 'rgba(26,58,106,0.15)')
      atmGrad.addColorStop(1, 'rgba(26,58,106,0.3)')
    }
    ctx.beginPath()
    ctx.arc(cx, cy, atmR, 0, Math.PI * 2)
    ctx.fillStyle = atmGrad
    ctx.fill()

    // Ocean sphere with subtle radial gradient for depth
    const oceanGrad = ctx.createRadialGradient(cx, cy, scaledRadius * 0.1, cx, cy, scaledRadius)
    if (isDark) {
      oceanGrad.addColorStop(0, '#020508')
      oceanGrad.addColorStop(1, '#020508')
    } else if (isEarth) {
      oceanGrad.addColorStop(0, '#1a3a6e')
      oceanGrad.addColorStop(1, '#0a1628')
    } else {
      oceanGrad.addColorStop(0, '#060D1A')
      oceanGrad.addColorStop(1, '#0B1628')
    }
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = oceanGrad; ctx.fill()

    // Graticule
    if (!isDark) {
      ctx.beginPath(); path(graticule)
      ctx.strokeStyle = isEarth ? 'rgba(255,255,255,0.06)' : 'rgba(26,70,140,0.08)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // Countries — geoPath + clipAngle(90) clips polygon geometry to the
    // visible hemisphere automatically; back-side countries render nothing.
    const hoveredId = hoveredCountryRef.current
    const pinnedId = pinnedCountryRef.current
    for (const feature of countries) {
      ctx.beginPath()
      path(feature)
      const numericId = parseInt(feature.id)
      let fill
      if (isEarth) fill = earthFillColor(numericId)
      else if (mode === 'HEAT') fill = heatColor(heatByCountry[numericId])
      else if (mode === 'CRYPTO') fill = cryptoFillColor(numericId)
      else if (isDark) fill = '#060D1A'
      else fill = 'rgba(11,22,40,0.6)'
      ctx.fillStyle = fill
      ctx.fill()

      const isSel = feature.id === hoveredId || feature.id === pinnedId
      let borderColor
      if (isSel) borderColor = '#C9A84C'
      else if (isEarth) borderColor = 'rgba(255,255,255,0.25)'
      else if (isDark) borderColor = 'rgba(201,168,76,0.15)'
      else borderColor = 'rgba(26,70,140,0.4)'
      ctx.strokeStyle = borderColor
      ctx.lineWidth = isSel ? 1.4 : 0.5
      ctx.stroke()
    }

    // Sphere outline + rim light
    ctx.beginPath(); path({ type: 'Sphere' })
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()

    // CRYPTO overlay — rising particles from high-adoption hubs + top crypto
    // cities, all hemisphere-clipped like the exchange markers below.
    if (mode === 'CRYPTO') {
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
          ctx.fillStyle = 'rgba(201,168,76,0.3)'
          ctx.fill()
        }
      }

      for (const city of CRYPTO_CITIES) {
        if (!isPointVisible(city.lon, city.lat, rotation)) continue
        const p = projection([city.lon, city.lat])
        if (!p) continue
        const [px, py] = p
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
      }
    }

    // Exchange markers — small clean indicators, hemisphere-clipped, shown on
    // every layer except DARK (DARK gets its own minimal white-dot style).
    const nextScreenPos = {}
    for (const ex of EXCHANGES) {
      if (!isPointVisible(ex.lon, ex.lat, rotation)) continue
      const p = projection([ex.lon, ex.lat])
      if (!p) continue
      const [px, py] = p
      nextScreenPos[ex.id] = { x: px, y: py, r: 8 }

      const open = isExchangeOpen(ex)
      const isHov = hoveredExchangeRef.current === ex.id || pinnedExchangeRef.current === ex.id

      if (isDark) {
        ctx.beginPath()
        ctx.arc(px, py, 2, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        continue
      }

      let r = 4
      if (open) {
        const cycle = ((now + ex.lat * 137) % 2000) / 2000
        r = 4 * (1 + 0.4 * Math.sin(Math.PI * cycle))
      }
      if (isHov) r *= 1.3

      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fillStyle = open ? '#C9A84C' : '#3D5070'
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(6,13,26,0.6)'
      ctx.stroke()

      // Labels only past a zoom threshold, MARKETS mode only, to avoid clutter
      if (mode === 'MARKETS' && zoomK > 1.8) {
        ctx.font = '8px "IBM Plex Mono", monospace'
        ctx.fillStyle = '#C9A84C'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(ex.label, px + 7, py)
      }
    }
    exchangeScreenPosRef.current = nextScreenPos

    // Vignette — subtle depth cue around the globe's edge, screen-space,
    // independent of zoom/rotation, drawn last so it sits above everything.
    const vignette = ctx.createRadialGradient(cx, cy, scaledRadius * 0.75, cx, cy, scaledRadius * 1.15)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.1)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, width, height)
  }, [width, height, radius, countries, graticule, heatByCountry])

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
      const mode = displayModeRef.current
      const { x: mx, y: my } = mouseRef.current
      const projection = d3.geoOrthographic()
        .scale(radius * zoomKRef.current).translate([width / 2, height / 2]).clipAngle(90).rotate(rotationRef.current)

      // Exchange markers take priority
      let exId = null
      for (const [id, pos] of Object.entries(exchangeScreenPosRef.current)) {
        const dx = mx - pos.x, dy = my - pos.y
        if (dx * dx + dy * dy <= pos.r * pos.r) { exId = id; break }
      }
      hoveredExchangeRef.current = exId

      // Same hemisphere-visibility check used for rendering point markers —
      // without it, `projection.invert()` near the sphere's silhouette edge
      // can resolve to a back-hemisphere lon/lat that still happens to fall
      // inside a (non-rendered) country polygon, bleeding its tooltip through.
      let countryId = null
      if (!exId) {
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
      } else if (countryId) {
        const n = parseInt(countryId)
        let text = `Country #${n}`
        const feature = countries.find(f => f.id === countryId)
        if (feature?.properties?.name) text = feature.properties.name
        if (mode === 'HEAT' && heatByCountry[n] != null) {
          text += ` · ${heatByCountry[n] >= 0 ? '+' : ''}${heatByCountry[n].toFixed(2)}%`
        }
        if (mode === 'CRYPTO') {
          const tier = CRYPTO_TIER_BY_COUNTRY_ID[n]
          const info = tier ? CRYPTO_TIER_INFO[tier] : null
          text += info ? ` · ${info.label} · ${info.legal}` : ' · No data'
        }
        setTooltip({ x: mx, y: my, text })
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
      onExchangeClick?.(hoveredExchangeRef.current)
    } else if (hoveredCountryRef.current) {
      const numericId = parseInt(hoveredCountryRef.current, 10)
      setPinnedCountry(hoveredCountryRef.current)
      setPinnedExchange(null)
      onCountryClick?.(numericId)
    } else {
      setPinnedCountry(null)
      setPinnedExchange(null)
    }
  }, [onCountryClick, onExchangeClick])

  function selectMode(mode) {
    setDisplayMode(mode)
    try { localStorage.setItem('maddex_globe_mode', mode) } catch {}
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

  function selectSearchResult(feature) {
    setPinnedCountry(feature.id)
    setPinnedExchange(null)
    rotateToCountry(feature)
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

      {/* Layer toggle — top-right, above canvas */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 pointer-events-auto">
        {DISPLAY_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => selectMode(m)}
            className={`font-mono text-[9px] tracking-widest px-2 py-1 transition-colors ${
              displayMode === m
                ? 'bg-terminal-gold text-terminal-bg'
                : 'bg-terminal-panel border border-terminal-border text-terminal-text-dim hover:border-terminal-gold'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Search — top-left, rotates the globe to the selected country */}
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
            {searchMatches.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => selectSearchResult(f)}
                className="block w-full text-left px-2 py-1 font-mono text-[10px] text-terminal-text-dim hover:bg-terminal-accent/30 hover:text-terminal-gold"
              >
                {f.properties?.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* HEAT legend — bottom-right, stacked below the compass/controls stack */}
      {displayMode === 'HEAT' && (
        <div className="absolute bottom-16 right-3 z-10 bg-terminal-panel/90 border border-terminal-border px-2.5 py-2 backdrop-blur-sm">
          <div className="text-[8px] font-mono text-terminal-text-dim tracking-widest mb-1.5">TODAY'S INDEX %</div>
          <div className="flex items-center gap-1.5">
            {[
              ['#A83232', '<-1%'],
              ['#6B2323', '-1 to -0.3%'],
              ['#1A3A6A', 'flat'],
              ['#2D8A50', '0-1%'],
              ['#1a5c35', '>1%'],
            ].map(([color, label]) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span style={{ width: 10, height: 10, background: color, display: 'inline-block' }} />
                <span className="text-[7px] text-terminal-text-dim whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CRYPTO legend — bottom-right, stacked below the compass/controls stack */}
      {displayMode === 'CRYPTO' && (
        <div className="absolute bottom-16 right-3 z-10 bg-terminal-panel/90 border border-terminal-border px-2.5 py-2 backdrop-blur-sm">
          <div className="text-[8px] font-mono text-terminal-text-dim tracking-widest mb-1.5">CRYPTO ADOPTION</div>
          <div className="flex items-center gap-1.5">
            {[
              ['#2D8A50', 'Very High'],
              ['#1a5c35', 'High'],
              ['#1A3A6A', 'Medium'],
              ['#6B2323', 'Low'],
              ['#A83232', 'Banned'],
            ].map(([color, label]) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span style={{ width: 10, height: 10, background: color, display: 'inline-block' }} />
                <span className="text-[7px] text-terminal-text-dim whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          bottom, the compass rose above them — column-reverse keeps the
          two from overlapping. z-10 keeps both above the canvas. */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col-reverse items-end gap-2">
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
