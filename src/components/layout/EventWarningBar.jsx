import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEconomicCalendar, eventInstant } from '../../services/calendarService'
import { askMaddenAI } from '../../utils/askAI'
import { sydneyTzAbbr } from '../../utils/dateUtils'

// "⏰ FOMC Rate Decision in 4h — high impact event", under the top bar, when
// a high-impact release is less than 24 hours away. One event at a time, the
// soonest. Dismissing hides that event only; the next one still appears.
// Untimed events are skipped — "in 9 hours" needs a time to count down to.

const WINDOW = 24 * 3_600_000
const DISMISSED_KEY = 'maddex_event_bar_dismissed'
const readDismissed = () => { try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') } catch { return [] } }
const eventId = (e) => `${e.date}|${e.time}|${e.event}`

function countdown(ms) {
  const m = Math.max(1, Math.round(ms / 60_000))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r && h < 6 ? `${h}h ${r}m` : `${h} hour${h === 1 ? '' : 's'}`
}

export default function EventWarningBar() {
  const [now, setNow] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState(readDismissed)
  const { data } = useQuery({ queryKey: ['economicCalendar'], queryFn: getEconomicCalendar, staleTime: 30 * 60_000 })

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const next = (data?.events ?? [])
    .filter((e) => String(e.importance).toLowerCase() === 'high' && /^\d{1,2}:\d{2}$/.test(e.time ?? ''))
    .map((e) => ({ e, at: eventInstant(e)?.getTime() }))
    .filter(({ e, at }) => at && at > now && at - now <= WINDOW && !dismissed.includes(eventId(e)))
    .sort((a, b) => a.at - b.at)[0]
  if (!next) return null

  const { e, at } = next
  const when = `${e.time} ${sydneyTzAbbr(e.date)}`
  const dismiss = () => {
    const list = [...dismissed, eventId(e)].slice(-50)
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(list)) } catch { /* private mode */ }
    setDismissed(list)
  }

  return (
    <div role="status" className="w-full px-3 py-1 flex items-center justify-center gap-3 flex-shrink-0 border-b font-mono text-2xs"
      style={{ background: 'rgba(245, 197, 66, 0.10)', borderColor: 'rgba(245, 197, 66, 0.35)' }}>
      <span aria-hidden="true">⏰</span>
      <span className="text-terminal-gold font-semibold tracking-wide">
        {e.event} in {countdown(at - now)} <span className="text-terminal-text-dim font-normal">· {when} · high impact event</span>
      </span>
      <button
        onClick={() => askMaddenAI(`${e.event} is due at ${when} on ${e.date}${e.description ? ` (${e.description})` : ''}. What should I watch for in this release, and how might ASX sectors and the AUD react either way? Do not state forecasts or consensus figures you have not been given.`)}
        className="px-2 py-0.5 bg-terminal-gold text-terminal-bg font-bold tracking-wide hover:bg-terminal-gold-bright"
      >WHAT TO WATCH ▶</button>
      <button onClick={dismiss} aria-label="Dismiss event warning" className="text-terminal-text-dim hover:text-terminal-text">✕</button>
    </div>
  )
}
