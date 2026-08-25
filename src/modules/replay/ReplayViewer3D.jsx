import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { GAIN_BRIGHT, LOSS_BRIGHT, GOLD, BG_COLOR } from '../../components/visualisations/shared3d'

const BAR_WIDTH = 0.7
const BAR_DEPTH = 0.7
const BAR_GAP = 0.3
const STEP = BAR_WIDTH + BAR_GAP

// A single day's bar — grows in from height 0 when it first mounts (i.e.
// the day the replay just stepped/played to), matching "new bar appears
// and grows as replay plays forward" from the brief.
function DayBar({ index, height, color, isLatest, date, level }) {
  const ref = useRef(null)
  const grownRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    grownRef.current = Math.min(1, grownRef.current + delta * 4)
    const h = height * grownRef.current
    ref.current.scale.y = Math.max(0.001, h / height)
    ref.current.position.y = h / 2
  })

  const x = index * STEP

  return (
    <group position={[x, 0, 0]}>
      <mesh ref={ref} position={[0, height / 2, 0]}>
        <boxGeometry args={[BAR_WIDTH, height, BAR_DEPTH]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isLatest ? 0.6 : 0.2}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
      {isLatest && (
        <Html position={[0, height + 0.5, 0]} center distanceFactor={13} occlude>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#0B1628',
            background: GOLD, borderRadius: 3, padding: '2px 8px', whiteSpace: 'nowrap',
            fontWeight: 700, pointerEvents: 'none',
          }}>
            {date.slice(5)} · {level.toFixed(1)}
          </div>
        </Html>
      )}
    </group>
  )
}

function EventAnnotation({ x, text }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 30); return () => clearTimeout(t) }, [text])
  return (
    <Html position={[x, 4.5, 0]} center distanceFactor={13} occlude={false}>
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#e8edf5',
        background: 'rgba(6,13,26,0.95)', border: `1px solid ${GOLD}`, borderRadius: 4,
        padding: '6px 10px', width: 200, pointerEvents: 'none',
        opacity: visible ? 1 : 0, transform: `scale(${visible ? 1 : 0.7}) translateY(${visible ? 0 : 10}px)`,
        transition: 'opacity 220ms ease-out, transform 220ms ease-out',
      }}>
        <div style={{ color: GOLD, fontWeight: 700, letterSpacing: '0.1em', fontSize: 8, marginBottom: 3 }}>⚡ ON THIS DAY</div>
        {text}
      </div>
    </Html>
  )
}

// Recentres the camera/orbit target on the latest bar whenever the series
// grows — a lightweight stand-in for the brief's "follow mode", layered
// under free OrbitControls dragging rather than a separate exclusive mode.
function FollowRig({ targetX, controlsRef }) {
  const { camera } = useThree()
  const desired = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    desired.set(targetX, 1.5, 8)
    camera.position.lerp(desired, 0.04)
    controls.target.lerp(new THREE.Vector3(targetX, 1, 0), 0.04)
    controls.update()
  })
  return null
}

function Scene({ series, event }) {
  const controlsRef = useRef(null)
  const levels = series.map((d) => d.level)
  const minLevel = Math.min(...levels)
  const maxLevel = Math.max(...levels)
  const range = Math.max(maxLevel - minLevel, 1)

  const latestX = (series.length - 1) * STEP

  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      <fog attach="fog" args={[BG_COLOR, 14, 34]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 10, 8]} intensity={1} />
      <directionalLight position={[-6, 4, -6]} intensity={0.2} color="#4a6fa8" />

      <gridHelper args={[STEP * series.length + 6, 24, '#1a2b4a', '#0d1a2e']} position={[latestX / 2, 0, 0]} />

      {series.map((d, i) => {
        const prev = series[i - 1]?.level ?? d.level
        const isLatest = i === series.length - 1
        const height = Math.max(0.15, ((d.level - minLevel) / range) * 5 + 0.3)
        const color = isLatest ? GOLD : d.level >= prev ? GAIN_BRIGHT : LOSS_BRIGHT
        return (
          <DayBar key={d.date} index={i} height={height} color={color} isLatest={isLatest} date={d.date} level={d.level} />
        )
      })}

      {event && <EventAnnotation x={latestX} text={event.text} />}

      <OrbitControls ref={controlsRef} enablePan minDistance={4} maxDistance={40} />
      <FollowRig targetX={latestX} controlsRef={controlsRef} />
    </>
  )
}

// series: [{date, level}] oldest-first, ending at the current replay date.
// event: { date, text } | null — shown as a pop-in annotation over the
// latest bar when it matches the current date.
export default function ReplayViewer3D({ series, event }) {
  if (!series?.length) {
    return (
      <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">
        No replay data to visualise yet.
      </div>
    )
  }
  return (
    <div className="h-full w-full relative" style={{ background: BG_COLOR }}>
      <div className="absolute top-2 left-2 z-10 text-2xs text-terminal-text-dim font-mono leading-relaxed pointer-events-none">
        <div>Bar height · index level</div>
        <div><span style={{ color: GAIN_BRIGHT }}>green</span> up · <span style={{ color: LOSS_BRIGHT }}>red</span> down · <span style={{ color: GOLD }}>gold</span> today</div>
      </div>
      <Canvas camera={{ position: [(series.length - 1) * STEP, 1.5, 8], fov: 50 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene series={series} event={event} />
        </Suspense>
      </Canvas>
    </div>
  )
}
