import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { Map } from 'react-map-gl/maplibre'
import { ScatterplotLayer, TextLayer, ArcLayer, ColumnLayer, PathLayer, GeoJsonLayer } from '@deck.gl/layers'
import { HeatmapLayer, HexagonLayer } from '@deck.gl/aggregation-layers'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  EXCHANGES, TRADE_ROUTES, SHIPPING_DISRUPTIONS, COMMODITY_SITES,
  GEOPOLITICAL_EVENTS, UNDERSEA_CABLES, MILITARY_BASES, MAJOR_CITIES,
  SEVERITY_COLOUR, isExchangeOpen,
  overlayNarrative, SHIPPING_NARRATIVE_FIELDS, GEO_NARRATIVE_FIELDS,
} from './intelMapData'
import MapDetailPanel from './MapDetailPanel'
import { liveDataService } from '../../services/liveDataService'
import { aiContentService } from '../../services/aiContentService'

// ── Basemaps ──────────────────────────────────────────────────────────────
//
// Four styles, none of which needs an API key.
//
// SATELLITE is ESRI's World Imagery service. It is genuine satellite
// photography, served free without registration, and it is the one style
// that makes this look like a real intelligence product rather than a chart
// with a map behind it.
//
// MapLibre takes either a style URL or a full style object; a raster tile
// service is not a style, so it gets wrapped in the minimal one that renders
// it. Written as a helper because satellite and terrain differ only by URL.
//
// INTELLIGENCE renders no tiles at all, leaving our own layers on black.
// That is both the most legible for dense data and the cheapest to draw, and
// it is the only style guaranteed to work with no network at all.
const rasterStyle = (url, attribution) => ({
  version: 8,
  sources: {
    base: { type: 'raster', tiles: [url], tileSize: 256, maxzoom: 19, attribution },
  },
  layers: [{ id: 'base', type: 'raster', source: 'base' }],
})

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'

const MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: rasterStyle(
    `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    'Imagery © Esri, Maxar, Earthstar Geographics',
  ),
  terrain: rasterStyle(
    `${ESRI}/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}`,
    'Relief © Esri',
  ),
  intel: null,
}

const STYLE_OPTIONS = [
  { id: 'dark',      label: 'DARK' },
  { id: 'satellite', label: 'SATELLITE' },
  { id: 'terrain',   label: 'TERRAIN' },
  { id: 'intel',     label: 'INTELLIGENCE' },
]

// ── Layer catalogue ───────────────────────────────────────────────────────
// One entry per toggleable layer. `dot` is the colour the panel shows beside
// the label, so the legend and the map cannot drift apart — the panel reads
// this table rather than repeating the colours.
const LAYER_CATALOGUE = [
  { id: 'exchanges',    label: 'Exchange Markets',  dot: '#C9A84C', on: true },
  { id: 'trade',        label: 'Trade Flows',       dot: '#4A9EDB', on: true },
  { id: 'shipping',     label: 'Shipping Risk',     dot: '#C86464', on: false },
  { id: 'commodities',  label: 'Commodity Sites',   dot: '#D9A441', on: false },
  { id: 'seismic',      label: 'Seismic Activity',  dot: '#A83232', on: false },
  { id: 'geopolitical', label: 'Geopolitical',      dot: '#FF6D00', on: false },
  { id: 'cables',       label: 'Data Cables',       dot: '#4ADBD0', on: false },
  { id: 'military',     label: 'Strategic Assets',  dot: '#8C8CFF', on: false },
  { id: 'countries',    label: 'Market Performance', dot: '#2D8A50', on: false },
  { id: 'marketcap',    label: 'Market Cap Columns', dot: '#C9A84C', on: false },
  { id: 'density',      label: 'Economic Density',  dot: '#7BE495', on: false },
  { id: 'citylights',   label: 'City Lights',       dot: '#FFE4B5', on: true },
]

// Natural Earth's NAME field for each country an exchange sits in. Written
// out rather than matched fuzzily because these names have exact forms —
// "United States of America", not "United States" — and a near-miss would
// silently colour nothing.
const EXCHANGE_COUNTRY = {
  'Australia': 'ASX',
  'United States of America': 'NYSE',
  'United Kingdom': 'LSE',
  'Japan': 'TSE',
  'Hong Kong S.A.R.': 'HKEX',
  'China': 'SSE',
  'Singapore': 'SGX',
  'Germany': 'FSE',
  'India': 'BSE',
  'Canada': 'TSX',
  'Brazil': 'B3',
  'South Korea': 'KRX',
  'Switzerland': 'SIX',
  'France': 'EPA',
  'New Zealand': 'NZX',
}

const DEFAULT_LAYERS = Object.fromEntries(LAYER_CATALOGUE.map((l) => [l.id, l.on]))
const LAYERS_KEY = 'maddex_map_layers'

const AU_VIEW     = { longitude: 134.0, latitude: -25.0, zoom: 3.5, pitch: 45, bearing: 0 }
const GLOBAL_VIEW = { longitude: 60.0,  latitude: 15.0,  zoom: 1.4, pitch: 30, bearing: 0 }

// Opens on Australia. This is an Australian investor's terminal, so the
// home frame is the one they care about; GLOBAL VIEW in the layer panel is
// one click away for the world.
//
// Note this is the camera only — auFocus stays false, so all global trade
// routes still draw. It is a starting position, not a filter.
const INITIAL_VIEW = AU_VIEW

// Ease-in-out cubic — the camera should settle rather than arrive abruptly.
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// Country outlines from Natural Earth, fetched once and cached in memory.
//
// This is the one geographic source with no tile server, no key and no rate
// limit behind it — which is why it is also the fallback that keeps the map
// legible if a basemap ever fails again. 110m resolution is the small file
// (~250KB); at the zooms this map uses, anything finer is wasted bytes.
//
// Fetched lazily, only when a layer that needs it is switched on, so the
// common case of looking at trade arcs never pays for it.
const NE_COUNTRIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

let countriesPromise = null

function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch(NE_COUNTRIES_URL)
      .then((r) => { if (!r.ok) throw new Error(`Natural Earth HTTP ${r.status}`); return r.json() })
      .catch((err) => {
        console.warn('[DeckGLMap] country outlines unavailable:', err.message)
        countriesPromise = null   // let a later toggle retry
        return null
      })
  }
  return countriesPromise
}

function useCountries(enabled) {
  const [countries, setCountries] = useState(null)
  useEffect(() => {
    if (!enabled || countries) return
    let alive = true
    loadCountries().then((d) => { if (alive && d) setCountries(d) })
    return () => { alive = false }
  }, [enabled, countries])
  return countries
}

// Refreshes the narrative on the shipping and geopolitical rows once a day
// from MaddenAI. Structure (coordinates, radii, routes) is never touched —
// see overlayNarrative in intelMapData for why that boundary exists.
//
// Both requests are settled independently: geopolitics failing should not
// cost us fresher shipping prose, which is the mistake the seismic feed made
// before it moved to liveDataService.
function useIntelNarratives() {
  const [shipping, setShipping] = useState(SHIPPING_DISRUPTIONS)
  const [geo, setGeo] = useState(GEOPOLITICAL_EVENTS)
  const [source, setSource] = useState('fallback')

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      aiContentService.getShippingStatus(),
      aiContentService.getGeopoliticalRisks(),
    ]).then(([ship, risk]) => {
      if (!alive) return
      if (ship.status === 'fulfilled' && Array.isArray(ship.value.data)) {
        setShipping(overlayNarrative(SHIPPING_DISRUPTIONS, ship.value.data, SHIPPING_NARRATIVE_FIELDS))
        setSource(ship.value.source)
      }
      if (risk.status === 'fulfilled' && Array.isArray(risk.value.data)) {
        setGeo(overlayNarrative(GEOPOLITICAL_EVENTS, risk.value.data, GEO_NARRATIVE_FIELDS))
      }
    })
    return () => { alive = false }
  }, [])

  return { shipping, geo, source }
}

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
  // Per-layer visibility, persisted: someone who turns off eight layers to
  // study trade flows should not have to do it again next time.
  const [layerOn, setLayerOn] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? 'null')
      return saved ? { ...DEFAULT_LAYERS, ...saved } : DEFAULT_LAYERS
    } catch { return DEFAULT_LAYERS }
  })

  const toggleLayer = useCallback((id) => {
    setLayerOn((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(LAYERS_KEY, JSON.stringify(next)) } catch { /* best-effort */ }
      return next
    })
  }, [])
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
  const { shipping: shippingRows, geo: geoRows, source: narrativeSource } = useIntelNarratives()

  // Country outlines drive both the market-performance fill and the density
  // hexagons, so one fetch serves both.
  const countries = useCountries(layerOn.countries || layerOn.density)

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
    const show = (id) => !!layerOn[id]
    const openExchanges = EXCHANGES.filter(isExchangeOpen)

    // ── Country fills, coloured by that market's performance ─────────────
    // Drawn first so everything else sits on top of it. Countries with no
    // exchange stay near-black rather than being dropped: an absent country
    // reads as missing land, which is worse than reading as "no data".
    if (show('countries') && countries) {
      all.push(new GeoJsonLayer({
        id: 'country-performance',
        data: countries,
        stroked: true,
        filled: true,
        getFillColor: (f) => {
          const ex = EXCHANGES.find((e) => e.id === EXCHANGE_COUNTRY[f.properties?.NAME])
          if (!ex) return [10, 15, 26, 190]
          // Saturation scales with the size of the move, capped at 2% so one
          // outlier does not flatten every other country to the same shade.
          const t = Math.min(Math.abs(ex.change) / 2, 1)
          return ex.change >= 0
            ? [20, 60 + t * 90, 40 + t * 45, 210]
            : [60 + t * 110, 20, 30 + t * 20, 210]
        },
        getLineColor: [201, 168, 76, 55],
        lineWidthMinPixels: 0.5,
        pickable: true,
        onHover: hover('country'),
        updateTriggers: { getFillColor: [countries] },
      }))
    }

    // ── Economic density ─────────────────────────────────────────────────
    // Hexagons binned over major cities, weighted by population and extruded.
    // The effect is a cityscape: economic concentration reads as skyline
    // height rather than as another colour ramp competing with everything
    // else on the map.
    if (show('density')) {
      all.push(new HexagonLayer({
        id: 'economic-density',
        data: MAJOR_CITIES,
        getPosition: (d) => [d.lon, d.lat],
        getElevationWeight: (d) => d.pop,
        elevationAggregation: 'SUM',
        radius: 220000,
        elevationScale: 380,
        extruded: true,
        coverage: 0.82,
        opacity: 0.42,
        colorRange: [
          [24, 60, 48], [34, 92, 68], [50, 128, 88],
          [86, 168, 108], [130, 200, 134], [180, 228, 168],
        ],
        pickable: false,
      }))
    }

    // ── Market cap columns ───────────────────────────────────────────────
    // Height is the cube root of market cap, not the raw value. NYSE is over
    // twenty times the ASX; drawn linearly it is a spike that dwarfs every
    // other exchange into invisibility, which tells you one fact and hides
    // fourteen.
    if (show('marketcap')) {
      all.push(new ColumnLayer({
        id: 'marketcap-columns',
        data: EXCHANGES,
        diskResolution: 16,
        radius: 95000,
        extruded: true,
        elevationScale: 1,
        getPosition: (d) => [d.lon, d.lat],
        getElevation: (d) => Math.cbrt(d.marketCap) * 900,
        getFillColor: (d) => (d.change >= 0 ? [45, 138, 80, 205] : [168, 50, 50, 205]),
        getLineColor: [201, 168, 76, 120],
        pickable: true,
        onHover: hover('exchange'),
        onClick: ({ object }) => object && setSelected({ type: 'exchange', data: object }),
      }))
    }

    if (show('citylights')) {
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
        data: shippingRows,
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
        data: shippingRows,
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
        data: geoRows,
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

    // ── Exchanges — the spine of the view, but still toggleable ──────────
    if (!show('exchanges')) return all

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
  }, [layerOn, quakes, majorQuakes, auFocus, pulseAlpha, hover, flyTo, onExchangeSelect, shippingRows, geoRows, countries])

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
        layerOn={layerOn} onToggleLayer={toggleLayer}
        mapStyle={mapStyle} onStyleChange={setMapStyle}
        auFocus={auFocus}
        onAuFocus={() => { setAuFocus((v) => !v); flyTo(AU_VIEW) }}
        onGlobal={() => { setAuFocus(false); flyTo(GLOBAL_VIEW) }}
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
          watchlist={watchlist} width={panelWidth} narrativeSource={narrativeSource} />
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
  whiteSpace: 'nowrap',
  transition: 'color .15s, border-color .15s, background-color .15s',
})

// ── Layer + view controls ──────────────────────────────────────────────────
// ── Layer + view controls ──────────────────────────────────────────────────
//
// A tab on the left edge that expands into a 200px overlay panel.
//
// The previous version was a permanent stack of buttons 136px wide and 320px
// tall, sitting over the map. On a wide screen that was tolerable; at 1280px
// the map is about 560px across and the panel occluded a quarter of the
// visible world at all times. A tab costs 22px and gives that back.
//
// It opens on the LEFT and stops at 200px so the centre of the map — where
// the thing you are looking at usually is — stays clear.
const PANEL_W = 200

function LayerPanel({ layerOn, onToggleLayer, mapStyle, onStyleChange, auFocus, onAuFocus, onGlobal }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Collapsed tab — always present, so the panel is never lost */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-expanded={false}
          title="Show intelligence layers"
          style={{
            position: 'absolute', top: 12, left: 0, zIndex: Z.CHROME,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(6,13,26,0.9)',
            border: '1px solid rgba(201,168,76,0.25)', borderLeft: 'none',
            borderRadius: '0 3px 3px 0',
            padding: '7px 9px',
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            letterSpacing: '0.14em', color: '#C9A84C', cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: 11, lineHeight: 1 }}>⟨</span>
          <span>LAYERS</span>
        </button>
      )}

      {open && (
        <div
          style={{
            position: 'absolute', top: 12, left: 12, zIndex: Z.CHROME,
            width: PANEL_W, maxHeight: 'calc(100% - 84px)',
            display: 'flex', flexDirection: 'column',
            background: 'rgba(6,13,26,0.94)',
            border: '1px solid rgba(201,168,76,0.28)', borderRadius: 3,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
            animation: 'panelSlideIn .16s ease-out',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderBottom: '1px solid rgba(201,168,76,0.18)',
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            letterSpacing: '0.14em', color: '#C9A84C', flexShrink: 0,
          }}>
            <span>INTELLIGENCE LAYERS</span>
            <button onClick={() => setOpen(false)} aria-label="Hide layers"
              style={{ background: 'none', border: 'none', color: '#637899', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>
          </div>

          <div className="thin-scrollbar" style={{ overflowY: 'auto', padding: '5px 0', minHeight: 0 }}>
            {LAYER_CATALOGUE.map((l) => {
              const on = !!layerOn[l.id]
              return (
                <button
                  key={l.id}
                  onClick={() => onToggleLayer(l.id)}
                  role="switch"
                  aria-checked={on}
                  className="map-layer-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '5px 10px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
                    color: on ? '#E8EDF5' : '#637899',
                  }}
                >
                  {/* Drawn rather than a native checkbox so it matches the
                      terminal's square, unrounded language. */}
                  <span style={{
                    width: 11, height: 11, flexShrink: 0, borderRadius: 2,
                    border: `1px solid ${on ? 'rgba(201,168,76,0.8)' : 'rgba(99,120,153,0.45)'}`,
                    background: on ? 'rgba(201,168,76,0.85)' : 'transparent',
                    color: '#060D1A', fontSize: 9, lineHeight: '9px', textAlign: 'center',
                  }}>{on ? '✓' : ''}</span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.label}</span>
                  {/* The legend reads its colour from the same table the map
                      draws from, so the two cannot drift apart. */}
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: l.dot, opacity: on ? 1 : 0.3,
                  }} />
                </button>
              )
            })}
          </div>

          <div style={{ borderTop: '1px solid rgba(201,168,76,0.18)', padding: '7px 10px', flexShrink: 0 }}>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 8, letterSpacing: '0.14em', color: '#4A6080', marginBottom: 5 }}>
              MAP STYLE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              {STYLE_OPTIONS.map((st) => (
                <button key={st.id} onClick={() => onStyleChange(st.id)}
                  style={{ ...btn(mapStyle === st.id), padding: '4px 5px', fontSize: 8, textAlign: 'center' }}>
                  {st.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
              <button onClick={onAuFocus} style={{ ...btn(auFocus), flex: 1, padding: '4px 5px', fontSize: 8, textAlign: 'center' }}>🇦🇺 AU</button>
              <button onClick={onGlobal} style={{ ...btn(false), flex: 1, padding: '4px 5px', fontSize: 8, textAlign: 'center' }}>🌐 GLOBAL</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
