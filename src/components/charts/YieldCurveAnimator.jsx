import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const SPEEDS = { Slow: 5000, Normal: 2500, Fast: 1000 }

function isInverted(pointsAtT) {
  const short = pointsAtT.find((p) => p.m === '3M' || p.m === '6M')
  const long = pointsAtT.find((p) => p.m === '10Y' || p.m === '30Y')
  if (!short || !long) return false
  return short.y > long.y
}

// curve: { label, color, points: [{m,y}], prev: {m: y} } — from YIELD_CURVES.
// Morphs continuously from `prev` (t=0, "12M ago") to `points` (t=1, "now").
export default function YieldCurveAnimator({ curve }) {
  const [t, setT] = useState(1)          // 0 = 12M ago, 1 = now
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState('Normal')
  const rafRef = useRef(null)
  const dirRef = useRef(1)

  const tenors = useMemo(() => curve.points.map((p) => p.m), [curve])

  const frame = useMemo(
    () => tenors.map((m) => {
      const now = curve.points.find((p) => p.m === m)?.y
      const prev = curve.prev[m] ?? now
      return { tenor: m, yield: parseFloat((prev + (now - prev) * t).toFixed(3)) }
    }),
    [tenors, curve, t]
  )

  const framePoints = frame.map((f) => ({ m: f.tenor, y: f.yield }))
  const inverted = isInverted(framePoints)

  // Bounces t between 0 ("12M ago") and 1 ("now"), flipping direction at
  // each edge — clamping and the direction flip happen inline in the same
  // setT update rather than via a follow-up effect reacting to t, so there's
  // no risk of an extra render cascading off of it.
  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return }
    const durationMs = SPEEDS[speed]
    let start = null
    const step = (ts) => {
      if (start == null) start = ts
      const elapsed = ts - start
      const delta = (elapsed / durationMs) * dirRef.current
      start = ts
      setT((prev) => {
        let next = prev + delta
        if (next >= 1) { next = 1; dirRef.current = -1 }
        else if (next <= 0) { next = 0; dirRef.current = 1 }
        return next
      })
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, speed])

  const togglePlay = () => {
    if (!playing) { dirRef.current = t >= 1 ? -1 : 1; setPlaying(true) }
    else setPlaying(false)
  }

  const allY = [...curve.points.map((p) => p.y), ...Object.values(curve.prev)]
  const yMin = Math.floor(Math.min(...allY) * 10) / 10 - 0.2
  const yMax = Math.ceil(Math.max(...allY) * 10) / 10 + 0.2

  return (
    <div className="flex flex-col">
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span style={{ color: curve.color }}>{curve.label}</span>
        <span className="text-2xs text-terminal-text-dim normal-case font-normal">yield curve · 12M ago → now</span>
        <span className={`ml-auto text-2xs px-1.5 py-0.5 border font-bold ${inverted ? 'border-terminal-red/40 text-terminal-red' : 'border-terminal-green/40 text-terminal-green'}`}>
          {inverted ? 'INVERTED' : 'NORMAL'}
        </span>
      </div>

      <div style={{ height: 220 }} className="px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={frame} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#0d2244" vertical={false} />
            <XAxis dataKey="tenor" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(1)}%`} domain={[yMin, yMax]} width={36} />
            <Tooltip
              contentStyle={{ background: '#0B1628', border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}
              formatter={(v) => [`${v.toFixed(2)}%`, 'Yield']}
            />
            <Line type="monotone" dataKey="yield" stroke={curve.color} strokeWidth={2} dot={{ fill: curve.color, r: 2.5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="px-3 pb-2 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="text-2xs px-3 py-1 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold"
        >{playing ? '⏸ PAUSE' : '▶ PLAY'}</button>

        <input
          type="range" min={0} max={1} step={0.01} value={t}
          onChange={(e) => { setPlaying(false); setT(parseFloat(e.target.value)) }}
          className="flex-1"
        />

        <div className="flex items-center border border-terminal-border rounded-full overflow-hidden">
          {Object.keys(SPEEDS).map((s) => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`text-2xs px-2 py-0.5 font-bold transition-colors ${speed === s ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
            >{s}</button>
          ))}
        </div>

        <span className="text-2xs text-terminal-text-dim font-mono w-24 text-right">
          {t <= 0.02 ? '12M AGO' : t >= 0.98 ? 'NOW' : `T-${Math.round((1 - t) * 12)}M`}
        </span>
      </div>
    </div>
  )
}
