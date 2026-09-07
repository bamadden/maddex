import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { marketSession } from '../../services/newsIntelligence'

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
  if (hour >= 12 && hour < 17) return 'GOOD AFTERNOON'
  if (hour >= 17 && hour < 22) return 'GOOD EVENING'
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

  const name = profile?.first_name?.trim()
  const greeting = greetingFor(auHour(now))
  const session = marketSession(now)
  const open = session.key === 'open'

  const dateStr = now.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  }).toUpperCase()
  const timeStr = now.toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })

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
      <span className="text-2xs text-terminal-text-dim/40 flex-shrink-0">·</span>
      <span className="text-2xs text-terminal-text-dim tracking-wider truncate">{dateStr}</span>

      {/* Session pill, centred. The dot pulses only while the market is
          actually trading — a pulsing dot beside "CLOSED" is a lie the eye
          believes before it reads the word. */}
      <div className="flex-1 flex justify-center min-w-0">
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
          {session.label} · {session.detail}
        </span>
      </div>

      <span className="text-2xs text-terminal-text-bright tabular-nums flex-shrink-0">{timeStr}</span>
      <span className="text-2xs text-terminal-text-dim/50 flex-shrink-0">AEST</span>
    </div>
  )
}
