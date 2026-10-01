import { useQuery } from '@tanstack/react-query'
import { getEconomicCalendar, pendingEvents } from '../../../services/calendarService'
import {WidgetBody, WidgetEmpty} from './_shared'
import { goModule } from './navigate'

export default function CalendarEventsWidget() {
  const { data } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  // Day window, then slice to three — see NextEventWidget.
  const events = pendingEvents(data?.events ?? [], 90).slice(0, 3)

  if (!events.length) return <WidgetEmpty action="OPEN CALENDAR" onAction={() => goModule('calendar')}>No upcoming events</WidgetEmpty>

  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 flex flex-col gap-2 justify-start">
        {events.map((e, i) => (
          <button key={i} onClick={() => goModule('calendar')} className="text-left min-w-0">
            <div className="font-sans text-[11px] truncate" style={{ color: '#E8EDF5' }}>{e.title ?? e.event}</div>
            <div className="font-mono text-[8px] mt-0.5" style={{ color: '#4A6080' }}>
              {new Date(`${e.date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
              {/^\d{1,2}:\d{2}$/.test(e.time ?? '') ? ` · ${e.time}` : ''}
            </div>
          </button>
        ))}
      </div>
    </WidgetBody>
  )
}
