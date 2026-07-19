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

// FLOW mode: follow-the-sun capital-flow loop — NYC → London → Frankfurt /
// Dubai → Mumbai → Singapore → Hong Kong → Tokyo → Sydney → NYC.
const FLOW_NODES = [
  { id: 'NYC',       name: 'New York',  lon: -74.0060, lat: 40.7128 },
  { id: 'LONDON',    name: 'London',    lon: -0.1278,  lat: 51.5074 },
  { id: 'FRANKFURT', name: 'Frankfurt', lon: 8.6821,   lat: 50.1109 },
  { id: 'DUBAI',     name: 'Dubai',     lon: 55.2708,  lat: 25.2048 },
  { id: 'MUMBAI',    name: 'Mumbai',    lon: 72.8777,  lat: 19.0760 },
  { id: 'SINGAPORE', name: 'Singapore', lon: 103.8198, lat: 1.3521 },
  { id: 'HONGKONG',  name: 'Hong Kong', lon: 114.1694, lat: 22.3193 },
  { id: 'TOKYO',     name: 'Tokyo',     lon: 139.6503, lat: 35.6762 },
  { id: 'SYDNEY',    name: 'Sydney',    lon: 151.2093, lat: -33.8688 },
]
const FLOW_NODE_MAP = Object.fromEntries(FLOW_NODES.map(n => [n.id, n]))
const FLOW_ROUTES = [
  { id: 'nyc-london',         from: 'NYC',       to: 'LONDON' },
  { id: 'london-frankfurt',   from: 'LONDON',    to: 'FRANKFURT' },
  { id: 'london-dubai',       from: 'LONDON',    to: 'DUBAI' },
  { id: 'dubai-mumbai',       from: 'DUBAI',     to: 'MUMBAI' },
  { id: 'mumbai-singapore',   from: 'MUMBAI',    to: 'SINGAPORE' },
  { id: 'singapore-hongkong', from: 'SINGAPORE', to: 'HONGKONG' },
  { id: 'hongkong-tokyo',     from: 'HONGKONG',  to: 'TOKYO' },
  { id: 'tokyo-sydney',       from: 'TOKYO',     to: 'SYDNEY' },
  { id: 'sydney-nyc',         from: 'SYDNEY',    to: 'NYC' },
]

const YF_SYMBOLS = [...new Set(EXCHANGES.map(e => e.ySymbol))]

const DISPLAY_MODES = ['MARKETS', 'HEAT', 'FLOW', 'DARK']

// Default starting orientation — Australia/Asia-Pacific centred, matches the
// terminal's home market. Auto-rotate speed is degrees/frame at ~60fps.
const DEFAULT_ROTATION = [-134, -26, 0]
const AUTO_ROTATE_SPEED = 0.06

const RAD = Math.PI / 180

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
// point features (exchange dots, flow-hub dots) are projected directly via
// `projection([lon, lat])`, which does NOT apply clipAngle — so point
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

export default function MaddexGlobe() {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const [size, setSize] = useState({ width: 800, height: 500 })
  const [topology, setTopology] = useState(null)
  const [displayMode, setDisplayMode] = useState(() => {
    try { return localStorage.getItem('maddex_globe_mode') ?? 'MARKETS' } catch { return 'MARKETS' }
  })
  const [isPaused, setIsPaused] = useState(false)

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
  const velocityRef = useRef([0, 0])
  const zoomKRef = useRef(1) // pure scale factor — globe centre never moves
  const draggingRef = useRef(false)
  const dragLastRef = useRef({ x: 0, y: 0, t: 0 })
  const lastInteractionRef = useRef(0)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const hoveredCountryRef = useRef(null)
  const hoveredExchangeRef = useRef(null)
  const exchangeScreenPosRef = useRef({}) // id -> { x, y, r }
  const pinnedCountryRef = useRef(null)
  const pinnedExchangeRef = useRef(null)
  const displayModeRef = useRef(displayMode)
  const quotesRef = useRef(quotes)
  const isPausedRef = useRef(isPaused)
  useEffect(() => { displayModeRef.current = displayMode }, [displayMode])
  useEffect(() => { quotesRef.current = quotes }, [quotes])
  useEffect(() => { pinnedCountryRef.current = pinnedCountry }, [pinnedCountry])
  useEffect(() => { pinnedExchangeRef.current = pinnedExchange }, [pinnedExchange])
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])

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
        lastInteractionRef.current = performance.now()
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

    // Atmosphere glow — soft blue halo around the sphere edge
    const atmR = scaledRadius + 14
    const atmGrad = ctx.createRadialGradient(cx, cy, scaledRadius * 0.94, cx, cy, atmR)
    atmGrad.addColorStop(0, 'rgba(26,58,106,0)')
    atmGrad.addColorStop(0.7, 'rgba(26,58,106,0.15)')
    atmGrad.addColorStop(1, 'rgba(26,58,106,0.3)')
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
      oceanGrad.addColorStop(0, '#060D1A')
      oceanGrad.addColorStop(1, '#0B1628')
    }
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = oceanGrad; ctx.fill()

    // Graticule
    if (!isDark) {
      ctx.beginPath(); path(graticule)
      ctx.strokeStyle = 'rgba(26,70,140,0.08)'
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
      let fill
      if (mode === 'HEAT') fill = heatColor(heatByCountry[parseInt(feature.id)])
      else if (isDark) fill = '#060D1A'
      else fill = 'rgba(11,22,40,0.6)'
      ctx.fillStyle = fill
      ctx.fill()

      const isSel = feature.id === hoveredId || feature.id === pinnedId
      ctx.strokeStyle = isSel ? '#C9A84C' : (isDark ? 'rgba(201,168,76,0.15)' : 'rgba(26,70,140,0.4)')
      ctx.lineWidth = isSel ? 1.4 : 0.5
      ctx.stroke()
    }

    // Sphere outline + rim light
    ctx.beginPath(); path({ type: 'Sphere' })
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()

    // FLOW arcs — gold → green gradient, animated travelling dashes, clipped
    // to the front hemisphere by the same geoPath pipeline as countries.
    if (mode === 'FLOW') {
      for (const route of FLOW_ROUTES) {
        const from = FLOW_NODE_MAP[route.from]
        const to = FLOW_NODE_MAP[route.to]
        const feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[from.lon, from.lat], [to.lon, to.lat]] } }
        const p0 = projection([from.lon, from.lat])
        const p1 = projection([to.lon, to.lat])
        ctx.beginPath()
        path(feature)
        if (p0 && p1) {
          const grad = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1])
          grad.addColorStop(0, 'rgba(201,168,76,0.6)')
          grad.addColorStop(1, 'rgba(45,138,80,0.6)')
          ctx.strokeStyle = grad
        } else {
          ctx.strokeStyle = 'rgba(201,168,76,0.6)'
        }
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 5])
        ctx.lineDashOffset = -((now / 40) % 11)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // City hub dots + always-on labels — hemisphere-clipped like everything else
      for (const node of FLOW_NODES) {
        if (!isPointVisible(node.lon, node.lat, rotation)) continue
        const p = projection([node.lon, node.lat])
        if (!p) continue
        const [px, py] = p
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.font = '8px "IBM Plex Mono", monospace'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.name, px + 6, py)
      }
    }

    // Exchange markers — small clean indicators, hemisphere-clipped
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

  // ── RAF loop: rotation (auto/inertia) + redraw ──────────────────────────
  useEffect(() => {
    let last = performance.now()

    function frame(now) {
      const dt = Math.min(now - last, 48)
      last = now

      const idle = !draggingRef.current
      const [vLambda, vPhi] = velocityRef.current
      const hasVelocity = Math.abs(vLambda) > 0.0003 || Math.abs(vPhi) > 0.0003

      if (idle && hasVelocity) {
        rotationRef.current = [
          rotationRef.current[0] + vLambda * dt,
          Math.max(-85, Math.min(85, rotationRef.current[1] + vPhi * dt)),
          0,
        ]
        velocityRef.current = [vLambda * 0.94, vPhi * 0.94]
      } else if (idle && !isPausedRef.current && now - lastInteractionRef.current > 4000) {
        rotationRef.current = [rotationRef.current[0] + AUTO_ROTATE_SPEED, rotationRef.current[1], 0]
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

      let countryId = null
      if (!exId) {
        const lonLat = projection.invert([mx, my])
        if (lonLat && Math.abs(lonLat[0]) <= 180) {
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
        setTooltip({ x: mx, y: my, text })
      } else {
        setTooltip(null)
      }
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [drawFrame, width, height, radius, countries, heatByCountry])

  // ── Pointer handlers (rotation drag with inertia) ───────────────────────
  const handlePointerDown = useCallback((e) => {
    draggingRef.current = true
    velocityRef.current = [0, 0]
    dragLastRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    lastInteractionRef.current = performance.now()
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
      const now = performance.now()
      const { x, y, t } = dragLastRef.current
      const dt = Math.max(now - t, 1)
      const dLambda = (e.clientX - x) * 0.3
      const dPhi = -(e.clientY - y) * 0.3
      rotationRef.current = [
        rotationRef.current[0] + dLambda,
        Math.max(-85, Math.min(85, rotationRef.current[1] + dPhi)),
        0,
      ]
      velocityRef.current = [dLambda / dt, dPhi / dt]
      dragLastRef.current = { x: e.clientX, y: e.clientY, t: now }
      lastInteractionRef.current = now
    }
    function onUp() {
      draggingRef.current = false
      lastInteractionRef.current = performance.now()
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
    } else if (hoveredCountryRef.current) {
      setPinnedCountry(hoveredCountryRef.current)
      setPinnedExchange(null)
    } else {
      setPinnedCountry(null)
      setPinnedExchange(null)
    }
  }, [])

  const handleWheelOrTouch = useCallback(() => {
    lastInteractionRef.current = performance.now()
  }, [])

  function selectMode(mode) {
    setDisplayMode(mode)
    try { localStorage.setItem('maddex_globe_mode', mode) } catch {}
  }

  function togglePaused() {
    setIsPaused(p => !p)
  }

  // Animate rotation back to the default orientation over ~800ms.
  function resetView() {
    const start = rotationRef.current.slice()
    const end = DEFAULT_ROTATION
    const interpolate = d3.interpolate(start, end)
    const startTime = performance.now()
    const duration = 800
    velocityRef.current = [0, 0]
    lastInteractionRef.current = startTime

    function tick(now) {
      const t = Math.min((now - startTime) / duration, 1)
      rotationRef.current = interpolate(d3.easeCubicInOut(t))
      lastInteractionRef.current = now
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  // ── Data cards ───────────────────────────────────────────────────────────
  const pinnedCountryFeature = pinnedCountry ? countries.find(f => f.id === pinnedCountry) : null
  const pinnedCountryName = pinnedCountryFeature?.properties?.name ?? null
  const pinnedCountryExchange = pinnedCountry ? EXCHANGES.find(e => e.countryId === parseInt(pinnedCountry)) : null
  const pinnedExchangeData = pinnedExchange ? EXCHANGES.find(e => e.id === pinnedExchange) : null
  const pinnedExchangeQuote = pinnedExchangeData ? quotes?.[pinnedExchangeData.ySymbol] : null

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
        onWheel={handleWheelOrTouch}
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

      {/* HEAT legend — bottom-right */}
      {displayMode === 'HEAT' && (
        <div className="absolute bottom-3 right-3 z-10 bg-terminal-panel/90 border border-terminal-border px-2.5 py-2 backdrop-blur-sm">
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

      {/* Single DOM tooltip, repositioned on hover */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-terminal-panel border border-terminal-gold/50 px-2 py-1.5 text-2xs text-terminal-text-bright font-mono shadow-lg"
          style={{ left: Math.min(tooltip.x + 12, width - 180), top: Math.max(tooltip.y - 30, 4) }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Bottom-left stack: pause/reset controls always at the true bottom;
          the pinned data card (when present) stacks above via column-reverse
          so the two never overlap. */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col-reverse items-start gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={togglePaused}
            title={isPaused ? 'Resume rotation' : 'Pause rotation'}
            className="w-6 h-6 flex items-center justify-center bg-terminal-panel/85 border border-terminal-border/70 text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold backdrop-blur-sm transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              {isPaused ? (
                <polygon points="2,1 9,5 2,9" fill="currentColor" />
              ) : (
                <>
                  <rect x="2" y="1" width="2.2" height="8" fill="currentColor" />
                  <rect x="5.8" y="1" width="2.2" height="8" fill="currentColor" />
                </>
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

        {(pinnedCountryName || pinnedExchangeData) && (
          <div className="bg-terminal-panel border border-terminal-gold/40 px-3 py-2.5 min-w-[180px] max-w-[240px] shadow-xl">
            {pinnedExchangeData ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-terminal-gold">{pinnedExchangeData.label}</span>
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 ${isExchangeOpen(pinnedExchangeData) ? 'bg-terminal-green/20 text-terminal-green' : 'bg-terminal-border text-terminal-text-dim'}`}>
                    {isExchangeOpen(pinnedExchangeData) ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
                <div className="text-2xs text-terminal-text-dim mb-1">{pinnedExchangeData.city}</div>
                {pinnedExchangeQuote?.price != null && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm text-terminal-text-bright">{pinnedExchangeQuote.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    {pinnedExchangeQuote.dayChangePct != null && (
                      <span className={`font-mono text-2xs ${pinnedExchangeQuote.dayChangePct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                        {pinnedExchangeQuote.dayChangePct >= 0 ? '▲' : '▼'} {Math.abs(pinnedExchangeQuote.dayChangePct).toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPinnedExchange(null)}
                  className="text-[9px] text-terminal-text-dim hover:text-terminal-text mt-1.5"
                >
                  ✕ close
                </button>
              </>
            ) : (
              <>
                <div className="font-mono text-xs font-bold text-terminal-text-bright mb-1">{pinnedCountryName}</div>
                {pinnedCountryExchange ? (
                  (() => {
                    const q = quotes?.[pinnedCountryExchange.ySymbol]
                    return (
                      <div className="text-2xs text-terminal-text-dim">
                        {pinnedCountryExchange.label}
                        {q?.price != null && (
                          <>
                            {' '}· {q.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            {q.dayChangePct != null && (
                              <span className={q.dayChangePct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
                                {' '}{q.dayChangePct >= 0 ? '▲' : '▼'} {Math.abs(q.dayChangePct).toFixed(2)}%
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })()
                ) : (
                  <div className="text-2xs text-terminal-text-dim">No exchange data for this country</div>
                )}
                <button
                  type="button"
                  onClick={() => setPinnedCountry(null)}
                  className="text-[9px] text-terminal-text-dim hover:text-terminal-text mt-1.5"
                >
                  ✕ close
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
