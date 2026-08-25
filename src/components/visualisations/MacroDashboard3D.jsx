import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import * as THREE from 'three'
import { BG_COLOR, GAIN_BRIGHT, LOSS_BRIGHT, GOLD } from './shared3d'

// Iron Man HUD / Palantir-style control room — a central health orb with
// each macro indicator floating as its own panel in a ring around it,
// connected back to the centre by thin lines.

function CentralOrb({ score }) {
  const ref = useRef(null)

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.2
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
  })

  const color = score > 60 ? GAIN_BRIGHT : score > 40 ? GOLD : LOSS_BRIGHT

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={0.4}
          metalness={0.8} roughness={0.1} transparent opacity={0.9}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.05, 16, 100]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} />
      </mesh>
      <Html center distanceFactor={11}>
        <div style={{ pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 24, color: 'white', fontWeight: 700, textShadow: `0 0 20px ${color}` }}>
            {Math.round(score)}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: GOLD, letterSpacing: '0.2em' }}>
            MACRO SCORE
          </div>
        </div>
      </Html>
    </group>
  )
}

function ConnectionLine({ target }) {
  const points = new Float32Array([0, 0, 0, target[0], target[1], target[2]])
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={GOLD} transparent opacity={0.25} />
    </line>
  )
}

function IndicatorPanel({ indicator, position, rotation }) {
  const [hovered, setHovered] = useState(false)
  const trendColor = indicator.trend === 'IMPROVING' ? GAIN_BRIGHT : indicator.trend === 'DECLINING' ? LOSS_BRIGHT : GOLD

  return (
    <group position={position} rotation={rotation}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
      >
        <planeGeometry args={[2.5, 1.5]} />
        <meshStandardMaterial color="#0B1628" transparent opacity={hovered ? 0.95 : 0.7} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(2.5, 1.5)]} />
        <lineBasicMaterial color={hovered ? GOLD : '#4A6080'} />
      </lineSegments>
      <Html position={[0, 0, 0.3]} center distanceFactor={11} occlude style={{ pointerEvents: 'none' }}>
        <div style={{ width: 200, padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace' }}>
          <div style={{ fontSize: 8, color: '#637899', letterSpacing: '0.15em', marginBottom: 4 }}>
            {indicator.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 20, color: 'white', fontWeight: 700 }}>
            {indicator.current}{indicator.unit}
          </div>
          <div style={{ fontSize: 9, color: trendColor }}>{indicator.trend}</div>
        </div>
      </Html>
    </group>
  )
}

function Scene({ indicators, macroHealthScore }) {
  const radius = 5
  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} color="#4040ff" intensity={0.5} />
      <pointLight position={[-5, -5, 5]} color={GOLD} intensity={0.3} />

      <Stars radius={100} depth={50} count={4000} factor={1} saturation={0} fade speed={0.3} />

      <OrbitControls enablePan={false} minDistance={5} maxDistance={20} />

      <CentralOrb score={macroHealthScore} />

      {indicators.map((ind, i) => {
        const angle = (i / indicators.length) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        return (
          <group key={ind.id}>
            <IndicatorPanel indicator={ind} position={[x, 0, z]} rotation={[0, Math.PI / 2 - angle, 0]} />
            <ConnectionLine target={[x, 0, z]} />
          </group>
        )
      })}

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.4} />
        <ChromaticAberration offset={[0.001, 0.001]} />
      </EffectComposer>
    </>
  )
}

// indicators: [{ id, name, current, unit, trend: 'IMPROVING'|'DECLINING'|'STABLE' }]
// macroHealthScore: 0-100
export default function MacroDashboard3D({ indicators, macroHealthScore }) {
  if (!indicators?.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No macro indicators available.
      </div>
    )
  }
  return (
    <div className="h-full w-full" style={{ background: BG_COLOR }}>
      <Canvas camera={{ position: [0, 0, 12], fov: 60 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene indicators={indicators} macroHealthScore={macroHealthScore} />
        </Suspense>
      </Canvas>
    </div>
  )
}
