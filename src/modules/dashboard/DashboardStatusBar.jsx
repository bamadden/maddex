import { marketSession } from '../../services/newsIntelligence'
import { sydneyClock, formatDate } from '../../utils/dateUtils'
import { displayService } from '../../services/displayService'
import { RegimeBadge } from '../../components/ui/RegimeBadge'
import IntelligenceScore from './IntelligenceScore'
import { useMarketSentiment, sentimentTooltip } from '../../hooks/useMarketSentiment'
import SentimentClass from '../../components/ui/SentimentClass'

// The market sentiment score, the same number as the top bar and Markets.
function SentimentChip() {
  const ms = useMarketSentiment()
  const s = ms.sentiment
  if (!s) return null
  return (
    <span className="inline-flex items-center gap-1">
    <span className="font-mono font-bold tracking-widest px-2 py-0.5 whitespace-nowrap cursor-help"
      style={{ fontSize: 11, color: s.color ?? PAL.gold, border: '1px solid currentColor', borderRadius: 2 }}
      title={sentimentTooltip(ms)} data-sentiment-score={s.score}>
      SENTIMENT {s.score} · {s.label.toUpperCase()}
    </span>
    <SentimentClass ms={ms} />
    </span>
  )
}
import { useStore } from '../../store/useStore'
import { PAL } from '../../styles/palette.js'
import { useNow } from '../../hooks/useNow'

// The first line of the first screen.
//
// A dashboard that opens with a grid of widgets and nothing else is a control
// panel. One line naming the person, the day and whether the market they care
// about is trading turns it into a briefing — and it costs 32px.
//
// Everything here is derived, nothing is fetched: the date and clock (Sydney),
// and the session from the same marketSession() the news module and status
// bar run on.

export default function DashboardStatusBar() {
  // The shared ticker (hooks/useNow), so this clock and the top bar's change
  // minute in the same render.
  const now = new Date(useNow())

  const { setActiveModule } = useStore()
  const dateStr = formatDate(now, { weekday: true }).toUpperCase()
  const session = marketSession(now)
  const open = session.key === 'open'

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
      {/* The date — not a greeting (1 Nov 2026 copy pass). */}
      <span className="text-2xs tracking-widest text-terminal-gold font-bold truncate">{dateStr}</span>

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
