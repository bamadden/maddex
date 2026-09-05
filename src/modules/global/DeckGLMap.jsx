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
import { liveDataService } from '../../services/liveDataService'

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

const AU_VIEW     = { longitude: 134.0, latitude: -25.0, zoom: 3.5, pitch: 45, bearing: 0 }
const GLOBAL_VIEW = { longitude: 60.0,  latitude: 15.0,  zoom: 1.4, pitch: 30, bearing: 0 }

// Opens on the world, not on Australia. At the previous zoom 3.2 over
// 134°E/25°S the frame was almost entirely the Indian Ocean: no chokepoints,
// no exchanges, and the trade arcs all left the viewport within a few hundred
// pixels of their origin. Every layer this map draws is global, so the
// default camera has to be too. AU FOCUS is one click away for the AU view.
const INITIAL_VIEW = GLOBAL_VIEW

// Ease-in-out cubic — the camera should settle rather than arrive abruptly.
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// Stacking order for everything that floats over the map, in one place.
// These used to be scattered literals, which is how the view toggle (20) and
// the fullscreen button (25) ended up sharing the top-right corner with the
// higher number silently painting over the lower one.
const Z = {
  ATMOSPHERE: 5,    // vignette + top fade, pointer-events: none
  CHROME: 10,       // layer panel, seismic status
  PANEL: 20,        // selection detail panel
  CONTROL: 25,      // fullscreen toggle — must stay clickable above PANEL
  TOOLTIP: 1000,    // hover card, position: fixed, above all map chrome
}

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
  const [mapWidth, setMapWidth] = useState(null)
  const wrapRef = useRef(null)
  const mapRef = useRef(null)

  // The overlays size themselves against the map, not the viewport: the map
  // is one of three columns, so a 1440px window can still leave it under
  // 700px wide. Measuring the element is the only way to know.
  // Returns true once the basemap is correctly sized AND its style is live,
  // which is the point at which it will actually request tiles.
  //
  // Both conditions matter. Sizing the canvas is not enough on its own:
  // MapLibre computes tile coverage from its internal transform, and a
  // transform built while the container was collapsed covers nothing, so the
  // map sat there having fetched style.json and the sprite but not a single
  // vector tile. Resizing after the style is loaded rebuilds that transform
  // and the tiles follow.
  const resizeBasemap = useCallback(() => {
    const m = mapRef.current?.getMap?.() ?? mapRef.current
    const el = wrapRef.current
    if (!m?.resize || !el) return false
    const canvas = el.querySelector('canvas.maplibregl-canvas')
    if (!canvas) return false
    const sized = Math.abs(canvas.getBoundingClientRect().width - el.clientWidth) < 1
    const styled = m.isStyleLoaded?.() ?? true
    if (sized && styled) return true
    m.resize()
    return false
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      setMapWidth(entry.contentRect.width)
      resizeBasemap()
    })
    ro.observe(el)
    setMapWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [resizeBasemap])

  // The ResizeObserver alone cannot correct the basemap's initial size: it
  // fires once on observe, before <Map> has mounted and while mapRef is
  // still null, and the container never changes size afterwards so it never
  // fires again. react-map-gl's onLoad is not an option either — under
  // DeckGL it does not fire at all (verified: the handler never ran).
  //
  // So the map is nudged on a short interval until the basemap canvas
  // matches the container, then left alone. Bounded at 4s so a genuinely
  // absent basemap ('intel' style is deliberately null) does not spin.
  useEffect(() => {
    if (!MAP_STYLES[mapStyle]) return
    const started = Date.now()
    const id = setInterval(() => {
      if (resizeBasemap() || Date.now() - started > 4000) clearInterval(id)
    }, 150)
    return () => clearInterval(id)
  }, [mapStyle, resizeBasemap])

  // The detail panel takes 300px where there is room and 40% of the map
  // where there is not, so it never swallows more than a third of the view.
  const panelWidth = mapWidth == null ? 300 : Math.round(Math.max(220, Math.min(300, mapWidth * 0.4)))

  // ── Live seismic feed ───────────────────────────────────────────────────
  // Routed through liveDataService so this shares the app's cache and its
  // stale-on-failure fallback. The previous inline version used Promise.all
  // over both USGS feeds, so a single slow or failed request blanked the
  // whole layer; the service settles each feed independently and keeps the
  // last good payload.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [week, major] = await Promise.all([
        liveDataService.getEarthquakes(4.5),
        liveDataService.getEarthquakes(6.0),
      ])
      if (cancelled) return
      const rows = week.data ?? []
      setQuakes(rows)
      setMajorQuakes((major.data ?? []).filter((q) => q.magnitude >= 6))
      setQuakeState(week.source === 'failed' ? 'error' : 'ready')
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

  // info.x / info.y are relative to deck's own canvas, while the tooltip is
  // position: fixed and so is placed in viewport coordinates. Those agree
  // only when the map sits at the window's top-left, which it never does —
  // it is the middle of three columns — so the card used to open one
  // map-origin (~364px) left and above the cursor, over the news feed.
  //
  // The originating pointer event already carries viewport coordinates, so
  // it is the source of truth here; info.x/y remain the fallback for a
  // synthetic hover with no source event behind it.
  const hover = useCallback((type) => (info, event) => {
    const { object, x, y } = info
    if (!object) return setTooltip(null)
    const src = event?.srcEvent
    setTooltip({ object, type, x: src?.clientX ?? x, y: src?.clientY ?? y })
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
          <Map
            ref={mapRef}
            mapStyle={MAP_STYLES[mapStyle]}
            reuseMaps
            attributionControl={false}
            // MapLibre reads its container's size once, at construction, and
            // that moment is inside a lazy/Suspense boundary where the box is
            // still collapsed — so the basemap canvas stayed pinned at its
            // 300x150 default while deck.gl's own canvas filled the 556x420
            // container. That mismatch is why the map drew arcs and markers
            // over a blank dark rectangle with no coastlines: deck.gl
            // measures itself, MapLibre does not.
            //
            // Correcting it is handled by the effect in the parent, not by
            // an onLoad prop here: under DeckGL that callback never fires.
          />
        )}
      </DeckGL>

      {/* Vignette + top fade. Purely atmospheric, and inert to the pointer so
          they never intercept a click meant for the map. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: Z.ATMOSPHERE,
        background: 'radial-gradient(ellipse at center, transparent 58%, rgba(6,13,26,0.45) 100%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, pointerEvents: 'none', zIndex: Z.ATMOSPHERE,
        background: 'linear-gradient(to bottom, rgba(6,13,26,0.55), transparent)' }} />

      {tooltip && <MapTooltip tooltip={tooltip} />}

      <LayerPanel
        activeLayer={activeLayer} onLayerChange={setActiveLayer}
        mapStyle={mapStyle} onStyleChange={setMapStyle}
        auFocus={auFocus}
        onAuFocus={() => { setAuFocus((v) => !v); flyTo(AU_VIEW) }}
        onGlobal={() => { setAuFocus(false); flyTo(GLOBAL_VIEW) }}
        mapWidth={fullscreen ? window.innerWidth : mapWidth}
      />

      {/* Fullscreen toggle */}
      <button
        onClick={() => setFullscreen((v) => !v)}
        title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
        style={{ position: 'absolute', top: 12, right: selected ? panelWidth + 24 : 12, zIndex: Z.CONTROL,
          background: 'rgba(6,13,26,0.88)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 2,
          color: '#8BA3C4', fontSize: 13, lineHeight: 1, padding: '6px 9px', cursor: 'pointer',
          backdropFilter: 'blur(8px)' }}
      >⤢</button>

      {selected && (
        <MapDetailPanel object={selected} onClose={() => setSelected(null)} onFlyTo={flyTo}
          watchlist={watchlist} width={panelWidth} />
      )}

      {/* Seismic status. Reports the feed's real state rather than only
          rendering when data happens to have arrived. */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: Z.CHROME,
        maxWidth: 'calc(100% - 24px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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

  // x and y arrive already translated into viewport coordinates by the
  // hover handler — see the note there.
  //
  // Near the right edge it FLIPS to the left of the cursor rather than
  // pinning at the edge: pinning slid the card back under the pointer, which
  // on a map means it covers the very marker you are reading about.
  const W = 244   // maxWidth 230 + padding
  const H = 190   // tallest body, measured
  const M = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = x + 14 + W > vw - M ? Math.max(M, x - 14 - W) : x + 14
  const top = Math.min(Math.max(y - 10, M), Math.max(M, vh - H - M))

  return (
    <div style={{
      position: 'fixed', left, top, zIndex: Z.TOOLTIP, maxWidth: 230,
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

// The stack of layer buttons is 136px wide and 320px tall. Over a 1400px+
// map that is a reasonable permanent fixture; over the ~560px map you get at
// 1280px viewport width it occludes a quarter of the visible world. So below
// `WIDE_MAP_PX` it starts collapsed behind a single button and opens on
// demand — the controls stay one click away instead of always in the way.
const WIDE_MAP_PX = 1400

function LayerPanel({ activeLayer, onLayerChange, mapStyle, onStyleChange, auFocus, onAuFocus, onGlobal, mapWidth }) {
  const wide = mapWidth == null || mapWidth >= WIDE_MAP_PX
  const [open, setOpen] = useState(wide)

  // Follow the breakpoint on resize, but only when it actually crosses it —
  // re-running on every pixel would fight the user's own toggle.
  const wasWide = useRef(wide)
  useEffect(() => {
    if (wide !== wasWide.current) { wasWide.current = wide; setOpen(wide) }
  }, [wide])

  const active = LAYERS.find((l) => l.id === activeLayer)

  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: Z.CHROME,
      display: 'flex', flexDirection: 'column', gap: 3,
      maxHeight: 'calc(100% - 90px)', overflowY: 'auto', overflowX: 'hidden' }}>
      {!wide && (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Hide layer controls' : 'Show layer controls'}
          style={{ ...btn(open), display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>{open ? '×' : '☰'}</span>
          <span>{open ? 'LAYERS' : (active?.label ?? 'LAYERS')}</span>
        </button>
      )}

      {open && (
        <>
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
        </>
      )}
    </div>
  )
}
