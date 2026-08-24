import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { GAIN_BRIGHT, LOSS_BRIGHT, NEUTRAL, normalise, BG_COLOR } from './shared3d'

// A deterministic pseudo-random layout — stable across re-renders (no
// physics engine needed per spec: holdings just gently float/pulse in
// place via a per-bubble sine offset in useFrame).
function layoutPosition(i, n) {
  const golden = Math.PI * (3 - Math.sqrt(5)) // golden angle, even sphere-ish spread
  const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0  // -1..1, single holding sits centred
  const radiusAtY = Math.sqrt(1 - y * y)
  const theta = golden * i
  const spread = 4.2
  // Vertical extent scales with holding count so a handful of bubbles stay
  // centred in frame instead of being pushed to the top/bottom edge of the
  // camera frustum — full +/-2.4 spread only kicks in once there are enough
  // holdings to actually need it.
  const yExtent = Math.min(2.4, 0.9 + n * 0.25)
  return [
    Math.cos(theta) * radiusAtY * spread,
    y * yExtent,
    Math.sin(theta) * radiusAtY * spread,
  ]
}

function Bubble({ holding, position, radius, color, onSelect, isSelected }) {
  const mesh = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [seed] = useState(() => Math.random() * Math.PI * 2)

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const t = clock.getElapsedTime()
    mesh.current.position.y = position[1] + Math.sin(t * 0.6 + seed) * 0.18
    const pulse = 1 + Math.sin(t * 1.4 + seed) * 0.03
    mesh.current.scale.setScalar(pulse * (hovered || isSelected ? 1.12 : 1))
  })

  return (
    <group position={position}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(holding) }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.65 : 0.3}
          roughness={0.25}
          metalness={0.2}
          transparent
          opacity={0.88}
        />
      </mesh>
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
    </group>
  )
}

function Scene({ holdings, onSelect, selectedSymbol }) {
  const maxVal = useMemo(() => Math.max(...holdings.map((h) => h.mktVal ?? 0), 1), [holdings])
  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <fog attach="fog" args={[BG_COLOR, 8, 24]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1} />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} color="#4a6fa8" />

      {holdings.map((h, i) => {
        const color = h.pnlPct == null ? NEUTRAL : h.pnlPct >= 0 ? GAIN_BRIGHT : LOSS_BRIGHT
        const radius = normalise(h.mktVal, maxVal, 0.35, 1.35)
        return (
          <Bubble
            key={h.symbol}
            holding={h}
            position={layoutPosition(i, holdings.length)}
            radius={radius}
            color={color}
            onSelect={onSelect}
            isSelected={selectedSymbol === h.symbol}
          />
        )
      })}

      <OrbitControls enablePan={false} minDistance={5} maxDistance={16} autoRotate autoRotateSpeed={0.4} />
    </>
  )
}

// holdings: [{ symbol, mktVal, pnlPct }]
export default function Portfolio3D({ holdings, onSelect, selectedSymbol }) {
  const valid = useMemo(() => (holdings ?? []).filter((h) => h.mktVal != null), [holdings])

  if (!valid.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No priced holdings to visualise yet.
      </div>
    )
  }

  return (
    <div className="h-full w-full" style={{ background: BG_COLOR }}>
      <Canvas camera={{ position: [0, 1.5, 9], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene holdings={valid} onSelect={onSelect} selectedSymbol={selectedSymbol} />
        </Suspense>
      </Canvas>
    </div>
  )
}
