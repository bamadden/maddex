import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEconomicCalendar, upcomingEvents } from '../../../services/calendarService'
import {WidgetBody, WidgetFigure, WidgetEmpty} from './_shared'
import { goModule } from './navigate'

export default function NextEventWidget() {
  const { data } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  // 90-day window, then take the first — the second argument is a day
  // range, not a count, so asking for 1 means "events in the next day".
  const next = upcomingEvents(data?.events ?? [], 90)?.[0]
  const [now, setNow] = useState(() => Date.now())

  // Ticks every second because this is a countdown; reading the clock in
  // render would leave it frozen until something else re-rendered.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!next) return <WidgetEmpty action="OPEN CALENDAR" onAction={() => goModule('calendar')}>No upcoming events</WidgetEmpty>

  const ms = new Date(next.date).getTime() - now
  const d = Math.max(0, Math.floor(ms / 86400000))
  const h = Math.max(0, Math.floor((ms % 86400000) / 3600000))
  const m = Math.max(0, Math.floor((ms % 3600000) / 60000))

  return (
    <WidgetBody>
      <WidgetFigure value={d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`} sub="UNTIL NEXT EVENT" tone="#C9A84C" />
      <div className="flex-1 min-h-0 flex flex-col justify-end">
        <div className="font-sans text-[11px] leading-snug line-clamp-2" style={{ color: '#E8EDF5' }}>{next.title ?? next.event}</div>
        <div className="font-mono text-[8px] mt-0.5" style={{ color: '#4A6080' }}>
          {new Date(next.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      </div>
    </WidgetBody>
  )
}
