import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { pctToColor, normalise, BG_COLOR } from './shared3d'

// One "mountain" — a box whose height encodes market cap and whose colour
// encodes performance. Sits on a grid laid out in the XZ plane.
function SectorBar({ sector, x, z, height, color, onHover }) {
  const [hovered, setHovered] = useState(false)
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, height / 2, 0]}
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover?.(sector) }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); onHover?.(null) }}
      >
        <boxGeometry args={[1.1, height, 1.1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.55 : 0.18}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      <Html position={[0, height + 0.45, 0]} center distanceFactor={12} occlude>
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
          <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{sector.abbr}</div>
          <div style={{ color, fontWeight: 600 }}>
            {sector.pct >= 0 ? '▲' : '▼'} {Math.abs(sector.pct).toFixed(2)}%
          </div>
        </div>
      </Html>
    </group>
  )
}

function Ground({ size }) {
  return (
    <gridHelper args={[size, size, '#1a2b4a', '#0d1a2e']} position={[0, 0, 0]} />
  )
}

function Scene({ sectors }) {
  const maxCap = useMemo(() => Math.max(...sectors.map((s) => s.marketCap ?? 0), 1), [sectors])
  const cols = Math.ceil(Math.sqrt(sectors.length))
  const spacing = 1.9
  const offset = ((cols - 1) * spacing) / 2

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <fog attach="fog" args={[BG_COLOR, 10, 26]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} color="#4a6fa8" />

      <Ground size={cols * spacing + 4} />

      {sectors.map((sector, i) => {
        const row = Math.floor(i / cols)
        const col = i % cols
        const height = normalise(sector.marketCap, maxCap, 0.5, 4.2)
        return (
          <SectorBar
            key={sector.name}
            sector={sector}
            x={col * spacing - offset}
            z={row * spacing - offset}
            height={height}
            color={pctToColor(sector.pct, 3)}
          />
        )
      })}

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0.5, 0]}
      />
    </>
  )
}

// sectors: [{ name, abbr, pct, marketCap }]
export default function SectorLandscape3D({ sectors }) {
  const valid = useMemo(() => (sectors ?? []).filter((s) => s.marketCap != null), [sectors])

  if (!valid.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No sector data available for the 3D landscape.
      </div>
    )
  }

  return (
    <div className="h-full w-full" style={{ background: BG_COLOR }}>
      <Canvas shadows camera={{ position: [0, 7, 9], fov: 42 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene sectors={valid} />
        </Suspense>
      </Canvas>
    </div>
  )
}
