import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEconomicCalendar, upcomingEvents } from '../../../services/calendarService'
import { WidgetBody, WidgetEmpty } from './_shared'
import { goModule } from './navigate'

const IMPACT = {
  high:   { label: 'HIGH',   colour: '#A83232' },
  medium: { label: 'MED',    colour: '#C9A84C' },
  low:    { label: 'LOW',    colour: '#4A6080' },
}

// The moment an event actually lands.
//
// The countdown previously used `new Date(event.date)`, which ignores the
// event's `time` field and — because a bare 'YYYY-MM-DD' is parsed as UTC
// midnight — resolves to 10am the same day in Sydney. An 11:30 AEST CPI print
// therefore counted down to a time 90 minutes before it, and a 22:30 US
// release counted down to twelve and a half hours before it. Combining the
// two fields as local time fixes both.
function eventTime(e) {
  if (!e?.date) return null
  const hasTime = /^\d{1,2}:\d{2}$/.test(e.time ?? '')
  const t = new Date(`${e.date}T${hasTime ? e.time : '00:00'}:00`)
  return isNaN(t) ? null : t
}

function Segment({ value, unit }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 26 }}>
      <span className="font-mono tabular-nums leading-none" style={{ fontSize: 18, color: '#E8EDF5' }}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="font-mono leading-none mt-1" style={{ fontSize: 7, color: '#4A6080', letterSpacing: '0.14em' }}>
        {unit}
      </span>
    </div>
  )
}

const Colon = () => (
  <span className="font-mono" style={{ fontSize: 14, color: '#2B3A50', marginTop: -6 }}>:</span>
)

export default function NextEventWidget() {
  const { data } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  // 90-day window, then take the first — the second argument is a day
  // range, not a count, so asking for 1 means "events in the next day".
  const events = upcomingEvents(data?.events ?? [], 90)
  const next = events[0]

  const [now, setNow] = useState(() => Date.now())

  // Ticks every second because this is a countdown; reading the clock in
  // render would leave it frozen until something else re-rendered.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!next) return <WidgetEmpty action="OPEN CALENDAR" onAction={() => goModule('calendar')}>No upcoming events</WidgetEmpty>

  const at = eventTime(next)
  const ms = Math.max(0, (at?.getTime() ?? now) - now)
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const sec = Math.floor((ms % 60000) / 1000)

  // Events between now and the end of the coming seven days. Counted from the
  // full list rather than assumed, so a quiet week reads as a quiet week.
  const weekEnd = now + 7 * 86400000
  const thisWeek = events.filter((e) => {
    const t = eventTime(e)?.getTime()
    return t != null && t >= now && t <= weekEnd
  }).length

  const impact = IMPACT[String(next.importance ?? '').toLowerCase()] ?? null

  return (
    <WidgetBody>
      <div className="flex items-center gap-1">
        <Segment value={d} unit="DAY" />
        <Colon />
        <Segment value={h} unit="HR" />
        <Colon />
        <Segment value={m} unit="MIN" />
        <Colon />
        <Segment value={sec} unit="SEC" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1">
        <div className="flex items-start gap-1.5">
          {impact && (
            <span
              className="font-mono flex-shrink-0"
              style={{
                fontSize: 7, letterSpacing: '0.1em', color: impact.colour,
                border: `1px solid ${impact.colour}66`, borderRadius: 2,
                padding: '1px 4px', marginTop: 1,
              }}
            >{impact.label}</span>
          )}
          <span className="font-sans text-[11px] leading-snug line-clamp-2 min-w-0" style={{ color: '#E8EDF5' }}>
            {next.title ?? next.event}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[8px]" style={{ color: '#4A6080' }}>
            {at?.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            {/^\d{1,2}:\d{2}$/.test(next.time ?? '') ? ` · ${next.time}` : ''}
          </span>
          <button
            onClick={() => goModule('calendar')}
            className="font-mono text-[8px] flex-shrink-0"
            style={{ color: '#4A6080' }}
          >{thisWeek} this week →</button>
        </div>
      </div>
    </WidgetBody>
  )
}
