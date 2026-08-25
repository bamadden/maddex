import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { BG_COLOR } from './shared3d'

const MATURITY_YEARS = { '3M': 0.25, '6M': 0.5, '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '10Y': 10, '30Y': 30 }
// Oldest first (Z increases toward "now") so PLAY-direction and depth agree.
const TIME_LABELS = ['1Y ago', '6M ago', '3M ago', 'Today']
// How hard to extrapolate the curve's one real "vs prev month" data point
// back further in time — deliberately damped (not linear) since a trend
// rarely holds in a straight line for a full year. This is clearly a
// demo-data derivation, not a claim of real historical AU/US yield curves.
const HISTORY_WEIGHT = { 'Today': 0, '3M ago': 2.2, '6M ago': 3.6, '1Y ago': 5.0 }

function logX(years, half) {
  const minLog = Math.log(0.2), maxLog = Math.log(32)
  const t = (Math.log(years) - minLog) / (maxLog - minLog)
  return (t - 0.5) * 2 * half
}

// curve: { label, color, points: [{m,y}], prev: {m: y} } from FXModule's
// YIELD_CURVES — builds a { 'Today': [...], '3M ago': [...], ... } history by
// extrapolating from the curve's real month-over-month delta per tenor.
function buildHistory(curve) {
  const out = {}
  for (const label of TIME_LABELS) {
    const weight = HISTORY_WEIGHT[label]
    out[label] = curve.points.map((p) => {
      const prevMo = curve.prev[p.m]
      const delta = prevMo != null ? p.y - prevMo : 0
      return { m: p.m, y: Math.round((p.y - delta * weight) * 100) / 100 }
    })
  }
  return out
}

function buildSurfaceGeometry(history, yMin, yMax, half) {
  const geo = new THREE.BufferGeometry()
  const vertices = []
  const uvs = []
  const rows = TIME_LABELS.length
  const cols = history.Today.length

  TIME_LABELS.forEach((label, ti) => {
    history[label].forEach((pt, mi) => {
      const x = logX(MATURITY_YEARS[pt.m], half)
      const yNorm = yMax > yMin ? (pt.y - yMin) / (yMax - yMin) : 0.5
      const y = yNorm * 3.2
      const z = ti * 2.0 - ((rows - 1) * 2.0) / 2
      vertices.push(x, y, z)
      uvs.push(mi / (cols - 1), ti / (rows - 1))
    })
  })

  const indices = []
  for (let ti = 0; ti < rows - 1; ti++) {
    for (let mi = 0; mi < cols - 1; mi++) {
      const a = ti * cols + mi
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function Surface({ curve, yMin, yMax, half, onHoverPoint }) {
  const history = useMemo(() => buildHistory(curve), [curve])
  const geometry = useMemo(() => buildSurfaceGeometry(history, yMin, yMax, half), [history, yMin, yMax, half])

  const todayPoints = useMemo(() => {
    const ti = TIME_LABELS.length - 1
    const z = ti * 2.0 - ((TIME_LABELS.length - 1) * 2.0) / 2
    return history.Today.map((pt) => {
      const x = logX(MATURITY_YEARS[pt.m], half)
      const yNorm = yMax > yMin ? (pt.y - yMin) / (yMax - yMin) : 0.5
      return new THREE.Vector3(x, yNorm * 3.2 + 0.03, z)
    })
  }, [history, yMin, yMax, half])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={curve.color} metalness={0.35} roughness={0.45} transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={curve.color} wireframe transparent opacity={0.25} />
      </mesh>

      {/* Today's curve, highlighted as a bright line along the front edge */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(todayPoints.flatMap((p) => [p.x, p.y, p.z])), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={curve.color} linewidth={3} />
      </line>

      {/* Invisible larger hit-targets at each grid vertex for hover tooltips */}
      {TIME_LABELS.map((label, ti) => history[label].map((pt) => {
        const x = logX(MATURITY_YEARS[pt.m], half)
        const yNorm = yMax > yMin ? (pt.y - yMin) / (yMax - yMin) : 0.5
        const z = ti * 2.0 - ((TIME_LABELS.length - 1) * 2.0) / 2
        return (
          <mesh
            key={`${label}-${pt.m}`}
            position={[x, yNorm * 3.2, z]}
            onPointerOver={(e) => { e.stopPropagation(); onHoverPoint({ curve, label, m: pt.m, y: pt.y, pos: [x, yNorm * 3.2, z] }) }}
            onPointerOut={(e) => { e.stopPropagation(); onHoverPoint(null) }}
          >
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )
      }))}
    </group>
  )
}

function AxisLabels({ half, curves }) {
  const maturities = curves[0]?.points.map((p) => p.m) ?? []
  return (
    <group>
      {maturities.map((m) => (
        <Html key={m} position={[logX(MATURITY_YEARS[m], half), -0.3, ((TIME_LABELS.length - 1) * 2.0) / 2 + 0.6]} center distanceFactor={14}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#8a94a6', whiteSpace: 'nowrap' }}>{m}</div>
        </Html>
      ))}
      {TIME_LABELS.map((label, ti) => (
        <Html key={label} position={[-half - 0.8, 0, ti * 2.0 - ((TIME_LABELS.length - 1) * 2.0) / 2]} center distanceFactor={14}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#8a94a6', whiteSpace: 'nowrap' }}>{label}</div>
        </Html>
      ))}
    </group>
  )
}

function Scene({ curves }) {
  const [hover, setHover] = useState(null)
  const half = 6

  const { yMin, yMax } = useMemo(() => {
    const allYields = curves.flatMap((c) => {
      const h = buildHistory(c)
      return TIME_LABELS.flatMap((label) => h[label].map((p) => p.y))
    })
    return { yMin: Math.min(...allYields) - 0.2, yMax: Math.max(...allYields) + 0.2 }
  }, [curves])

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, 6, -6]} intensity={0.3} color="#2D7DD2" />

      <Stars radius={100} depth={50} count={2000} factor={2} saturation={0} fade speed={0.3} />

      <OrbitControls enablePan minDistance={6} maxDistance={30} />

      {curves.map((c) => (
        <Surface key={c.label} curve={c} yMin={yMin} yMax={yMax} half={half} onHoverPoint={setHover} />
      ))}

      <AxisLabels half={half} curves={curves} />

      {hover && (
        <Html position={hover.pos} center distanceFactor={11} occlude>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#e8edf5',
            background: 'rgba(6,13,26,0.92)', border: `1px solid ${hover.curve.color}`, borderRadius: 3,
            padding: '4px 8px', whiteSpace: 'nowrap', pointerEvents: 'none', transform: 'translateY(-140%)',
          }}>
            <div style={{ fontWeight: 700, color: hover.curve.color }}>{hover.curve.label.split(' ')[0]} · {hover.m}</div>
            <div>{hover.label}: <span style={{ fontWeight: 700 }}>{hover.y.toFixed(2)}%</span></div>
          </div>
        </Html>
      )}

      <EffectComposer>
        <Bloom intensity={0.3} luminanceThreshold={0.7} luminanceSmoothing={0.9} />
      </EffectComposer>
    </>
  )
}

// auCurve, usCurve: YIELD_CURVES.AU / YIELD_CURVES.US from FXModule (passed
// as props rather than imported, since FXModule.jsx is a single-default-
// export component file — exporting the const alongside it would trip
// react-refresh/only-export-components).
export default function YieldCurve3D({ auCurve, usCurve }) {
  const [show, setShow] = useState('both') // 'AU' | 'US' | 'both'
  const curves = useMemo(() => {
    if (show === 'AU') return [auCurve]
    if (show === 'US') return [usCurve]
    return [auCurve, usCurve]
  }, [show, auCurve, usCurve])

  return (
    <div className="h-full w-full relative" style={{ background: BG_COLOR }}>
      <div className="absolute top-2 left-2 z-10 flex items-center border border-terminal-border rounded-full overflow-hidden">
        {['AU', 'US', 'both'].map((k) => (
          <button
            key={k}
            onClick={() => setShow(k)}
            className={`text-2xs px-2.5 py-1 font-bold transition-colors ${show === k ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
          >{k === 'both' ? 'AU + US' : k}</button>
        ))}
      </div>
      <div className="absolute top-2 right-2 z-10 text-2xs text-terminal-text-dim font-mono leading-relaxed pointer-events-none text-right">
        <div>X · MATURITY</div>
        <div>Y · YIELD %</div>
        <div>Z · TIME (1Y AGO &rarr; TODAY)</div>
      </div>
      <Canvas camera={{ position: [0, 6, 13], fov: 50 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene curves={curves} />
        </Suspense>
      </Canvas>
    </div>
  )
}
