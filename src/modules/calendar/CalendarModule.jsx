import { useState, useEffect, useMemo } from 'react'
import CorporateActions from './CorporateActions'
import { PredictedEvents, EventImpactHistory } from './PredictiveCalendar'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { InlineLoading } from '../../components/ui/ModuleStates'
import {
  eventStars, starString, earningsSeason, buildIcs, eventInstant,
  REMINDER_OFFSETS, addReminder, removeReminder, dismissReminder,
  remindersForEvent, pendingReminders,
} from '../../services/calendarExtras'
import { getEconomicCalendar, upcomingEvents, ECON_SCHEDULE_CHECKED } from '../../services/calendarService'
import { LAST_DECISIONS, daysBetweenDays } from '../../services/centralBankSchedule'
import { useReleaseWatch } from '../../hooks/useReleaseWatch'
import { releaseKey } from '../../services/releaseWatch'
import ReleaseWatchBanner from '../../components/ui/ReleaseWatchBanner'
import { upcomingEarnings } from '../../services/earningsCalendar'
import { dispatchAskAI } from '../../utils/askAI'
import { logActivity } from '../../services/activityLogService'
import { sydneyTzAbbr, formatDate, sydneyISO } from '../../utils/dateUtils'
import { peekModuleIntent, takeModuleIntent } from '../../services/moduleIntent'
import { PAL } from '../../styles/palette.js'
import { useNow } from '../../hooks/useNow'
import DataBadge from '../../components/ui/DataBadge'

const REGION_FLAGS = { AU: '🇦🇺', US: '🇺🇸', CN: '🇨🇳', JP: '🇯🇵', UK: '🇬🇧', EU: '🇪🇺', NZ: '🇳🇿', CA: '🇨🇦' }
const IMPORTANCE_COLOR = { high: 'text-terminal-red', medium: 'text-terminal-gold', low: 'text-terminal-muted' }
const IMPORTANCE_BORDER = { high: 'border-l-terminal-red', medium: 'border-l-terminal-gold', low: 'border-l-terminal-muted' }

const FILTERS = [
  { key: 'all',      label: 'ALL' },
  { key: 'AU',       label: '🇦🇺 AU' },
  { key: 'US',       label: '🇺🇸 US' },
  { key: 'earnings', label: '📊 EARNINGS' },
  { key: 'cb',       label: '◈ CB' },
  { key: 'high',     label: 'HIGH ONLY' },
]

const CB_KEYWORDS = ['RBA', 'FOMC', 'Fed', 'ECB', 'Bank of', 'Reserve Bank']

function isCentralBank(eventName) {
  return CB_KEYWORDS.some((kw) => eventName.includes(kw))
}

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function useCountdown(target) {
  const now = useNow()
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
        <button onClick={() => onMonthChange(new Date(year, m - 1, 1))} aria-label="Previous month" className="text-terminal-text-dim hover:text-terminal-gold px-1">←</button>
        <span className="text-2xs font-bold text-terminal-gold tracking-wider">
          {month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }).toUpperCase()}
        </span>
        <button onClick={() => onMonthChange(new Date(year, m + 1, 1))} aria-label="Next month" className="text-terminal-text-dim hover:text-terminal-gold px-1">→</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-[11px] text-terminal-text-dim/50 py-0.5">{d}</div>
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
  // Grouped by Sydney calendar days (event dates are Sydney dates).
  const todayKey = sydneyISO()
  const groups = { TODAY: [], 'THIS WEEK': [], 'NEXT WEEK': [], LATER: [] }
  for (const e of events) {
    const n = daysBetweenDays(todayKey, toDateKey(e.dateObj))
    if (n === 0) groups.TODAY.push(e)
    else if (n < 7) groups['THIS WEEK'].push(e)
    else if (n < 14) groups['NEXT WEEK'].push(e)
    else groups.LATER.push(e)
  }
  return groups
}

function UpcomingList({ events, onSelect, selectedKey, loading = false }) {
  const groups = useMemo(() => groupEvents(events), [events])
  return (
    <div className="flex-1 overflow-y-auto thin-scrollbar">
      {Object.entries(groups).map(([label, items]) => items.length > 0 && (
        <div key={label}>
          <div className="px-2 py-1 text-[11px] font-bold text-terminal-text-dim/60 tracking-widest bg-terminal-header/50 sticky top-0">{label}</div>
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
                  {formatDate(e.dateObj, { weekday: true, year: false })}
                </span>
                <span className="text-2xs text-terminal-text-bright flex-1 min-w-0 truncate">{e.label}</span>
                <Stars event={e} />
                <span className={`text-[11px] font-bold flex-shrink-0 ${IMPORTANCE_COLOR[e.importance] ?? 'text-terminal-muted'}`}>
                  ●{e.importance?.toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>
      ))}
      {events.length === 0 && (
        loading
          ? <InlineLoading label="Loading events" className="p-4" />
          : <div className="p-4 text-center text-2xs text-terminal-text-dim">No events match this filter</div>
      )}
    </div>
  )
}

// ─── Right panel: countdown widget ───────────────────────────────────────────

function CountdownWidget({ event }) {
  // To the release itself in Sydney time, not to local midnight on its date:
  // dateObj is the start of the day, so the RBA's 2:30pm decision counted down
  // to 00:00 and read 13½ hours short of the Rates module's countdown.
  const target = useMemo(() => (event ? eventInstant(event) ?? event.dateObj : null), [event])
  const countdown = useCountdown(target)
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


function EconomicEventCard({ event, onReminderChange }) {
  const rbaMatch = event.event.includes('RBA') ? LAST_DECISIONS.RBA : null
  const released = useReleaseWatch().some((r) => r.key === releaseKey(event))

  return (
    <div
      className={`border border-terminal-border border-l-[3px] ${IMPORTANCE_BORDER[event.importance] ?? 'border-l-terminal-muted'} ${released ? 'ring-1 ring-terminal-gold' : ''}`}
      style={{
        // Depth rather than a flat panel: a top-lit gradient plus a soft drop
        // shadow. These cards sit in a scrolling column against the same
        // panel colour they were painted in, so without separation they read
        // as one long block of text rather than as discrete events.
        background: 'linear-gradient(180deg, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0) 42%), rgb(var(--t-panel))',
        boxShadow: 'var(--shadow-elevated)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border/50">
        <span className="text-2xs text-terminal-text-dim">{REGION_FLAGS[event.region] ?? '🌐'} {event.time !== '—' ? `${event.time} ${sydneyTzAbbr(event.date)}` : 'Time TBC'}</span>
        <div className="flex items-center gap-2">
          <Stars event={event} />
          <span className={`text-2xs font-bold ${IMPORTANCE_COLOR[event.importance]}`}>●{event.importance?.toUpperCase()}</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-sm font-bold text-white uppercase">
            {event.event}
            {released && <span className="ml-2 text-2xs font-bold text-terminal-gold border border-terminal-gold/60 px-1 align-middle">RELEASED</span>}
          </div>
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
            {/* A forecast is shown only with the source that published it. */}
            {event.forecast && event.forecast !== '—' && event.forecastSource && (
              <div>
                <div className="text-terminal-text-dim/60">FORECASTS</div>
                <div className="text-terminal-text-bright font-semibold">{event.forecast}</div>
                <div className="text-terminal-text-dim/60">{event.forecastSource}</div>
              </div>
            )}
          </div>
        )}

        {event.description && (
          <div className="text-2xs text-terminal-text-dim italic mb-2 pb-2 border-b border-terminal-border/30">{event.description}</div>
        )}

        {/* No "historical impact analysis" (removed 16 Nov 2026, Ben's decision):
            it described how markets tended to react to a hotter or cooler
            release, a conditional scenario not built from sourced episodes. */}

        {/* No "MARKET SENSITIVITY" dots (removed 16 Nov 2026): they were the
            event's importance copied onto AUD, banks and bonds, not a
            measured sensitivity. */}

        <button
          onClick={() => dispatchAskAI({
            name: event.event,
            date: event.date,
            instruction: `Describe this scheduled event: ${event.event} (${event.region}). Who publishes it, what it measures, and what the previous release showed if it is in your context. Describe only: no forecast, no price and no suggestion of any action.`,
          }, { rawPrompt: false })}
          className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-2 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >
          ASK MADDENAI ABOUT THIS EVENT →
        </button>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
            className="ml-2 inline-block text-2xs font-bold text-terminal-text-bright border border-terminal-border px-2 py-1 hover:border-terminal-gold transition-colors"
          >VIEW ON {event.sourceLabel} ↗</a>
        )}
      </div>
    </div>
  )
}

function EarningsEventCard({ event, onReminderChange }) {
  const isAgm = event.reportType === 'AGM'
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
    <div
      className="border border-terminal-border border-l-[3px] border-l-terminal-gold"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0) 42%), rgb(var(--t-panel))',
        boxShadow: 'var(--shadow-elevated)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border/50">
        {/* Release timing is not held for any of these, so none is claimed. */}
        <span className="text-2xs text-terminal-text-dim">{isAgm ? '🗳 ANNUAL GENERAL MEETING' : '📊 RESULTS'}{event.source ? ' · SOURCED' : ''}</span>
        <div className="flex items-center gap-2">
          <Stars event={event} />
          <span className="text-2xs font-bold text-terminal-gold">●MEDIUM</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-white uppercase">{event.company} ({event.ticker})</div>
            <div className="text-2xs text-terminal-text-dim" title={event.source ? `Source: ${event.source}` : 'Date approximate'}>
              {isAgm ? 'AGM — shareholder votes and the chair\'s address' : `${event.reportType ?? 'Results'} results`}
            </div>
          </div>
          <ReminderPicker event={{ ...event, event: `${event.company} earnings` }} onChange={onReminderChange} />
        </div>
        <div className="mb-2 pb-2 border-b border-terminal-border/30" />

        {/* No EPS or revenue estimate: none has a source (removed 15 Nov). */}

        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatchAskAI({
              name: event.company, ticker: bareTicker, date: event.date,
              instruction: isAgm
                ? `${event.company} (${event.ticker}) holds its AGM on ${event.date}. Describe the business typically put to an ASX AGM (resolutions, remuneration vote, any trading update) and what the company has published about this one. Describe only: no forecast, no price and no suggestion of any action.`
                : `${event.company} (${event.ticker}) reports its ${event.reportType ?? ''} results on ${event.date}. Describe the business, its segments and what it reported last time, from what is in your context. Describe only: no forecast, no price and no suggestion of any action. No bull or bear case.`,
            })}
            className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-2 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >
            {isAgm ? 'ABOUT THIS AGM →' : 'ABOUT THIS COMPANY →'}
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
      style={{ fontSize: 11, color: n >= 5 ? PAL.down : n >= 4 ? PAL.gold : PAL.muted }}
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
  const todayKey = sydneyISO()

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
                  style={{ borderColor: eventStars(e) >= 5 ? PAL.down : eventStars(e) >= 4 ? PAL.gold : PAL.muted }}
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
  // A dashboard event can open the calendar at its date ({ date: 'YYYY-MM-DD' }).
  const [month, setMonth] = useState(() => {
    const d = peekModuleIntent('calendar')?.date
    return d ? new Date(`${d}T00:00:00`) : new Date()
  })
  const [selectedKey, setSelectedKey] = useState(() => peekModuleIntent('calendar')?.date ?? sydneyISO())
  useEffect(() => { takeModuleIntent('calendar') }, [])
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
      ...e, type: 'earnings', reportType: e.type, label: `${e.company} ${e.type === 'AGM' ? 'AGM' : 'earnings'}`, importance: 'medium', region: 'AU',
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
  const todayKey = sydneyISO()

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
  // Sydney calendar days between today and the selected date.
  const dayGap = daysBetweenDays(todayKey, selectedKey)
  const isFuture = dayGap > 0
  const relLabel = dayGap === 0 ? 'Today'
    : isFuture ? `In ${plural(dayGap, 'day')}`
    : `${plural(-dayGap, 'day')} ago`

  return (
    <div className="h-full flex flex-col">
      <ModuleHeader
        title="CALENDAR"
        subtitle="Economic events · Earnings"
        onRefresh={refetch}
        isFetching={isFetching}
        // The calendar feed is licensed off, so the events are the hand-entered
        // schedule: its date is when it was checked, not when it was loaded
        // ("just now" said the latter).
        lastUpdated={calResult?.source === 'fallback' ? null : dataUpdatedAt}
        right={calResult && (calResult.source === 'fallback'
          ? <DataBadge cls="DELAYED" source="Maddex schedule, checked" at={ECON_SCHEDULE_CHECKED} />
          : <DataBadge cls="DELAYED" source="FMP economic calendar" at={dataUpdatedAt || null} />)}
      />
      <ReleaseWatchBanner className="px-3 pt-2" />
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
                className={`text-[11px] font-bold px-1.5 py-0.5 border transition-colors ${
                  filter === f.key ? 'bg-terminal-gold text-terminal-bg border-terminal-gold' : 'text-terminal-text-dim border-terminal-border hover:border-terminal-gold/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <UpcomingList events={filtered} onSelect={setSelectedKey} selectedKey={selectedKey} loading={!calResult && isFetching} />
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 overflow-y-auto p-4 min-w-0">
          <div className="mb-1">
            <div className="text-lg font-bold text-white uppercase tracking-wide">
              {formatDate(selectedKey, { weekday: true })}
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

          {dayEvents.length === 0 && !calResult && isFetching ? (
            <InlineLoading label="Loading events" className="mt-6" />
          ) : dayEvents.length === 0 ? (
            <div className="mt-6 text-center">
              <div className="text-xs text-terminal-text-dim mb-1">No major scheduled events</div>
              {nextFutureEvent && (
                <div className="text-2xs text-terminal-text-dim/60">
                  The next event is in {plural(daysBetweenDays(todayKey, toDateKey(nextFutureEvent.dateObj)), 'day')}: {nextFutureEvent.label}
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

          <CorporateActions />
          <PredictedEvents events={allEvents} />
          <EventImpactHistory />
        </div>
      </div>
    </div>
  )
}
