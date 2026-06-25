import { useState, useRef, useMemo } from 'react'
import {
  AU_MACRO, GLOBAL_MACRO, AU_CALENDAR, GLOBAL_CALENDAR,
  AU_CPI_HISTORY, AU_UNEMP_HISTORY, AU_GDP_HISTORY,
  RBA_RATE_HISTORY, RBA_BOARD_MEMBERS, RBA_RECENT_STATEMENTS,
  AU_CONSUMER_SENTIMENT, AU_BUSINESS_CONFIDENCE, AU_TRADE_BALANCE,
  IRON_ORE_HISTORY, CHINA_WATCH,
} from '../../data/placeholders'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

// ─── Data freshness helpers ───────────────────────────────────────────────────
// Every macro indicator carries its official release `date` (ISO) and `src`
// (domain). Freshness is computed from that date — never assumed — so the
// badge always reflects how old the underlying official release actually is.

const monthYear = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

const daysSince = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return Infinity
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

const freshnessLevel = (iso) => {
  const days = daysSince(iso)
  if (days <= 30) return 'green'
  if (days <= 90) return 'amber'
  return 'red'
}

const FRESHNESS_COLOR = {
  green: 'bg-terminal-green text-terminal-green border-terminal-green/40',
  amber: 'bg-terminal-gold text-terminal-gold border-terminal-gold/40',
  red:   'bg-terminal-red text-terminal-red border-terminal-red/40',
}

const FRESHNESS_LABEL = { green: 'FRESH (<1MO)', amber: 'AGEING (1-3MO)', red: 'STALE (>3MO)' }

function FreshnessDot({ date }) {
  const level = freshnessLevel(date)
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${FRESHNESS_COLOR[level].split(' ')[0]}`} title={FRESHNESS_LABEL[level]} />
}

function SourceLink({ src }) {
  if (!src) return null
  const domain = src.split('/')[0]
  return (
    <a
      href={`https://${src}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-terminal-blue-bright hover:text-terminal-gold hover:underline"
    >
      {domain}
    </a>
  )
}

// Next official release date per indicator — only populated where the release
// calendar is well known; indicators without a confirmed next date are left
// blank rather than guessed.
const NEXT_RELEASE = {
  'RBA Cash Rate':       '1 July 2026',
  'AU CPI YoY':          '30 July 2026 (Q2 2026)',
  'AU CPI Trimmed Mean': '30 July 2026 (Q2 2026)',
  'AU Unemployment':     '19 June 2026',
  'AU GDP QoQ':          'September 2026',
  'AU GDP Annual':       'September 2026',
}

// Overall "DATA FRESHNESS" badge — worst-case across the 4 headline indicators
function OverallFreshnessBadge({ indicators }) {
  const dates = indicators.map((n) => AU_MACRO.find((m) => m.name === n)?.date).filter(Boolean)
  if (!dates.length) return null
  const worst = dates.reduce((acc, d) => (daysSince(d) > daysSince(acc) ? d : acc), dates[0])
  const level = freshnessLevel(worst)
  return (
    <span className={`inline-flex items-center gap-1.5 text-2xs font-bold px-2 py-0.5 border ${FRESHNESS_COLOR[level]} bg-opacity-10`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${FRESHNESS_COLOR[level].split(' ')[0]}`} />
      DATA FRESHNESS: {FRESHNESS_LABEL[level]}
    </span>
  )
}

const importanceDots = (level) => {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  return (
    <span className="flex gap-0.5 flex-shrink-0">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i <= filled
              ? level === 'high'   ? 'bg-terminal-red'
                : level === 'medium' ? 'bg-terminal-gold'
                : 'bg-terminal-text-dim'
              : 'bg-terminal-border'
          }`}
        />
      ))}
    </span>
  )
}

const ChartTooltip = ({ active, payload, label, unit, color }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1.5 text-2xs shadow-lg">
      <div className="text-terminal-text-dim mb-0.5">{label}</div>
      <div className="font-semibold" style={{ color }}>{payload[0].value}{unit}</div>
    </div>
  )
}

const MiniChart = ({ data, dataKey, color, refLine, unit = '', onClick }) => (
  <div
    className={`w-full h-full ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
    title={onClick ? 'Click to expand' : undefined}
  >
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
        <CartesianGrid stroke="#0d2244" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 8 }} interval={1} />
        <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `${v}${unit}`} domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip unit={unit} color={color} />} />
        {refLine != null && <ReferenceLine y={refLine} stroke="#c8a84b" strokeDasharray="2 2" />}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          dot={{ r: 2, fill: color }}
          activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 1 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)

// ─── Expanded Chart Modal ─────────────────────────────────────────────────────

const CHART_CONFIGS = {
  cpi: {
    title: 'AU CPI YoY (%)',
    data: null,
    color: '#f0c040',
    unit: '%',
    refLine: 2.5,
    refLabel: 'RBA midpoint 2.5%',
    annotations: [
      { date: 'Jun-22', label: 'RBA hiking cycle begins', y: 6.1 },
      { date: 'Dec-22', label: 'CPI peak', y: 8.4 },
      { date: 'Sep-23', label: 'RBA pauses', y: 5.4 },
    ],
  },
  unemp: {
    title: 'AU Unemployment Rate (%)',
    data: null,
    color: 'var(--color-gain)',
    unit: '%',
    refLine: 4.25,
    refLabel: 'NAIRU estimate 4.25%',
    annotations: [
      { date: 'Dec-22', label: '50yr low 3.4%', y: 3.4 },
    ],
  },
  gdp: {
    title: 'AU GDP Growth QoQ (%)',
    data: null,
    color: '#3b82f6',
    unit: '%',
    refLine: 0,
    refLabel: 'Zero growth',
    annotations: [],
  },
}

function ExpandedChartModal({ chartKey, data, onClose }) {
  const overlayRef = useRef(null)
  const cfg = CHART_CONFIGS[chartKey]
  if (!cfg) return null

  const latest = data[data.length - 1]
  const prev   = data[data.length - 2]
  const trend  = latest?.value > prev?.value ? 'UP' : latest?.value < prev?.value ? 'DOWN' : 'FLAT'
  const trendCls = trend === 'UP'
    ? (chartKey === 'unemp' ? 'text-terminal-red' : 'text-terminal-green')
    : trend === 'DOWN'
      ? (chartKey === 'unemp' ? 'text-terminal-green' : 'text-terminal-red')
      : 'text-terminal-text-dim'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="bg-terminal-panel border border-terminal-border flex flex-col overflow-hidden"
        style={{ width: '80vw', maxWidth: 900, height: '70vh', maxHeight: 600 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-sm font-bold text-terminal-gold tracking-wider">{cfg.title}</span>
          <span className={`text-2xs font-bold ${trendCls}`}>
            {latest?.value}{cfg.unit} {trend === 'UP' ? '▲' : trend === 'DOWN' ? '▼' : '—'}
          </span>
          <span className="text-2xs text-terminal-text-dim ml-2">PREV: {prev?.value}{cfg.unit}</span>
          <button onClick={onClose} className="ml-auto text-terminal-text-dim hover:text-terminal-text text-lg">✕</button>
        </div>

        {/* Chart */}
        <div className="flex-1 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#0d2244" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4a6580' }} interval={1} />
              <YAxis
                tick={{ fontSize: 10, fill: '#4a6580' }}
                tickFormatter={(v) => `${v}${cfg.unit}`}
                domain={['auto', 'auto']}
                width={50}
              />
              <Tooltip content={<ChartTooltip unit={cfg.unit} color={cfg.color} />} />
              {cfg.refLine != null && (
                <ReferenceLine
                  y={cfg.refLine}
                  stroke="#c8a84b"
                  strokeDasharray="4 4"
                  label={{ value: cfg.refLabel, fill: '#c8a84b', fontSize: 9, position: 'right' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={cfg.color}
                strokeWidth={2}
                dot={{ r: 3, fill: cfg.color }}
                activeDot={{ r: 5, fill: cfg.color, stroke: '#fff', strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer stats */}
        <div className="border-t border-terminal-border px-4 py-2 flex items-center gap-6 text-2xs flex-shrink-0">
          <span className="text-terminal-text-dim">LATEST: <span style={{ color: cfg.color }}>{latest?.value}{cfg.unit} ({latest?.date})</span></span>
          <span className="text-terminal-text-dim">PERIOD HIGH: <span className="text-terminal-green">{Math.max(...data.map(d => d.value)).toFixed(1)}{cfg.unit}</span></span>
          <span className="text-terminal-text-dim">PERIOD LOW: <span className="text-terminal-red">{Math.min(...data.map(d => d.value)).toFixed(1)}{cfg.unit}</span></span>
          <span className="text-terminal-text-dim ml-auto">SOURCE: ABS · Click outside to close</span>
        </div>
      </div>
    </div>
  )
}

// Highlight calendar events dated today (handles 'DD MMM' format like '14 JUN')
const todayShort = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  .toUpperCase().replace(/\./g, '').replace(/\s+/, ' ')  // e.g. '14 JUN'

function CalendarPanel({ events, title }) {
  return (
    <div className="flex flex-col">
      <div className="panel-header">
        {title}
        <span className="ml-2 text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">INDICATIVE</span>
      </div>
      <div>
        {events.map((evt, i) => {
          const isRBA    = evt.event.includes('RBA') || evt.event.includes('AU ')
          const isToday  = evt.date === 'TODAY' || evt.date === todayShort
          return (
            <div
              key={i}
              className={`border-b border-terminal-border/50 p-2 hover:bg-terminal-accent/20 ${
                isToday
                  ? isRBA
                    ? 'border-l-2 border-l-terminal-gold'
                    : 'border-l-2 border-l-terminal-blue'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-2xs font-bold ${isToday ? 'text-terminal-gold' : 'text-terminal-text-dim'}`}>
                    {evt.date === 'TODAY' ? 'TODAY' : evt.date}
                  </span>
                  <span className="text-2xs text-terminal-text-dim">{evt.time} AEST</span>
                  <span className={`text-2xs px-1 font-bold ${
                    evt.region === 'AU' ? 'bg-terminal-gold/20 text-terminal-gold'
                    : evt.region === 'CN' ? 'bg-red-900/30 text-red-400'
                    : 'bg-terminal-border/50 text-terminal-text-dim'
                  }`}>
                    {evt.region}
                  </span>
                </div>
                {importanceDots(evt.importance)}
              </div>
              <div className="text-2xs font-semibold text-terminal-text-bright">{evt.event}</div>
              <div className="flex items-center gap-3 mt-0.5 text-2xs text-terminal-text-dim">
                <span>FCST: <span className="text-terminal-text">{evt.forecast}</span></span>
                <span>PREV: <span className="text-terminal-text">{evt.prev}</span></span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-terminal-border p-1.5 flex-shrink-0">
        <div className="flex items-center gap-3 text-2xs text-terminal-text-dim">
          <span className="flex items-center gap-1">{importanceDots('high')} <span>HIGH</span></span>
          <span className="flex items-center gap-1">{importanceDots('medium')} <span>MEDIUM</span></span>
          <span className="flex items-center gap-1">{importanceDots('low')} <span>LOW</span></span>
        </div>
      </div>
    </div>
  )
}

// ─── Meeting Countdown ────────────────────────────────────────────────────────

// Next RBA meeting: 1 July 2026 at 2:30pm AEST (04:30 UTC)
const RBA_NEXT_MEETING = new Date('2026-07-01T04:30:00Z')
const FOMC_NEXT_MEETING = new Date('2026-07-28T18:00:00Z')

const MEETINGS = [
  { label: 'RBA',  name: 'Rate Decision', date: RBA_NEXT_MEETING,  color: 'text-terminal-gold',        note: '2:30pm AEST' },
  { label: 'FOMC', name: 'Rate Decision', date: FOMC_NEXT_MEETING, color: 'text-terminal-blue-bright', note: '2:00pm EDT'  },
]

function MeetingCountdown({ meeting }) {
  const diff = meeting.date - Date.now()
  if (diff <= 0) return <span className={`text-2xs font-bold ${meeting.color}`}>{meeting.label}: TODAY {meeting.note}</span>
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const text  = days > 0 ? `${days}d ${hours}h` : `${hours}h`
  return (
    <span className="inline-flex items-center gap-1 text-2xs">
      <span className={`font-bold ${meeting.color}`}>{meeting.label}</span>
      <span className="text-terminal-text-dim">{meeting.name}:</span>
      <span className="text-terminal-text-bright font-semibold">{text}</span>
      <span className="text-terminal-text-dim/60">({meeting.note})</span>
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_MAP = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 }

function parseEventDate(dateStr, timeStr = '00:00') {
  if (!dateStr || dateStr === 'TODAY') return new Date()
  const [d, m] = dateStr.split(' ')
  const month = MONTH_MAP[m?.toUpperCase()]
  if (month == null) return null
  const [h, min] = (timeStr || '00:00').split(':').map(Number)
  return new Date(2026, month, parseInt(d, 10), h, min)
}

function getCountdown(dateStr, timeStr) {
  const d = parseEventDate(dateStr, timeStr)
  if (!d) return null
  const diff = d - Date.now()
  if (diff <= 0) return null
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  return days > 0 ? `${days}D ${hours}H` : `${hours}H`
}

// ─── Section 7: RBA Dashboard ─────────────────────────────────────────────────

const RBA_NEXT = new Date('2026-07-01T04:30:00Z')

function RBADashboard({ askAI }) {
  const [showBoard, setShowBoard] = useState(false)

  const diffMs   = RBA_NEXT - Date.now()
  const daysLeft = Math.max(0, Math.floor(diffMs / 86400000))
  const hrsLeft  = Math.max(0, Math.floor((diffMs % 86400000) / 3600000))

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      {/* Header */}
      <div className="panel-header flex items-center gap-3 flex-wrap">
        <span className="text-terminal-gold">RBA DASHBOARD</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case">Cash Rate Target</span>
        <span className="text-2xl font-bold text-terminal-gold">4.35%</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case">p.a.</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-2xs text-terminal-text-dim">NEXT MEETING:</span>
          <span className="text-2xs font-bold text-terminal-text-bright">1 JUL 2026</span>
          <span className="text-2xs border border-terminal-gold/40 text-terminal-gold px-1.5 py-0.5">
            IN {daysLeft}D {hrsLeft}H
          </span>
          <button
            onClick={() => askAI('What is the RBA likely to do at the next meeting on 1 July 2026 and why? Current cash rate 4.35%. CPI at 2.4% YoY. Unemployment 4.1%. Market pricing 35% cut, 65% hold.')}
            className="text-2xs border border-terminal-gold/40 text-terminal-gold/70 hover:border-terminal-gold hover:text-terminal-gold px-2 py-0.5 transition-colors"
          >
            AI ▶
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] divide-x divide-terminal-border">
        {/* Rate history chart */}
        <div className="p-2">
          <div className="text-2xs text-terminal-text-dim mb-1">CASH RATE HISTORY (Jan 2022 – Jun 2026)</div>
          <div style={{ height: 110 }}>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={RBA_RATE_HISTORY} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <defs>
                  <linearGradient id="rbaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c8a84b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c8a84b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#0d2244" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 7 }} interval={5} />
                <YAxis tick={{ fontSize: 7 }} tickFormatter={v => `${v}%`} domain={[0, 5]} width={32} />
                <Tooltip content={({ active, payload, label }) =>
                  active && payload?.length
                    ? <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                        <div className="text-terminal-text-dim">{label}</div>
                        <div className="text-terminal-gold font-semibold">{payload[0].value}%</div>
                      </div>
                    : null
                } />
                <ReferenceLine y={2.5} stroke="#3b82f6" strokeDasharray="3 3" />
                <Area type="stepAfter" dataKey="rate" stroke="#c8a84b" strokeWidth={1.5}
                  fill="url(#rbaGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-1 text-2xs text-terminal-text-dim">
            <span>May-22: Hike cycle begins 0.10% → 0.35%</span>
            <span>Oct-23: Peak 4.35%</span>
            <span className="text-terminal-blue-bright">— neutral ~2.5%</span>
          </div>
        </div>

        {/* Market pricing */}
        <div className="p-3 w-44 flex-shrink-0">
          <div className="text-2xs text-terminal-gold font-bold mb-2">NEXT MEETING PRICING</div>
          <div className="space-y-2">
            {[
              { label: 'HOLD 4.35%', pct: 65, color: 'var(--color-neutral)' },
              { label: 'CUT 4.10%',  pct: 35, color: 'var(--color-loss)' },
              { label: 'HIKE 4.60%', pct: 0,  color: 'var(--color-gain)' },
            ].map(({ label, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-2xs" style={{ color }}>{label}</span>
                  <span className="text-2xs font-bold" style={{ color }}>{pct}%</span>
                </div>
                <div className="h-1 bg-terminal-border/30">
                  <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-2xs text-terminal-text-dim/60">ASX 30-day interbank</div>
        </div>

        {/* Recent statements */}
        <div className="p-3 w-72 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-2xs text-terminal-gold font-bold">RECENT STATEMENTS</div>
            <button
              onClick={() => setShowBoard(v => !v)}
              className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors"
            >
              {showBoard ? 'HIDE BOARD' : 'SHOW BOARD'}
            </button>
          </div>
          {showBoard ? (
            <div className="overflow-auto flex-1">
              {RBA_BOARD_MEMBERS.map(m => (
                <div key={m.name} className="border-b border-terminal-border/30 py-0.5">
                  <div className="text-2xs font-semibold text-terminal-text-bright">{m.name}</div>
                  <div className="flex justify-between">
                    <span className="text-2xs text-terminal-text-dim">{m.role}</span>
                    <span className="text-2xs text-terminal-gold/70">{m.votes}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 overflow-auto flex-1">
              {RBA_RECENT_STATEMENTS.map((s, i) => (
                <div key={i} className="border-l-2 border-terminal-gold/40 pl-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-2xs text-terminal-text-dim">{s.date}</span>
                    <span className="text-2xs font-bold text-terminal-gold">{s.decision}</span>
                  </div>
                  <div className="text-2xs text-terminal-text-dim italic leading-tight line-clamp-2">{s.key}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section 4: Leading Indicators ───────────────────────────────────────────

const SentimentTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs shadow-lg">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="text-terminal-gold font-semibold">{payload[0].value}</div>
    </div>
  )
}

function LeadingIndicators() {
  const cards = [
    {
      title: 'AU CONSUMER SENTIMENT',
      subtitle: 'Westpac-Melbourne Inst.',
      current: '82.4',
      note: 'Jun 2026 — PESSIMISTIC (below 100)',
      source: 'Westpac-MI',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={AU_CONSUMER_SENTIMENT} margin={{ top: 4, right: 8, left: -28, bottom: 4 }}>
            <CartesianGrid stroke="#0d2244" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 7 }} interval={4} />
            <YAxis tick={{ fontSize: 7 }} domain={[70, 110]} width={34} />
            <Tooltip content={<SentimentTooltip />} />
            <ReferenceLine y={100} stroke="#c8a84b" strokeDasharray="3 3"
              label={{ value: 'NEUTRAL', fill: '#c8a84b', fontSize: 7, position: 'right' }} />
            <Line type="monotone" dataKey="value" stroke="#f87171" strokeWidth={1.5}
              dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'AU BUSINESS CONFIDENCE',
      subtitle: 'NAB Monthly Survey',
      current: '+4',
      note: 'May 2026',
      source: 'NAB Survey',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={AU_BUSINESS_CONFIDENCE} margin={{ top: 4, right: 8, left: -28, bottom: 4 }}>
            <CartesianGrid stroke="#0d2244" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 7 }} interval={4} />
            <YAxis tick={{ fontSize: 7 }} domain={[-5, 12]} width={28} />
            <Tooltip content={<SentimentTooltip />} />
            <ReferenceLine y={0} stroke="#c8a84b" strokeDasharray="3 3" />
            <Bar dataKey="value" isAnimationActive={false} radius={[1,1,0,0]}>
              {AU_BUSINESS_CONFIDENCE.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? 'rgba(46,160,90,0.6)' : 'rgba(180,60,60,0.6)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'AU TRADE BALANCE',
      subtitle: 'ABS International Trade',
      current: '+A$6.9B',
      note: 'Mar 2026 — SURPLUS',
      source: 'ABS 5368.0',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={AU_TRADE_BALANCE} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <defs>
              <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2ea05a" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2ea05a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#0d2244" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 7 }} interval={4} />
            <YAxis tick={{ fontSize: 7 }} tickFormatter={v => `${v}B`} domain={[0, 14]} width={32} />
            <Tooltip content={<SentimentTooltip />} />
            <ReferenceLine y={0} stroke="#c8a84b" strokeDasharray="2 2" />
            <Area type="monotone" dataKey="value" stroke="#2ea05a" strokeWidth={1.5}
              fill="url(#tradeGrad)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'IRON ORE PRICE',
      subtitle: 'Singapore Exchange (SGX)',
      current: 'USD 98/t',
      note: 'Key AU export driver — impacts AUD & miners',
      source: 'SGX / Platts',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={IRON_ORE_HISTORY} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
            <CartesianGrid stroke="#0d2244" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 7 }} interval={2} />
            <YAxis tick={{ fontSize: 7 }} tickFormatter={v => `$${v}`} domain={[85, 115]} width={36} />
            <Tooltip content={<SentimentTooltip />} />
            <ReferenceLine y={90} stroke="#f87171" strokeDasharray="3 3"
              label={{ value: '$90 support', fill: '#f87171', fontSize: 7, position: 'right' }} />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5}
              dot={{ r: 2.5, fill: '#3b82f6' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
  ]

  return (
    <div className="border-b border-terminal-border">
      <div className="panel-header">
        LEADING INDICATORS
        <span className="ml-2 text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">
          Forward-looking signals
        </span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4" style={{ gap: 16, padding: 16 }}>
        {cards.map((c) => (
          <div
            key={c.title}
            className="flex flex-col"
            style={{ background: '#071428', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: 12 }}
          >
            <div className="flex-shrink-0 mb-1">
              <div className="text-2xs font-bold text-terminal-text-bright">{c.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-terminal-gold">{c.current}</span>
                <span className="text-2xs text-terminal-text-dim">{c.note}</span>
              </div>
            </div>
            <div style={{ height: 110 }}>
              {c.chart}
            </div>
            <div className="mt-1 text-2xs text-terminal-text-dim/60 border-t border-terminal-border pt-1">
              SOURCE: {c.source}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section 6: China Watch ───────────────────────────────────────────────────

function ChinaWatch({ askAI }) {
  const trendIcon = (t) => t === 'up' ? '▲' : t === 'down' ? '▼' : '—'
  const trendCls  = (t) => t === 'up' ? 'text-terminal-green' : t === 'down' ? 'text-terminal-red' : 'text-terminal-text-dim'

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        <span className="text-red-400">CHINA WATCH</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">
          Key indicators for Australian commodity and trade exposure
        </span>
        <span className="text-2xs text-terminal-text-dim/60 font-normal normal-case ml-2">
          China ≈ 32% of Australian exports
        </span>
        <button
          onClick={() => askAI('Analyse current China economic conditions and their impact on Australian markets, commodities, and the AUD. Include iron ore demand outlook, property sector risks, and implications for ASX-listed miners and energy companies.')}
          className="ml-auto text-2xs border border-red-400/40 text-red-400/70 hover:border-red-400 hover:text-red-400 px-2 py-0.5 transition-colors"
        >
          AI ▶
        </button>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-terminal-border border-b border-terminal-border">
        {CHINA_WATCH.slice(0, 4).map((ind) => (
          <div key={ind.name} className="p-2 hover:bg-terminal-accent/10">
            <div className="text-2xs text-terminal-text-dim mb-0.5">{ind.name}</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-terminal-text-bright">{ind.value}</span>
              <span className={`text-2xs font-bold ${trendCls(ind.trend)}`}>
                {trendIcon(ind.trend)} {ind.mom}
              </span>
            </div>
            <div className="mt-1" style={{ height: 32 }}>
              <ResponsiveContainer width="100%" height={32}>
                <LineChart data={ind.history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                  <Line type="monotone" dataKey="v" stroke={ind.trend === 'up' ? '#2ea05a' : ind.trend === 'down' ? '#b43c3c' : '#c8a84b'}
                    strokeWidth={1.2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-2xs text-terminal-text-dim/60 mt-0.5 truncate" title={ind.why}>{ind.why}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 divide-x divide-terminal-border">
        {CHINA_WATCH.slice(4).map((ind) => (
          <div key={ind.name} className="p-2 hover:bg-terminal-accent/10">
            <div className="text-2xs text-terminal-text-dim mb-0.5">{ind.name}</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-terminal-text-bright">{ind.value}</span>
              <span className={`text-2xs font-bold ${trendCls(ind.trend)}`}>
                {trendIcon(ind.trend)} {ind.mom}
              </span>
              <span className="text-2xs text-terminal-text-dim ml-auto">{ind.date}</span>
            </div>
            <div className="mt-1" style={{ height: 32 }}>
              <ResponsiveContainer width="100%" height={32}>
                <LineChart data={ind.history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                  <Line type="monotone" dataKey="v" stroke={ind.trend === 'up' ? '#2ea05a' : ind.trend === 'down' ? '#b43c3c' : '#c8a84b'}
                    strokeWidth={1.2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-2xs text-terminal-text-dim/60 mt-0.5 truncate" title={ind.why}>{ind.why}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section 5: Enhanced Events Calendar ─────────────────────────────────────

function EnhancedEvents() {
  const [expanded, setExpanded] = useState(null)
  const allEvents = useMemo(() => {
    return [...AU_CALENDAR, ...GLOBAL_CALENDAR]
      .map((e, i) => ({ ...e, id: i }))
      .sort((a, b) => {
        const da = parseEventDate(a.date, a.time)
        const db = parseEventDate(b.date, b.time)
        return (da || 0) - (db || 0)
      })
  }, [])

  const impactCls = (imp) =>
    imp === 'high'   ? 'text-terminal-red border-l-2 border-l-terminal-red' :
    imp === 'medium' ? 'text-terminal-gold border-l-2 border-l-terminal-gold' :
                       'text-terminal-text-dim border-l-2 border-l-terminal-border'

  const impactDot = (imp) =>
    imp === 'high'   ? 'bg-terminal-red' :
    imp === 'medium' ? 'bg-terminal-gold' : 'bg-terminal-border'

  const regionCls = (r) =>
    r === 'AU' ? 'text-terminal-gold bg-terminal-gold/10' :
    r === 'CN' ? 'text-red-400 bg-red-900/20' :
    r === 'US' ? 'text-terminal-blue-bright bg-blue-900/20' : 'text-terminal-text-dim bg-terminal-border/20'

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        <span>MARKET MOVING EVENTS</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">Next 30 days · All times AEST</span>
        <div className="ml-auto flex items-center gap-3 text-2xs text-terminal-text-dim">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-terminal-red inline-block" /> HIGH</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-terminal-gold inline-block" /> MED</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-terminal-border inline-block" /> LOW</span>
        </div>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 260 }}>
        {allEvents.map((evt) => {
          const countdown = getCountdown(evt.date, evt.time)
          const isPast    = !countdown && evt.date !== 'TODAY'
          const isOpen    = expanded === evt.id
          return (
            <div
              key={evt.id}
              className={`border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-accent/15 transition-colors ${impactCls(evt.importance)} ${isPast ? 'opacity-40' : ''}`}
              onClick={() => setExpanded(isOpen ? null : evt.id)}
            >
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${impactDot(evt.importance)}`} />
                <div className="flex items-center gap-1.5 flex-shrink-0 w-20">
                  <span className="text-2xs font-bold text-terminal-text-bright">{evt.date}</span>
                </div>
                <span className="text-2xs text-terminal-text-dim w-12 flex-shrink-0">{evt.time}</span>
                <span className={`text-2xs px-1 font-bold flex-shrink-0 ${regionCls(evt.region)}`}>{evt.region}</span>
                <span className="text-2xs font-semibold text-terminal-text-bright flex-1 truncate">{evt.event}</span>
                <div className="flex items-center gap-3 flex-shrink-0 text-2xs text-terminal-text-dim">
                  <span>FCST: <span className="text-terminal-text">{evt.forecast}</span></span>
                  <span>PREV: <span className="text-terminal-text">{evt.prev}</span></span>
                </div>
                {countdown && (
                  <span className="text-2xs font-bold text-terminal-gold border border-terminal-gold/30 px-1.5 py-0.5 flex-shrink-0">
                    IN {countdown}
                  </span>
                )}
                <span className="text-terminal-text-dim text-2xs ml-1">{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div className="px-8 py-2 bg-terminal-accent/5 border-t border-terminal-border/20">
                  <div className="grid grid-cols-2 gap-4 text-2xs">
                    <div>
                      <div className="text-terminal-gold font-bold mb-1">WHAT THIS MEASURES</div>
                      <div className="text-terminal-text-dim leading-relaxed">
                        {evt.region === 'AU' && evt.event.includes('RBA')
                          ? 'Reserve Bank of Australia monetary policy decision. Sets the target cash rate which flows through to all lending and deposit rates in Australia.'
                          : evt.region === 'AU'
                          ? `Official Australian economic data release from the ABS or RBA. Key input for RBA policy decisions and market pricing.`
                          : `International economic data release. Relevant for global risk sentiment and Australian trade/currency exposure.`}
                      </div>
                    </div>
                    <div>
                      <div className="text-terminal-gold font-bold mb-1">AU MARKET IMPACT</div>
                      <div className="text-terminal-text-dim leading-relaxed">
                        {evt.importance === 'high'
                          ? 'HIGH IMPACT — typically moves AUD, ASX 200 futures, and rate-sensitive sectors (REITs, banks, utilities). Watch for immediate repricing.'
                          : 'MEDIUM IMPACT — may influence sector rotation and AUD cross rates. Monitor for deviation from consensus.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export default function MacroModule() {
  const [globalExpanded, setGlobalExpanded] = useState(false)
  const [expandedChart, setExpandedChart]   = useState(null)

  const askAI = (prompt) =>
    window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt } }))

  // RBA Cash Rate — hardcoded from official rba.gov.au May 2026 board decision.
  // The live RBA API (api.rba.gov.au) is unreliable; for a single data point that
  // changes at most 8 times per year, hardcoding the confirmed rate is more reliable.
  const rbaRate    = 4.35
  const rbaRateStr = '4.35%'

  // AU indicator stats from ABS (updated in placeholders to latest known release)
  const latestCPI   = AU_CPI_HISTORY[AU_CPI_HISTORY.length - 1]?.value ?? 2.4
  const prevCPI     = AU_CPI_HISTORY[AU_CPI_HISTORY.length - 2]?.value ?? 2.4
  const latestUnemp = AU_UNEMP_HISTORY[AU_UNEMP_HISTORY.length - 1]?.value ?? 4.1
  const prevUnemp   = AU_UNEMP_HISTORY[AU_UNEMP_HISTORY.length - 2]?.value ?? 4.0
  const latestGDP   = AU_GDP_HISTORY[AU_GDP_HISTORY.length - 1]?.value ?? 0.6
  const prevGDP     = AU_GDP_HISTORY[AU_GDP_HISTORY.length - 2]?.value ?? 0.3

  const globalByRegion = {
    US: GLOBAL_MACRO.filter((m) => m.region === 'US'),
    CN: GLOBAL_MACRO.filter((m) => m.region === 'CN'),
    EU: GLOBAL_MACRO.filter((m) => m.region === 'EU'),
    UK: GLOBAL_MACRO.filter((m) => m.region === 'UK'),
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">

      {/* Expanded chart modal — fixed overlay, unaffected by scroll */}
      {expandedChart && (
        <ExpandedChartModal
          chartKey={expandedChart}
          data={expandedChart === 'cpi' ? AU_CPI_HISTORY : expandedChart === 'unemp' ? AU_UNEMP_HISTORY : AU_GDP_HISTORY}
          onClose={() => setExpandedChart(null)}
        />
      )}

      {/* Data freshness summary — worst-case across headline indicators */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-terminal-border flex-shrink-0">
        <OverallFreshnessBadge indicators={['RBA Cash Rate', 'AU CPI YoY', 'AU Unemployment', 'AU GDP QoQ']} />
        <span className="text-2xs text-terminal-text-dim">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-green mr-1" />GREEN &lt;1mo old ·
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-gold mx-1" />AMBER 1-3mo ·
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-red mx-1" />RED &gt;3mo
        </span>
      </div>

      {/* ── Section 1: RBA Dashboard ── */}
      <RBADashboard askAI={askAI} />

      {/* ── Section 2: AU Macro Indicators ── */}
      <div style={{ marginTop: 24 }}>
        <div className="panel-header flex items-center gap-2">
          <span className="text-terminal-gold">AU MACRO INDICATORS</span>
          <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">
            RBA CASH RATE
          </span>
          <span className="text-terminal-gold font-bold text-sm">{rbaRateStr}</span>
          <span className="text-2xs text-terminal-text-dim font-normal normal-case">
            AS AT {monthYear(AU_MACRO.find((m) => m.name === 'RBA Cash Rate')?.date).toUpperCase()}
          </span>
          <div className="flex items-center gap-4 ml-auto">
            {MEETINGS.map(m => <MeetingCountdown key={m.label} meeting={m} />)}
          </div>
        </div>

        <div className="grid grid-cols-4 xl:grid-cols-8 border-b border-terminal-border">
          {AU_MACRO.slice(0, 8).map((ind) => (
            <div key={ind.name} className="border-r border-terminal-border p-2 hover:bg-terminal-accent/20">
              <div className="flex items-center gap-1 mb-0.5">
                <FreshnessDot date={ind.date} />
                <div className="text-2xs text-terminal-text-dim leading-tight">{ind.name}</div>
              </div>
              <div className="text-sm font-bold text-terminal-text-bright">
                {ind.name === 'RBA Cash Rate' ? rbaRateStr : ind.value}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-2xs text-terminal-text-dim">PREV: {ind.prev}</span>
                {ind.beat !== null && (
                  <span className={`text-2xs font-bold ${ind.beat ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {ind.beat ? '▲' : '▼'}
                  </span>
                )}
              </div>
              <div className="text-2xs text-terminal-text-dim mt-0.5">
                as at {monthYear(ind.date)} · <SourceLink src={ind.src} />
              </div>
              {NEXT_RELEASE[ind.name] && (
                <div className="text-2xs text-terminal-gold/70 mt-0.5">NEXT: {NEXT_RELEASE[ind.name]}</div>
              )}
            </div>
          ))}
        </div>

        <div className="px-3 py-1 text-2xs text-terminal-text-dim/60 border-b border-terminal-border flex items-center gap-4 flex-wrap">
          <span>AU MACRO: ABS/RBA OFFICIAL RELEASES · DATES = RELEASE DATES</span>
          <span>RBA: <a href="https://www.rba.gov.au/monetary-policy/rba-board-minutes/" target="_blank" rel="noopener noreferrer" className="text-terminal-blue-bright hover:underline">rba.gov.au ↗</a> · ABS: abs.gov.au</span>
          <span className="ml-auto">Rate decisions announced day of meeting at 2:30pm AEST</span>
        </div>
      </div>

      {/* ── Section 3: AU Charts ── */}
      <div style={{ marginTop: 24 }}>
        <div className="grid grid-cols-3 border-b border-terminal-border" style={{ height: 220 }}>
          <div className="flex flex-col border-r border-terminal-border">
            <div className="panel-header text-2xs cursor-pointer hover:text-terminal-gold transition-colors"
              onClick={() => setExpandedChart('cpi')}>
              AU CPI YoY ↗
              <span className="text-terminal-text-bright ml-1">{latestCPI}%</span>
              <span className={`ml-1 text-2xs ${latestCPI < prevCPI ? 'text-terminal-green' : 'text-terminal-red'}`}>
                {latestCPI < prevCPI ? '▼' : '▲'} {Math.abs(latestCPI - prevCPI).toFixed(1)}
              </span>
              <span className="ml-auto text-terminal-text-dim font-normal normal-case text-2xs">ABS</span>
            </div>
            <div className="flex-1 p-1">
              <MiniChart data={AU_CPI_HISTORY} dataKey="value" color="#f0c040" refLine={2.5} unit="%" onClick={() => setExpandedChart('cpi')} />
            </div>
            <div className="px-2 py-1 text-2xs text-terminal-text-dim border-t border-terminal-border flex-shrink-0">
              RBA TARGET: 2–3% <span className={`ml-1 ${latestCPI > 3 ? 'text-terminal-red' : 'text-terminal-green'}`}>
                {latestCPI > 3 ? 'ABOVE TARGET' : 'IN TARGET'}
              </span>
            </div>
          </div>

          <div className="flex flex-col border-r border-terminal-border">
            <div className="panel-header text-2xs cursor-pointer hover:text-terminal-gold transition-colors"
              onClick={() => setExpandedChart('unemp')}>
              AU UNEMPLOYMENT ↗
              <span className="text-terminal-text-bright ml-1">{latestUnemp}%</span>
              <span className={`ml-1 text-2xs ${latestUnemp > prevUnemp ? 'text-terminal-red' : 'text-terminal-green'}`}>
                {latestUnemp > prevUnemp ? '▲' : '▼'} {Math.abs(latestUnemp - prevUnemp).toFixed(1)}
              </span>
              <span className="ml-auto text-terminal-text-dim font-normal normal-case text-2xs">ABS</span>
            </div>
            <div className="flex-1 p-1">
              <MiniChart data={AU_UNEMP_HISTORY} dataKey="value" color="var(--color-gain)" unit="%" onClick={() => setExpandedChart('unemp')} />
            </div>
            <div className="px-2 py-1 text-2xs text-terminal-text-dim border-t border-terminal-border flex-shrink-0">
              NAIRU ESTIMATE ~4.25%
            </div>
          </div>

          <div className="flex flex-col">
            <div className="panel-header text-2xs cursor-pointer hover:text-terminal-gold transition-colors"
              onClick={() => setExpandedChart('gdp')}>
              AU GDP QoQ ↗
              <span className="text-terminal-text-bright ml-1">{latestGDP}%</span>
              <span className={`ml-1 text-2xs ${latestGDP >= prevGDP ? 'text-terminal-green' : 'text-terminal-red'}`}>
                {latestGDP >= prevGDP ? '▲' : '▼'} {Math.abs(latestGDP - prevGDP).toFixed(1)}
              </span>
              <span className="ml-auto text-terminal-text-dim font-normal normal-case text-2xs">ABS</span>
            </div>
            <div className="flex-1 p-1">
              <MiniChart data={AU_GDP_HISTORY} dataKey="value" color="#3b82f6" refLine={0} unit="%" onClick={() => setExpandedChart('gdp')} />
            </div>
            <div className="px-2 py-1 text-2xs text-terminal-text-dim border-t border-terminal-border flex-shrink-0">
              QUARTERLY · ABS NATIONAL ACCOUNTS
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Leading Indicators ── */}
      <div style={{ marginTop: 24 }}>
        <LeadingIndicators />
      </div>

      {/* ── Section 5: China Watch ── */}
      <div style={{ marginTop: 24 }}>
        <ChinaWatch askAI={askAI} />
      </div>

      {/* ── Section 6: Market Moving Events / Calendar ── */}
      <div style={{ marginTop: 24 }}>
        <EnhancedEvents />
        <div style={{ marginTop: 16 }}>
          <CalendarPanel events={AU_CALENDAR} title="AU ECONOMIC CALENDAR" />
        </div>
        <div style={{ marginTop: 8 }}>
          <CalendarPanel events={GLOBAL_CALENDAR} title="GLOBAL CALENDAR (AEST)" />
        </div>
      </div>

      {/* ── Section 7: Global Context (collapsible) ── */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <button
          onClick={() => setGlobalExpanded((v) => !v)}
          className="w-full panel-header flex items-center justify-between hover:bg-terminal-accent/20 transition-colors cursor-pointer"
        >
          <span className="text-terminal-text-dim font-normal normal-case tracking-normal">
            GLOBAL CONTEXT
          </span>
          <span className="text-terminal-text-dim">{globalExpanded ? '▲' : '▼'}</span>
        </button>

        {globalExpanded && (
          <div className="border-t border-terminal-border">
            <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-terminal-border border-b border-terminal-border">
              {Object.entries(globalByRegion).map(([region, indicators]) => (
                <div key={region} className="p-2">
                  <div className={`text-2xs font-bold mb-2 pb-1 border-b border-terminal-border/50 ${
                    region === 'CN' ? 'text-red-400' : region === 'US' ? 'text-terminal-blue-bright' : 'text-terminal-text-bright'
                  }`}>
                    {region === 'CN' ? 'CN CHINA' : region === 'US' ? 'US' : region === 'EU' ? 'EU EUROZONE' : 'UK'}
                  </div>
                  {indicators.map((ind) => (
                    <div key={ind.name} className="py-0.5 border-b border-terminal-border/20">
                      <div className="flex items-center gap-1">
                        <FreshnessDot date={ind.date} />
                        <span className="text-2xs text-terminal-text-dim">{ind.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-terminal-text-bright">{ind.value}</span>
                        {ind.beat !== null && (
                          <span className={`text-2xs ${ind.beat ? 'text-terminal-green' : 'text-terminal-red'}`}>
                            {ind.beat ? '▲ BEAT' : '▼ MISS'}
                          </span>
                        )}
                      </div>
                      <div className="text-2xs text-terminal-text-dim">
                        PREV: {ind.prev} · as at {monthYear(ind.date)} · <SourceLink src={ind.src} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="px-3 py-1 text-2xs text-terminal-text-dim/60">
              GLOBAL DATA: OFFICIAL STATISTICAL AGENCY RELEASES · DATES SHOWN ARE RELEASE DATES
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
