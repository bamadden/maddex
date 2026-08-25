import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { GAIN_BRIGHT, LOSS_BRIGHT, GOLD, normalise, BG_COLOR } from './shared3d'

function scaleAxis(value, min, max, outHalfRange) {
  if (max === min) return 0
  const t = (value - min) / (max - min) // 0..1
  return (t - 0.5) * 2 * outHalfRange
}

// Market cap and volume are long-tail distributed (BTC/ETH dwarf everything
// else), so a linear scale crams 18 of 20 coins into one corner. Log scale
// spreads the full field out into something actually readable.
function scaleAxisLog(value, min, max, outHalfRange) {
  const safeMin = Math.max(min, 1)
  const safeVal = Math.max(value, 1)
  return scaleAxis(Math.log(safeVal), Math.log(safeMin), Math.log(Math.max(max, safeMin + 1)), outHalfRange)
}

// Deterministic per-coin PRNG (same mulberry32 pattern used elsewhere in
// this codebase, e.g. scannerService.js) — particle positions must be
// stable across re-renders, so Math.random() isn't safe to call in a
// render-time useMemo.
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Real Pearson correlation between two coins' 7-day hourly sparklines (the
// same series the 2D crypto table's sparkline column already renders) —
// not a fabricated/heuristic number.
function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 3) return 0
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n
  let cov = 0, varA = 0, varB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }
  const denom = Math.sqrt(varA * varB)
  return denom === 0 ? 0 : cov / denom
}

// Small floating particles orbiting each coin — purely decorative, cheap
// (12 points per coin) so all 20 coins can have them simultaneously.
function CoinParticles({ color, radius, seed }) {
  const ref = useRef(null)
  const positions = useMemo(() => {
    const rng = mulberry32(hashStr(seed))
    const count = 12
    const pts = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2
      const r = radius * (1.4 + rng() * 0.6)
      pts[i * 3]     = Math.cos(angle) * r
      pts[i * 3 + 1] = (rng() - 0.5) * radius * 1.2
      pts[i * 3 + 2] = Math.sin(angle) * r
    }
    return pts
  }, [radius, seed])

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.3
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color={color} transparent opacity={0.5} sizeAttenuation />
    </points>
  )
}

// Downsampled 7-day sparkline spiralled around the sphere as a chain of
// short coloured tube segments — green where price rose since the previous
// sample, red where it fell. Only rendered for the selected coin.
function PriceRibbon({ sparkline, radius }) {
  const segments = useMemo(() => {
    if (!sparkline?.length) return []
    const targetCount = 40
    const step = Math.max(1, Math.floor(sparkline.length / targetCount))
    const sampled = sparkline.filter((_, i) => i % step === 0)
    const min = Math.min(...sampled), max = Math.max(...sampled)
    const pts = sampled.map((price, i) => {
      const t = i / (sampled.length - 1)
      const angle = t * Math.PI * 6
      const rr = radius * 1.5
      const norm = max > min ? (price - min) / (max - min) : 0.5
      const y = (norm - 0.5) * radius * 3
      return { pos: new THREE.Vector3(Math.cos(angle) * rr, y, Math.sin(angle) * rr), price }
    })
    const out = []
    for (let i = 1; i < pts.length; i++) {
      const curve = new THREE.CatmullRomCurve3([pts[i - 1].pos, pts[i].pos])
      const geo = new THREE.TubeGeometry(curve, 4, 0.018, 5, false)
      const color = pts[i].price >= pts[i - 1].price ? GAIN_BRIGHT : LOSS_BRIGHT
      out.push({ geo, color, key: i })
    }
    return out
  }, [sparkline, radius])

  return (
    <group>
      {segments.map((s) => (
        <mesh key={s.key} geometry={s.geo}>
          <meshBasicMaterial color={s.color} />
        </mesh>
      ))}
    </group>
  )
}

// Correlation edges between coins whose 7-day sparklines move together
// (|r| > 0.7) — gold for positive, red for negative, thicker/more opaque
// the stronger the correlation.
function CorrelationLines({ coins, positionsBySymbol }) {
  const edges = useMemo(() => {
    const withSpark = coins.filter((c) => c.sparkline?.length >= 24)
    const out = []
    for (let i = 0; i < withSpark.length; i++) {
      for (let j = i + 1; j < withSpark.length; j++) {
        const r = pearson(withSpark[i].sparkline, withSpark[j].sparkline)
        if (Math.abs(r) >= 0.7) out.push({ a: withSpark[i].symbol, b: withSpark[j].symbol, r })
      }
    }
    return out
  }, [coins])

  return (
    <group>
      {edges.map((e) => {
        const posA = positionsBySymbol[e.a], posB = positionsBySymbol[e.b]
        if (!posA || !posB) return null
        const color = e.r > 0 ? GOLD : LOSS_BRIGHT
        const strength = (Math.abs(e.r) - 0.7) / 0.3
        return (
          <line key={`${e.a}-${e.b}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[new Float32Array([...posA, ...posB]), 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={color} transparent opacity={0.15 + strength * 0.45} />
          </line>
        )
      })}
    </group>
  )
}

function CoinPoint({ coin, position, radius, color, showLabel, onHover, hovered, onSelect, selected }) {
  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onHover?.(coin) }}
        onPointerOut={(e) => { e.stopPropagation(); onHover?.(null) }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(coin) }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || selected ? 0.7 : 0.3}
          roughness={0.3}
          metalness={0.25}
        />
      </mesh>
      <CoinParticles color={color} radius={radius} seed={coin.symbol} />
      {selected && <PriceRibbon sparkline={coin.sparkline} radius={radius} />}
      {(showLabel || hovered) && (
        <Html position={[0, radius + 0.3, 0]} center distanceFactor={11} occlude>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: '#e8edf5',
            background: 'rgba(6,13,26,0.9)',
            border: `1px solid ${color}`,
            borderRadius: 3,
            padding: '2px 6px',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            pointerEvents: 'none',
            transform: 'translateX(-50%)',
          }}>
            <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{coin.symbol}</div>
            {hovered && (
              <>
                <div style={{ color, fontWeight: 600 }}>
                  {coin.pct24h >= 0 ? '▲' : '▼'} {Math.abs(coin.pct24h).toFixed(2)}% 24H
                </div>
                <div style={{ color: '#8a94a6' }}>
                  MCAP {(coin.marketCap / 1e9).toFixed(1)}B · VOL {(coin.volume / 1e9).toFixed(2)}B
                </div>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

function AxisLines({ half }) {
  const pts = (a, b) => [a, b].flat()
  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(pts([-half, 0, 0], [half, 0, 0])), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#1a2b4a" />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(pts([0, -half, 0], [0, half, 0])), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#1a2b4a" />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(pts([0, 0, -half], [0, 0, half])), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#1a2b4a" />
      </line>
    </group>
  )
}

// Lerps the camera toward a focused coin's position (and back to the
// overview position once cleared), keeping OrbitControls' target in sync
// each frame so manual dragging mid-tween doesn't fight the animation.
function CameraRig({ focusPosition, controlsRef }) {
  const { camera } = useThree()
  const overviewPos = useMemo(() => new THREE.Vector3(7, 5, 9), [])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    if (focusPosition) {
      const dir = focusPosition.clone().normalize()
      const desired = focusPosition.clone().add(dir.multiplyScalar(2.5)).add(new THREE.Vector3(0, 0.8, 0))
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

function Scene({ coins, selected, setSelected }) {
  const [hoveredSym, setHoveredSym] = useState(null)
  const controlsRef = useRef(null)

  const maxCap = useMemo(() => Math.max(...coins.map((c) => c.marketCap ?? 0), 1), [coins])
  const minCap = useMemo(() => Math.min(...coins.map((c) => c.marketCap ?? 0)), [coins])
  const maxPct = useMemo(() => Math.max(...coins.map((c) => Math.abs(c.pct24h ?? 0)), 1), [coins])
  const maxVol = useMemo(() => Math.max(...coins.map((c) => c.volume ?? 0), 1), [coins])
  const minVol = useMemo(() => Math.min(...coins.map((c) => c.volume ?? 0)), [coins])

  const top5 = useMemo(
    () => [...coins].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 5).map((c) => c.symbol),
    [coins]
  )

  const half = 4.5

  const positionsBySymbol = useMemo(() => {
    const out = {}
    coins.forEach((coin) => {
      out[coin.symbol] = [
        scaleAxisLog(coin.marketCap, minCap, maxCap, half),
        scaleAxis(coin.pct24h, -maxPct, maxPct, half),
        scaleAxisLog(coin.volume, minVol, maxVol, half),
      ]
    })
    return out
  }, [coins, minCap, maxCap, maxPct, minVol, maxVol])

  const focusPosition = useMemo(() => {
    if (!selected || !positionsBySymbol[selected.symbol]) return null
    return new THREE.Vector3(...positionsBySymbol[selected.symbol])
  }, [selected, positionsBySymbol])

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <fog attach="fog" args={[BG_COLOR, 10, 26]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 8, 6]} intensity={1} />
      <directionalLight position={[-6, -4, -6]} intensity={0.2} color="#4a6fa8" />

      <AxisLines half={half} />
      <CorrelationLines coins={coins} positionsBySymbol={positionsBySymbol} />

      {coins.map((coin) => {
        const position = positionsBySymbol[coin.symbol]
        const radius = normalise(Math.log(Math.max(coin.marketCap, 1)), Math.log(Math.max(maxCap, 1)), 0.12, 0.55)
        const color = coin.symbol === 'BTC' ? GOLD : coin.pct24h >= 0 ? GAIN_BRIGHT : LOSS_BRIGHT
        return (
          <CoinPoint
            key={coin.symbol}
            coin={coin}
            position={position}
            radius={radius}
            color={color}
            showLabel={top5.includes(coin.symbol)}
            hovered={hoveredSym === coin.symbol}
            selected={selected?.symbol === coin.symbol}
            onHover={(c) => setHoveredSym(c?.symbol ?? null)}
            onSelect={setSelected}
          />
        )
      })}

      <OrbitControls ref={controlsRef} enablePan={false} minDistance={4} maxDistance={20} />
      <CameraRig focusPosition={focusPosition} controlsRef={controlsRef} />
    </>
  )
}

// coins: [{ symbol, marketCap, pct24h, volume, sparkline? }] — top 20
export default function CryptoLandscape3D({ coins }) {
  const valid = useMemo(
    () => (coins ?? []).filter((c) => c.marketCap != null && c.volume != null).slice(0, 20),
    [coins]
  )
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!valid.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No crypto market data available for the 3D view.
      </div>
    )
  }

  return (
    <div className="h-full w-full relative" style={{ background: BG_COLOR }} onDoubleClick={() => setSelected(null)}>
      <div className="absolute top-2 left-2 z-10 text-2xs text-terminal-text-dim font-mono leading-relaxed pointer-events-none">
        <div>X · MARKET CAP</div>
        <div>Y · 24H CHANGE</div>
        <div>Z · VOLUME</div>
        <div className="mt-1 text-terminal-gold/70">Lines: 7D correlation &gt;0.7</div>
      </div>
      {selected && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-terminal-header border border-terminal-gold px-4 py-2.5 flex items-center gap-4">
          <div>
            <div className="text-xs font-bold text-terminal-gold">{selected.symbol}</div>
            <div className="text-2xs text-terminal-text-dim">{selected.name || selected.symbol}</div>
          </div>
          <div className="text-right">
            <div className={`text-xs font-bold ${selected.pct24h >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
              {selected.pct24h >= 0 ? '+' : ''}{selected.pct24h?.toFixed(2)}%
            </div>
            <div className="text-2xs text-terminal-text-dim">24H</div>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="text-2xs font-bold text-terminal-gold border border-terminal-gold/40 px-2.5 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >← BACK TO OVERVIEW</button>
        </div>
      )}
      <Canvas camera={{ position: [7, 5, 9], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene coins={valid} selected={selected} setSelected={setSelected} />
        </Suspense>
      </Canvas>
    </div>
  )
}
