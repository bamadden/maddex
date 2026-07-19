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

const MAX_MARKET_CAP = Math.max(...EXCHANGES.map(e => e.marketCapB))

// FLOW mode: follow-the-sun capital-flow loop. Uses its own node set since it
// includes financial centres (Frankfurt, Dubai) not among the 12 exchanges
// plotted in MARKETS mode.
const FLOW_NODES = {
  NYC:       [-74.0060, 40.7128],
  LONDON:    [-0.1278, 51.5074],
  FRANKFURT: [8.6821, 50.1109],
  DUBAI:     [55.2708, 25.2048],
  SINGAPORE: [103.8198, 1.3521],
  TOKYO:     [139.6503, 35.6762],
  SYDNEY:    [151.2093, -33.8688],
}
const FLOW_ROUTES = [
  { id: 'nyc-london',       from: 'NYC',       to: 'LONDON',    volume: 1.0 },
  { id: 'london-frankfurt', from: 'LONDON',    to: 'FRANKFURT', volume: 0.55 },
  { id: 'frankfurt-dubai',  from: 'FRANKFURT', to: 'DUBAI',     volume: 0.45 },
  { id: 'dubai-singapore',  from: 'DUBAI',     to: 'SINGAPORE', volume: 0.5 },
  { id: 'singapore-tokyo',  from: 'SINGAPORE', to: 'TOKYO',     volume: 0.65 },
  { id: 'tokyo-sydney',     from: 'TOKYO',     to: 'SYDNEY',    volume: 0.4 },
  { id: 'sydney-nyc',       from: 'SYDNEY',    to: 'NYC',       volume: 0.6 },
]

const YF_SYMBOLS = [...new Set(EXCHANGES.map(e => e.ySymbol))]

const DISPLAY_MODES = ['MARKETS', 'HEAT', 'FLOW', 'DARK']

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
  const rotationRef = useRef([-134, -26, 0])
  const velocityRef = useRef([0, 0])
  const zoomRef = useRef({ x: 0, y: 0, k: 1 })
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
  useEffect(() => { displayModeRef.current = displayMode }, [displayMode])
  useEffect(() => { quotesRef.current = quotes }, [quotes])
  useEffect(() => { pinnedCountryRef.current = pinnedCountry }, [pinnedCountry])
  useEffect(() => { pinnedExchangeRef.current = pinnedExchange }, [pinnedExchange])

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

  // ── d3-zoom: wheel + touch only, so mousedown stays dedicated to rotation ──
  useEffect(() => {
    if (!canvasRef.current) return
    const zoomBehavior = d3.zoom()
      .scaleExtent([1, 5])
      .filter((event) => event.type === 'wheel' || event.type.startsWith('touch'))
      .on('zoom', (event) => {
        zoomRef.current = { x: event.transform.x, y: event.transform.y, k: event.transform.k }
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
    const zoom = zoomRef.current
    const rotation = rotationRef.current

    const projection = d3.geoOrthographic()
      .scale(radius)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .rotate(rotation)
    const path = d3.geoPath(projection, ctx)

    // Atmosphere glow — soft blue-white halo around the sphere edge
    const atmR = radius * zoom.k + 14
    const atmGrad = ctx.createRadialGradient(
      width / 2 + zoom.x - width / 2 * (zoom.k - 1), height / 2 + zoom.y - height / 2 * (zoom.k - 1), radius * zoom.k * 0.94,
      width / 2 + zoom.x - width / 2 * (zoom.k - 1), height / 2 + zoom.y - height / 2 * (zoom.k - 1), atmR
    )
    atmGrad.addColorStop(0, 'rgba(120,170,255,0)')
    atmGrad.addColorStop(0.7, 'rgba(120,170,255,0.10)')
    atmGrad.addColorStop(1, 'rgba(180,210,255,0.22)')
    ctx.save()
    ctx.beginPath()
    ctx.arc(width / 2 + zoom.x - width / 2 * (zoom.k - 1), height / 2 + zoom.y - height / 2 * (zoom.k - 1), atmR, 0, Math.PI * 2)
    ctx.fillStyle = atmGrad
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.translate(zoom.x, zoom.y)
    ctx.scale(zoom.k, zoom.k)

    const isDark = mode === 'DARK'

    // Ocean sphere with subtle radial gradient for depth
    const oceanGrad = ctx.createRadialGradient(width / 2, height / 2, radius * 0.1, width / 2, height / 2, radius)
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
      ctx.strokeStyle = 'rgba(26,70,140,0.15)'
      ctx.lineWidth = 0.5 / zoom.k
      ctx.stroke()
    }

    // Countries
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
      ctx.lineWidth = (isSel ? 1.4 : 0.5) / zoom.k
      ctx.stroke()
    }

    // Sphere outline + rim light
    ctx.beginPath(); path({ type: 'Sphere' })
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1 / zoom.k
    ctx.stroke()

    // FLOW arcs
    if (mode === 'FLOW') {
      for (const route of FLOW_ROUTES) {
        const feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: [FLOW_NODES[route.from], FLOW_NODES[route.to]] } }
        ctx.beginPath()
        path(feature)
        ctx.strokeStyle = `rgba(201,168,76,${0.15 + route.volume * 0.35})`
        ctx.lineWidth = (1 + route.volume * 2.2) / zoom.k
        ctx.setLineDash([8 / zoom.k, 6 / zoom.k])
        ctx.lineDashOffset = -((now / 35) % 14)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Exchange markers
    const nextScreenPos = {}
    for (const ex of EXCHANGES) {
      const p = projection([ex.lon, ex.lat])
      if (!p) continue
      const [px, py] = p
      const screenX = zoom.x + zoom.k * px
      const screenY = zoom.y + zoom.k * py
      const sizeFrac = ex.marketCapB / MAX_MARKET_CAP
      const baseR = 2 + sizeFrac * 3.5
      nextScreenPos[ex.id] = { x: screenX, y: screenY, r: (baseR + 3) * zoom.k }

      const open = isExchangeOpen(ex)
      const isHov = hoveredExchangeRef.current === ex.id || pinnedExchangeRef.current === ex.id

      if (isDark) {
        ctx.beginPath()
        ctx.arc(px, py, 2 / zoom.k, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        continue
      }

      let r = baseR
      if (open) {
        const pulse = 1 + 0.28 * Math.sin(now / 420 + ex.lat)
        r = baseR * pulse
        ctx.beginPath()
        ctx.arc(px, py, r * 1.9, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(201,168,76,0.12)'
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(px, py, isHov ? r * 1.3 : r, 0, Math.PI * 2)
      ctx.fillStyle = open ? '#C9A84C' : 'rgba(201,168,76,0.45)'
      ctx.fill()
      ctx.lineWidth = 1 / zoom.k
      ctx.strokeStyle = '#060D1A'
      ctx.stroke()

      // Labels above a zoom threshold, MARKETS mode only
      if (mode === 'MARKETS' && zoom.k > 1.6) {
        const q = quotesRef.current?.[ex.ySymbol]
        const label = q?.price != null ? `${ex.label} ${q.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ex.label
        ctx.font = `${9 / zoom.k}px "IBM Plex Mono", monospace`
        ctx.fillStyle = '#C9A84C'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, px + (baseR + 4) / zoom.k, py)
      }
    }
    exchangeScreenPosRef.current = nextScreenPos

    ctx.restore()
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
      } else if (idle && now - lastInteractionRef.current > 4000) {
        rotationRef.current = [rotationRef.current[0] + 0.15, rotationRef.current[1], 0]
      }

      // Hit-testing against the latest mouse position, once per frame
      hitTest()

      drawFrame(now)
      rafRef.current = requestAnimationFrame(frame)
    }

    function hitTest() {
      const mode = displayModeRef.current
      const { x: mx, y: my } = mouseRef.current
      const zoom = zoomRef.current
      const projection = d3.geoOrthographic()
        .scale(radius).translate([width / 2, height / 2]).clipAngle(90).rotate(rotationRef.current)

      // Exchange markers take priority
      let exId = null
      for (const [id, pos] of Object.entries(exchangeScreenPosRef.current)) {
        const dx = mx - pos.x, dy = my - pos.y
        if (dx * dx + dy * dy <= pos.r * pos.r) { exId = id; break }
      }
      hoveredExchangeRef.current = exId

      let countryId = null
      if (!exId) {
        const ux = (mx - zoom.x) / zoom.k
        const uy = (my - zoom.y) / zoom.k
        const lonLat = projection.invert([ux, uy])
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

      {/* Pinned data card — fixed bottom-left, never overlaps layer controls */}
      {(pinnedCountryName || pinnedExchangeData) && (
        <div className="absolute bottom-3 left-3 z-10 bg-terminal-panel border border-terminal-gold/40 px-3 py-2.5 min-w-[180px] max-w-[240px] shadow-xl">
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
  )
}
