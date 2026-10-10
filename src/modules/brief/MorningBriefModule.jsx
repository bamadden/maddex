import { useEffect, useState, useMemo } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { SkeletonText } from '../../components/ui/Skeleton'
import { isAuWeekend, getWeekendMessage, generateMorningBrief, clearBriefCache, listBriefHistory, briefDayKey, getCachedBrief } from '../../services/morningBriefService'
import { markMilestone } from '../../services/gettingStarted'
import { canOpenBriefToday, recordBriefDay } from '../../services/usageService'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import { useStore } from '../../store/useStore'
import { dispatchAskAI } from '../../utils/askAI'
import { SentimentBar } from '../../components/ui/SentimentIndicator'
import { useQuery } from '@tanstack/react-query'
import { getEconomicCalendar, upcomingEvents } from '../../services/calendarService'
import { eventStars, starString } from '../../services/calendarExtras'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { useSentiment } from '../../hooks/useSentiment'
import { sydneyTzAbbr } from '../../utils/dateUtils'

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
          <span className="text-2xs text-terminal-text-dim">Next brief Monday, 7am Sydney time</span>
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
          <div className="text-xl font-bold text-terminal-gold tabular-nums">{rba.cashRate.toFixed(2)}%</div>
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
          <div className="text-xl font-bold text-terminal-text-bright tabular-nums">{au.cpi.toFixed(1)}%</div>
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

// Model prose arrives as plain text that sometimes carries markdown. Strip the
// markup rather than render it — a stray "**" reads as a glitch — and turn
// line breaks into paragraphs, or list items where the line is a
// "Name — reason" pair.
const clean = (t) => String(t ?? '').replace(/\*\*|__|^#+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '')
function SectionText({ text }) {
  const lines = clean(text).split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const isList = lines.length > 1 && lines.every((l) => / [—–-] /.test(l) || l.length < 160)
  if (isList) {
    return (
      <ul className="space-y-2">
        {lines.map((l, i) => {
          const m = l.match(/^(.{2,48}?)\s+[—–-]\s+(.+)$/)
          return (
            <li key={i} className="flex gap-2.5">
              <span className="text-terminal-gold flex-shrink-0 mt-[1px]">›</span>
              <span>{m ? <><b className="text-terminal-text-bright font-semibold">{m[1]}</b> — {m[2]}</> : l}</span>
            </li>
          )
        })}
      </ul>
    )
  }
  return <div className="space-y-2.5">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
}

function BriefSection({ title, content }) {
  return (
    <section className="relative pl-5 py-4 pr-4" style={{ background: 'rgba(7,20,40,0.55)', border: '1px solid rgba(201,168,76,0.08)' }}>
      <span className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: '#C9A84C' }} />
      <h3 className="font-mono text-terminal-gold uppercase mb-2" style={{ fontSize: 8, letterSpacing: '0.22em' }}>{title}</h3>
      <div className="font-sans text-terminal-text" style={{ fontSize: 14, lineHeight: 1.7 }}>
        <SectionText text={content} />
      </div>
    </section>
  )
}

const scoreColour = (score) => BANDS.find((b) => score >= b.from && (score <= b.to || b.to === 100))?.color ?? '#8BA3C4'

// Previous briefs, collapsed by default.
//
// The value of a daily brief compounds — Monday's beside Thursday's shows how
// the narrative moved, which no single day can. Collapsed because that is a
// deliberate act of looking back, not something to push in front of someone
// reading today's.
function PreviousBriefs({ currentDay }) {
  const [open, setOpen] = useState(null)
  const history = useMemo(
    () => listBriefHistory(6).filter((h) => h.day !== currentDay).slice(0, 5),
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
                <span className="font-mono font-bold px-1.5 py-px rounded-sm" style={{ fontSize: 9, color: scoreColour(brief.maddenAIScore), border: `1px solid ${scoreColour(brief.maddenAIScore)}55` }}>
                  {brief.maddenAIScore} · {brief.scoreLabel}
                </span>
              )}
              <span className="ml-auto text-2xs text-terminal-text-dim">{open === day ? '▲' : '▼'}</span>
            </button>
            {open === day && (
              <div className="px-2.5 pb-2.5 border-t border-terminal-border/40 pt-2">
                <div className="text-2xs text-terminal-text-bright font-semibold mb-1.5">{brief.headline}</div>
                {(brief.sections ?? []).map((sec) => (
                  <div key={sec.title} className="mb-2.5">
                    <div className="text-[9px] text-terminal-gold font-bold tracking-widest mb-0.5">{sec.title}</div>
                    <div className="text-xs text-terminal-text-dim leading-relaxed"><SectionText text={sec.content} /></div>
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
  const [status, setStatus] = useState('loading') // loading | empty | locked | ready | error
  // Core reads the brief on three days a week; Prime and Apex every day.
  const { limits } = useSubscription()
  const [error, setError] = useState(null)

  const [copied, setCopied] = useState(false)

  const load = async ({ force = false } = {}) => {
    // Weekends short-circuit before the network call. getWeekendMessage()
    // existed in the service and was rendered by nothing, so Saturday and
    // Sunday spent an AI call producing a brief about a market that had not
    // traded — and the reader got a stale-looking one either way.
    //
    // `force` still overrides: someone who presses REGENERATE on a Sunday has
    // asked for it explicitly, and refusing would be the app arguing with them.
    if (!force && isAuWeekend()) {
      setBrief(getWeekendMessage())
      setStatus('ready')
      markMilestone('brief')
      return
    }
    // Opening the module no longer generates. A brief is made at 7am by the
    // auto-generator, or on request below — not as a side effect of looking,
    // which spent a model call on every visit to a day with no brief yet.
    if (!canOpenBriefToday(limits.briefsPerWeek)) { setStatus('locked'); return }
    if (!force) {
      const cached = getCachedBrief()
      if (cached) { setBrief(cached); setStatus('ready'); markMilestone('brief'); recordBriefDay() }
      else setStatus('empty')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      if (force) clearBriefCache()
      const result = await generateMorningBrief(watchlist, null, { force })
      setBrief(result)
      setStatus('ready')
      markMilestone('brief')
      recordBriefDay()
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  // Plain text, not the JSON. What someone pastes into a message should read
  // as a brief, not as a payload.
  const share = async () => {
    if (!brief) return
    const day = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' }).toUpperCase()
    const text = [
      `MADDEX MORNING BRIEF — ${day}`,
      `Market Score: ${brief.maddenAIScore} (${brief.scoreLabel})`,
      '',
      brief.headline,
      brief.scoreDriver ?? brief.scoreRationale ?? '',
      '',
      ...(brief.sections ?? []).map((sec) => `${sec.title}\n${clean(sec.content)}\n`),
      'Generated by MaddenAI · maddex.com.au',
      'General information only — not advice.',
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
        subtitle="Your personalised market brief · generated 7am Sydney time, weekdays"
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
        {status === 'locked' && (
          <div className="relative h-full min-h-[420px]">
            <UpgradePrompt featureKey="briefs" requiredTier="prime"
              message={`You've read ${limits.briefsPerWeek} briefs this week — the Core allowance`} />
          </div>
        )}

        {status === 'empty' && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="w-14 h-14 rounded-full border border-terminal-gold/40 text-terminal-gold flex items-center justify-center" style={{ fontSize: 26 }} aria-hidden="true">☀</span>
            <div className="text-terminal-text-bright text-base font-semibold tracking-wide mt-1">Your brief isn't ready yet</div>
            <div className="text-terminal-text-dim text-sm max-w-sm leading-relaxed">
              Morning briefs generate automatically at 7am on weekdays. Or generate one now.
            </div>
            <button
              onClick={() => load({ force: true })}
              className="mt-2 px-5 py-2 text-xs font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors"
            >GENERATE BRIEF NOW</button>
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
                onClick={() => load({ force: true })}
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

        {status === 'ready' && brief && brief.isWeekend && (
          <div className="p-4 space-y-4">
            <WeekendBrief currentDay={briefDayKey()} />
          </div>
        )}

        {status === 'ready' && brief && !brief.isWeekend && (
          <article className="max-w-[920px] mx-auto px-5 pb-8">
            {/* Masthead */}
            <header className="pt-6 pb-5 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="font-mono text-terminal-gold uppercase" style={{ fontSize: 9, letterSpacing: '0.28em' }}>Morning Intelligence Brief</div>
                <h1 className="font-mono font-bold text-terminal-text-bright mt-1.5" style={{ fontSize: 26, letterSpacing: '0.04em' }}>
                  {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' }).toUpperCase()}
                </h1>
              </div>
              {brief.generatedAt && (
                <div className="font-mono text-terminal-text-dim text-right" style={{ fontSize: 10 }}>
                  Generated {new Date(brief.generatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' })}{' '}
                  {sydneyTzAbbr(new Date(brief.generatedAt).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))}
                </div>
              )}
            </header>

            {/* Score */}
            <div className="flex flex-col items-center text-center py-4">
              <ScoreGauge score={brief.maddenAIScore ?? 50} label={brief.scoreLabel ?? 'NEUTRAL'} />
              {(brief.scoreDriver || brief.scoreRationale) && (
                <div className="font-sans text-terminal-text-dim mt-2 max-w-lg" style={{ fontSize: 13 }}>{brief.scoreDriver ?? brief.scoreRationale}</div>
              )}
              <div className="font-sans text-terminal-text-bright font-semibold mt-4 max-w-2xl leading-snug" style={{ fontSize: 18 }}>{brief.headline}</div>
              <button
                onClick={() => dispatchAskAI({ instruction: `Elaborate on today's market brief: "${brief.headline}". Give more detail on what's driving this.` }, { rawPrompt: true })}
                className="mt-3 text-2xs text-terminal-gold border border-terminal-gold/40 px-2.5 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
              >Ask MaddenAI for more detail →</button>
            </div>

            <div className="my-5" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.55), transparent)' }} />

            <div className="mb-4"><SentimentBar sentiment={sentiment} status={sentimentStatus} error={sentimentError} /></div>

            {/* Sections */}
            <div className="flex flex-col gap-3">
              {(brief.sections ?? []).map((sec) => <BriefSection key={sec.title} title={sec.title} content={sec.content} />)}
            </div>

            {brief.keyEvents?.length > 0 && (
              <div className="mt-5 border-t border-terminal-border pt-3">
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

            {/* Footer */}
            <footer className="mt-6 pt-3 border-t border-terminal-border flex items-center justify-between gap-3 flex-wrap">
              <div className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8, letterSpacing: '0.14em' }}>
                AI-GENERATED SUMMARY · FIGURES FROM VERIFIED AND LIVE DATA ONLY · GENERAL INFORMATION · NOT ADVICE
                {brief.generatedAt && <> · {new Date(brief.generatedAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</>}
              </div>
              <button
                onClick={() => load({ force: true })}
                className="font-mono text-[9px] tracking-widest px-2 py-1 rounded-sm text-terminal-text-dim hover:text-terminal-gold transition-colors"
                style={{ border: '1px solid rgba(201,168,76,0.2)' }}
              >↻ REGENERATE</button>
            </footer>

            <div className="mt-6"><PreviousBriefs currentDay={briefDayKey()} /></div>
          </article>
        )}
      </div>
    </div>
  )
}
