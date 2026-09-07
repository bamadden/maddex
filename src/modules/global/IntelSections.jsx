import { useEffect, useMemo, useState } from 'react'

// Three panels for the Global intel rail. Each is built from data the module
// already fetches or from the clock — nothing here adds a request, and nothing
// here invents a figure.

// ─── Seismic ─────────────────────────────────────────────────────────────────

// Great-circle distance, for the "how far from Australia" line. A magnitude
// alone does not tell an Australian investor whether it matters; an M6 off
// Chile and an M6 off the North West Shelf are very different events.
const SYDNEY = [151.2093, -33.8688]
function distanceKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

const magTone = (m) => (m >= 6.5 ? '#A83232' : m >= 5.5 ? '#C9A84C' : '#8BA3C4')

function timeAgo(ms, now) {
  const mins = Math.floor((now - ms) / 60000)
  if (mins < 60) return `${Math.max(0, mins)}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function SeismicSection({ earthquakes, onFocus }) {
  const [now] = useState(() => Date.now())

  const top = useMemo(() => {
    const list = Array.isArray(earthquakes) ? earthquakes : []
    return [...list]
      .filter((q) => q?.magnitude != null && Array.isArray(q.coordinates))
      .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
      .slice(0, 5)
  }, [earthquakes])

  return (
    <div className="border-b border-terminal-border">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">SEISMIC ACTIVITY</span>
        <span className="text-2xs text-terminal-text-dim/50">USGS · M4.5+ · 7 days</span>
      </div>

      {top.length === 0 ? (
        <div className="px-3 pb-2 text-2xs text-terminal-text-dim/60">
          No M4.5+ events in the last seven days, or the feed is unavailable.
        </div>
      ) : (
        <div className="pb-1">
          {top.map((q) => {
            const km = distanceKm(SYDNEY, q.coordinates)
            return (
              <button
                key={`${q.time}-${q.place}`}
                onClick={() => onFocus?.(q)}
                title="Show on the map"
                className="w-full text-left px-3 py-1.5 hover:bg-terminal-accent/15 transition-colors"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-bold tabular-nums flex-shrink-0" style={{ fontSize: 11, color: magTone(q.magnitude) }}>
                    M{q.magnitude.toFixed(1)}
                  </span>
                  <span className="text-2xs text-terminal-text truncate flex-1 min-w-0">{q.place}</span>
                  <span className="text-2xs text-terminal-text-dim/60 flex-shrink-0">{timeAgo(q.time, now)}</span>
                </div>
                <div className="text-2xs text-terminal-text-dim/50 mt-0.5">
                  {q.depth != null ? `${Math.round(q.depth)}km deep` : 'depth unknown'}
                  {' · '}{km.toLocaleString()}km from Sydney
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Market session countdown ────────────────────────────────────────────────
//
// Exchange hours in local time, converted through the browser's own timezone
// database rather than a table of UTC offsets — offsets are wrong twice a year
// and the bug only appears at a daylight-saving boundary, which is exactly when
// nobody is looking.
const EXCHANGES = [
  { code: 'ASX',  city: 'Sydney',   tz: 'Australia/Sydney',  open: [10, 0], close: [16, 0] },
  { code: 'NYSE', city: 'New York', tz: 'America/New_York',  open: [9, 30], close: [16, 0] },
  { code: 'LSE',  city: 'London',   tz: 'Europe/London',     open: [8, 0],  close: [16, 30] },
  { code: 'TSE',  city: 'Tokyo',    tz: 'Asia/Tokyo',        open: [9, 0],  close: [15, 0] },
]

// Minutes since midnight, and the weekday, in the exchange's own timezone.
function localState(tz, now) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    weekday: get('weekday'),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

const fmtGap = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function MarketSessionSection() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const rows = useMemo(() => {
    const d = new Date(now)
    return EXCHANGES.map((ex) => {
      const { weekday, minutes } = localState(ex.tz, d)
      const weekend = weekday === 'Sat' || weekday === 'Sun'
      const openMin = ex.open[0] * 60 + ex.open[1]
      const closeMin = ex.close[0] * 60 + ex.close[1]
      const isOpen = !weekend && minutes >= openMin && minutes < closeMin

      let status, gapMins
      if (weekend) { status = 'WEEKEND'; gapMins = null }
      else if (isOpen) { status = 'OPEN'; gapMins = closeMin - minutes }
      else if (minutes < openMin) { status = 'PRE'; gapMins = openMin - minutes }
      else { status = 'CLOSED'; gapMins = 24 * 60 - minutes + openMin }

      return { ...ex, status, gapMins, isOpen }
    })
    // Open exchanges first, then the one opening soonest — the ordering a
    // trader actually wants rather than a fixed list.
    .sort((a, b) => {
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1
      return (a.gapMins ?? 1e9) - (b.gapMins ?? 1e9)
    })
  }, [now])

  const tone = { OPEN: '#2D8A50', PRE: '#C9A84C', CLOSED: '#637899', WEEKEND: '#4A6080' }

  return (
    <div className="border-b border-terminal-border">
      <div className="px-3 py-1.5">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">MARKET SESSIONS</span>
      </div>
      <div className="pb-1">
        {rows.map((r) => (
          <div key={r.code} className="flex items-baseline gap-2 px-3 py-1">
            <span className="text-2xs font-bold text-terminal-text-bright w-10 flex-shrink-0">{r.code}</span>
            <span
              className="text-2xs font-bold flex-shrink-0 w-14"
              style={{ color: tone[r.status] }}
            >{r.status === 'PRE' ? 'PRE-OPEN' : r.status}</span>
            <span className="text-2xs text-terminal-text-dim truncate flex-1 min-w-0">{r.city}</span>
            <span className="text-2xs tabular-nums flex-shrink-0" style={{ color: tone[r.status] }}>
              {r.gapMins == null ? '—' : r.isOpen ? `${fmtGap(r.gapMins)} left` : `opens in ${fmtGap(r.gapMins)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Commodity momentum ──────────────────────────────────────────────────────
//
// Direction over the last five observations, expressed as a count rather than
// a percentage. "Up 4 of the last 5" is a fact about the series; a projected
// move would not be, and this deliberately stops at the fact.
function momentumOf(series) {
  if (!Array.isArray(series) || series.length < 3) return null
  const recent = series.slice(-6)
  let up = 0, down = 0
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i - 1]) up++
    else if (recent[i] < recent[i - 1]) down++
  }
  const n = recent.length - 1
  if (up >= Math.ceil(n * 0.6)) return { key: 'up', glyph: '▲▲', label: `up ${up} of last ${n}`, tone: '#2D8A50' }
  if (down >= Math.ceil(n * 0.6)) return { key: 'down', glyph: '▼▼', label: `down ${down} of last ${n}`, tone: '#A83232' }
  return { key: 'flat', glyph: '—', label: `mixed (${up} up, ${down} down)`, tone: '#637899' }
}

export function MomentumBadge({ series }) {
  const m = momentumOf(series)
  if (!m) return null
  return (
    <span
      className="text-2xs font-bold flex-shrink-0 tabular-nums"
      style={{ color: m.tone }}
      title={`5-day direction — ${m.label}`}
    >{m.glyph}</span>
  )
}
