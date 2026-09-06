import { useEffect, useState } from 'react'
import { useSentiment } from '../../../hooks/useSentiment'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'

// Five bands rather than three. The old widget coloured everything above 60
// the same green, which put "cautiously bullish" and "strongly bullish" in one
// bucket — the two readings a person would act on differently.
const BANDS = [
  { min: 0,  max: 20,  colour: '#A83232', label: 'BEARISH' },
  { min: 20, max: 40,  colour: '#C4653A', label: 'CAUTIOUS' },
  { min: 40, max: 60,  colour: '#C9A84C', label: 'NEUTRAL' },
  { min: 60, max: 80,  colour: '#6FA34A', label: 'CONSTRUCTIVE' },
  { min: 80, max: 100, colour: '#2D8A50', label: 'BULLISH' },
]

const bandFor = (score) => BANDS.find((b) => score >= b.min && score < b.max) ?? BANDS[BANDS.length - 1]

// Semicircle geometry. The gauge sweeps 180° from due west to due east, so a
// score of 0 puts the needle hard left and 100 hard right.
const R = 42
const CX = 50
const CY = 48
const polar = (pct) => {
  const angle = Math.PI * (1 - pct / 100)
  return [CX + R * Math.cos(angle), CY - R * Math.sin(angle)]
}

// One arc segment per band, drawn as a stroked path along the same circle.
function bandArc({ min, max }) {
  const [x1, y1] = polar(min)
  const [x2, y2] = polar(max)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// "Updated Xh ago", from a real timestamp.
//
// Only rendered when the score carries one. A sentiment object cached before
// generatedAt existed has no honest answer to "how old is this", and inventing
// "just now" for it would be worse than leaving the line off.
function freshness(generatedAt, now) {
  if (!generatedAt) return null
  const mins = Math.floor((now - new Date(generatedAt).getTime()) / 60000)
  if (!Number.isFinite(mins) || mins < 0) return null
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Updated ${hrs}h ago`
  return `Updated ${Math.floor(hrs / 24)}d ago`
}

export default function MarketScoreWidget() {
  const { sentiment, status } = useSentiment()
  const score = sentiment?.score
  const band = score == null ? null : bandFor(score)

  // The needle animates from the neutral midpoint to the real score on first
  // paint. Started off-value deliberately: the sweep is what tells the eye
  // which direction the reading sits from neutral, which a needle that simply
  // appears in place does not.
  const [swept, setSwept] = useState(false)
  useEffect(() => {
    if (score == null) return
    const id = requestAnimationFrame(() => setSwept(true))
    return () => cancelAnimationFrame(id)
  }, [score])

  // Ticks every minute so "updated 3m ago" does not sit at "just now" all
  // session. Cheap — one setState a minute on a widget that is already mounted.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const needlePct = swept && score != null ? score : 50
  const [nx, ny] = polar(needlePct)

  // The driver line — what actually moved the score, taken from the model's
  // own read of the headlines. Never synthesised here: when the sentiment
  // service returned neither drivers nor a theme, the line is simply absent.
  const driver = sentiment?.keyTheme ?? sentiment?.drivers?.[0] ?? sentiment?.summary ?? null
  const stamp = freshness(sentiment?.generatedAt, now)

  return (
    <WidgetBody>
      <div className="flex items-start gap-3 min-w-0">
        <svg viewBox="0 0 100 56" style={{ width: 92, height: 52, flexShrink: 0, overflow: 'visible' }}>
          {BANDS.map((b) => (
            <path
              key={b.min}
              d={bandArc(b)}
              fill="none"
              stroke={b.colour}
              strokeWidth={5}
              strokeLinecap="butt"
              opacity={band && band.min === b.min ? 1 : 0.22}
              style={{ transition: 'opacity 400ms ease' }}
            />
          ))}
          {score != null && (
            <>
              <line
                x1={CX} y1={CY} x2={nx} y2={ny}
                stroke={band.colour} strokeWidth={2} strokeLinecap="round"
                style={{ transition: 'all 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
              <circle cx={CX} cy={CY} r={3} fill={band.colour} />
            </>
          )}
        </svg>

        <div className="min-w-0 flex-1">
          <div
            className="font-mono tabular-nums leading-none"
            style={{ fontSize: 26, color: band?.colour ?? '#8BA3C4' }}
          >
            {score ?? '·'}
          </div>
          <div
            className="font-mono text-[9px] mt-1 truncate"
            style={{ color: '#8BA3C4', letterSpacing: '0.08em' }}
          >
            {(sentiment?.label ?? (status === 'loading' ? 'Analysing…' : '—')).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1">
        {driver && (
          <div className="font-sans text-[10px] leading-snug line-clamp-2" style={{ color: '#8BA3C4' }}>
            {driver}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => goModule('markets')} className="font-mono text-[9px] tracking-widest" style={{ color: '#4A6080' }}>
            MARKETS →
          </button>
          {stamp && <span className="font-mono text-[8px] truncate" style={{ color: '#3A4E68' }}>{stamp}</span>}
        </div>
      </div>
    </WidgetBody>
  )
}
