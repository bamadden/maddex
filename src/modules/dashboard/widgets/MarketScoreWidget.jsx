import { useEffect, useState } from 'react'
import { useSentiment } from '../../../hooks/useSentiment'
import { useMarketSentiment, sentimentTooltip } from '../../../hooks/useMarketSentiment'
import SentimentClass from '../../../components/ui/SentimentClass'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'
import { currentRegime } from '../../../services/marketRegime'
import { PAL } from '../../../styles/palette.js'
import ScoreNote from '../../../components/ui/ScoreNote'

// Five colour bands for the gauge: how far the session's moves were from
// balanced, in either direction. Colour describes direction, not a call.
const BANDS = [
  { min: 0,  max: 20,  colour: PAL.down, label: 'STRONGLY NEGATIVE' },
  { min: 20, max: 40,  colour: '#C4653A', label: 'NEGATIVE' },
  { min: 40, max: 60,  colour: PAL.gold, label: 'BALANCED' },
  { min: 60, max: 80,  colour: '#6FA34A', label: 'POSITIVE' },
  { min: 80, max: 100, colour: PAL.up, label: 'STRONGLY POSITIVE' },
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
  // The number is the one market sentiment score (useMarketSentiment), the
  // same as the top bar, Markets and News. MaddenAI's daily read of the
  // headlines (useSentiment) supplies only the words underneath.
  const ms = useMarketSentiment()
  const score = ms.sentiment?.score
  const band = score == null ? null : bandFor(score)
  const { sentiment: read } = useSentiment()

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
  const driver = read?.keyTheme ?? read?.drivers?.[0] ?? (read?.source === 'keyword' ? null : read?.summary) ?? null
  const stamp = freshness(read?.generatedAt, now)
  const [regime] = useState(() => currentRegime())

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
            // 28px and 600 weight. The score is the single number this widget
            // exists to deliver; at 26 regular it was competing with the
            // index levels two cells down rather than leading them.
            style={{ fontSize: 28, fontWeight: 600, color: band?.colour ?? PAL.dim }}
            title={sentimentTooltip(ms)}
            data-sentiment-score={score ?? undefined}
          >
            {score ?? '—'}
          </div>
          <div
            className="font-mono text-[11px] mt-1 truncate font-semibold"
            style={{ color: PAL.dim, letterSpacing: '0.08em' }}
          >
            {score != null ? ms.sentiment.label.toUpperCase() : ms.status === 'loading' ? 'READING MARKET DATA…' : 'NO MARKET DATA YET'}
          </div>
          <div className="font-mono text-[11px] mt-0.5" style={{ color: PAL.muted }} title={sentimentTooltip(ms)}>
            {ms.demo ? 'MARKET SENTIMENT · DEMO COMPOSITE' : 'MARKET SENTIMENT · COMPUTED BY MADDEX'}{ms.stale ? ' · STALE INPUTS' : ''}
          </div>
          <SentimentClass ms={ms} className="mt-1" />
          <ScoreNote method="sentiment" inputs={ms.inputs} asOf={ms.asOf} className="mt-1" />
        </div>
      </div>

        {/* justify-between, not justify-end: the body belongs directly under
            the hero it describes, and only the footer meta belongs at the
            bottom of the card. Pinning both to the bottom opened a band of
            empty panel under the hero once dashboard cells started stretching,
            which read as the widget having failed to finish loading. */}
      <div className="flex-1 min-h-0 flex flex-col justify-between gap-2">
        <div className="min-w-0">
          {driver && (
            <div className="font-sans text-[11px] leading-snug line-clamp-2" style={{ color: PAL.dim }} title="MaddenAI's daily read of the headlines (words only; it does not set the score)">
              <span className="font-mono text-[11px] tracking-widest" style={{ color: PAL.muted }}>HEADLINES · </span>{driver}
            </div>
          )}
          {/* The other drivers the model named — from the same read of the
              headlines, never synthesised here. */}
          {(read?.drivers ?? []).filter((d) => d && d !== driver).slice(0, 3).map((d) => (
            <div key={d} className="font-sans text-[11px] leading-snug mt-1 flex gap-1.5 min-w-0" style={{ color: PAL.dim }}>
              <span style={{ color: band?.colour ?? PAL.muted }}>•</span><span className="line-clamp-1">{d}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-1.5 font-mono" style={{ fontSize: 11 }}>
            <span style={{ color: PAL.muted, letterSpacing: '0.14em' }}>REGIME</span>
            <span className="font-bold" style={{ color: regime.colour, letterSpacing: '0.1em' }}>{regime.regime}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => goModule('markets')} className="font-mono text-[11px] tracking-widest" style={{ color: PAL.muted }}>
            MARKETS →
          </button>
          {stamp && <span className="font-mono text-[11px] truncate" style={{ color: PAL.muted }}>{stamp}</span>}
        </div>
      </div>
    </WidgetBody>
  )
}
