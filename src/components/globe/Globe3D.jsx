import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import * as THREE from 'three'
import * as topojson from 'topojson-client'
import { EXCHANGES, subsolarPoint } from '../../data/globeExchanges'
import { BG_COLOR } from '../visualisations/shared3d'

// ─── Earth from space ───────────────────────────────────────────────────────
//
// The previous globe was geometrically correct and visually dead: a flat dark
// sphere with a painted texture, no atmosphere, no glow, and borders that
// disappeared against the ocean. It read as a diagram of a planet.
//
// This is built in layers, the way the thing actually looks from orbit:
//
//   stars           the backdrop, so the globe sits IN something
//   globe shader    ocean/land, day/night terminator, graticule
//   borders         real coastlines as gold LineSegments, not painted pixels
//   city lights     warm points that only appear on the dark side
//   exchange rings  three concentric pulses per open market
//   trade arcs      great circles with a travelling dash
//   atmosphere      backside-rendered fresnel shell — the blue halo
//   bloom           what makes the lights read as light rather than dots
//
// Bloom is doing the heaviest lifting. Without it the markers are flat
// coloured circles; with it they glow, and the whole image stops looking like
// a chart.

const GLOBE_RADIUS = 5
const RAD = Math.PI / 180

// Camera distance. The atmosphere shell is 1.16x the globe, so sitting close
// enough to crop the planet also crops the halo — which is the one element
// that sells "from orbit". 15 puts the whole disc plus its glow in frame.
const CAM_DISTANCE = 15

// Shared by every layer — texture, borders, markers and arcs all have to
// agree on where a coordinate is, or the lights sit in the ocean.
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * RAD
  const theta = (lon + 180) * RAD
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

// Opens looking at Australia — same reasoning as the intel map's home frame.
// Derived from the coordinate helper rather than hand-tuned XYZ, so it stays
// correct if the projection convention ever changes.
const AU_CAMERA = (() => {
  const v = latLonToVector3(-25, 134, CAM_DISTANCE)
  return [v.x, v.y, v.z]
})()

// ─── Globe surface ──────────────────────────────────────────────────────────
// Land is sampled from a coastline mask rendered once to a canvas. Doing it
// in the shader from a texture rather than as geometry keeps the day/night
// terminator a per-pixel effect, so the light line across the planet is
// smooth rather than stepping between polygons.

const globeVertex = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const globeFragment = /* glsl */`
  uniform sampler2D landMask;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    float land = texture2D(landMask, vUv).r;

    vec3 ocean    = vec3(0.012, 0.040, 0.105);
    vec3 landDay  = vec3(0.040, 0.092, 0.070);
    vec3 landNight= vec3(0.030, 0.043, 0.062);
    vec3 oceanNight = vec3(0.004, 0.010, 0.032);

    // Terminator. smoothstep over a band rather than a hard dot product, so
    // the day/night edge is a soft twilight the width of a real one.
    float sun = dot(normalize(vWorldPos), normalize(sunDirection));
    float night = smoothstep(0.18, -0.22, sun);

    vec3 dayCol   = mix(ocean, landDay, land);
    vec3 nightCol = mix(oceanNight, landNight, land);
    vec3 col = mix(dayCol, nightCol, night);

    // Warm rim exactly on the terminator — sunrise seen edge-on.
    float twilight = smoothstep(0.0, 0.30, sun) * smoothstep(0.42, 0.05, sun);
    col += vec3(0.26, 0.12, 0.04) * twilight * 0.18;

    // Graticule. Every 15 degrees, and faint — it should read as a grid you
    // notice second, not a cage over the planet.
    float latLine = abs(fract(vUv.y * 12.0) - 0.5);
    float lonLine = abs(fract(vUv.x * 24.0) - 0.5);
    float grid = max(smoothstep(0.48, 0.5, latLine), smoothstep(0.48, 0.5, lonLine));
    col += vec3(0.05, 0.16, 0.28) * grid * 0.22;

    // Fresnel on the surface itself, under the atmosphere shell, so the limb
    // brightens rather than ending abruptly against space.
    float fres = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
    col += vec3(0.04, 0.13, 0.34) * fres * 0.45;

    gl_FragColor = vec4(col, 1.0);
  }
`

// ─── Atmosphere ─────────────────────────────────────────────────────────────
// A larger sphere rendered from the inside (BackSide). Because we only see
// its far wall, the fresnel term peaks around the planet's edge, which is
// what produces a halo rather than a glowing ball.

const atmosphereFragment = /* glsl */`
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
    gl_FragColor = vec4(0.16, 0.42, 0.95, 1.0) * intensity;
  }
`

const atmosphereVertex = /* glsl */`
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Renders coastlines to an offscreen canvas as a red-channel land mask. Only
// the mask goes to the GPU — the visible borders are real geometry below.
function buildLandMask(topology) {
  const w = 2048, h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  if (topology) {
    const land = topojson.feature(topology, topology.objects.countries)
    ctx.fillStyle = '#fff'
    for (const feature of land.features) {
      const polys = feature.geometry?.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry?.coordinates ?? []
      for (const poly of polys) {
        for (const ring of poly) {
          ctx.beginPath()
          ring.forEach(([lon, lat], i) => {
            const x = (lon + 180) / 360 * w
            const y = (90 - lat) / 180 * h
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          })
          ctx.closePath()
          ctx.fill()
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

function Globe({ topology, sunDir }) {
  const mask = useMemo(() => buildLandMask(topology), [topology])
  const uniforms = useMemo(() => ({
    landMask: { value: mask },
    sunDirection: { value: sunDir.clone() },
  }), [mask, sunDir])

  useEffect(() => { uniforms.sunDirection.value.copy(sunDir) }, [sunDir, uniforms])

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 96, 96]} />
      <shaderMaterial vertexShader={globeVertex} fragmentShader={globeFragment} uniforms={uniforms} />
    </mesh>
  )
}

function Atmosphere() {
  return (
    <mesh scale={1.16}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertex}
        fragmentShader={atmosphereFragment}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

// ─── Country borders ────────────────────────────────────────────────────────
// Real geometry rather than pixels in the texture: painted borders blur as
// you zoom and vanish at the limb. One merged LineSegments keeps it to a
// single draw call for every country on Earth.
function Borders({ topology }) {
  const geometry = useMemo(() => {
    if (!topology) return null
    const mesh = topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b)
    const pts = []
    // Lifted fractionally off the surface — coincident with the sphere it
    // z-fights and the lines strobe as the camera moves.
    const r = GLOBE_RADIUS * 1.0015
    for (const line of mesh.coordinates) {
      for (let i = 0; i < line.length - 1; i++) {
        pts.push(latLonToVector3(line[i][1], line[i][0], r))
        pts.push(latLonToVector3(line[i + 1][1], line[i + 1][0], r))
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [topology])

  if (!geometry) return null
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#D9B85C" transparent opacity={0.62} depthWrite={false} />
    </lineSegments>
  )
}

// ─── City lights ────────────────────────────────────────────────────────────
// Fifty of the largest metros. Brightness is driven per-vertex by the same
// sun direction the globe shader uses, so a city fades up as its part of the
// planet turns into night rather than switching on.
const CITIES = [
  [-33.87, 151.21, 1.3], [-37.81, 144.96, 1.1], [-27.47, 153.03, 0.9], [-31.95, 115.86, 0.8],
  [-34.93, 138.60, 0.7], [40.71, -74.01, 2.0], [34.05, -118.24, 1.7], [41.88, -87.63, 1.4],
  [29.76, -95.37, 1.2], [37.77, -122.42, 1.2], [25.76, -80.19, 1.1], [47.61, -122.33, 1.0],
  [43.65, -79.38, 1.2], [19.43, -99.13, 1.7], [-23.55, -46.63, 1.8], [-34.60, -58.38, 1.4],
  [4.71, -74.07, 1.2], [-12.05, -77.04, 1.1], [51.51, -0.13, 1.9], [48.86, 2.35, 1.7],
  [52.52, 13.40, 1.4], [40.42, -3.70, 1.3], [41.90, 12.50, 1.2], [55.76, 37.62, 1.5],
  [52.37, 4.90, 1.0], [59.33, 18.07, 0.9], [41.01, 28.98, 1.6], [30.04, 31.24, 1.6],
  [-26.20, 28.05, 1.2], [6.52, 3.38, 1.5], [-1.29, 36.82, 1.0], [-33.92, 18.42, 0.9],
  [35.69, 139.69, 2.0], [37.57, 126.98, 1.7], [39.90, 116.41, 1.9], [31.23, 121.47, 1.9],
  [22.32, 114.17, 1.5], [23.13, 113.26, 1.5], [1.35, 103.82, 1.3], [13.76, 100.50, 1.4],
  [-6.21, 106.85, 1.6], [14.60, 120.98, 1.4], [3.14, 101.69, 1.1], [28.61, 77.21, 1.8],
  [19.08, 72.88, 1.8], [13.08, 80.27, 1.3], [22.57, 88.36, 1.4], [24.86, 67.01, 1.5],
  [25.20, 55.27, 1.2], [-36.85, 174.76, 0.7],
]

function CityLights({ sunDir }) {
  const matRef = useRef(null)
  const geometry = useMemo(() => {
    const positions = []
    const sizes = []
    for (const [lat, lon, size] of CITIES) {
      const v = latLonToVector3(lat, lon, GLOBE_RADIUS * 1.004)
      positions.push(v.x, v.y, v.z)
      sizes.push(size)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    return g
  }, [])

  const uniforms = useMemo(() => ({ sunDirection: { value: sunDir.clone() } }), [sunDir])
  useEffect(() => { uniforms.sunDirection.value.copy(sunDir) }, [sunDir, uniforms])

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */`
          attribute float aSize;
          uniform vec3 sunDirection;
          varying float vNight;
          void main() {
            // Only lit on the dark side, ramped so the terminator sweeps
            // across the continents instead of flipping them on at once.
            float sun = dot(normalize(position), normalize(sunDirection));
            vNight = smoothstep(0.12, -0.30, sun);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Perspective-scaled, then CLAMPED. Without the clamp a city at
            // the near limb rendered a ~300px sprite, and with bloom on top
            // that became a white smear covering a third of the planet.
            float px = aSize * 60.0 / -mv.z;
            gl_PointSize = clamp(px, 1.5, 7.0);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */`
          varying float vNight;
          void main() {
            // Round, soft-edged sprite. Square points read as dead pixels.
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c);
            if (d > 0.5) discard;
            float falloff = pow(1.0 - d * 2.0, 2.2);
            gl_FragColor = vec4(1.0, 0.886, 0.71, falloff * vNight * 0.85);
          }
        `}
      />
    </points>
  )
}

// ─── Exchange markers ───────────────────────────────────────────────────────
// Three rings per exchange at different periods. One ring reads as a dot;
// three offset ones read as a signal being emitted.
function isOpen(ex, now) {
  const local = new Date(now.toLocaleString('en-US', { timeZone: ex.tz }))
  const d = local.getDay()
  if (d === 0 || d === 6) return false
  const mins = local.getHours() * 60 + local.getMinutes()
  return mins >= ex.open[0] * 60 + ex.open[1] && mins < ex.close[0] * 60 + ex.close[1]
}

function ExchangeRing({ position, quaternion, open, period, maxScale }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime % period) / period
    const s = 0.3 + t * maxScale
    ref.current.scale.set(s, s, s)
    ref.current.material.opacity = (1 - t) * (open ? 0.7 : 0.3)
  })
  return (
    <mesh ref={ref} position={position} quaternion={quaternion}>
      <ringGeometry args={[0.11, 0.17, 32]} />
      <meshBasicMaterial
        color={open ? '#C9A84C' : '#5A6B82'}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function ExchangeMarkers({ now, onExchangeClick }) {
  const markers = useMemo(() => EXCHANGES.map((ex) => {
    const pos = latLonToVector3(ex.lat, ex.lon, GLOBE_RADIUS * 1.008)
    // Lie the ring flat against the sphere: rotate +Z onto the surface normal.
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1), pos.clone().normalize(),
    )
    return { ex, pos, q, open: isOpen(ex, now) }
  }), [now])

  return markers.map(({ ex, pos, q, open }) => (
    <group key={ex.id}>
      <mesh
        position={pos}
        onClick={(e) => { e.stopPropagation(); onExchangeClick?.(ex.id) }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }}
      >
        <sphereGeometry args={[0.062, 14, 14]} />
        <meshBasicMaterial color={open ? '#FFD97A' : '#7C8DA6'} />
      </mesh>
      <ExchangeRing position={pos} quaternion={q} open={open} period={1.4} maxScale={0.9} />
      <ExchangeRing position={pos} quaternion={q} open={open} period={2.2} maxScale={1.5} />
      <ExchangeRing position={pos} quaternion={q} open={open} period={3.0} maxScale={2.1} />
    </group>
  ))
}

// ─── Trade arcs ─────────────────────────────────────────────────────────────
const TRADE_LANES = [
  { from: 'ASX', to: 'SSE',  dir: 'export' },
  { from: 'ASX', to: 'TSE',  dir: 'export' },
  { from: 'ASX', to: 'KRX',  dir: 'export' },
  { from: 'ASX', to: 'BSE',  dir: 'export' },
  { from: 'NYSE', to: 'ASX', dir: 'import' },
  { from: 'SGX', to: 'ASX',  dir: 'import' },
  { from: 'LSE', to: 'ASX',  dir: 'import' },
]

// Slerp, not lerp. Interpolating raw positions cuts a chord through the
// planet; normalising each step keeps the path on the surface, which is what
// makes it a great circle rather than a tunnel.
function greatCircle(a, b, segments = 96) {
  const start = a.clone().normalize()
  const end = b.clone().normalize()
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p = start.clone().lerp(end, t).normalize()
    const lift = GLOBE_RADIUS * (1 + Math.sin(t * Math.PI) * 0.30)
    pts.push(p.multiplyScalar(lift))
  }
  return pts
}

function TradeArc({ points, colour, speed, offset }) {
  const ref = useRef(null)
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])

  // A dash travelling the line, done by moving the dash offset. Cheaper and
  // steadier than rebuilding geometry each frame.
  useFrame(({ clock }) => {
    if (ref.current) ref.current.dashOffset = -((clock.elapsedTime * speed + offset) % 4)
  })

  return (
    <line geometry={geometry}>
      <lineDashedMaterial
        ref={ref}
        color={colour}
        dashSize={0.35}
        gapSize={0.55}
        transparent
        opacity={0.95}
        depthWrite={false}
        onUpdate={(m) => m.needsUpdate = true}
      />
    </line>
  )
}

function TradeArcs() {
  const arcs = useMemo(() => TRADE_LANES.map((lane, i) => {
    const from = EXCHANGES.find((e) => e.id === lane.from)
    const to = EXCHANGES.find((e) => e.id === lane.to)
    if (!from || !to) return null
    const pts = greatCircle(
      latLonToVector3(from.lat, from.lon, GLOBE_RADIUS),
      latLonToVector3(to.lat, to.lon, GLOBE_RADIUS),
    )
    return {
      key: `${lane.from}-${lane.to}`,
      points: pts,
      colour: lane.dir === 'export' ? '#C9A84C' : '#4A9EDB',
      speed: 0.55 + (i % 3) * 0.18,
      offset: i * 0.7,
    }
  }).filter(Boolean), [])

  return arcs.map((a) => <TradeArc key={a.key} {...a} />)
}

// Dashed materials need their line distances computed once the geometry
// exists, or every dash renders solid. Done here, after the whole scene has
// mounted, rather than per-arc.
function ComputeDashes() {
  const { scene } = useThree()
  useEffect(() => {
    scene.traverse((o) => { if (o.isLine && o.computeLineDistances) o.computeLineDistances() })
  })
  return null
}

// ─── Camera ─────────────────────────────────────────────────────────────────
// Rotates on its own, stops the moment the user touches it, and resumes three
// seconds after they stop — idle motion is what makes it feel alive, and
// fighting the user for control is what makes it feel broken.
function AutoRotate({ controlsRef }) {
  const idleAt = useRef(0)
  useFrame(({ clock }) => {
    const c = controlsRef.current
    if (!c) return
    c.autoRotate = clock.elapsedTime - idleAt.current > 3
  })
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    const onStart = () => { idleAt.current = performance.now() / 1000 + 1e6 }
    const onEnd = () => { idleAt.current = performance.now() / 1000 }
    c.addEventListener('start', onStart)
    c.addEventListener('end', onEnd)
    return () => { c.removeEventListener('start', onStart); c.removeEventListener('end', onEnd) }
  }, [controlsRef])
  return null
}

// ─── Status bar ─────────────────────────────────────────────────────────────
function ExchangeStatusBar({ now }) {
  const rows = EXCHANGES.slice(0, 7).map((ex) => ({ id: ex.id, open: isOpen(ex, now) }))
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: '6px 12px', background: 'rgba(6,13,26,0.82)',
      borderTop: '1px solid rgba(201,168,76,0.18)', backdropFilter: 'blur(8px)',
      fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: '0.1em',
      pointerEvents: 'none',
    }}>
      <span style={{ color: '#C9A84C' }}>LIVE EXCHANGE STATUS</span>
      {rows.map((r) => (
        <span key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, color: r.open ? '#E8EDF5' : '#4A6080' }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: r.open ? '#2D8A50' : '#3A4759', display: 'inline-block',
          }} />
          {r.id}
        </span>
      ))}
    </div>
  )
}

// World-atlas topojson, fetched once at module scope and shared.
let topologyPromise = null
function loadTopology() {
  if (!topologyPromise) {
    topologyPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((r) => r.json())
      .catch((err) => {
        console.warn('[Globe3D] country topology unavailable:', err.message)
        topologyPromise = null
        return null
      })
  }
  return topologyPromise
}

export default function Globe3D({ onExchangeClick }) {
  const controlsRef = useRef(null)
  const [topology, setTopology] = useState(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let alive = true
    loadTopology().then((t) => { if (alive && t) setTopology(t) })
    return () => { alive = false }
  }, [])

  // Exchange open/closed only changes on the scale of minutes.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  // Real subsolar point, so the terminator is where it actually is right now.
  const sunDir = useMemo(() => {
    // Returns [lon, lat] — note the order, it is not {lat, lon}.
    const [lon, lat] = subsolarPoint(now)
    return latLonToVector3(lat, lon, 1).normalize()
  }, [now])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: BG_COLOR }}>
      <Canvas
        camera={{ position: AU_CAMERA, fov: 40 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[BG_COLOR]} />
        <ambientLight intensity={0.6} />

        <Suspense fallback={null}>
          <Stars radius={130} depth={70} count={9000} factor={5} saturation={0} fade speed={0.35} />

          <Globe topology={topology} sunDir={sunDir} />
          <Borders topology={topology} />
          <CityLights sunDir={sunDir} />
          <ExchangeMarkers now={now} onExchangeClick={onExchangeClick} />
          <TradeArcs />
          <Atmosphere />
          <ComputeDashes />

          {/* Bloom is what turns coloured circles into light. Threshold sits
              above the globe surface so the planet does not smear — only the
              markers, city lights and arcs bleed. */}
          <EffectComposer>
            {/* Threshold sits well above the globe surface. At 0.3 the lit
                side of the planet itself passed the cutoff and the whole
                image bloomed into a white haze; only markers, city lights
                and arcs should bleed. */}
            <Bloom luminanceThreshold={0.72} luminanceSmoothing={0.3} intensity={0.6} mipmapBlur radius={0.5} />
            <ChromaticAberration offset={[0.0008, 0.0008]} />
          </EffectComposer>
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.55}
          autoRotateSpeed={0.35}
          minDistance={7}
          maxDistance={20}
        />
        <AutoRotate controlsRef={controlsRef} />
      </Canvas>

      <ExchangeStatusBar now={now} />
    </div>
  )
}
