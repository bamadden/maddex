import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
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

function CoinPoint({ coin, position, radius, color, showLabel, onHover, hovered }) {
  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onHover?.(coin) }}
        onPointerOut={(e) => { e.stopPropagation(); onHover?.(null) }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.7 : 0.3}
          roughness={0.3}
          metalness={0.25}
        />
      </mesh>
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

function Scene({ coins }) {
  const [hoveredSym, setHoveredSym] = useState(null)

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

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <fog attach="fog" args={[BG_COLOR, 10, 26]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 8, 6]} intensity={1} />
      <directionalLight position={[-6, -4, -6]} intensity={0.2} color="#4a6fa8" />

      <AxisLines half={half} />

      {coins.map((coin) => {
        const x = scaleAxisLog(coin.marketCap, minCap, maxCap, half)
        const y = scaleAxis(coin.pct24h, -maxPct, maxPct, half)
        const z = scaleAxisLog(coin.volume, minVol, maxVol, half)
        const radius = normalise(Math.log(Math.max(coin.marketCap, 1)), Math.log(Math.max(maxCap, 1)), 0.12, 0.55)
        const color = coin.symbol === 'BTC' ? GOLD : coin.pct24h >= 0 ? GAIN_BRIGHT : LOSS_BRIGHT
        return (
          <CoinPoint
            key={coin.symbol}
            coin={coin}
            position={[x, y, z]}
            radius={radius}
            color={color}
            showLabel={top5.includes(coin.symbol)}
            hovered={hoveredSym === coin.symbol}
            onHover={(c) => setHoveredSym(c?.symbol ?? null)}
          />
        )
      })}

      <OrbitControls enablePan={false} minDistance={6} maxDistance={20} />
    </>
  )
}

// coins: [{ symbol, marketCap, pct24h, volume }] — top 20
export default function CryptoLandscape3D({ coins }) {
  const valid = useMemo(
    () => (coins ?? []).filter((c) => c.marketCap != null && c.volume != null).slice(0, 20),
    [coins]
  )

  if (!valid.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No crypto market data available for the 3D view.
      </div>
    )
  }

  return (
    <div className="h-full w-full relative" style={{ background: BG_COLOR }}>
      <div className="absolute top-2 left-2 z-10 text-2xs text-terminal-text-dim font-mono leading-relaxed pointer-events-none">
        <div>X · MARKET CAP</div>
        <div>Y · 24H CHANGE</div>
        <div>Z · VOLUME</div>
      </div>
      <Canvas camera={{ position: [7, 5, 9], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene coins={valid} />
        </Suspense>
      </Canvas>
    </div>
  )
}
