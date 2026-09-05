import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { Map } from 'react-map-gl/maplibre'
import { ScatterplotLayer, TextLayer, ArcLayer, ColumnLayer, PathLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  EXCHANGES, TRADE_ROUTES, SHIPPING_DISRUPTIONS, COMMODITY_SITES,
  GEOPOLITICAL_EVENTS, UNDERSEA_CABLES, MILITARY_BASES, MAJOR_CITIES,
  SEVERITY_COLOUR, isExchangeOpen,
} from './intelMapData'
import MapDetailPanel from './MapDetailPanel'

// ── Basemaps ──────────────────────────────────────────────────────────────
// CartoCDN's GL styles are free and need no API key. INTELLIGENCE is not a
// basemap at all — it renders no tiles, leaving our own layers on black,
// which is both the most legible for data and the cheapest to draw.
const MAP_STYLES = {
  dark:    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  minimal: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  night:   'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  intel:   null,
}

const INITIAL_VIEW = {
  longitude: 134.0,
  latitude: -25.0,
  zoom: 3.2,
  pitch: 45,
  bearing: 0,
}

const AU_VIEW     = { longitude: 134.0, latitude: -25.0, zoom: 3.5, pitch: 45, bearing: 0 }
const GLOBAL_VIEW = { longitude: 60.0,  latitude: 15.0,  zoom: 1.4, pitch: 30, bearing: 0 }

// Ease-in-out cubic — the camera should settle rather than arrive abruptly.
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const USGS_WEEK  = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'
const USGS_MAJOR = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/6.0_month.geojson'

export default function DeckGLMap({ onExchangeSelect, watchlist = [] }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [activeLayer, setActiveLayer] = useState('all')
  const [tooltip, setTooltip] = useState(null)
  const [selected, setSelected] = useState(null)
  const [mapStyle, setMapStyle] = useState('dark')
  const [quakes, setQuakes] = useState([])
  const [majorQuakes, setMajorQuakes] = useState([])
  const [quakeState, setQuakeState] = useState('loading')
  const [auFocus, setAuFocus] = useState(false)
  const [pulse, setPulse] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const wrapRef = useRef(null)

  // ── Live seismic feed ───────────────────────────────────────────────────
  // Both feeds in parallel, refreshed every 10 minutes. A failure leaves the
  // previous data in place rather than blanking the layer — stale quakes are
  // more useful than none.
  useEffect(() => {
    let cancelled = false
    const parse = (data) => (data?.features ?? []).map((f) => ({
      coordinates: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      depth: f.geometry.coordinates[2],
    }))
    const load = async () => {
      try {
        const [w, m] = await Promise.all([
          fetch(USGS_WEEK).then((r) => r.json()),
          fetch(USGS_MAJOR).then((r) => r.json()),
        ])
        if (cancelled) return
        setQuakes(parse(w))
        setMajorQuakes(parse(m).filter((q) => q.magnitude >= 6))
        setQuakeState('ready')
      } catch {
        if (!cancelled) setQuakeState((s) => (s === 'ready' ? 'ready' : 'error'))
      }
    }
    load()
    const id = setInterval(load, 600_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Pulse clock for the open-exchange rings. Deliberately 100ms, not a
  // requestAnimationFrame loop: the rings only need to breathe, and driving
  // React state at 60fps would rebuild every layer on every frame.
  useEffect(() => {
    const id = setInterval(() => setPulse((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const flyTo = useCallback((target) => {
    setViewState({ ...target, transitionDuration: 1800, transitionEasing: easeInOutCubic })
  }, [])

  const hover = useCallback((type) => ({ object, x, y }) => {
    setTooltip(object ? { object, x, y, type } : null)
  }, [])

  // Sine over the pulse tick, so the ring alpha breathes between ~20 and ~80.
  const pulseAlpha = Math.round((Math.sin(pulse * 0.18) * 0.5 + 0.5) * 60 + 20)

  const layers = useMemo(() => {
    const all = []
    const show = (id) => activeLayer === 'all' || activeLayer === id
    const openExchanges = EXCHANGES.filter(isExchangeOpen)

    if (mapStyle === 'night') {
      all.push(new HeatmapLayer({
        id: 'city-lights',
        data: MAJOR_CITIES,
        getPosition: (d) => [d.lon, d.lat],
        getWeight: (d) => d.pop,
        radiusPixels: 70,
        intensity: 0.9,
        threshold: 0.05,
        colorRange: [
          [40, 30, 10, 60], [80, 60, 20, 120], [160, 120, 40, 170],
          [220, 170, 60, 210], [255, 200, 80, 235], [255, 240, 190, 255],
        ],
      }))
    }

    // ── Trade routes ──────────────────────────────────────────────────────
    if (show('trade')) {
      const routes = auFocus ? TRADE_ROUTES.filter((r) => r.id.startsWith('AU-')) : TRADE_ROUTES
      all.push(new ArcLayer({
        id: 'trade-arcs',
        data: routes,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getSourceColor: (d) => (d.disrupted ? [168, 50, 50, 220] : [...d.color, 210]),
        getTargetColor: (d) => (d.disrupted ? [168, 50, 50, 40] : [...d.color, 40]),
        getWidth: (d) => d.thickness,
        getHeight: 0.4,
        greatCircle: true,
        pickable: true,
        onHover: hover('trade'),
      }))
    }

    // ── Shipping chokepoints ──────────────────────────────────────────────
    if (show('shipping')) {
      all.push(new ScatterplotLayer({
        id: 'disruption-fill',
        data: SHIPPING_DISRUPTIONS,
        getPosition: (d) => d.coordinates,
        getRadius: (d) => d.radius,
        getFillColor: (d) => [...(SEVERITY_COLOUR[d.severity] ?? [120, 120, 120]), 40],
        getLineColor: (d) => [...(SEVERITY_COLOUR[d.severity] ?? [120, 120, 120]), 180],
        lineWidthMinPixels: 1.5,
        stroked: true,
        pickable: true,
        onHover: hover('disruption'),
        onClick: ({ object }) => object && setSelected({ type: 'disruption', data: object }),
      }))
      all.push(new TextLayer({
        id: 'disruption-labels',
        data: SHIPPING_DISRUPTIONS,
        getPosition: (d) => d.coordinates,
        getText: (d) => `⚠ ${d.name}`,
        getSize: 11,
        getColor: (d) => (d.severity === 'CRITICAL' ? [255, 90, 90, 255] : [201, 168, 76, 220]),
        getTextAnchor: 'middle',
        fontFamily: '"IBM Plex Mono", monospace',
        characterSet: 'auto',
      }))
    }

    // ── Commodity production, as 3D columns ───────────────────────────────
    if (show('commodities')) {
      all.push(new ColumnLayer({
        id: 'commodity-columns',
        data: COMMODITY_SITES,
        getPosition: (d) => [d.lon, d.lat],
        // Log scale: Saudi crude at 9,800 kbd against lithium at 84 kt/yr is
        // a 100x spread, and a linear column would flatten everything else.
        getElevation: (d) => Math.log(d.production + 1) * 80000,
        getFillColor: (d) => [...d.color, 200],
        getLineColor: (d) => [...d.color, 255],
        radius: 45000,
        elevationScale: 1,
        extruded: true,
        pickable: true,
        material: { ambient: 0.7, diffuse: 0.6, shininess: 40, specularColor: [255, 255, 255] },
        onHover: hover('commodity'),
        onClick: ({ object }) => object && setSelected({ type: 'commodity', data: object }),
      }))
    }

    // ── Seismic ───────────────────────────────────────────────────────────
    if (show('seismic') && quakes.length) {
      all.push(new ScatterplotLayer({
        id: 'earthquakes',
        data: quakes,
        getPosition: (d) => d.coordinates,
        getRadius: (d) => Math.pow(2, d.magnitude) * 7000,
        getFillColor: (d) => (
          d.magnitude >= 7 ? [255, 50, 50, 170]
            : d.magnitude >= 6 ? [255, 120, 50, 145]
            : d.magnitude >= 5 ? [255, 180, 50, 115]
            : [200, 150, 50, 80]
        ),
        getLineColor: [255, 100, 50, 200],
        lineWidthMinPixels: 1,
        stroked: true,
        pickable: true,
        onHover: hover('earthquake'),
      }))
      // M6+ get a second, larger ring so a significant event is separable
      // from the background of routine M4.5s.
      if (majorQuakes.length) {
        all.push(new ScatterplotLayer({
          id: 'earthquakes-major',
          data: majorQuakes,
          getPosition: (d) => d.coordinates,
          getRadius: (d) => Math.pow(2, d.magnitude) * 14000,
          getFillColor: [255, 60, 60, 0],
          getLineColor: [255, 90, 90, 220],
          lineWidthMinPixels: 2,
          stroked: true,
          filled: false,
          pickable: true,
          onHover: hover('earthquake'),
        }))
      }
    }

    // ── Geopolitical ──────────────────────────────────────────────────────
    if (show('geopolitical')) {
      all.push(new ScatterplotLayer({
        id: 'geo-events',
        data: GEOPOLITICAL_EVENTS,
        getPosition: (d) => [d.lon, d.lat],
        getRadius: 90000,
        getFillColor: (d) => [...(SEVERITY_COLOUR[d.severity] ?? [201, 168, 76]), 55],
        getLineColor: (d) => [...(SEVERITY_COLOUR[d.severity] ?? [201, 168, 76]), 210],
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        onHover: hover('geopolitical'),
        onClick: ({ object }) => object && setSelected({ type: 'geopolitical', data: object }),
      }))
    }

    // ── Subsea cables ─────────────────────────────────────────────────────
    if (show('cables')) {
      all.push(new PathLayer({
        id: 'cables',
        data: UNDERSEA_CABLES,
        // Source data is [lat, lon]; deck.gl wants [lon, lat].
        getPath: (d) => d.path.map(([lat, lon]) => [lon, lat]),
        getColor: [100, 140, 255, 150],
        getWidth: 2,
        widthMinPixels: 1.5,
        pickable: true,
        onHover: hover('cable'),
      }))
    }

    // ── Strategic sites ───────────────────────────────────────────────────
    if (show('military')) {
      all.push(new ScatterplotLayer({
        id: 'bases',
        data: MILITARY_BASES,
        getPosition: (d) => [d.lon, d.lat],
        getRadius: 28000,
        getFillColor: [100, 100, 200, 120],
        getLineColor: [140, 140, 255, 210],
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        onHover: hover('military'),
      }))
    }

    // ── Exchanges — always on, they are the spine of the view ─────────────
    all.push(new ScatterplotLayer({
      id: 'exchange-glow',
      data: openExchanges,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: 130000,
      getFillColor: [45, 138, 80, pulseAlpha],
      getLineColor: [201, 168, 76, 70],
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      updateTriggers: { getFillColor: pulseAlpha },
    }))
    all.push(new ScatterplotLayer({
      id: 'exchanges',
      data: EXCHANGES,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: (d) => (isExchangeOpen(d) ? 38000 : 22000),
      getFillColor: (d) => (isExchangeOpen(d) ? [45, 138, 80, 220] : [74, 96, 128, 160]),
      getLineColor: (d) => (isExchangeOpen(d) ? [201, 168, 76, 255] : [74, 96, 128, 110]),
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      onHover: hover('exchange'),
      onClick: ({ object }) => {
        if (!object) return
        setSelected({ type: 'exchange', data: object })
        onExchangeSelect?.(object)
        flyTo({ longitude: object.lon, latitude: object.lat, zoom: 6, pitch: 50, bearing: 0 })
      },
    }))
    all.push(new TextLayer({
      id: 'exchange-labels',
      data: EXCHANGES,
      getPosition: (d) => [d.lon, d.lat],
      getText: (d) => d.id,
      getSize: 11,
      getColor: (d) => (isExchangeOpen(d) ? [201, 168, 76, 255] : [120, 140, 170, 190]),
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: [0, -26],
      fontFamily: '"IBM Plex Mono", monospace',
      fontWeight: 700,
      characterSet: 'auto',
    }))
    all.push(new TextLayer({
      id: 'exchange-change',
      data: EXCHANGES,
      getPosition: (d) => [d.lon, d.lat],
      getText: (d) => `${d.change >= 0 ? '▲' : '▼'} ${Math.abs(d.change).toFixed(2)}%`,
      getSize: 9,
      getColor: (d) => (d.change >= 0 ? [45, 138, 80, 210] : [168, 50, 50, 210]),
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: [0, -40],
      fontFamily: '"IBM Plex Mono", monospace',
      characterSet: 'auto',
    }))

    return all
  }, [activeLayer, quakes, majorQuakes, mapStyle, auFocus, pulseAlpha, hover, flyTo, onExchangeSelect])

  const shell = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999 }
    : { position: 'relative', width: '100%', height: '100%' }

  return (
    <div ref={wrapRef} style={{ ...shell, background: '#060D1A', overflow: 'hidden' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={{ dragRotate: true, touchRotate: true, keyboard: false, doubleClickZoom: true }}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        {MAP_STYLES[mapStyle] && (
          <Map mapStyle={MAP_STYLES[mapStyle]} reuseMaps attributionControl={false} />
        )}
      </DeckGL>

      {/* Vignette + top fade. Purely atmospheric, and inert to the pointer so
          they never intercept a click meant for the map. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
        background: 'radial-gradient(ellipse at center, transparent 58%, rgba(6,13,26,0.45) 100%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, pointerEvents: 'none', zIndex: 5,
        background: 'linear-gradient(to bottom, rgba(6,13,26,0.55), transparent)' }} />

      {tooltip && <MapTooltip tooltip={tooltip} />}

      <LayerPanel
        activeLayer={activeLayer} onLayerChange={setActiveLayer}
        mapStyle={mapStyle} onStyleChange={setMapStyle}
        auFocus={auFocus}
        onAuFocus={() => { setAuFocus((v) => !v); flyTo(AU_VIEW) }}
        onGlobal={() => { setAuFocus(false); flyTo(GLOBAL_VIEW) }}
      />

      {/* Fullscreen toggle */}
      <button
        onClick={() => setFullscreen((v) => !v)}
        title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
        style={{ position: 'absolute', top: 12, right: selected ? 324 : 12, zIndex: 25,
          background: 'rgba(6,13,26,0.88)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 2,
          color: '#8BA3C4', fontSize: 13, lineHeight: 1, padding: '6px 9px', cursor: 'pointer',
          backdropFilter: 'blur(8px)' }}
      >⤢</button>

      {selected && <MapDetailPanel object={selected} onClose={() => setSelected(null)} onFlyTo={flyTo} watchlist={watchlist} />}

      {/* Seismic status. Reports the feed's real state rather than only
          rendering when data happens to have arrived. */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10,
        background: 'rgba(6,13,26,0.9)', border: `1px solid ${quakeState === 'error' ? 'rgba(201,168,76,0.3)' : 'rgba(168,50,50,0.4)'}`,
        borderRadius: 3, padding: '4px 10px', fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 9, letterSpacing: '0.1em', color: quakeState === 'error' ? '#8BA3C4' : '#C86464' }}>
        {quakeState === 'loading' ? '◌ LOADING SEISMIC FEED…'
          : quakeState === 'error' ? '⚠ SEISMIC FEED UNAVAILABLE'
          : `🌍 ${quakes.length} QUAKES / WEEK (M4.5+) · ${majorQuakes.length} MAJOR (M6+)`}
      </div>
    </div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────
function MapTooltip({ tooltip }) {
  const { object, x, y, type } = tooltip
  const gold = { color: '#C9A84C', fontWeight: 700, marginBottom: 5 }
  const dim = { fontSize: 10, color: '#8BA3C4', lineHeight: 1.5 }

  const body = {
    exchange: () => (
      <>
        <div style={gold}>{object.flag} {object.id} — {object.city}</div>
        <div style={{ marginBottom: 3 }}>{object.index}</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{object.value.toLocaleString()}</div>
        <div style={{ color: object.change >= 0 ? '#2D8A50' : '#A83232', marginBottom: 5 }}>
          {object.change >= 0 ? '▲' : '▼'} {Math.abs(object.change)}%
        </div>
        <div style={{ fontSize: 10, color: isExchangeOpen(object) ? '#2D8A50' : '#637899' }}>
          {isExchangeOpen(object) ? '● OPEN NOW' : '○ CLOSED'}
        </div>
      </>
    ),
    trade: () => (
      <>
        <div style={gold}>TRADE ROUTE</div>
        <div style={{ marginBottom: 2 }}>{object.exports}</div>
        <div style={dim}>A${object.value}B annually</div>
        {object.disrupted && <div style={{ color: '#A83232', marginTop: 4, fontSize: 10 }}>⚠ DISRUPTED</div>}
      </>
    ),
    disruption: () => (
      <>
        <div style={{ color: '#A83232', fontWeight: 700, marginBottom: 4 }}>⚠ {object.severity} — {object.name}</div>
        <div style={dim}>{object.detail.slice(0, 110)}…</div>
        <div style={{ color: '#C9A84C', fontSize: 10, marginTop: 4 }}>{object.impact}</div>
      </>
    ),
    earthquake: () => (
      <>
        <div style={{ color: object.magnitude >= 6 ? '#A83232' : '#C9A84C', fontWeight: 700, marginBottom: 4 }}>
          M{object.magnitude?.toFixed(1)} EARTHQUAKE
        </div>
        <div style={dim}>{object.place}</div>
        <div style={{ fontSize: 10, color: '#4A6080', marginTop: 2 }}>Depth {Math.round(object.depth)}km</div>
      </>
    ),
    commodity: () => (
      <>
        <div style={gold}>{object.commodity}</div>
        <div style={{ marginBottom: 2 }}>{object.country}</div>
        <div style={dim}>{object.production} {object.unit}</div>
        <div style={{ fontSize: 10, color: '#4A6080', marginTop: 3 }}>{object.companies.join(', ')}</div>
      </>
    ),
    geopolitical: () => (
      <>
        <div style={{ color: '#A83232', fontWeight: 700, marginBottom: 4 }}>{object.title}</div>
        <div style={{ ...dim, marginBottom: 4 }}>{object.summary}</div>
        <div style={{ fontSize: 10, color: '#C9A84C' }}>ASX: {object.asxExposure}</div>
      </>
    ),
    cable: () => (
      <>
        <div style={{ color: '#6496FF', fontWeight: 700, marginBottom: 4 }}>{object.name}</div>
        <div style={dim}>Capacity {object.capacity}</div>
        <div style={{ fontSize: 10, color: '#4A6080' }}>{object.owner}</div>
      </>
    ),
    military: () => (
      <>
        <div style={{ color: '#8C8CFF', fontWeight: 700, marginBottom: 4 }}>✦ {object.name}</div>
        <div style={{ ...dim, marginBottom: 2 }}>{object.country} · {object.type}</div>
        <div style={{ fontSize: 10, color: '#4A6080', lineHeight: 1.5 }}>{object.significance}</div>
      </>
    ),
  }[type]

  if (!body) return null

  // Clamped so a hover near an edge doesn't open the card off-screen.
  const left = Math.min(x + 14, window.innerWidth - 250)
  const top = Math.min(Math.max(y - 10, 8), window.innerHeight - 190)

  return (
    <div style={{
      position: 'fixed', left, top, zIndex: 1000, maxWidth: 230,
      background: 'rgba(6,13,26,0.96)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 4,
      padding: '10px 14px', fontFamily: '"IBM Plex Mono", monospace', fontSize: 11,
      color: '#E8EDF5', pointerEvents: 'none', lineHeight: 1.4,
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    }}>
      {body()}
    </div>
  )
}

// ── Layer + view controls ──────────────────────────────────────────────────
const LAYERS = [
  { id: 'all',          label: '⊞ ALL LAYERS' },
  { id: 'trade',        label: '⇄ TRADE FLOWS' },
  { id: 'shipping',     label: '⚓ SHIPPING RISK' },
  { id: 'commodities',  label: '⛏ COMMODITIES' },
  { id: 'seismic',      label: '🌍 SEISMIC' },
  { id: 'geopolitical', label: '⚔ GEOPOLITICAL' },
  { id: 'cables',       label: '⌁ DATA CABLES' },
  { id: 'military',     label: '✦ STRATEGIC' },
]

const STYLES = [
  { id: 'dark', label: 'DARK' },
  { id: 'minimal', label: 'MIN' },
  { id: 'night', label: 'NIGHT' },
  { id: 'intel', label: 'INTEL' },
]

const btn = (active) => ({
  background: active ? 'rgba(201,168,76,0.18)' : 'rgba(6,13,26,0.88)',
  border: `1px solid rgba(201,168,76,${active ? 0.6 : 0.12})`,
  borderRadius: 2,
  padding: '5px 10px',
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: 9,
  letterSpacing: '0.1em',
  color: active ? '#C9A84C' : '#637899',
  cursor: 'pointer',
  textAlign: 'left',
  backdropFilter: 'blur(8px)',
  whiteSpace: 'nowrap',
  transition: 'color .15s, border-color .15s, background-color .15s',
})

function LayerPanel({ activeLayer, onLayerChange, mapStyle, onStyleChange, auFocus, onAuFocus, onGlobal }) {
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: 3,
      maxHeight: 'calc(100% - 90px)', overflowY: 'auto' }}>
      {LAYERS.map((l) => (
        <button key={l.id} onClick={() => onLayerChange(l.id)} style={btn(activeLayer === l.id)}>
          {l.label}
        </button>
      ))}

      <div style={{ height: 1, background: 'rgba(201,168,76,0.1)', margin: '3px 0' }} />

      <div style={{ display: 'flex', gap: 3 }}>
        {STYLES.map((s) => (
          <button key={s.id} onClick={() => onStyleChange(s.id)}
            style={{ ...btn(mapStyle === s.id), flex: 1, padding: '5px 3px', fontSize: 8, textAlign: 'center' }}>
            {s.label}
          </button>
        ))}
      </div>

      <button onClick={onAuFocus} style={btn(auFocus)}>🇦🇺 AU FOCUS</button>
      <button onClick={onGlobal} style={btn(false)}>🌐 GLOBAL VIEW</button>
    </div>
  )
}
