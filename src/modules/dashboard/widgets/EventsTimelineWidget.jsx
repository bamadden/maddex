import { useQuery } from '@tanstack/react-query'
import { getEconomicCalendar, pendingEvents } from '../../../services/calendarService'
import { eventStars, starString } from '../../../services/calendarExtras'
import { setModuleIntent } from '../../../services/moduleIntent'
import { sydneyTzAbbr } from '../../../utils/dateUtils'
import { WidgetBody, WidgetEmpty } from './_shared'
import { goModule } from './navigate'

// EVENTS TIMELINE — the next seven days as columns, one per day that has
// something on, from the same calendar the Calendar module reads (dates and
// times checked against the agencies' own schedules there). Importance comes
// from the calendar's own star scoring, so a five-star event here is a
// five-star event there. Clicking an event opens the Calendar on its day.

const TONE = { high: '#E8A33D', medium: '#C9A84C', low: '#637899' }
const MAX_DAYS = 4
const PER_DAY = 2

const dayKey = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

function dayLabel(iso, todayIso) {
  const d = new Date(`${iso}T00:00:00`)
  const t = new Date(`${todayIso}T00:00:00`)
  const diff = Math.round((d - t) / 86400000)
  if (diff === 0) return 'TODAY'
  if (diff === 1) return 'TOMORROW'
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
}

const timeLabel = (e) => {
  if (!/^\d{1,2}:\d{2}$/.test(e.time ?? '')) return 'time TBC'
  const [h, m] = e.time.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'} ${sydneyTzAbbr(e.date)}`
}

export default function EventsTimelineWidget() {
  const { data, isLoading } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  const today = dayKey(new Date())
  const events = pendingEvents(data?.events ?? [], 7)
    .filter((e) => e.importance === 'high' || e.importance === 'medium')

  if (isLoading) return <WidgetEmpty>Loading calendar…</WidgetEmpty>
  if (!events.length) return <WidgetEmpty action="OPEN CALENDAR" onAction={() => goModule('calendar')}>No high-impact events in the next 7 days</WidgetEmpty>

  // Group by day, keep the days in order, most important first within a day.
  const byDay = new Map()
  for (const e of events) {
    if (!byDay.has(e.date)) byDay.set(e.date, [])
    byDay.get(e.date).push(e)
  }
  const days = [...byDay.entries()].slice(0, MAX_DAYS)
    .map(([date, list]) => [date, list.sort((a, b) => eventStars(b) - eventStars(a)).slice(0, PER_DAY)])
  const hidden = events.length - days.reduce((n, [, l]) => n + l.length, 0)

  const open = (date) => { setModuleIntent('calendar', { date }); goModule('calendar') }

  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map(([date, list]) => (
          <div key={date} className="min-w-0 flex flex-col gap-2" style={{ borderLeft: '1px solid rgba(201,168,76,0.12)', paddingLeft: 8 }}>
            <div className="font-mono font-bold truncate" style={{ fontSize: 9, letterSpacing: '0.12em', color: date === today ? '#C9A84C' : '#8BA3C4' }}>
              {dayLabel(date, today)}
            </div>
            {list.map((e, i) => {
              const n = eventStars(e)
              return (
                <button key={i} onClick={() => open(date)} className="text-left min-w-0 hover:opacity-80 transition-opacity" title={`${e.event} — open in Calendar`}>
                  <div className="font-sans text-[11px] leading-tight line-clamp-2" style={{ color: TONE[e.importance] ?? '#E8EDF5' }}>{e.event}</div>
                  <div className="font-mono mt-0.5" style={{ fontSize: 8, color: '#4A6080' }}>{timeLabel(e)}</div>
                  <div className="font-mono" style={{ fontSize: 9, color: TONE[e.importance] ?? '#637899', letterSpacing: '-0.02em' }}>{starString(n)}</div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <button onClick={() => goModule('calendar')} className="font-mono text-left flex-shrink-0 mt-1" style={{ fontSize: 8, color: '#4A6080' }}>
          +{hidden} more this week →
        </button>
      )}
    </WidgetBody>
  )
}
