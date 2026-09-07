import { useMemo, useState } from 'react'
import { upcomingEarnings, daysUntil, EARNINGS_2026 } from '../../services/earningsCalendar'
import { getPrep, togglePrepItem, prunePrep } from '../../services/earningsPrep'
import { useStore } from '../../store/useStore'
import EarningsPreviewPanel from '../../components/earningsPreview/EarningsPreviewPanel'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Month grid, Monday-first — the ASX week, not the US one.
function buildMonth(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function PrepChecklist({ entry, onChange }) {
  const prep = getPrep(entry.ticker, entry.date)
  const done = prep.items.filter((i) => i.done).length

  return (
    <div className="border border-terminal-gold/30 bg-terminal-gold/5 p-3 mt-2">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">
          BEFORE {entry.company.toUpperCase()} REPORTS
        </span>
        <span className="text-2xs text-terminal-text-dim tabular-nums">
          {done} / {prep.items.length}
        </span>
      </div>

      <div className="space-y-1">
        {prep.items.map((item, i) => (
          <button
            key={item.text}
            onClick={() => { togglePrepItem(entry.ticker, entry.date, i); onChange?.() }}
            className="flex items-start gap-2 w-full text-left group"
          >
            <span
              className="flex-shrink-0 mt-px flex items-center justify-center"
              style={{
                width: 12, height: 12, fontSize: 9,
                border: `1px solid ${item.done ? '#C9A84C' : 'rgba(99,120,153,0.5)'}`,
                color: '#C9A84C',
              }}
            >{item.done ? '✓' : ''}</span>
            <span className={`text-2xs leading-snug ${item.done ? 'text-terminal-text-dim/50 line-through' : 'text-terminal-text'}`}>
              {item.text}
            </span>
          </button>
        ))}
      </div>

      <div className="text-2xs text-terminal-text-dim/50 mt-2 leading-relaxed">
        Saved for this reporting date only — next half starts fresh.
      </div>
    </div>
  )
}

export default function EarningsCalendar() {
  const { watchlist, openModal } = useStore()
  const [anchor, setAnchor] = useState(() => {
    // Open on the month of the next report rather than today's: during a quiet
    // month an empty grid is a worse first impression than the month that
    // actually has something in it.
    const next = upcomingEarnings()[0]
    return next ? new Date(`${next.date}T00:00:00`) : new Date()
  })
  const [selectedDate, setSelectedDate] = useState(null)
  const [preview, setPreview] = useState(null)
  const [prepTicker, setPrepTicker] = useState(null)
  const [, bump] = useState(0)

  useMemo(() => prunePrep(), [])

  const watched = useMemo(
    () => new Set((watchlist ?? []).map((w) => String(w).toUpperCase().replace(/\.AX$/, ''))),
    [watchlist],
  )
  const isWatched = (ticker) => watched.has(ticker.replace('.AX', ''))

  const byDate = useMemo(() => {
    const map = new Map()
    for (const e of EARNINGS_2026) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date).push(e)
    }
    return map
  }, [])

  const cells = useMemo(() => buildMonth(anchor), [anchor])
  const todayKey = toKey(new Date())
  const upcoming = useMemo(() => upcomingEarnings().slice(0, 12), [])

  // "Earnings season" is a checkable condition — an unusual concentration in a
  // short window — counted from the entries actually present rather than from
  // an assumed reporting calendar.
  const season = useMemo(() => {
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    const start = now.toISOString().slice(0, 10)
    const thisWeek = EARNINGS_2026.filter((e) => e.date >= start && e.date <= end)
    return { active: thisWeek.length >= 5, count: thisWeek.length, items: thisWeek }
  }, [])

  const dayList = selectedDate ? (byDate.get(selectedDate) ?? []) : []

  return (
    <div className="flex-shrink-0 border-b border-terminal-border">
      <div className="panel-header flex items-center gap-2">
        <span>EARNINGS · ASX REPORTING</span>
        {season.active && (
          <span
            className="text-2xs font-bold tracking-widest px-1.5 py-0.5"
            style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)' }}
          >EARNINGS SEASON · {season.count} THIS WEEK</span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Month grid */}
        <div className="lg:w-[340px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-terminal-border p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
              className="text-terminal-text-dim hover:text-terminal-gold px-1"
            >←</button>
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">
              {MONTH_NAMES[anchor.getMonth()]} {anchor.getFullYear()}
            </span>
            <button
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
              className="text-terminal-text-dim hover:text-terminal-gold px-1"
            >→</button>
          </div>

          <div className="grid grid-cols-7 gap-px">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-2xs text-terminal-text-dim/50 text-center py-1">{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`x${i}`} />
              const key = toKey(d)
              const list = byDate.get(key) ?? []
              const anyWatched = list.some((e) => isWatched(e.ticker))
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(list.length ? key : null)}
                  disabled={!list.length}
                  className={`aspect-square flex flex-col items-center justify-center transition-colors ${
                    key === selectedDate ? 'bg-terminal-gold/20 border border-terminal-gold'
                      : key === todayKey ? 'border border-terminal-gold/40'
                      : list.length ? 'hover:bg-terminal-accent/20 border border-transparent'
                      : 'border border-transparent'
                  }`}
                >
                  <span className={`text-2xs tabular-nums ${list.length ? 'text-terminal-text-bright' : 'text-terminal-text-dim/40'}`}>
                    {d.getDate()}
                  </span>
                  {/* Stacked dots — one per company reporting that day, so a
                      heavy day reads as heavy at a glance. */}
                  {list.length > 0 && (
                    <span className="flex gap-px mt-0.5">
                      {list.slice(0, 4).map((e) => (
                        <span
                          key={e.ticker}
                          className="rounded-full"
                          style={{
                            width: 3, height: 3,
                            background: isWatched(e.ticker) ? '#C9A84C' : '#4A7FB5',
                          }}
                        />
                      ))}
                    </span>
                  )}
                  {anyWatched && <span style={{ fontSize: 6, color: '#C9A84C', lineHeight: 1 }}>★</span>}
                </button>
              )
            })}
          </div>

          {selectedDate && (
            <div className="mt-3 pt-2 border-t border-terminal-border/40">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {dayList.map((e) => (
                <button
                  key={e.ticker}
                  onClick={() => openModal?.({ symbol: e.ticker, name: e.company, type: 'asx' })}
                  className="flex items-baseline justify-between gap-2 w-full text-left py-1 hover:bg-terminal-accent/10"
                >
                  <span className="text-2xs font-bold text-terminal-text-bright">
                    {isWatched(e.ticker) && <span className="text-terminal-gold mr-1" title="In your watchlist">★</span>}
                    {e.ticker.replace('.AX', '')}
                  </span>
                  <span className="text-2xs text-terminal-text-dim truncate flex-1">{e.company}</span>
                  <span className="text-2xs text-terminal-text-dim/60 flex-shrink-0">{e.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming list */}
        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">NEXT REPORTS</span>
            <span className="text-2xs text-terminal-text-dim/60">estimates illustrative, not sourced</span>
          </div>

          <div className="space-y-px max-h-[300px] overflow-y-auto">
            {upcoming.map((e) => {
              const days = daysUntil(e.date)
              const open = prepTicker === `${e.ticker}|${e.date}`
              return (
                <div key={`${e.ticker}-${e.date}`}>
                  <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-terminal-accent/10 border-l-2"
                    style={{ borderColor: isWatched(e.ticker) ? '#C9A84C' : 'transparent' }}
                  >
                    <span className="text-2xs text-terminal-text-dim w-14 flex-shrink-0 tabular-nums">
                      {new Date(`${e.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </span>
                    <button
                      onClick={() => openModal?.({ symbol: e.ticker, name: e.company, type: 'asx' })}
                      className="text-2xs font-bold text-terminal-gold w-12 flex-shrink-0 text-left"
                    >{e.ticker.replace('.AX', '')}</button>
                    <span className="text-2xs text-terminal-text truncate flex-1 min-w-0">
                      {e.company}
                      {isWatched(e.ticker) && <span className="text-terminal-gold ml-1" title="In your watchlist">★</span>}
                    </span>
                    <span className="text-2xs text-terminal-text-dim/60 w-20 flex-shrink-0 truncate">{e.type}</span>
                    <span className="text-2xs text-terminal-text-dim w-14 flex-shrink-0 text-right tabular-nums">
                      {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d`}
                    </span>
                    <button
                      onClick={() => setPrepTicker(open ? null : `${e.ticker}|${e.date}`)}
                      title="Pre-earnings checklist"
                      className="text-2xs px-1.5 py-0.5 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold flex-shrink-0"
                    >{open ? '−' : '☑'}</button>
                  </div>
                  {open && <div className="px-2 pb-2"><PrepChecklist entry={e} onChange={() => bump((n) => n + 1)} /></div>}
                </div>
              )
            })}
          </div>

          {/* WHAT IS NOT HERE.
              The design asked for a per-sector "historical beat rate" (Materials
              65%, Financials 72%) and an implied move from options pricing.
              Neither has a source in this app — there is no earnings-history
              feed and no options data — and a beat rate is precisely the sort of
              statistic someone would weight a position on. The EPS estimates
              already carry an "illustrative, not sourced" label; adding two more
              unsourced figures beside them would make the panel look researched
              when it is not. */}
          <div className="text-2xs text-terminal-text-dim/50 mt-2 leading-relaxed">
            Reporting dates are real. EPS and revenue estimates are illustrative placeholders,
            not broker consensus. No historical beat rate or implied move is shown — neither
            has a data source connected.
          </div>
        </div>
      </div>

      {preview && <EarningsPreviewPanel entry={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
