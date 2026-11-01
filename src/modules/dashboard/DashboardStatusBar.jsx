import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { marketSession } from '../../services/newsIntelligence'
import { sydneyClock } from '../../utils/dateUtils'
import { displayService } from '../../services/displayService'
import { RegimeBadge } from '../../components/ui/RegimeBadge'
import IntelligenceScore from './IntelligenceScore'
import { useMarketSentiment, sentimentTooltip } from '../../hooks/useMarketSentiment'

// The market sentiment score, the same number as the top bar and Markets.
function SentimentChip() {
  const ms = useMarketSentiment()
  const s = ms.sentiment
  if (!s) return null
  return (
    <span className="font-mono font-bold tracking-widest px-2 py-0.5 whitespace-nowrap cursor-help"
      style={{ fontSize: 11, color: s.color ?? PAL.gold, border: '1px solid currentColor', borderRadius: 2 }}
      title={sentimentTooltip(ms)} data-sentiment-score={s.score}>
      SENTIMENT {s.score} · {s.label.toUpperCase()}
    </span>
  )
}
import { useStore } from '../../store/useStore'
import { PAL } from '../../styles/palette.js'

// The first line of the first screen.
//
// A dashboard that opens with a grid of widgets and nothing else is a control
// panel. One line naming the person, the day and whether the market they care
// about is trading turns it into a briefing — and it costs 32px.
//
// Everything here is derived, nothing is fetched: the greeting from the clock,
// the session from the same marketSession() the news module and status bar run
// on, the name from the profile already in the auth store.

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'GOOD MORNING'
  // Afternoon runs to 6pm: at 5:30 the working day is still on, and the
  // greeting should not jump to evening the moment the ASX closes.
  if (hour >= 12 && hour < 18) return 'GOOD AFTERNOON'
  if (hour >= 18) return 'GOOD EVENING'
  return 'GOOD NIGHT'
}

// Australian hour, not the browser's — the greeting should match the market
// day the user is being briefed on, not the timezone they happen to be in.
function auHour(d) {
  return Number(new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', hour: '2-digit', hour12: false,
  }).format(d))
}

export default function DashboardStatusBar() {
  const profile = useAuthStore((s) => s.profile)
  const [now, setNow] = useState(() => new Date())

  // One second, because the clock shows seconds. The whole bar is text on a
  // fixed-width layout, so a per-second render costs nothing measurable.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { setActiveModule } = useStore()
  const name = profile?.first_name?.trim()
  const greeting = greetingFor(auHour(now))
  const session = marketSession(now)
  const open = session.key === 'open'

  const dateStr = now.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  }).toUpperCase()
  // The same clock as the top bar (sydneyClock): HH:MM with its zone.
  const { time: timeStr, tz } = sydneyClock(now, { hour12: displayService.get('clockFormat') === '12h' })

  return (
    <div
      className="flex items-center gap-3 flex-shrink-0 font-mono"
      style={{
        height: 32, padding: '0 20px', background: '#030912',
        borderBottom: '1px solid rgba(201,168,76,0.08)',
      }}
    >
      <span className="text-2xs tracking-widest text-terminal-gold font-bold truncate">
        {greeting}{name ? <span className="text-terminal-text-bright">{` ${name.toUpperCase()}`}</span> : ''}
      </span>
      {/* At phone width the bar keeps the greeting, the session and the clock;
          the date and the zone label go, or all five overprint each other. */}
      <span className="text-2xs text-terminal-text-dim/40 flex-shrink-0 hidden md:inline">·</span>
      <span className="text-2xs text-terminal-text-dim tracking-wider truncate hidden md:inline">{dateStr}</span>

      {/* Session pill, centred. The dot pulses only while the market is
          actually trading — a pulsing dot beside "CLOSED" is a lie the eye
          believes before it reads the word. */}
      <div className="flex-1 flex justify-center min-w-0 overflow-hidden">
        <span
          className="badge flex items-center gap-1.5 flex-shrink-0"
          style={{
            color: session.colour,
            background: `${session.colour}14`,
            border: `1px solid ${session.colour}40`,
          }}
        >
          <span
            className={`rounded-full flex-shrink-0 ${open ? 'pulse-gold' : ''}`}
            style={{ width: 5, height: 5, background: session.colour }}
          />
          {session.label}<span className="hidden sm:inline"> · {session.detail}</span>
        </span>
        <span className="hidden lg:inline-flex ml-2"><RegimeBadge onClick={() => setActiveModule?.('macro')} /></span>
      </div>

      <span className="hidden md:inline-flex flex-shrink-0"><SentimentChip /></span>
      <span className="hidden md:inline-flex flex-shrink-0"><IntelligenceScore /></span>

      <span title={`Sydney market time (${tz})`} data-clock className="text-2xs text-terminal-text-bright tabular-nums flex-shrink-0 cursor-help">{timeStr}</span>
      <span title={`Sydney market time (${tz})`} className="text-2xs text-terminal-text-dim/60 flex-shrink-0 cursor-help">{tz}</span>
    </div>
  )
}
