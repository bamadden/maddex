import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { GAIN_BRIGHT, LOSS_BRIGHT, NEUTRAL, GOLD, normalise, BG_COLOR } from './shared3d'
import { getMockFMPHistory } from '../../services/mockData'

// A deterministic pseudo-random layout — stable across re-renders (no
// physics engine needed per spec: holdings just gently float/pulse in
// place via a per-bubble sine offset in useFrame).
function layoutPosition(i, n) {
  const golden = Math.PI * (3 - Math.sqrt(5)) // golden angle, even sphere-ish spread
  const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0  // -1..1, single holding sits centred
  const radiusAtY = Math.sqrt(1 - y * y)
  const theta = golden * i
  const spread = 4.2
  const yExtent = Math.min(2.4, 0.9 + n * 0.25)
  return [
    Math.cos(theta) * radiusAtY * spread,
    y * yExtent,
    Math.sin(theta) * radiusAtY * spread,
  ]
}

// Symmetric axis scale — maps [min,max] to [-half, half], used by PERFORMANCE
// mode where P&L% can be negative and zero has to sit at the origin.
function scaleAxis(value, min, max, half) {
  if (max === min) return 0
  const t = (value - min) / (max - min)
  return (t - 0.5) * 2 * half
}

// Volatility proxy: stdev of daily % returns over the last 30 sessions, from
// the same mock history PortfolioAnalytics' attribution waterfall reads —
// a real (if mock-sourced) statistic, not a fake stand-in.
function computeVolatility(holding) {
  const hist = getMockFMPHistory(holding.type === 'asx' ? `${holding.symbol}.AX` : holding.symbol, 30)
  if (hist.length < 3) return 0
  const rets = []
  for (let i = 1; i < hist.length; i++) rets.push((hist[i].close - hist[i - 1].close) / hist[i - 1].close)
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
  return Math.sqrt(variance) * 100
}

function Bubble({ holding, position, radius, color, onSelect, isSelected, dimmed }) {
  const mesh = useRef(null)
  const glow = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [seed] = useState(() => Math.random() * Math.PI * 2)

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const t = clock.getElapsedTime()
    mesh.current.position.y = Math.sin(t * 0.6 + seed) * 0.18
    const pulse = 1 + Math.sin(t * 1.4 + seed) * 0.03
    mesh.current.scale.setScalar(pulse * (hovered || isSelected ? 1.15 : 1))
    if (glow.current) glow.current.position.copy(mesh.current.position)
  })

  const glowIntensity = Math.min(0.9, 0.2 + Math.abs(holding.pnlPct ?? 0) / 30)

  return (
    <group position={position}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(holding) }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshPhysicalMaterial
          color={color}
          transmission={0.85}
          thickness={0.6}
          roughness={0.05}
          metalness={0.05}
          ior={1.4}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          transparent
          opacity={dimmed ? 0.18 : 0.8}
        />
      </mesh>
      {/* Inner glow — a smaller emissive core visible through the glass shell */}
      <mesh ref={glow} scale={0.42}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.05 : glowIntensity} />
      </mesh>
      {!dimmed && (
        <Html position={[0, radius + 0.35, 0]} center distanceFactor={11} occlude>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: '#e8edf5',
            background: 'rgba(6,13,26,0.85)',
            border: `1px solid ${color}`,
            borderRadius: 3,
            padding: '2px 6px',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            pointerEvents: 'none',
            transform: 'translateX(-50%)',
          }}>
            <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{holding.symbol}</div>
            <div style={{ color, fontWeight: 600 }}>
              {holding.pnlPct != null ? `${holding.pnlPct >= 0 ? '+' : ''}${holding.pnlPct.toFixed(1)}%` : '—'}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// A thin gold ribbon tracing the portfolio's cumulative 30D return —
// PERFORMANCE mode only. Floats above/below the Y=0 (breakeven) plane at a
// fixed offset so it reads as a standalone reference line, not one more
// bubble axis.
function ReturnRibbon({ holdings }) {
  const points = useMemo(() => {
    const n = 21
    const perHolding = holdings.map((h) => ({
      hist: getMockFMPHistory(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol, n),
      weight: h.mktVal ?? 0,
    })).filter((p) => p.hist.length === n && p.weight > 0)
    const totalWeight = perHolding.reduce((s, p) => s + p.weight, 0)
    if (!perHolding.length || totalWeight === 0) return []

    const pts = []
    for (let day = 0; day < n; day++) {
      let cumPct = 0
      for (const p of perHolding) {
        const start = p.hist[0].close
        const cur = p.hist[day].close
        cumPct += ((cur - start) / start) * (p.weight / totalWeight)
      }
      const x = (day / (n - 1)) * 8 - 4
      const y = cumPct * 100 * 0.3 // scaled to sit comfortably alongside the bubble field
      pts.push(new THREE.Vector3(x, y, 5.5))
    }
    return pts
  }, [holdings])

  if (points.length < 2) return null

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GOLD} linewidth={2} />
      </line>
      <Html position={[points[points.length - 1].x + 0.6, points[points.length - 1].y, points[points.length - 1].z]} center distanceFactor={11}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: GOLD,
          background: 'rgba(6,13,26,0.85)', border: `1px solid ${GOLD}`, borderRadius: 3,
          padding: '2px 6px', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>30D PORTFOLIO RETURN</div>
      </Html>
    </group>
  )
}

// Imperatively lerps the camera toward a focus target (and back to the
// overview position when cleared) — kept in sync with OrbitControls by also
// lerping its target each frame, so the user can still drag-orbit mid-tween
// without the two fighting each other.
function CameraRig({ focusPosition, controlsRef }) {
  const { camera } = useThree()
  const overviewPos = useMemo(() => new THREE.Vector3(0, 1.5, 9), [])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    if (focusPosition) {
      const dir = focusPosition.clone().normalize()
      const desired = focusPosition.clone().add(dir.multiplyScalar(2.2))
      camera.position.lerp(desired, 0.08)
      controls.target.lerp(focusPosition, 0.08)
    } else {
      camera.position.lerp(overviewPos, 0.06)
      controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.06)
    }
    controls.update()
  })
  return null
}

function Scene({ holdings, mode, selectedSymbol, focused, setFocused }) {
  const maxVal = useMemo(() => Math.max(...holdings.map((h) => h.mktVal ?? 0), 1), [holdings])
  const controlsRef = useRef(null)

  const perf = useMemo(() => {
    if (mode !== 'performance') return null
    const withVol = holdings.map((h) => ({ ...h, _vol: computeVolatility(h) }))
    const pnlPcts = withVol.map((h) => h.pnlPct ?? 0)
    const mktVals = withVol.map((h) => h.mktVal ?? 0)
    const vols = withVol.map((h) => h._vol)
    return {
      holdings: withVol,
      pnlMax: Math.max(...pnlPcts.map(Math.abs), 1),
      valMin: Math.min(...mktVals), valMax: Math.max(...mktVals, 1),
      volMin: Math.min(...vols), volMax: Math.max(...vols, 1),
    }
  }, [holdings, mode])

  const focusPosition = useMemo(() => {
    if (!focused) return null
    const list = mode === 'performance' ? perf.holdings : holdings
    const idx = list.findIndex((h) => h.symbol === focused.symbol)
    if (idx < 0) return null
    const pos = mode === 'performance'
      ? [
          scaleAxis(perf.holdings[idx].mktVal, perf.valMin, perf.valMax, 4.2),
          scaleAxis(perf.holdings[idx].pnlPct ?? 0, -perf.pnlMax, perf.pnlMax, 3.2),
          scaleAxis(perf.holdings[idx]._vol, perf.volMin, perf.volMax, 3.2),
        ]
      : layoutPosition(idx, holdings.length)
    return new THREE.Vector3(...pos)
  }, [focused, mode, holdings, perf])

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <fog attach="fog" args={[BG_COLOR, 8, 24]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1} />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} color="#4a6fa8" />

      {mode === 'performance' && (
        <>
          <ReturnRibbon holdings={holdings} />
          {/* Y=0 breakeven plane reference line */}
          <line>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5, -5, 0, -5]), 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#4a6080" transparent opacity={0.35} />
          </line>
        </>
      )}

      {(mode === 'performance' ? perf.holdings : holdings).map((h, i) => {
        const color = h.pnlPct == null ? NEUTRAL : h.pnlPct >= 0 ? GAIN_BRIGHT : LOSS_BRIGHT
        const position = mode === 'performance'
          ? [
              scaleAxis(h.mktVal, perf.valMin, perf.valMax, 4.2),
              scaleAxis(h.pnlPct ?? 0, -perf.pnlMax, perf.pnlMax, 3.2),
              scaleAxis(h._vol, perf.volMin, perf.volMax, 3.2),
            ]
          : layoutPosition(i, holdings.length)
        const radius = mode === 'performance'
          ? normalise(Math.abs((h.pnlPct ?? 0) / 100 * (h.mktVal ?? 0)), Math.max(...(perf.holdings.map((x) => Math.abs((x.pnlPct ?? 0) / 100 * (x.mktVal ?? 0)))), 1), 0.3, 1.2)
          : normalise(h.mktVal, maxVal, 0.35, 1.35)
        return (
          <Bubble
            key={h.symbol}
            holding={h}
            position={position}
            radius={radius}
            color={color}
            onSelect={setFocused}
            isSelected={selectedSymbol === h.symbol || focused?.symbol === h.symbol}
            dimmed={focused != null && focused.symbol !== h.symbol}
          />
        )
      })}

      <OrbitControls ref={controlsRef} enablePan={false} minDistance={5} maxDistance={16} autoRotate={!focused} autoRotateSpeed={0.4} />
      <CameraRig focusPosition={focusPosition} controlsRef={controlsRef} />
    </>
  )
}

// holdings: [{ symbol, mktVal, pnlPct, type }]
export default function Portfolio3D({ holdings, onSelect, selectedSymbol }) {
  const valid = useMemo(() => (holdings ?? []).filter((h) => h.mktVal != null), [holdings])
  const [mode, setMode] = useState('allocation') // 'allocation' | 'performance'
  const [focused, setFocused] = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setFocused(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!valid.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No priced holdings to visualise yet.
      </div>
    )
  }

  return (
    <div
      className="h-full w-full relative"
      style={{ background: BG_COLOR }}
      onDoubleClick={() => setFocused(null)}
    >
      <div className="absolute top-2 left-2 z-10 flex items-center border border-terminal-border rounded-full overflow-hidden">
        <button
          onClick={() => { setMode('allocation'); setFocused(null) }}
          className={`text-2xs px-2.5 py-0.5 font-bold transition-colors ${mode === 'allocation' ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
        >ALLOCATION</button>
        <button
          onClick={() => { setMode('performance'); setFocused(null) }}
          className={`text-2xs px-2.5 py-0.5 font-bold transition-colors ${mode === 'performance' ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
        >PERFORMANCE</button>
      </div>
      {mode === 'performance' && (
        <div className="absolute top-2 right-2 z-10 text-2xs text-terminal-text-dim font-mono leading-relaxed pointer-events-none text-right">
          <div>X · POSITION SIZE</div>
          <div>Y · P&amp;L %</div>
          <div>Z · VOLATILITY (30D)</div>
        </div>
      )}

      {/* Background darkens + a small detail card appears when a bubble is focused */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ background: '#000', opacity: focused ? 0.35 : 0, zIndex: 5 }}
      />
      {focused && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-terminal-header border border-terminal-gold px-4 py-2.5 flex items-center gap-4">
          <div>
            <div className="text-xs font-bold text-terminal-gold">{focused.symbol}</div>
            <div className="text-2xs text-terminal-text-dim">{focused.name || focused.symbol}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-terminal-text-bright">
              {focused.pnlPct != null ? `${focused.pnlPct >= 0 ? '+' : ''}${focused.pnlPct.toFixed(2)}%` : '—'}
            </div>
            <div className="text-2xs text-terminal-text-dim">P&amp;L</div>
          </div>
          <button
            onClick={() => { onSelect?.(focused); setFocused(null) }}
            className="text-2xs font-bold text-terminal-gold border border-terminal-gold/40 px-2.5 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >FULL DETAIL →</button>
          <button
            onClick={() => setFocused(null)}
            className="text-2xs text-terminal-text-dim hover:text-terminal-red"
          >✕ BACK</button>
        </div>
      )}

      <Canvas camera={{ position: [0, 1.5, 9], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene holdings={valid} mode={mode} selectedSymbol={selectedSymbol} focused={focused} setFocused={setFocused} />
        </Suspense>
      </Canvas>
    </div>
  )
}
