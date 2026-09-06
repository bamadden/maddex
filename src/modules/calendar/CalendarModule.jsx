import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import ModuleHeader from '../../components/ui/ModuleHeader'
import {
  eventStars, starString, earningsSeason, buildIcs, eventInstant,
  REMINDER_OFFSETS, addReminder, removeReminder, dismissReminder,
  remindersForEvent, pendingReminders,
} from '../../services/calendarExtras'
import { getEconomicCalendar, upcomingEvents } from '../../services/calendarService'
import { LAST_DECISIONS } from '../../services/centralBankSchedule'
import { upcomingEarnings } from '../../services/earningsCalendar'
import { dispatchAskAI } from '../../utils/askAI'
import { logActivity } from '../../services/activityLogService'

const REGION_FLAGS = { AU: '🇦🇺', US: '🇺🇸', CN: '🇨🇳', JP: '🇯🇵', UK: '🇬🇧' }
const IMPORTANCE_COLOR = { high: 'text-terminal-red', medium: 'text-terminal-gold', low: 'text-terminal-muted' }
const IMPORTANCE_BORDER = { high: 'border-l-terminal-red', medium: 'border-l-terminal-gold', low: 'border-l-terminal-muted' }

const FILTERS = [
  { key: 'all',      label: 'ALL' },
  { key: 'AU',       label: '🇦🇺 AU' },
  { key: 'US',       label: '🇺🇸 US' },
  { key: 'earnings', label: '📊 EARNINGS' },
  { key: 'cb',       label: '🏦 CB' },
  { key: 'high',     label: 'HIGH ONLY' },
]

const CB_KEYWORDS = ['RBA', 'FOMC', 'Fed', 'ECB', 'Bank of', 'Reserve Bank']

function isCentralBank(eventName) {
  return CB_KEYWORDS.some((kw) => eventName.includes(kw))
}

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  if (!target) return null
  const diff = target.getTime() - now
  if (diff <= 0) return null
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  }
}

// ─── Mini month calendar ─────────────────────────────────────────────────────

function MonthCalendar({ month, onMonthChange, selectedKey, onSelect, eventDays, todayKey }) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="p-2 border-b border-terminal-border flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onMonthChange(new Date(year, m - 1, 1))} className="text-terminal-text-dim hover:text-terminal-gold px-1">←</button>
        <span className="text-2xs font-bold text-terminal-gold tracking-wider">
          {month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }).toUpperCase()}
        </span>
        <button onClick={() => onMonthChange(new Date(year, m + 1, 1))} className="text-terminal-text-dim hover:text-terminal-gold px-1">→</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-[9px] text-terminal-text-dim/50 py-0.5">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />
          const dateObj = new Date(year, m, d)
          const key = toDateKey(dateObj)
          const isToday = key === todayKey
          const isPast = key < todayKey
          const isSelected = key === selectedKey
          const hasEvents = eventDays.has(key)
          return (
            <button
              key={i}
              onClick={() => onSelect(key)}
              className={`relative text-2xs py-1 rounded-sm transition-colors ${
                isSelected ? 'border border-terminal-gold' : 'border border-transparent hover:bg-terminal-surface2'
              } ${isPast && !isToday ? 'opacity-40' : ''}`}
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${isToday ? 'bg-terminal-gold text-terminal-bg font-bold' : 'text-terminal-text-bright'}`}>
                {d}
              </span>
              {hasEvents && !isToday && <span className="block w-1 h-1 rounded-full bg-terminal-gold mx-auto mt-0.5" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Left panel: upcoming list ───────────────────────────────────────────────

function groupEvents(events) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekEnd = new Date(today.getTime() + 7 * 86400000)
  const nextWeekEnd = new Date(today.getTime() + 14 * 86400000)
  const groups = { TODAY: [], 'THIS WEEK': [], 'NEXT WEEK': [], LATER: [] }
  for (const e of events) {
    const d = e.dateObj
    if (d.getTime() === today.getTime()) groups.TODAY.push(e)
    else if (d < weekEnd) groups['THIS WEEK'].push(e)
    else if (d < nextWeekEnd) groups['NEXT WEEK'].push(e)
    else groups.LATER.push(e)
  }
  return groups
}

function UpcomingList({ events, onSelect, selectedKey }) {
  const groups = useMemo(() => groupEvents(events), [events])
  return (
    <div className="flex-1 overflow-y-auto thin-scrollbar">
      {Object.entries(groups).map(([label, items]) => items.length > 0 && (
        <div key={label}>
          <div className="px-2 py-1 text-[9px] font-bold text-terminal-text-dim/60 tracking-widest bg-terminal-header/50 sticky top-0">{label}</div>
          {items.map((e, i) => {
            const key = toDateKey(e.dateObj)
            return (
              <button
                key={`${key}-${i}`}
                onClick={() => onSelect(key)}
                className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 border-b border-terminal-border/30 hover:bg-terminal-surface2 transition-colors ${
                  selectedKey === key ? 'bg-terminal-gold/10' : ''
                }`}
              >
                <span className="flex-shrink-0">{e.type === 'earnings' ? '📊' : (REGION_FLAGS[e.region] ?? '🌐')}</span>
                <span className="text-2xs text-terminal-text-dim flex-shrink-0 w-14">
                  {e.dateObj.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-2xs text-terminal-text-bright flex-1 min-w-0 truncate">{e.label}</span>
                <Stars event={e} />
                <span className={`text-[9px] font-bold flex-shrink-0 ${IMPORTANCE_COLOR[e.importance] ?? 'text-terminal-muted'}`}>
                  ●{e.importance?.toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>
      ))}
      {events.length === 0 && (
        <div className="p-4 text-center text-2xs text-terminal-text-dim">No events match this filter</div>
      )}
    </div>
  )
}

// ─── Right panel: countdown widget ───────────────────────────────────────────

function CountdownWidget({ event }) {
  const countdown = useCountdown(event?.dateObj ?? null)
  if (!event || !countdown) return null
  const total = 30 * 86400000
  const remaining = ((countdown.d * 24 + countdown.h) * 60 + countdown.m) * 60000 + countdown.s * 1000
  const pct = Math.max(2, Math.min(100, 100 - (remaining / total) * 100))
  return (
    <div className="bg-terminal-surface border border-terminal-border-gold p-3 mb-3">
      <div className="text-2xs font-bold text-terminal-gold tracking-widest mb-2">TIME UNTIL {event.label.toUpperCase()}</div>
      <div className="h-2 bg-terminal-border rounded-sm overflow-hidden mb-2">
        <div className="h-full bg-terminal-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-lg font-mono font-bold text-white">
        {countdown.d}D {countdown.h}H {countdown.m}M {countdown.s}S
      </div>
    </div>
  )
}

// ─── Event cards ──────────────────────────────────────────────────────────────

function SensitivityBar({ label, dots }) {
  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="text-terminal-text-dim w-20">{label}</span>
      <span className="text-terminal-gold tracking-widest">{'●'.repeat(dots)}{'○'.repeat(3 - dots)}</span>
    </div>
  )
}

function EconomicEventCard({ event, onReminderChange }) {
  const rbaMatch = event.event.includes('RBA') ? LAST_DECISIONS.RBA : null
  const sensitivity = event.importance === 'high' ? 3 : event.importance === 'medium' ? 2 : 1

  return (
    <div className={`bg-terminal-panel border border-terminal-border border-l-[3px] ${IMPORTANCE_BORDER[event.importance] ?? 'border-l-terminal-muted'}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border/50">
        <span className="text-2xs text-terminal-text-dim">{REGION_FLAGS[event.region] ?? '🌐'} {event.time !== '—' ? `${event.time} AEST` : 'Time TBC'}</span>
        <div className="flex items-center gap-2">
          <Stars event={event} />
          <span className={`text-2xs font-bold ${IMPORTANCE_COLOR[event.importance]}`}>●{event.importance?.toUpperCase()}</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-sm font-bold text-white uppercase">{event.event}</div>
          <ReminderPicker event={event} onChange={onReminderChange} />
        </div>
        <div className="mb-2"><ConsensusRow event={event} /></div>

        {(rbaMatch || event.forecast || event.prev) && (
          <div className="grid grid-cols-3 gap-2 text-2xs mb-2 pb-2 border-b border-terminal-border/30">
            {rbaMatch && (
              <div>
                <div className="text-terminal-text-dim/60">PREVIOUS</div>
                <div className="text-terminal-text-bright font-semibold">{rbaMatch.rate} ({rbaMatch.decision})</div>
              </div>
            )}
            {event.prev && event.prev !== '—' && (
              <div>
                <div className="text-terminal-text-dim/60">PREVIOUS</div>
                <div className="text-terminal-text-bright font-semibold">{event.prev}</div>
              </div>
            )}
            {event.forecast && event.forecast !== '—' && (
              <div>
                <div className="text-terminal-text-dim/60">CONSENSUS</div>
                <div className="text-terminal-text-bright font-semibold">{event.forecast}</div>
              </div>
            )}
          </div>
        )}

        {event.description && (
          <div className="text-2xs text-terminal-text-dim italic mb-2 pb-2 border-b border-terminal-border/30">{event.description}</div>
        )}

        <div className="space-y-1 mb-2">
          <div className="text-[9px] text-terminal-text-dim/60 tracking-widest">MARKET SENSITIVITY</div>
          <SensitivityBar label={event.region === 'AU' ? 'AUD/USD' : 'USD Index'} dots={sensitivity} />
          <SensitivityBar label={event.region === 'AU' ? 'ASX Banks' : 'US Equities'} dots={Math.max(1, sensitivity - 1)} />
          <SensitivityBar label="Bonds" dots={sensitivity} />
        </div>

        <button
          onClick={() => dispatchAskAI({
            name: event.event,
            date: event.date,
            instruction: `Explain the likely market impact of this scheduled event: ${event.event} (${event.region}, ${event.importance} importance). What should investors watch for?`,
          }, { rawPrompt: false })}
          className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-2 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >
          ASK MADDENAI ABOUT THIS EVENT →
        </button>
      </div>
    </div>
  )
}

function EarningsEventCard({ event, onReminderChange }) {
  const { watchlist, addToWatchlist } = useStore()
  const bareTicker = event.ticker.replace('.AX', '')
  const inWatchlist = watchlist.includes(event.ticker)
  const [reminded, setReminded] = useState(inWatchlist)

  const setReminder = () => {
    if (!inWatchlist) {
      addToWatchlist(event.ticker)
      logActivity('watchlist', `Added ${event.ticker} to watchlist (earnings reminder)`)
    }
    setReminded(true)
  }

  return (
    <div className="bg-terminal-panel border border-terminal-border border-l-[3px] border-l-terminal-gold">
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border/50">
        <span className="text-2xs text-terminal-text-dim">📊 AFTER MARKET</span>
        <span className="text-2xs font-bold text-terminal-gold">●MEDIUM</span>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-white uppercase">{event.company} ({event.ticker})</div>
            <div className="text-2xs text-terminal-text-dim">{event.type} — FY2026</div>
          </div>
          <ReminderPicker event={{ ...event, event: `${event.company} earnings` }} onChange={onReminderChange} />
        </div>
        <div className="mb-2 pb-2 border-b border-terminal-border/30" />

        <div className="grid grid-cols-2 gap-2 text-2xs mb-2 pb-2 border-b border-terminal-border/30">
          <div>
            <div className="text-terminal-text-dim/60">EPS ESTIMATE</div>
            <div className="text-terminal-text-bright font-semibold">{event.epsEst != null ? `A$${event.epsEst.toFixed(2)}/share` : '—'}</div>
          </div>
          <div>
            <div className="text-terminal-text-dim/60">REVENUE ESTIMATE</div>
            <div className="text-terminal-text-bright font-semibold">{event.revEst != null ? `A$${(event.revEst / 1000).toFixed(1)}B` : '—'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatchAskAI({
              name: event.company, ticker: bareTicker, date: event.date,
              instruction: `Give an earnings preview for ${event.company} (${event.ticker})'s upcoming ${event.type} report: what to watch for, bull case, and bear case.`,
            })}
            className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-2 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >
            FULL EARNINGS PREVIEW →
          </button>
          <button
            onClick={setReminder}
            disabled={reminded}
            className="text-2xs font-bold text-terminal-text-dim border border-terminal-border px-2 py-1 hover:border-terminal-gold hover:text-terminal-gold transition-colors disabled:opacity-50"
          >
            {reminded ? '✓ REMINDER SET' : '+ SET REMINDER'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Root ───────────────────────────────────────────────────────────────────

// Five filled stars for an RBA decision, two for jobless claims. Derived from
// the event name by deterministic rules — see calendarExtras.js — rather than
// from the feed's coarse high/medium/low, which puts a rate decision and a
// building-approvals print in the same bucket.
function Stars({ event }) {
  const n = eventStars(event)
  return (
    <span
      className="font-mono tracking-tight flex-shrink-0"
      style={{ fontSize: 10, color: n >= 5 ? '#A83232' : n >= 4 ? '#C9A84C' : '#637899' }}
      title={`Importance ${n}/5 — scored from the event type`}
    >{starString(n)}</span>
  )
}

// What the feed actually carries.
//
// The design asked for an ACTUAL result on past events and a six-reading
// beat/miss history. The economic calendar this app reads supplies `estimate`
// and `previous` for upcoming events and no `actual` at all, and nothing here
// records releases as they land. A track record is a figure someone leans on,
// so it is stated as missing rather than synthesised.
function ConsensusRow({ event }) {
  const hasForecast = event.forecast && event.forecast !== '—'
  const hasPrev = event.prev && event.prev !== '—'
  const [now] = useState(() => Date.now())
  const at = eventInstant(event)
  const past = at ? at.getTime() < now : false

  if (!hasForecast && !hasPrev) {
    return (
      <div className="text-2xs text-terminal-text-dim/50">
        {past ? 'No release result connected for this event.' : 'No consensus published for this event.'}
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      {hasForecast && (
        <span className="text-2xs text-terminal-text-dim">
          {past ? 'Was expected' : 'Consensus'}:{' '}
          <span className="text-terminal-text-bright font-bold">{event.forecast}</span>
        </span>
      )}
      {hasPrev && (
        <span className="text-2xs text-terminal-text-dim">
          Previous: <span className="text-terminal-text-bright">{event.prev}</span>
        </span>
      )}
      {past && (
        <span className="text-2xs text-terminal-gold/70">actual not connected</span>
      )}
    </div>
  )
}

function ReminderPicker({ event, onChange }) {
  const [open, setOpen] = useState(false)
  const existing = remindersForEvent(event)

  const toggle = (key) => {
    const hit = existing.find((r) => r.offsetKey === key)
    if (hit) removeReminder(hit.id)
    else addReminder(event, key)
    onChange?.()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`text-2xs px-2 py-1 border transition-colors font-bold ${
          existing.length
            ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10'
            : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
        }`}
      >⏰ {existing.length ? `${existing.length} REMINDER${existing.length > 1 ? 'S' : ''}` : 'REMIND ME'}</button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-terminal-header border border-terminal-gold z-30">
          <div className="px-2 py-1 text-2xs text-terminal-gold font-bold tracking-widest border-b border-terminal-border/50">
            REMIND ME
          </div>
          {REMINDER_OFFSETS.map((o) => {
            const on = existing.some((r) => r.offsetKey === o.key)
            return (
              <button
                key={o.key}
                onClick={() => toggle(o.key)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-2xs hover:bg-terminal-accent/20 transition-colors"
              >
                <span className={on ? 'text-terminal-gold' : 'text-terminal-text-dim'}>{o.label}</span>
                <span className="text-terminal-gold">{on ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Due reminders, surfaced on load. Stored locally and checked against the
// clock — this is not a push notification and does not pretend to be one: it
// only fires while the terminal is open.
function ReminderToasts({ items, onDismiss, onView }) {
  if (!items.length) return null
  return (
    <div className="absolute top-2 right-2 z-40 flex flex-col gap-2 w-64">
      {items.map((r) => (
        <div key={r.id} className="border border-terminal-gold bg-terminal-header p-2.5 shadow-2xl">
          <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-0.5">⏰ REMINDER</div>
          <div className="text-2xs text-terminal-text-bright leading-snug">{r.title}</div>
          <div className="text-2xs text-terminal-text-dim mt-0.5">
            {r.eventDate}{r.eventTime ? ` · ${r.eventTime}` : ''}
          </div>
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => onView(r)} className="flex-1 btn-primary btn-sm">VIEW EVENT</button>
            <button onClick={() => onDismiss(r.id)} className="flex-1 btn-secondary btn-sm">DISMISS</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Mon-Fri columns for the selected week, events placed by time of day.
function WeekView({ anchorDate, events, selectedKey, onSelect }) {
  const monday = useMemo(() => {
    const d = new Date(anchorDate)
    const dow = (d.getDay() + 6) % 7 // Monday = 0
    d.setDate(d.getDate() - dow)
    d.setHours(0, 0, 0, 0)
    return d
  }, [anchorDate])

  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => new Date(monday.getTime() + i * 86400000)),
    [monday],
  )
  const todayKey = toDateKey(new Date())

  return (
    <div className="grid grid-cols-5 gap-1">
      {days.map((d) => {
        const key = toDateKey(d)
        const dayEvents = events
          .filter((e) => toDateKey(e.dateObj) === key)
          .sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')))
        const isToday = key === todayKey
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`text-left border p-1.5 min-h-[130px] align-top transition-colors ${
              key === selectedKey ? 'border-terminal-gold bg-terminal-gold/5'
                : isToday ? 'border-terminal-gold/40'
                : 'border-terminal-border hover:border-terminal-gold/40'
            }`}
          >
            <div className={`text-2xs font-bold ${isToday ? 'text-terminal-gold' : 'text-terminal-text-dim'}`}>
              {d.toLocaleDateString('en-AU', { weekday: 'short' })} {d.getDate()}
            </div>
            <div className="mt-1 space-y-1">
              {dayEvents.slice(0, 4).map((e, i) => (
                <div
                  key={i}
                  className="text-2xs leading-tight border-l-2 pl-1"
                  style={{ borderColor: eventStars(e) >= 5 ? '#A83232' : eventStars(e) >= 4 ? '#C9A84C' : '#637899' }}
                >
                  <div className="text-terminal-text-dim">{e.time && e.time !== '—' ? e.time : ''}</div>
                  <div className="text-terminal-text-bright line-clamp-2">{e.label}</div>
                </div>
              ))}
              {dayEvents.length > 4 && (
                <div className="text-2xs text-terminal-text-dim/60">+{dayEvents.length - 4} more</div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function CalendarModule() {
  const [month, setMonth] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()))
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('month')
  // Bumped whenever a reminder is added or removed, so components reading the
  // store re-render. Cheaper and less error-prone than mirroring the whole
  // reminder list into React state in two places.
  const [reminderTick, setReminderTick] = useState(0)
  const [toasts, setToasts] = useState(() => pendingReminders())

  const { data: calResult, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000,
  })

  const allEvents = useMemo(() => {
    const econ = calResult ? upcomingEvents(calResult.events, 180).map((e) => ({
      ...e, type: 'economic', label: e.event,
    })) : []
    const earnings = upcomingEarnings().map((e) => ({
      ...e, type: 'earnings', label: `${e.company} earnings`, importance: 'medium', region: 'AU',
      dateObj: new Date(`${e.date}T00:00:00`),
    }))
    return [...econ, ...earnings].sort((a, b) => a.dateObj - b.dateObj)
  }, [calResult])

  const filtered = useMemo(() => allEvents.filter((e) => {
    if (filter === 'all') return true
    if (filter === 'earnings') return e.type === 'earnings'
    if (filter === 'cb') return e.type === 'economic' && isCentralBank(e.event)
    if (filter === 'high') return e.importance === 'high'
    return e.region === filter
  }), [allEvents, filter])

  const eventDays = useMemo(() => new Set(allEvents.map((e) => toDateKey(e.dateObj))), [allEvents])
  const todayKey = toDateKey(new Date())

  // Counted from the events actually loaded, so the banner cannot announce a
  // season this app has no events for.
  const season = useMemo(() => earningsSeason(allEvents), [allEvents])

  const exportIcs = () => {
    const ics = buildIcs(filtered, { name: 'Maddex Economic Calendar' })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `maddex-calendar-${todayKey}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const refreshReminders = () => {
    setReminderTick((n) => n + 1)
    setToasts(pendingReminders())
  }

  const dayEvents = filtered.filter((e) => toDateKey(e.dateObj) === selectedKey)
  const nextFutureEvent = allEvents.find((e) => e.dateObj > new Date())
  const selectedDateObj = new Date(`${selectedKey}T00:00:00`)
  const isFuture = selectedDateObj > new Date(new Date().setHours(0, 0, 0, 0))
  const relLabel = selectedKey === todayKey ? 'Today'
    : isFuture ? `In ${Math.ceil((selectedDateObj - new Date()) / 86400000)} days`
    : `${Math.ceil((new Date() - selectedDateObj) / 86400000)} days ago`

  return (
    <div className="h-full flex flex-col">
      <ModuleHeader
        title="CALENDAR"
        subtitle="Economic events & earnings"
        onRefresh={refetch}
        isFetching={isFetching}
        lastUpdated={dataUpdatedAt}
      />
      {season.active && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-terminal-gold/40 bg-terminal-gold/10 flex-shrink-0">
          <span className="text-2xs font-bold tracking-widest text-terminal-gold">EARNINGS SEASON</span>
          <span className="text-2xs text-terminal-text-bright">
            {season.thisWeek} {season.thisWeek === 1 ? 'company reporting' : 'companies reporting'} this week
          </span>
          <span className="text-2xs text-terminal-text-dim">
            · {season.total} in the next {season.windowDays} days
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-terminal-border flex-shrink-0">
        <div className="flex border border-terminal-border">
          {['month', 'week'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-0.5 text-2xs font-bold border-r border-terminal-border last:border-r-0 transition-colors ${
                view === v ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
            >{v.toUpperCase()} VIEW</button>
          ))}
        </div>
        <span className="text-2xs text-terminal-text-dim">{filtered.length} events</span>
        <button
          onClick={exportIcs}
          disabled={!filtered.length}
          title="Download as an iCalendar file for Apple Calendar or Google Calendar"
          className="ml-auto text-2xs px-2.5 py-1 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors font-bold disabled:opacity-40"
        >⤓ EXPORT .ICS</button>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        <ReminderToasts
          items={toasts}
          onDismiss={(id) => { dismissReminder(id); refreshReminders() }}
          onView={(r) => { setSelectedKey(r.eventDate); dismissReminder(r.id); refreshReminders() }}
        />
        {/* LEFT PANEL */}
        <div className="w-[300px] flex-shrink-0 border-r border-terminal-border flex flex-col bg-terminal-surface">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            eventDays={eventDays}
            todayKey={todayKey}
          />
          <div className="flex flex-wrap gap-1 p-2 border-b border-terminal-border flex-shrink-0">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors ${
                  filter === f.key ? 'bg-terminal-gold text-terminal-bg border-terminal-gold' : 'text-terminal-text-dim border-terminal-border hover:border-terminal-gold/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <UpcomingList events={filtered} onSelect={setSelectedKey} selectedKey={selectedKey} />
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 overflow-y-auto p-4 min-w-0">
          <div className="mb-1">
            <div className="text-lg font-bold text-white uppercase tracking-wide">
              {selectedDateObj.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="text-2xs text-terminal-text-dim">{relLabel}</div>
          </div>

          {view === 'week' && (
            <div className="mb-4">
              <WeekView
                anchorDate={selectedDateObj}
                events={filtered}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            </div>
          )}

          {dayEvents.length === 0 ? (
            <div className="mt-6 text-center">
              <div className="text-xs text-terminal-text-dim mb-1">No major scheduled events</div>
              {nextFutureEvent && (
                <div className="text-2xs text-terminal-text-dim/60">
                  The next event is in {Math.ceil((nextFutureEvent.dateObj - new Date()) / 86400000)} days: {nextFutureEvent.label}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {isFuture && dayEvents[0] && <CountdownWidget event={dayEvents[0]} />}
              {/* reminderTick is in the key so a reminder toggle re-mounts the
                  cards and their pickers re-read the store. */}
              {dayEvents.map((e, i) => (
                e.type === 'earnings'
                  ? <EarningsEventCard key={`e-${i}-${reminderTick}`} event={e} onReminderChange={refreshReminders} />
                  : <EconomicEventCard key={`c-${i}-${reminderTick}`} event={e} onReminderChange={refreshReminders} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
