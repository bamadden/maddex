import { useEffect, useState, useMemo } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { SkeletonText } from '../../components/ui/Skeleton'
import { generateMorningBrief, clearBriefCache, listBriefHistory, briefDayKey } from '../../services/morningBriefService'
import { useStore } from '../../store/useStore'
import { dispatchAskAI } from '../../utils/askAI'
import { SentimentBar } from '../../components/ui/SentimentIndicator'
import { useQuery } from '@tanstack/react-query'
import { getEconomicCalendar, upcomingEvents } from '../../services/calendarService'
import { eventStars, starString } from '../../services/calendarExtras'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { useSentiment } from '../../hooks/useSentiment'

// The weekend state.
//
// A morning brief on a Saturday used to be a gauge pinned at 50, one sentence
// saying markets are closed, and two-thirds of an empty screen. That is a
// correct statement and a dead end: the reason someone opens this module on a
// weekend is to prepare for Monday, and it answered nothing.
//
// Everything below is real and already in the app — the week ahead comes from
// the economic calendar, the policy settings from verifiedConstants, and the
// last brief from the local history the module already keeps. Nothing is
// generated to fill the space.
function WeekendBrief({ currentDay }) {
  const { data: cal } = useQuery({
    queryKey: ['econCalendar'],
    queryFn: getEconomicCalendar,
    staleTime: 6 * 60 * 60_000,
  })

  const weekAhead = useMemo(() => {
    const events = upcomingEvents(cal?.events ?? [], 9)
    return [...events]
      .sort((a, b) => eventStars(b) - eventStars(a) || a.dateObj - b.dateObj)
      .slice(0, 6)
      .sort((a, b) => a.dateObj - b.dateObj)
  }, [cal])

  const { rba, fed, au } = VERIFIED_CONSTANTS
  const [now] = useState(() => Date.now())
  const daysToRba = Math.max(0, Math.ceil((new Date(`${rba.nextMeeting}T00:00:00`) - now) / 86400000))

  return (
    <div className="space-y-4">
      <div className="border border-terminal-border p-4">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold text-terminal-text-bright">Markets are closed for the weekend.</span>
          <span className="text-2xs text-terminal-text-dim">Next brief Monday, 7am AEST</span>
        </div>
        <div className="text-2xs text-terminal-text-dim leading-relaxed">
          No brief is generated on non-trading days. What follows is the week ahead and
          where policy stands — everything below is published data, not a forecast.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-terminal-border p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">RBA</span>
            <VerifiedBadge dataKey="rba" alwaysShow />
          </div>
          <div className="text-xl font-bold text-terminal-gold tabular-nums">{rba.cashRate}%</div>
          <div className="text-2xs text-terminal-text-dim mt-0.5">
            {rba.lastDecisionVerb} on {rba.lastDecision}
          </div>
          <div className="text-2xs text-terminal-text mt-1">
            Next meeting {new Date(`${rba.nextMeeting}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            <span className="text-terminal-gold"> · {daysToRba}d</span>
          </div>
        </div>

        <div className="border border-terminal-border p-3">
          <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">US FED</div>
          <div className="text-xl font-bold text-terminal-text-bright tabular-nums">{fed.rateRange}</div>
          <div className="text-2xs text-terminal-text-dim mt-0.5">
            {fed.lastDecisionVerb} on {fed.lastDecision}
          </div>
          <div className="text-2xs text-terminal-text mt-1">
            Next {new Date(`${fed.nextMeeting}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </div>
        </div>

        <div className="border border-terminal-border p-3">
          <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">AU INFLATION</div>
          <div className="text-xl font-bold text-terminal-text-bright tabular-nums">{au.cpi}%</div>
          <div className="text-2xs text-terminal-text-dim mt-0.5">{au.cpiPeriod}</div>
          <div className="text-2xs text-terminal-text mt-1">
            Target band {au.rbaTargetBand} · unemployment {au.unemployment}%
          </div>
        </div>
      </div>

      <div className="border border-terminal-border">
        <div className="px-3 py-2 border-b border-terminal-border/50 flex items-center justify-between">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">THE WEEK AHEAD</span>
          <span className="text-2xs text-terminal-text-dim">next 9 days · by importance</span>
        </div>
        {weekAhead.length === 0 ? (
          <div className="px-3 py-6 text-center text-2xs text-terminal-text-dim">
            No scheduled events in the next nine days.
          </div>
        ) : (
          <div className="divide-y divide-terminal-border/30">
            {weekAhead.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="text-2xs text-terminal-text-dim w-16 flex-shrink-0">
                  {e.dateObj.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })}
                </span>
                <span className="text-2xs text-terminal-text-dim/60 w-12 flex-shrink-0">
                  {e.time && e.time !== '—' ? e.time : ''}
                </span>
                <span className="text-2xs text-terminal-text flex-1 min-w-0 truncate">{e.event}</span>
                <span
                  className="text-2xs flex-shrink-0 font-mono"
                  style={{ color: eventStars(e) >= 5 ? '#A83232' : eventStars(e) >= 4 ? '#C9A84C' : '#637899' }}
                >{starString(eventStars(e))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PreviousBriefs currentDay={currentDay} />
    </div>
  )
}

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

// Previous briefs, collapsed by default.
//
// The value of a daily brief compounds — Monday's beside Thursday's shows how
// the narrative moved, which no single day can. Collapsed because that is a
// deliberate act of looking back, not something to push in front of someone
// reading today's.
function PreviousBriefs({ currentDay }) {
  const [open, setOpen] = useState(null)
  const history = useMemo(
    () => listBriefHistory().filter((h) => h.day !== currentDay),
    [currentDay],
  )
  if (!history.length) return null

  const label = (day) =>
    new Date(`${day}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="border-t border-terminal-border pt-3">
      <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">PREVIOUS BRIEFS</div>
      <div className="flex flex-col gap-1">
        {history.map(({ day, brief }) => (
          <div key={day} className="border border-terminal-border">
            <button
              onClick={() => setOpen((cur) => (cur === day ? null : day))}
              aria-expanded={open === day}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-terminal-accent/10 transition-colors"
            >
              <span className="text-2xs text-terminal-text-bright font-semibold">{label(day)}</span>
              {brief.maddenAIScore != null && (
                <span className="text-2xs text-terminal-text-dim">{brief.maddenAIScore} · {brief.scoreLabel}</span>
              )}
              <span className="ml-auto text-2xs text-terminal-text-dim">{open === day ? '▲' : '▼'}</span>
            </button>
            {open === day && (
              <div className="px-2.5 pb-2.5 border-t border-terminal-border/40 pt-2">
                <div className="text-2xs text-terminal-text-bright font-semibold mb-1.5">{brief.headline}</div>
                {(brief.sections ?? []).map((sec) => (
                  <div key={sec.title} className="mb-2">
                    <div className="text-[9px] text-terminal-gold font-bold tracking-widest mb-0.5">{sec.title}</div>
                    <div className="text-2xs text-terminal-text-dim leading-relaxed">{sec.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MorningBriefModule() {
  const { watchlist } = useStore()
  const { sentiment, status: sentimentStatus, error: sentimentError } = useSentiment()
  const [brief, setBrief] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)

  const [copied, setCopied] = useState(false)

  const load = async ({ force = false } = {}) => {
    setStatus('loading')
    setError(null)
    try {
      if (force) clearBriefCache()
      const result = await generateMorningBrief(watchlist, null, { force })
      setBrief(result)
      setStatus('ready')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  // Plain text, not the JSON. What someone pastes into a message should read
  // as a brief, not as a payload.
  const share = async () => {
    if (!brief) return
    const text = [
      `MADDEX MORNING BRIEF — ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      brief.headline,
      brief.scoreRationale ? `\nMaddenAI score: ${brief.maddenAIScore}/100 — ${brief.scoreLabel}. ${brief.scoreRationale}` : `\nMaddenAI score: ${brief.maddenAIScore}/100 — ${brief.scoreLabel}`,
      '',
      ...(brief.sections ?? []).map((sec) => `${sec.title}\n${sec.content}\n`),
      'General information only — not financial advice.',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — the button simply does not confirm */ }
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
        // Was deleting a UTC-keyed entry by hand. The cache key is now the
        // LOCAL date, so that removed a key that does not exist and left the
        // real one in place — refresh would have appeared to do nothing.
        // clearBriefCache owns the key format instead of this file guessing.
        onRefresh={() => load({ force: true })}
        right={
          brief && !brief.isWeekend ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => load({ force: true })}
                disabled={status === 'loading'}
                className="font-mono text-[9px] tracking-widest px-2 py-1 rounded-sm text-terminal-text-dim hover:text-terminal-gold transition-colors disabled:opacity-40"
                style={{ border: '1px solid rgba(201,168,76,0.2)' }}
              >{status === 'loading' ? 'GENERATING…' : '↻ REGENERATE'}</button>
              <button
                onClick={share}
                className="font-mono text-[9px] tracking-widest px-2 py-1 rounded-sm text-terminal-text-dim hover:text-terminal-gold transition-colors"
                style={{ border: '1px solid rgba(201,168,76,0.2)' }}
              >{copied ? '✓ COPIED' : '⧉ SHARE'}</button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto">
        {status === 'loading' && (
          <div className="p-6 space-y-5">
            <div className="text-2xs text-terminal-gold tracking-widest animate-pulse">GENERATING YOUR BRIEF…</div>
            <SkeletonText lines={4} />
            <SkeletonText lines={3} />
            <SkeletonText lines={5} />
          </div>
        )}
        {status === 'error' && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="text-2xl">{/credit balance/i.test(error ?? '') ? '🤖' : '⚠'}</span>
            <div className="text-terminal-red text-2xs font-bold tracking-widest">
              {/credit balance/i.test(error ?? '') ? 'BRIEF NOT GENERATED' : 'BRIEF UNAVAILABLE'}
            </div>
            <div className="text-terminal-text-dim text-2xs max-w-sm">
              {/credit balance/i.test(error ?? '') ? 'Add Anthropic API credits to generate your daily market brief.' : error}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={load}
                className="text-2xs text-terminal-gold border border-terminal-gold px-3 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
              >RETRY</button>
              {/credit balance/i.test(error ?? '') && (
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xs font-bold text-terminal-bg bg-terminal-gold px-3 py-0.5 hover:bg-terminal-gold-bright transition-colors"
                >ADD CREDITS →</a>
              )}
            </div>
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
                above (that one weighs watchlist/portfolio context too).
                
                Hidden on weekends. The weekend brief reads "50 — NEUTRAL ·
                Markets are closed for the weekend"; rendering a live sentiment
                score of 52 CAUTIOUSLY BULLISH directly beneath it had the
                module stating two different verdicts in a 130px span, which
                reads as a fault rather than as two measures. */}
            {!brief.isWeekend && (
              <SentimentBar sentiment={sentiment} status={sentimentStatus} error={sentimentError} />
            )}

            {brief.isWeekend && <WeekendBrief currentDay={briefDayKey()} />}

            {/* Middle — sections, 2-col */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${brief.isWeekend ? 'hidden' : ''}`}>
              {(brief.sections ?? []).map((s) => (
                <div key={s.title} className="border border-terminal-border p-3">
                  <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">{s.title}</div>
                  <div className="text-2xs text-terminal-text leading-relaxed">{s.content}</div>
                </div>
              ))}
            </div>

            {!brief.isWeekend && <PreviousBriefs currentDay={briefDayKey()} />}

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
