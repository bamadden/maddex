import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import ModuleHeader from '../../components/ui/ModuleHeader'
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

function EconomicEventCard({ event }) {
  const rbaMatch = event.event.includes('RBA') ? LAST_DECISIONS.RBA : null
  const sensitivity = event.importance === 'high' ? 3 : event.importance === 'medium' ? 2 : 1

  return (
    <div className={`bg-terminal-panel border border-terminal-border border-l-[3px] ${IMPORTANCE_BORDER[event.importance] ?? 'border-l-terminal-muted'}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border/50">
        <span className="text-2xs text-terminal-text-dim">{REGION_FLAGS[event.region] ?? '🌐'} {event.time !== '—' ? `${event.time} AEST` : 'Time TBC'}</span>
        <span className={`text-2xs font-bold ${IMPORTANCE_COLOR[event.importance]}`}>●{event.importance?.toUpperCase()}</span>
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-bold text-white uppercase mb-2">{event.event}</div>

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

function EarningsEventCard({ event }) {
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
        <div className="text-sm font-bold text-white uppercase">{event.company} ({event.ticker})</div>
        <div className="text-2xs text-terminal-text-dim mb-2 pb-2 border-b border-terminal-border/30">{event.type} — FY2026</div>

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

export default function CalendarModule() {
  const [month, setMonth] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()))
  const [filter, setFilter] = useState('all')

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
      <div className="flex-1 flex min-h-0">
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
              {dayEvents.map((e, i) => (
                e.type === 'earnings'
                  ? <EarningsEventCard key={`e-${i}`} event={e} />
                  : <EconomicEventCard key={`c-${i}`} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
