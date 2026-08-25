import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { EXCHANGES, subsolarPoint, DEFAULT_ROTATION } from '../../data/globeExchanges'
import { BG_COLOR, GOLD } from '../visualisations/shared3d'

const GLOBE_RADIUS = 5
const RAD = Math.PI / 180

// A handful of illustrative AU trade lanes — exports (gold) leaving Australia,
// imports (blue) arriving. Reuses the same exchange coordinates as the
// markers so lanes always terminate exactly at a marker.
const TRADE_LANES = [
  { from: 'ASX', to: 'SSE', direction: 'export', label: 'AU → China' },
  { from: 'ASX', to: 'TSE', direction: 'export', label: 'AU → Japan' },
  { from: 'ASX', to: 'KRX', direction: 'export', label: 'AU → South Korea' },
  { from: 'NYSE', to: 'ASX', direction: 'import', label: 'US → AU' },
  { from: 'SGX', to: 'ASX', direction: 'import', label: 'Singapore → AU' },
]

// lat/lon (degrees) -> position on the sphere, matching the equirectangular
// UV convention used by buildEarthTexture below (u=0.5+lon/360 increasing
// eastward, v=0.5-lat/180) so texture, markers, and the sun-direction shader
// all agree on where things are.
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * RAD
  const theta = (lon + 180) * RAD
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// Builds an equirectangular canvas texture from real country borders (same
// world-atlas topojson MaddexGlobe uses) — a genuinely-geographic "procedural"
// texture rather than a fake/painted continent shape, with no external image
// asset needed.
function buildEarthTexture(topology) {
  const width = 2048, height = 1024
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#050b18'
  ctx.fillRect(0, 0, width, height)

  const projection = d3.geoEquirectangular().translate([width / 2, height / 2]).scale(width / (2 * Math.PI))
  const path = d3.geoPath(projection, ctx)
  const features = topology ? topojson.feature(topology, topology.objects.countries).features : []

  ctx.fillStyle = '#16304F'
  ctx.strokeStyle = 'rgba(201,168,76,0.55)'
  ctx.lineWidth = 1.2
  for (const feature of features) {
    ctx.beginPath()
    path(feature)
    ctx.fill()
    ctx.stroke()
  }

  // Subtle graticule so the sphere still reads as a globe when zoomed in on ocean.
  ctx.strokeStyle = 'rgba(201,168,76,0.06)'
  ctx.lineWidth = 0.5
  const graticule = d3.geoGraticule().step([20, 20])
  ctx.beginPath()
  path(graticule())
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Day/night shading over the earth texture — mixes the day-lit texture
// sample with a darkened "night" version based on the real subsolar
// direction, updated every frame from a live Date so the terminator tracks
// actual UTC time (same subsolarPoint the canvas/d3 globe uses).
const EARTH_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const EARTH_FRAGMENT_SHADER = `
  uniform sampler2D dayTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vec4 dayColor = texture2D(dayTexture, vUv);
    float dayFactor = dot(vNormalW, normalize(sunDirection));
    float night = smoothstep(-0.15, 0.15, -dayFactor);
    vec3 nightColor = dayColor.rgb * 0.22;
    gl_FragColor = vec4(mix(dayColor.rgb, nightColor, night), 1.0);
  }
`

function Earth({ texture }) {
  const materialRef = useRef(null)
  const sunDir = useRef(new THREE.Vector3(1, 0, 0))

  useFrame(() => {
    const [subLon, subLat] = subsolarPoint(new Date())
    sunDir.current.copy(latLonToVector3(subLat, subLon, 1)).normalize()
    if (materialRef.current) materialRef.current.uniforms.sunDirection.value.copy(sunDir.current)
  })

  const uniforms = useMemo(() => ({
    dayTexture: { value: texture },
    sunDirection: { value: new THREE.Vector3(1, 0, 0) },
  }), [texture])

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 96, 96]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={EARTH_VERTEX_SHADER}
        fragmentShader={EARTH_FRAGMENT_SHADER}
      />
    </mesh>
  )
}

const ATMOSPHERE_VERTEX_SHADER = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ATMOSPHERE_FRAGMENT_SHADER = `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
    gl_FragColor = vec4(0.15, 0.45, 0.85, 1.0) * intensity;
  }
`

function Atmosphere() {
  return (
    <mesh scale={[1.045, 1.045, 1.045]}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <shaderMaterial
        transparent
        vertexShader={ATMOSPHERE_VERTEX_SHADER}
        fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

// Three expanding, staggered rings per exchange marker — fast/small,
// medium, slow/large — same "radar sweep" language as the brief.
function PulseRing({ position, normal, color, delay, scale, speed }) {
  const ref = useRef(null)
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    return q
  }, [normal])

  useFrame((state) => {
    const t = ((state.clock.elapsedTime + delay) * speed) % 1
    if (!ref.current) return
    ref.current.scale.setScalar(scale * (0.4 + t * 1.6))
    ref.current.material.opacity = Math.max(0, 0.85 * (1 - t))
  })

  return (
    <mesh ref={ref} position={position} quaternion={quaternion}>
      <ringGeometry args={[0.075, 0.095, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  )
}

function ExchangeMarker({ exchange, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const position = useMemo(() => latLonToVector3(exchange.lat, exchange.lon, GLOBE_RADIUS + 0.02), [exchange])
  const normal = useMemo(() => position.clone().normalize(), [position])

  return (
    <group>
      <mesh
        position={position}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(exchange.id) }}
      >
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <PulseRing position={position} normal={normal} color={GOLD} delay={0}   scale={1}   speed={0.9} />
      <PulseRing position={position} normal={normal} color={GOLD} delay={0.35} scale={1.6} speed={0.55} />
      <PulseRing position={position} normal={normal} color={GOLD} delay={0.7}  scale={2.3} speed={0.32} />
      {hovered && (
        <Html position={position} center distanceFactor={11} occlude>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: '#e8edf5',
            background: 'rgba(6,13,26,0.92)',
            border: `1px solid ${GOLD}`,
            borderRadius: 3,
            padding: '4px 8px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transform: 'translateX(-50%) translateY(-140%)',
          }}>
            <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{exchange.label}</div>
            <div style={{ color: '#8a94a6' }}>{exchange.city}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

// A great-circle-ish arc between two exchanges, lofted above the surface via
// a quadratic Bezier control point — static tube for the path, plus a few
// small pulses animated along it via curve.getPointAt() to read as "flow".
function TradeArc({ lane, byId }) {
  const from = byId[lane.from]
  const to = byId[lane.to]
  const valid = Boolean(from && to)

  const curve = useMemo(() => {
    if (!valid) return null
    const start = latLonToVector3(from.lat, from.lon, GLOBE_RADIUS + 0.01)
    const end = latLonToVector3(to.lat, to.lon, GLOBE_RADIUS + 0.01)
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS * 1.35)
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [valid, from, to])

  const points = useMemo(() => (curve ? curve.getPoints(48) : []), [curve])
  const color = lane.direction === 'export' ? GOLD : '#2D7DD2'

  const pulseRef0 = useRef(null)
  const pulseRef1 = useRef(null)
  const pulseRef2 = useRef(null)

  useFrame((state) => {
    if (!curve) return
    ;[pulseRef0, pulseRef1, pulseRef2].forEach((ref, i) => {
      const t = (state.clock.elapsedTime * 0.12 + i / 3) % 1
      const p = curve.getPointAt(t)
      ref.current?.position.copy(p)
    })
  })

  if (!valid) return null

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.35} />
      </line>
      <mesh ref={pulseRef0}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={pulseRef1}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={pulseRef2}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function AutoRotateGroup({ children, paused }) {
  const ref = useRef(null)
  useFrame((_, delta) => {
    if (!paused && ref.current) ref.current.rotation.y += delta * 0.035
  })
  return <group ref={ref}>{children}</group>
}

function Scene({ texture, showTradeArcs, onSelectExchange }) {
  const [interacting, setInteracting] = useState(false)
  const byId = useMemo(() => Object.fromEntries(EXCHANGES.map((e) => [e.id, e])), [])
  // Initial yaw so Australia faces the camera on load, matching DEFAULT_ROTATION.
  const initialYaw = -DEFAULT_ROTATION[0] * RAD

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 6, 10]} intensity={1.1} />
      <directionalLight position={[-8, -4, -6]} intensity={0.15} color="#2D7DD2" />

      <Stars radius={120} depth={60} count={4000} factor={2.2} saturation={0} fade speed={0.3} />

      <group rotation={[0, initialYaw, 0]}>
        <AutoRotateGroup paused={interacting}>
          <Earth texture={texture} />
          <Atmosphere />
          {EXCHANGES.map((ex) => (
            <ExchangeMarker key={ex.id} exchange={ex} onSelect={onSelectExchange} />
          ))}
          {showTradeArcs && TRADE_LANES.map((lane) => (
            <TradeArc key={`${lane.from}-${lane.to}`} lane={lane} byId={byId} />
          ))}
        </AutoRotateGroup>
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={22}
        rotateSpeed={0.5}
        onStart={() => setInteracting(true)}
        onEnd={() => setInteracting(false)}
      />
    </>
  )
}

// World-atlas topojson is fetched once and cached at module scope — every
// Globe3D mount (including a Fast-Refresh remount) reuses the same promise
// instead of re-fetching, same caching shape MaddexGlobe's useQuery gives it.
let topologyPromise = null
function loadTopology() {
  if (!topologyPromise) {
    topologyPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((r) => r.json())
  }
  return topologyPromise
}

export default function Globe3D({ onExchangeClick }) {
  const [texture, setTexture] = useState(null)
  const [showTradeArcs, setShowTradeArcs] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadTopology()
      .then((topology) => { if (!cancelled) setTexture(buildEarthTexture(topology)) })
      .catch(() => { if (!cancelled) setTexture(buildEarthTexture(null)) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="h-full w-full relative" style={{ background: BG_COLOR }}>
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowTradeArcs((v) => !v)}
          className={`text-2xs px-2.5 py-1 border font-bold tracking-widest transition-colors ${
            showTradeArcs ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
          }`}
        >TRADE FLOWS</button>
      </div>
      {!texture ? (
        <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">Loading globe geometry...</div>
      ) : (
        <Canvas camera={{ position: [0, 3, 14], fov: 50 }} dpr={[1, 1.5]}>
          <Suspense fallback={null}>
            <Scene texture={texture} showTradeArcs={showTradeArcs} onSelectExchange={onExchangeClick} />
          </Suspense>
        </Canvas>
      )}
    </div>
  )
}
