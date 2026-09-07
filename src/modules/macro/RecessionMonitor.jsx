import { useMemo } from 'react'
import {
  auRecessionRisk, usRecessionRisk, combinedRisk,
  BAND_TONE, STATE_TONE, AU_RECESSIONS,
} from '../../data/recessionRisk'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

// Semicircle gauge, 0-100 left to right.
const R = 46
const CX = 56
const CY = 52
const polar = (pct) => {
  const a = Math.PI * (1 - pct / 100)
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)]
}
const arc = (from, to) => {
  const [x1, y1] = polar(from)
  const [x2, y2] = polar(to)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

const BANDS = [
  { from: 0, to: 35, tone: BAND_TONE.LOW },
  { from: 35, to: 60, tone: BAND_TONE.MODERATE },
  { from: 60, to: 100, tone: BAND_TONE.ELEVATED },
]

function Gauge({ score, band }) {
  const [nx, ny] = polar(score)
  const tone = BAND_TONE[band]
  return (
    <svg viewBox="0 0 112 62" style={{ width: 132, height: 74, overflow: 'visible' }}>
      {BANDS.map((b) => (
        <path
          key={b.from}
          d={arc(b.from, b.to)}
          fill="none"
          stroke={b.tone}
          strokeWidth={6}
          opacity={band && BAND_TONE[band] === b.tone ? 1 : 0.2}
        />
      ))}
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={tone} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={3.5} fill={tone} />
    </svg>
  )
}

function FactorRow({ f }) {
  const filled = f.weight > 0 ? (f.points / f.weight) * 100 : 0
  return (
    <div className="py-2 border-b border-terminal-border/30 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATE_TONE[f.state] }} />
          <span className="text-2xs font-bold text-terminal-text-bright truncate">{f.label}</span>
          <span className="text-2xs text-terminal-gold tabular-nums flex-shrink-0">{f.reading}</span>
        </div>
        <span className="text-2xs text-terminal-text-dim tabular-nums flex-shrink-0">
          {f.points} / {f.weight}
        </span>
      </div>
      <div className="h-1 bg-terminal-border/40 rounded-sm overflow-hidden mb-1">
        <div className="h-full rounded-sm" style={{ width: `${filled}%`, background: STATE_TONE[f.state] }} />
      </div>
      <div className="text-2xs text-terminal-text-dim leading-snug">{f.note}</div>
    </div>
  )
}

function RegionCard({ risk }) {
  return (
    <div className="border border-terminal-border p-3">
      <div className="flex items-start gap-3">
        <Gauge score={risk.score} band={risk.band} />
        <div className="min-w-0 flex-1">
          <div className="text-2xs text-terminal-text-dim tracking-widest">{risk.region.toUpperCase()}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums" style={{ color: BAND_TONE[risk.band] }}>
              {risk.score}
            </span>
            <span className="text-2xs text-terminal-text-dim">/ 100</span>
          </div>
          <div className="text-2xs font-bold tracking-widest" style={{ color: BAND_TONE[risk.band] }}>
            {risk.band}
          </div>
          <div className="text-2xs text-terminal-text-dim/60 mt-0.5">inputs as at {risk.asOf}</div>
        </div>
      </div>

      <div className="mt-2 pt-1 border-t border-terminal-border/40">
        {risk.factors.map((f) => <FactorRow key={f.key} f={f} />)}
      </div>
    </div>
  )
}

export default function RecessionMonitor() {
  const au = useMemo(() => auRecessionRisk(), [])
  const us = useMemo(() => usRecessionRisk(), [])
  const combined = useMemo(() => combinedRisk(), [])

  return (
    <div className="p-3 space-y-3">
      <div className="border border-terminal-border p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">RECESSION RISK MONITOR</span>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-terminal-text-dim">
              {combined.region}: <span className="font-bold" style={{ color: BAND_TONE[combined.band] }}>{combined.score}</span>
            </span>
            <VerifiedBadge dataKey="rba" alwaysShow />
          </div>
        </div>

        {/* THE PROVENANCE PARAGRAPH IS THE POINT OF THIS PANEL.
            A recession probability is the number someone moves to cash on. It
            is stated here as a composite of five published inputs, with the
            rubric visible and every contribution shown, precisely so it cannot
            be mistaken for a forecast — which is what a model-generated
            percentage behind an AI badge would have been. */}
        <div className="text-2xs text-terminal-text-dim leading-relaxed">
          Maddex's own composite, not a third-party measure and not a forecast. Each score is
          the sum of five factors below, computed from verified constants and the published
          yield curve — every contribution is shown, so the number can be checked rather than
          taken. It describes conditions that have historically preceded downturns; it does
          not predict one.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RegionCard risk={au} />
        <RegionCard risk={us} />
      </div>

      <div className="border border-terminal-border p-3">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">
          HOW THE SCORE IS BUILT
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {[
            ['Yield curve inverted (2s10s)', 30],
            ['GDP growth weak or negative', 25],
            ['Unemployment above its trough', 20],
            ['Real policy rate restrictive', 15],
            ['Inflation outside target band', 10],
          ].map(([label, w]) => (
            <div key={label} className="flex items-baseline justify-between gap-2 text-2xs">
              <span className="text-terminal-text-dim truncate">{label}</span>
              <span className="text-terminal-text-bright tabular-nums flex-shrink-0">up to {w}</span>
            </div>
          ))}
        </div>
        <div className="text-2xs text-terminal-text-dim/60 mt-2 leading-relaxed">
          The curve carries the largest weight because it is the most-studied of the five,
          not because this rubric claims it is decisive. Scores of 35+ read as MODERATE and
          60+ as ELEVATED.
        </div>
      </div>

      <div className="border border-terminal-border p-3">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">
          PAST AUSTRALIAN RECESSIONS
        </div>
        <div className="space-y-1">
          {AU_RECESSIONS.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2 text-2xs">
              <span className="text-terminal-text">{r.label}</span>
              <span className="text-terminal-text-dim tabular-nums">
                {new Date(r.from).getFullYear()}–{new Date(r.to).getFullYear()}
              </span>
            </div>
          ))}
        </div>
        <div className="text-2xs text-terminal-text-dim/60 mt-2 leading-relaxed">
          Historical record, for context on how rare these are. Australia went nearly three
          decades between the 1991 recession and 2020.
        </div>
      </div>
    </div>
  )
}
