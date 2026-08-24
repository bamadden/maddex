import { useEffect, useState } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { ModuleLoader } from '../../components/ui/ModuleStates'
import { generateMorningBrief } from '../../services/morningBriefService'
import { useStore } from '../../store/useStore'
import { dispatchAskAI } from '../../utils/askAI'
import { SentimentBar } from '../../components/ui/SentimentIndicator'
import { useSentiment } from '../../hooks/useSentiment'

// Score bands per spec — angular width is proportional to each band's share
// of the 0-100 range, not evenly split, so the gauge's colour transitions
// land at the same score thresholds the label logic uses.
const BANDS = [
  { from: 0,  to: 30,  color: '#A83232' }, // BEARISH
  { from: 30, to: 50,  color: '#C9A84C' }, // CAUTIOUS (amber-ish gold)
  { from: 50, to: 70,  color: '#E8C96A' }, // NEUTRAL
  { from: 70, to: 85,  color: '#6FCB8F' }, // BULLISH (light green)
  { from: 85, to: 100, color: '#2D8A50' }, // STRONGLY BULLISH
]

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
// Score 0-100 -> angle 180 (left) .. 360/0 (right), sweeping the top half.
const scoreToAngle = (s) => 180 + (s / 100) * 180

function ScoreGauge({ score, label }) {
  const cx = 110, cy = 105, r = 88, strokeW = 16
  const needle = polar(cx, cy, r - strokeW / 2 - 6, scoreToAngle(score))
  const bandColor = BANDS.find((b) => score >= b.from && (score <= b.to || b.to === 100))?.color ?? '#8BA3C4'

  return (
    <div className="flex flex-col items-center">
      <svg width={220} height={120} viewBox="0 0 220 120">
        {BANDS.map((b) => {
          const start = polar(cx, cy, r, scoreToAngle(b.from))
          const end = polar(cx, cy, r, scoreToAngle(b.to))
          return (
            <path
              key={b.from}
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
              fill="none"
              stroke={b.color}
              strokeWidth={strokeW}
              strokeLinecap="butt"
            />
          )
        })}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#E8EDF5" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="#E8EDF5" />
      </svg>
      <div className="text-center -mt-2">
        <div className="text-4xl font-bold" style={{ color: bandColor }}>{score}</div>
        <div className="text-2xs font-bold tracking-widest mt-1" style={{ color: bandColor }}>{label}</div>
      </div>
    </div>
  )
}

const IMPACT_COLOR = { HIGH: 'text-terminal-red', MEDIUM: 'text-terminal-gold', LOW: 'text-terminal-text-dim' }

export default function MorningBriefModule() {
  const { watchlist } = useStore()
  const { sentiment, status: sentimentStatus, error: sentimentError } = useSentiment()
  const [brief, setBrief] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)

  const load = async () => {
    setStatus('loading')
    setError(null)
    try {
      const result = await generateMorningBrief(watchlist)
      setBrief(result)
      setStatus('ready')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  // Deferred via setTimeout(fn, 0) rather than calling load() directly —
  // same pattern NewsModule's MorningBriefing uses, since calling setState
  // synchronously as the effect body runs (load's first line) is what the
  // lint rule flags, not a deferred call from a callback.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="MORNING BRIEF"
        subtitle="Your personalised market brief · generated 7am AEST weekdays"
        moduleId="brief"
        isFetching={status === 'loading'}
        onRefresh={() => {
          try { localStorage.removeItem(`maddex_morning_brief_${new Date().toISOString().split('T')[0]}`) } catch { /* ignore */ }
          load()
        }}
      />

      <div className="flex-1 overflow-y-auto">
        {status === 'loading' && <ModuleLoader name="MORNING BRIEF" />}
        {status === 'error' && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="text-terminal-red text-xl">⚠</span>
            <div className="text-terminal-red text-2xs font-bold tracking-widest">BRIEF UNAVAILABLE</div>
            <div className="text-terminal-text-dim text-2xs max-w-sm">{error}</div>
            <button
              onClick={load}
              className="mt-1 text-2xs text-terminal-gold border border-terminal-gold px-3 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >RETRY</button>
          </div>
        )}

        {status === 'ready' && brief && (
          <div className="p-4 space-y-4">
            {/* Top — headline + gauge */}
            <div className="flex items-center gap-6 flex-wrap border-b border-terminal-border pb-4">
              <ScoreGauge score={brief.maddenAIScore ?? 50} label={brief.scoreLabel ?? 'NEUTRAL'} />
              <div className="flex-1 min-w-[240px]">
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">
                  MADDENAI MARKET SCORE: {brief.maddenAIScore} — {brief.scoreLabel}
                </div>
                <div className="text-terminal-text-bright text-base font-semibold leading-snug">{brief.headline}</div>
                {!brief.isWeekend && (
                  <button
                    onClick={() => dispatchAskAI({ instruction: `Elaborate on today's market brief: "${brief.headline}". Give more detail on what's driving this.` }, { rawPrompt: true })}
                    className="mt-2 text-2xs text-terminal-gold border border-terminal-gold/40 px-2.5 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                  >Ask MaddenAI for more detail →</button>
                )}
              </div>
            </div>

            {/* News sentiment index — a distinct, headline-derived score from
                sentimentService, separate from the brief's own maddenAIScore
                above (that one weighs watchlist/portfolio context too). */}
            <SentimentBar sentiment={sentiment} status={sentimentStatus} error={sentimentError} />

            {/* Middle — sections, 2-col */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(brief.sections ?? []).map((s) => (
                <div key={s.title} className="border border-terminal-border p-3">
                  <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">{s.title}</div>
                  <div className="text-2xs text-terminal-text leading-relaxed">{s.content}</div>
                </div>
              ))}
            </div>

            {/* Bottom — key events timeline */}
            {brief.keyEvents?.length > 0 && (
              <div className="border-t border-terminal-border pt-3">
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">TODAY'S KEY EVENTS</div>
                <div className="space-y-1.5">
                  {brief.keyEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 text-2xs">
                      <span className="text-terminal-text-dim w-20 flex-shrink-0">{e.time}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />
                      <span className="text-terminal-text flex-1">{e.event}</span>
                      <span className={`font-bold ${IMPACT_COLOR[e.impact] ?? 'text-terminal-text-dim'}`}>{e.impact}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
