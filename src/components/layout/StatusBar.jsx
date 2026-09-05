import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { USING_MOCK_DATA } from '../../services/api'

// Thin always-on status strip at the very bottom of the terminal.
//
// Everything here is context rather than control: where you are, what the
// market is doing, and whether the data in front of you is current. It exists
// so those three questions never require looking away from what you are
// reading — which is the difference between a terminal and a dashboard.
//
// Kept to 24px and 9px type deliberately; it should be readable when looked
// at and invisible when not.

const SESSIONS = [
  { id: 'ASX',  tz: 'Australia/Sydney', open: [10, 0], close: [16, 0] },
  { id: 'NYSE', tz: 'America/New_York', open: [9, 30], close: [16, 0] },
  { id: 'LSE',  tz: 'Europe/London',    open: [8, 0],  close: [16, 30] },
]

const MODULE_LABEL = {
  dashboard: 'DASHBOARD', markets: 'MARKETS', crypto: 'CRYPTO', fx: 'RATES',
  macro: 'MACRO', global: 'GLOBAL', watchlist: 'WATCHLIST', portfolio: 'PORTFOLIO',
  news: 'NEWS', brief: 'MORNING BRIEF', calendar: 'CALENDAR', screener: 'SCREENER',
  replay: 'MARKET REPLAY', scanner: 'MARKET SCANNER', alerts: 'ALERTS',
}

// Minutes until the next open, so the strip can say how long the wait is
// rather than only that something is shut.
function minutesToOpen(session, now) {
  const local = new Date(now.toLocaleString('en-US', { timeZone: session.tz }))
  const mins = local.getHours() * 60 + local.getMinutes()
  const openMins = session.open[0] * 60 + session.open[1]
  const day = local.getDay()

  let deltaDays = 0
  let target = openMins
  if (day === 6) deltaDays = 2                        // Saturday → Monday
  else if (day === 0) deltaDays = 1                   // Sunday → Monday
  else if (mins >= openMins) deltaDays = day === 5 ? 3 : 1  // after open → next weekday
  else target = openMins

  return deltaDays * 1440 + (target - mins)
}

function isOpen(session, now) {
  const local = new Date(now.toLocaleString('en-US', { timeZone: session.tz }))
  const d = local.getDay()
  if (d === 0 || d === 6) return false
  const mins = local.getHours() * 60 + local.getMinutes()
  return mins >= session.open[0] * 60 + session.open[1]
      && mins < session.close[0] * 60 + session.close[1]
}

export default function StatusBar({ lastUpdated }) {
  const { activeModule, modalAsset } = useStore()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const states = SESSIONS.map((s) => ({ session: s, id: s.id, openNow: isOpen(s, now) }))
  const nextUp = states
    .filter((s) => !s.openNow)
    .map((s) => ({ id: s.id, mins: minutesToOpen(s.session, now) }))
    .filter((s) => Number.isFinite(s.mins) && s.mins > 0)
    .sort((a, b) => a.mins - b.mins)[0]

  const countdown = nextUp
    ? `${Math.floor(nextUp.mins / 60)}h ${nextUp.mins % 60}m to ${nextUp.id} open`
    : null

  // Derived from the ticking `now` state rather than Date.now(), so the
  // render stays pure and the age advances with the same 30s tick.
  const ageSecs = lastUpdated ? Math.max(0, Math.round((now.getTime() - lastUpdated) / 1000)) : null
  const freshness = ageSecs == null
    ? 'awaiting data'
    : ageSecs < 60 ? `updated ${ageSecs}s ago`
    : `updated ${Math.round(ageSecs / 60)}m ago`

  const crumbs = [MODULE_LABEL[activeModule] ?? activeModule?.toUpperCase()]
  if (modalAsset?.symbol) crumbs.push(modalAsset.symbol)

  return (
    <div
      className="hidden md:flex items-center gap-3 px-3 flex-shrink-0 select-none"
      style={{
        height: 24,
        background: '#030912',
        borderTop: '1px solid rgba(201,168,76,0.06)',
        fontFamily: '"IBM Plex Mono", Menlo, Monaco, Consolas, monospace',
        fontSize: 9,
        color: '#4A6080',
      }}
    >
      <span className="truncate min-w-0">{crumbs.join(' › ')}</span>

      <span className="mx-auto flex items-center gap-2 whitespace-nowrap">
        {states.map((s) => (
          <span key={s.id} className={s.openNow ? 'text-terminal-green' : undefined}>
            {s.id} {s.openNow ? 'OPEN' : 'CLOSED'}
          </span>
        ))}
        {countdown && <span className="opacity-70">· {countdown}</span>}
      </span>

      <span className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
        <span
          className={`inline-block w-1 h-1 rounded-full ${
            ageSecs != null && ageSecs < 120 ? 'bg-terminal-green' : 'bg-amber-400'
          }`}
        />
        <span>{USING_MOCK_DATA ? 'LIVE DEMO' : 'LIVE'} · {freshness}</span>
      </span>
    </div>
  )
}
