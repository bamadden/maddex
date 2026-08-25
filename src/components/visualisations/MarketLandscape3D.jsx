import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { animated, useSpring } from '@react-spring/three'
import { pctToColor, normalise, BG_COLOR, GOLD } from './shared3d'

// Per-stock "building" — height encodes market cap, footprint width encodes
// volume, colour encodes today's performance. Gold cap marks gainers, and
// big movers (>3%) get a slow emissive pulse so the skyline reads at a
// glance which towers are "hot" without needing to hover every one.
function Building({ stock, x, z, height, width, color, onSelect, onHover, hovered }) {
  const meshRef = useRef(null)
  const isMover = Math.abs(stock.changePct) > 3

  const { scale } = useSpring({
    scale: hovered ? 1.08 : 1,
    config: { mass: 1, tension: 280, friction: 22 },
  })

  useFrame((state) => {
    if (!isMover || !meshRef.current) return
    meshRef.current.material.emissiveIntensity = 0.35 + Math.sin(state.clock.elapsedTime * 2 + x) * 0.2
  })

  return (
    <animated.group position={[x, height / 2, z]} scale={scale}>
      <mesh
        ref={meshRef}
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); onHover?.(stock) }}
        onPointerOut={(e) => { e.stopPropagation(); onHover?.(null) }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(stock) }}
      >
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.6 : 0.22}
          metalness={0.55}
          roughness={0.3}
        />
      </mesh>

      {stock.changePct > 0 && (
        <mesh position={[0, height / 2 + 0.03, 0]}>
          <boxGeometry args={[width + 0.03, 0.05, width + 0.03]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} />
        </mesh>
      )}

      {hovered && (
        <Html position={[0, height / 2 + 0.5, 0]} center distanceFactor={11} occlude>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: '#e8edf5',
            background: 'rgba(6,13,26,0.92)',
            border: `1px solid ${color}`,
            borderRadius: 3,
            padding: '4px 8px',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            pointerEvents: 'none',
            transform: 'translateX(-50%)',
          }}>
            <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{stock.symbol.replace('.AX', '')}</div>
            <div style={{ fontWeight: 700, color: '#fff' }}>A${stock.price.toFixed(2)}</div>
            <div style={{ color, fontWeight: 600 }}>
              {stock.changePct >= 0 ? '▲' : '▼'} {Math.abs(stock.changePct).toFixed(2)}%
            </div>
          </div>
        </Html>
      )}
    </animated.group>
  )
}

// Static, non-interactive gold label floating over a sector cluster's
// footprint — always visible so the skyline reads as neighbourhoods, not
// just an undifferentiated grid of towers.
function SectorLabel({ abbr, x, z, avgPct }) {
  const color = pctToColor(avgPct, 2)
  return (
    <Html position={[x, 0.02, z]} center distanceFactor={16} occlude={false}>
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.15em',
        color,
        background: 'rgba(6,13,26,0.75)',
        border: `1px solid ${color}55`,
        borderRadius: 3,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {abbr}
      </div>
    </Html>
  )
}

function Scene({ clusters, onSelect }) {
  const [hoveredSym, setHoveredSym] = useState(null)

  const allStocks = useMemo(() => clusters.flatMap((c) => c.stocks), [clusters])
  const maxCap = useMemo(() => Math.max(...allStocks.map((s) => s.marketCap ?? 0), 1), [allStocks])
  const maxVol = useMemo(() => Math.max(...allStocks.map((s) => s.volume ?? 0), 1), [allStocks])

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <fog attach="fog" args={[BG_COLOR, 20, 48]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[14, 22, 14]} intensity={1} color={GOLD} />
      <pointLight position={[-14, 20, -14]} intensity={0.5} color="#2D7DD2" />
      <directionalLight position={[8, 16, 8]} intensity={0.4} castShadow />

      <Stars radius={100} depth={50} count={2500} factor={2} saturation={0} fade speed={0.4} />

      <gridHelper args={[34, 34, '#4a3a1a', '#1a2b4a']} position={[0, 0, 0]} />

      {clusters.map((cluster) => (
        <SectorLabel key={cluster.name} abbr={cluster.abbr} x={cluster.cx} z={cluster.cz} avgPct={cluster.avgPct} />
      ))}

      {clusters.map((cluster) =>
        cluster.stocks.map((stock) => {
          const height = Math.max(0.4, normalise(Math.log(Math.max(stock.marketCap, 1)), Math.log(Math.max(maxCap, 2)), 0.4, 5.5))
          const width = Math.max(0.35, normalise(Math.log(Math.max(stock.volume, 1)), Math.log(Math.max(maxVol, 2)), 0.35, 0.85))
          return (
            <Building
              key={stock.symbol}
              stock={stock}
              x={stock._x}
              z={stock._z}
              height={height}
              width={width}
              color={pctToColor(stock.changePct, 3)}
              hovered={hoveredSym === stock.symbol}
              onHover={(s) => setHoveredSym(s?.symbol ?? null)}
              onSelect={onSelect}
            />
          )
        })
      )}

      <OrbitControls
        enablePan
        enableZoom
        minDistance={8}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 1, 0]}
      />

      <EffectComposer>
        <Bloom intensity={0.4} luminanceThreshold={0.6} luminanceSmoothing={0.9} />
      </EffectComposer>
    </>
  )
}

// stocks: [{ symbol, name, sector, price, changePct, volume, marketCap }]
// Buildings are clustered spatially by sector (a ring of neighbourhoods)
// rather than a flat grid, so sectors read as distinct districts of the
// skyline. Each district gets its own small grid of towers plus a floating
// gold label at its centre.
export default function MarketLandscape3D({ stocks, onSelect }) {
  const clusters = useMemo(() => {
    const bySector = new Map()
    for (const s of stocks ?? []) {
      if (s.marketCap == null || s.volume == null) continue
      if (!bySector.has(s.sector)) bySector.set(s.sector, [])
      bySector.get(s.sector).push(s)
    }
    const sectorNames = [...bySector.keys()]
    const ringRadius = Math.max(7, sectorNames.length * 1.25)

    return sectorNames.map((name, si) => {
      const angle = (si / sectorNames.length) * Math.PI * 2
      const cx = Math.cos(angle) * ringRadius
      const cz = Math.sin(angle) * ringRadius
      const list = bySector.get(name)
      const cols = Math.ceil(Math.sqrt(list.length))
      const spacing = 1.3
      const offset = ((cols - 1) * spacing) / 2

      const positioned = list.map((s, i) => ({
        ...s,
        _x: cx + (i % cols) * spacing - offset,
        _z: cz + Math.floor(i / cols) * spacing - offset,
      }))
      const avgPct = positioned.reduce((sum, s) => sum + s.changePct, 0) / positioned.length

      return { name, abbr: name.length > 12 ? name.slice(0, 10).toUpperCase() : name.toUpperCase(), cx, cz, stocks: positioned, avgPct }
    })
  }, [stocks])

  if (!clusters.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No stock data available for the 3D cityscape.
      </div>
    )
  }

  return (
    <div className="h-full w-full" style={{ background: BG_COLOR }}>
      <Canvas shadows camera={{ position: [0, 17, 24], fov: 55 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene clusters={clusters} onSelect={onSelect} />
        </Suspense>
      </Canvas>
    </div>
  )
}
