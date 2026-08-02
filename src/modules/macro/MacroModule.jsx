import { useState, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AU_MACRO,
  AU_CPI_HISTORY, AU_UNEMP_HISTORY, AU_GDP_HISTORY,
  RBA_RATE_HISTORY, RBA_BOARD_MEMBERS, RBA_RECENT_STATEMENTS,
  AU_CONSUMER_SENTIMENT, AU_BUSINESS_CONFIDENCE, AU_TRADE_BALANCE,
  IRON_ORE_HISTORY, CHINA_WATCH, AU_BONDS, US_BONDS,
} from '../../data/placeholders'
import { fetchFxHistory } from '../../services/api'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
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

// Per-indicator freshness thresholds — release cadences vary by type
// interest-rate: RBA meets every ~6 weeks (45d); cpi/gdp: quarterly (95d); unemployment: monthly (40d)
const FRESH_THRESHOLDS = {
  'interest-rate': { fresh: 45,  amber: 90  },
  'cpi':           { fresh: 95,  amber: 130 },
  'unemployment':  { fresh: 40,  amber: 60  },
  'gdp':           { fresh: 95,  amber: 130 },
  'default':       { fresh: 45,  amber: 90  },
}

const freshnessLevel = (iso, type = 'default') => {
  const days = daysSince(iso)
  const t = FRESH_THRESHOLDS[type] ?? FRESH_THRESHOLDS.default
  if (days <= t.fresh) return 'green'
  if (days <= t.amber) return 'amber'
  return 'red'
}

const DOT_COLOR = { green: 'bg-terminal-green', amber: 'bg-terminal-gold', red: 'bg-terminal-red' }
const DOT_LABEL = { green: 'Current', amber: 'Approaching next release', red: 'Overdue for update' }

// Infer freshness type from indicator name
function inferType(name = '') {
  const n = name.toLowerCase()
  if (n.includes('rate') || n.includes('cash') || n.includes('fed funds')) return 'interest-rate'
  if (n.includes('cpi') || n.includes('inflation') || n.includes('pce')) return 'cpi'
  if (n.includes('unemp') || n.includes('labour') || n.includes('nfp') || n.includes('employment')) return 'unemployment'
  if (n.includes('gdp')) return 'gdp'
  return 'default'
}

function FreshnessDot({ date, name }) {
  const type  = inferType(name)
  const level = freshnessLevel(date, type)
  // Only render a dot — no large banners, no labels
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLOR[level]}`} title={DOT_LABEL[level]} />
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
  'RBA Cash Rate':       '5 August 2026',
  'AU CPI YoY':          '30 July 2026 (Q2 2026)',
  'AU CPI Trimmed Mean': '30 July 2026 (Q2 2026)',
  'AU Unemployment':     '17 July 2026',
  'AU GDP QoQ':          'September 2026',
  'AU GDP Annual':       'September 2026',
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
// ─── Meeting Countdown ────────────────────────────────────────────────────────

// Next RBA meeting: 5 August 2026 at 2:30pm AEST (04:30 UTC)
const RBA_NEXT_MEETING = new Date('2026-08-05T04:30:00Z')
const FOMC_NEXT_MEETING = new Date('2026-07-30T18:00:00Z')

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

const RBA_NEXT = new Date('2026-08-05T04:30:00Z')

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
        <span className="text-2xl font-bold text-terminal-gold">3.85%</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case">p.a.</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-2xs text-terminal-text-dim">NEXT MEETING:</span>
          <span className="text-2xs font-bold text-terminal-text-bright">5 AUG 2026</span>
          <span className="text-2xs border border-terminal-gold/40 text-terminal-gold px-1.5 py-0.5">
            IN {daysLeft}D {hrsLeft}H
          </span>
          <button
            onClick={() => askAI({
              name:        'RBA Cash Rate',
              price:       '3.85% p.a.',
              sector:      'Interest Rates',
              date:        todayAEST(),
              instruction: 'What is the RBA likely to do at the next meeting on 5 August 2026 and why? Current cash rate 3.85% (cut from 4.10% in May 2026, after a first cut from 4.35% in Feb 2026). CPI Q2 2026 came in at 2.5%. Unemployment 4.1%. What is the market pricing?',
            })}
            className="text-2xs border border-terminal-gold/40 text-terminal-gold/70 hover:border-terminal-gold hover:text-terminal-gold px-2 py-0.5 transition-colors"
          >
            AI ▶
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] divide-x divide-terminal-border">
        {/* Rate history chart */}
        <div className="p-2">
          <div className="text-2xs text-terminal-text-dim mb-1">CASH RATE HISTORY (Jan 2022 – Aug 2026)</div>
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
              { label: 'HOLD 3.85%', pct: 72, color: 'var(--color-neutral)' },
              { label: 'CUT 3.60%',  pct: 28, color: 'var(--color-loss)' },
              { label: 'HIKE 4.10%', pct: 0,  color: 'var(--color-gain)' },
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
      note: 'Jul 2026 — PESSIMISTIC (below 100)',
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
          onClick={() => askAI({
            name:        'China',
            sector:      'Macro / Trade',
            date:        todayAEST(),
            instruction: 'Analyse current China economic conditions and their impact on Australian markets, commodities, and the AUD. Include iron ore demand outlook, property sector risks, and implications for ASX-listed miners and energy companies.',
          })}
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

// ─── Auto-generated economic calendar ─────────────────────────────────────────
// Static forward schedule of known/recurring events (RBA meets ~every 6 weeks,
// FOMC ~every 6 weeks, CPI/employment monthly, etc.) — generateEconomicCalendar()
// filters this down to whatever falls in the next 30 days from "now", so the
// visible list stays current without needing manual date bumps every session.

const COUNTRY_FLAG = { AU: '🇦🇺', US: '🇺🇸', GLOBAL: '🌐' }

const KNOWN_EVENTS = [
  { date: '05 AUG', time: '14:30', event: 'RBA Interest Rate Decision', region: 'AU', importance: 'high',
    forecast: 'Hold 3.85%', prev: 'Cut to 3.85%',
    description: 'Hold expected after the May cut — watch the statement for easing-cycle signals.' },
  { date: '06 AUG', time: '15:30', event: 'RBA Governor Press Conference', region: 'AU', importance: 'medium',
    forecast: '—', prev: '—',
    description: 'Follow-up briefing — markets watch tone for hints on the next move.' },
  { date: '07 AUG', time: '—', event: 'US Senate Recess Begins (CLARITY Act)', region: 'US', importance: 'medium',
    forecast: '—', prev: '—',
    description: 'Crypto market-structure bill vote deadline — binary outcome for digital assets before recess.' },
  { date: '12 AUG', time: '22:30', event: 'US CPI', region: 'US', importance: 'high',
    forecast: '2.3%', prev: '2.3%',
    description: 'Key input for the Fed\'s next move — a hot print would push back rate-cut timing.' },
  { date: '13 AUG', time: '11:30', event: 'AU Unemployment Rate', region: 'AU', importance: 'medium',
    forecast: '4.1%', prev: '4.1%',
    description: 'Labour market strength is the main swing factor for further RBA easing.' },
  { date: '14 AUG', time: '11:00', event: 'AU Consumer Confidence', region: 'AU', importance: 'low',
    forecast: '—', prev: '82.4',
    description: 'Westpac-Melbourne Institute survey — a read on household sentiment post rate cuts.' },
  { date: '19 AUG', time: '22:00', event: 'FOMC Minutes', region: 'US', importance: 'medium',
    forecast: '—', prev: '—',
    description: 'Detail behind the Jul 29-30 hold — look for the internal debate on the pace of cuts.' },
  { date: '22 AUG', time: '09:00', event: 'AU/Global PMI Flash Estimates', region: 'GLOBAL', importance: 'medium',
    forecast: '—', prev: '—',
    description: 'Earliest read on August activity across manufacturing and services.' },
  { date: '26 AUG', time: '—', event: 'Jackson Hole Economic Symposium Begins', region: 'US', importance: 'medium',
    forecast: '—', prev: '—',
    description: 'Annual Fed policy retreat — sets the tone into September\'s FOMC decision.' },
  { date: '27 AUG', time: '00:00', event: 'Fed Chair Powell Speaks at Jackson Hole', region: 'US', importance: 'high',
    forecast: '—', prev: '—',
    description: 'The single most-watched speech of the month for rate-path signalling.' },
  { date: '28 AUG', time: '11:30', event: 'AU Retail Sales', region: 'AU', importance: 'medium',
    forecast: '—', prev: '+0.3%',
    description: 'Consumer spending pulse — feeds directly into the RBA\'s growth outlook.' },
  { date: '02 SEP', time: '11:30', event: 'AU GDP Q2 2026', region: 'AU', importance: 'high',
    forecast: '—', prev: '0.4%',
    description: 'Confirms whether the economy is growing fast enough to justify a pause in cuts.' },
  { date: '16 SEP', time: '14:30', event: 'RBA Interest Rate Decision', region: 'AU', importance: 'high',
    forecast: '—', prev: 'Hold 3.85%',
    description: 'Next scheduled decision after the Aug 5 meeting.' },
  { date: '17 SEP', time: '04:00', event: 'FOMC Rate Decision', region: 'US', importance: 'high',
    forecast: '—', prev: '4.25–4.50%',
    description: 'September Fed decision — markets will have priced in Jackson Hole signals by then.' },
]

// Last 7 days' actual results — genuinely historical, so this stays a fixed
// list rather than a generated one (there's nothing to "predict" about the past).
const PREVIOUS_EVENTS = [
  { date: '30 JUL', event: 'FOMC Rate Decision (Jul 2026)',  region: 'US', importance: 'high',   actual: '4.25–4.50% (held)', forecast: '4.25–4.50%' },
  { date: '30 JUL', event: 'AU CPI Q2 2026',                 region: 'AU', importance: 'high',   actual: '2.5%',              forecast: '2.5%'       },
  { date: '30 JUL', event: 'AU Retail Sales MoM (Jun)',      region: 'AU', importance: 'medium', actual: '+0.3%',             forecast: '+0.4%'      },
  { date: '29 JUL', event: 'FOMC Meeting Begins (Jul-Aug)',  region: 'US', importance: 'high',   actual: '—',                 forecast: '—'          },
  { date: '24 JUL', event: 'US S&P Global PMI (Jul)',        region: 'US', importance: 'medium', actual: '52.1',              forecast: '52.0'       },
  { date: '23 JUL', event: 'AU CPI Monthly (Jun 2026)',      region: 'AU', importance: 'high',   actual: '2.3%',              forecast: '2.3%'       },
  { date: '17 JUL', event: 'AU Unemployment Rate (Jun)',     region: 'AU', importance: 'high',   actual: '4.1%',              forecast: '4.1%'       },
]

// Relative label ("Today" / "Tomorrow" / "Tue 5 Aug") from a 'DD MMM' date string.
function relativeDateLabel(dateStr, timeStr) {
  const d = parseEventDate(dateStr, timeStr === '—' ? '00:00' : timeStr)
  if (!d) return dateStr
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((target - today) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  const weekday = target.toLocaleDateString('en-AU', { weekday: 'short' })
  const dayMonth = target.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  return `${weekday} ${dayMonth}`
}

// Filters KNOWN_EVENTS down to the next 30 days from now, nearest first.
function generateEconomicCalendar() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in30Days = new Date(today.getTime() + 30 * 86400000)
  return KNOWN_EVENTS
    .map((e, i) => ({ ...e, id: i, dateObj: parseEventDate(e.date, e.time === '—' ? '00:00' : e.time) }))
    .filter(e => e.dateObj && e.dateObj >= today && e.dateObj <= in30Days)
    .sort((a, b) => a.dateObj - b.dateObj)
}

function EnhancedEvents() {
  const [expanded, setExpanded] = useState(null)
  const allEvents = useMemo(() => generateEconomicCalendar(), [])

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
          const countdown = getCountdown(evt.date, evt.time === '—' ? '00:00' : evt.time)
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
                <div className="flex items-center gap-1.5 flex-shrink-0 w-24">
                  <span className="text-2xs font-bold text-terminal-text-bright">{relativeDateLabel(evt.date, evt.time)}</span>
                </div>
                <span className="text-2xs text-terminal-text-dim w-12 flex-shrink-0">{evt.time === '—' ? '' : evt.time}</span>
                <span className="flex-shrink-0" title={evt.region}>{COUNTRY_FLAG[evt.region] ?? '🌐'}</span>
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
                      <div className="text-terminal-gold font-bold mb-1">WHAT TO WATCH</div>
                      <div className="text-terminal-text-dim leading-relaxed">
                        {evt.description ?? (evt.region === 'AU' && evt.event.includes('RBA')
                          ? 'Reserve Bank of Australia monetary policy decision. Sets the target cash rate which flows through to all lending and deposit rates in Australia.'
                          : evt.region === 'AU'
                          ? `Official Australian economic data release from the ABS or RBA. Key input for RBA policy decisions and market pricing.`
                          : `International economic data release. Relevant for global risk sentiment and Australian trade/currency exposure.`)}
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

// ─── Previous 7 days — actual results vs forecast ─────────────────────────────

function PreviousEventsPanel() {
  const impactDot = (imp) =>
    imp === 'high'   ? 'bg-terminal-red' :
    imp === 'medium' ? 'bg-terminal-gold' : 'bg-terminal-border'
  const regionCls = (r) =>
    r === 'AU' ? 'text-terminal-gold bg-terminal-gold/10' :
    r === 'US' ? 'text-terminal-blue-bright bg-blue-900/20' : 'text-terminal-text-dim bg-terminal-border/20'

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        <span>PREVIOUS</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">Last 7 days · Actual vs forecast</span>
      </div>
      <div>
        {PREVIOUS_EVENTS.map((evt, i) => {
          const beat = evt.actual !== '—' && evt.actual !== evt.forecast
          return (
            <div key={i} className="border-b border-terminal-border/30 flex items-center gap-2 px-3 py-1.5">
              <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${impactDot(evt.importance)}`} />
              <span className="text-2xs font-bold text-terminal-text-dim w-14 flex-shrink-0">{evt.date}</span>
              <span className="flex-shrink-0" title={evt.region}>{COUNTRY_FLAG[evt.region] ?? '🌐'}</span>
              <span className={`text-2xs px-1 font-bold flex-shrink-0 ${regionCls(evt.region)}`}>{evt.region}</span>
              <span className="text-2xs font-semibold text-terminal-text-bright flex-1 truncate">{evt.event}</span>
              <div className="flex items-center gap-3 flex-shrink-0 text-2xs text-terminal-text-dim">
                <span>FCST: <span className="text-terminal-text">{evt.forecast}</span></span>
                <span>ACTUAL: <span className={beat ? 'text-terminal-gold font-semibold' : 'text-terminal-text'}>{evt.actual}</span></span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Global Context — macro/geopolitical intelligence panel ──────────────────

// -90 = full RISK-OFF, 0 = TRANSITIONING, +90 = full RISK-ON. Set by hand from
// the qualitative regime call below — there's no single live "regime score"
// feed wired up, so this is a periodically-updated editorial judgment, not a
// computed value.
const MACRO_REGIME = {
  label: 'RISK-OFF', angle: -35, color: 'var(--color-loss)',
  reason: 'Elevated bond yields and geopolitical tension (US-Iran supply risk, China property stress) are keeping risk appetite subdued, even as the Fed and RBA both lean toward easing.',
}

function MacroRegimeGauge() {
  return (
    <div className="border border-terminal-border p-3 bg-terminal-panel/40 flex items-center gap-4 flex-wrap">
      <div style={{ position: 'relative', width: 120, height: 64, flexShrink: 0 }}>
        <svg viewBox="0 0 120 64" style={{ width: 120, height: 64, display: 'block' }}>
          <path d="M 8 60 A 52 52 0 0 1 60 8"   fill="none" stroke="var(--color-loss)" strokeWidth="9" opacity="0.55" />
          <path d="M 60 8 A 52 52 0 0 1 112 60" fill="none" stroke="var(--color-gain)" strokeWidth="9" opacity="0.55" />
        </svg>
        <div style={{
          position: 'absolute', left: 59, bottom: 4, width: 2, height: 46,
          background: '#c8a84b', transformOrigin: 'bottom center',
          transform: `rotate(${MACRO_REGIME.angle}deg)`, borderRadius: 2,
        }} />
        <div style={{ position: 'absolute', left: 55, bottom: 0, width: 8, height: 8, borderRadius: '50%', background: '#c8a84b' }} />
      </div>
      <div className="flex-1 min-w-[180px]">
        <div className="text-2xs text-terminal-text-dim tracking-widest mb-0.5">MACRO REGIME</div>
        <div className="text-lg font-bold mb-1" style={{ color: MACRO_REGIME.color }}>{MACRO_REGIME.label}</div>
        <div className="text-2xs text-terminal-text-dim leading-relaxed">{MACRO_REGIME.reason}</div>
      </div>
    </div>
  )
}

const MACRO_THEMES = [
  { title: 'FED POLICY PIVOT', icon: '🏦',
    summary: 'FOMC meeting Jul 29-30 held rates at 4.25-4.50%. Markets pricing 2 cuts by year-end.',
    impact: 'BULLISH', note: 'AUD, equities' },
  { title: 'CHINA SLOWDOWN', icon: '🇨🇳',
    summary: 'PMI below 50 for 3rd consecutive month. Property sector stress continues.',
    impact: 'BEARISH', note: 'Materials, ASX' },
  { title: 'US-IRAN TENSIONS', icon: '⚠️',
    summary: 'Oil near multi-year highs on supply risk.',
    impact: 'MIXED', note: 'Bearish risk assets, bullish energy' },
  { title: 'AI CAPEX SUPERCYCLE', icon: '🤖',
    summary: 'US tech capex at record highs.',
    impact: 'BULLISH', note: 'Tech, neutral ASX' },
  { title: 'CLARITY ACT (CRYPTO)', icon: '₿',
    summary: 'Senate vote before Aug 7 recess critical. Polymarket odds ~40%.',
    impact: 'BINARY', note: 'Crypto assets' },
  { title: 'RBA EASING CYCLE', icon: '💰',
    summary: 'RBA cut to 3.85% in May 2026. Next meeting Aug 5 — hold expected.',
    impact: 'BULLISH', note: 'AUD equities, property' },
]

const THEME_IMPACT_COLOR = {
  BULLISH: 'var(--color-gain)', BEARISH: 'var(--color-loss)',
  MIXED: '#c8a84b', BINARY: '#a855f7',
}

function MacroThemeCard({ theme }) {
  const color = THEME_IMPACT_COLOR[theme.impact] ?? 'var(--color-text-dim)'
  return (
    <div className="border border-terminal-border p-2.5 bg-terminal-panel/40">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{theme.icon}</span>
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">{theme.title}</span>
      </div>
      <div className="text-2xs text-terminal-text-dim leading-relaxed mb-1.5">{theme.summary}</div>
      <div className="text-2xs font-bold" style={{ color }}>
        {theme.impact} <span className="text-terminal-text-dim font-normal">— {theme.note}</span>
      </div>
    </div>
  )
}

// AU vs US yield curve — simple SVG line comparison, 2Y/5Y/10Y/30Y
function YieldCurveVisual() {
  const maturities = ['2Y', '5Y', '10Y', '30Y']
  const auPoints = maturities.map(m => AU_BONDS.find(b => b.maturity === m)?.yield ?? 0)
  const usPoints = maturities.map(m => US_BONDS.find(b => b.maturity === m)?.yield ?? 0)
  const allVals  = [...auPoints, ...usPoints]
  const minY = Math.min(...allVals) - 0.3
  const maxY = Math.max(...allVals) + 0.3
  const w = 320, h = 130, padL = 30, padR = 12, padT = 14, padB = 20
  const chartW = w - padL - padR, chartH = h - padT - padB
  const xAt = (i) => padL + (i / (maturities.length - 1)) * chartW
  const yAt = (v) => padT + chartH - ((v - minY) / (maxY - minY)) * chartH
  const pathFor = (vals) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')

  return (
    <div className="border border-terminal-border p-2.5 bg-terminal-panel/40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs text-terminal-gold tracking-widest font-bold">AU vs US YIELD CURVE</span>
        <div className="flex items-center gap-3 text-2xs text-terminal-text-dim">
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 2, background: '#c8a84b', display: 'inline-block' }} /> AU</span>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 2, background: '#3b82f6', display: 'inline-block' }} /> US</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
        {maturities.map((m, i) => (
          <line key={m} x1={xAt(i)} y1={padT} x2={xAt(i)} y2={padT + chartH} stroke="#0d2244" strokeWidth="1" />
        ))}
        <path d={pathFor(auPoints)} fill="none" stroke="#c8a84b" strokeWidth="1.8" />
        <path d={pathFor(usPoints)} fill="none" stroke="#3b82f6" strokeWidth="1.8" />
        {/* Label the higher curve above its point and the lower one below, per
            maturity — a fixed "AU above / US below" placement collides
            whenever one curve sits consistently above the other (as AU/US do
            here), stacking both labels in the same spot. */}
        {maturities.map((m, i) => {
          const auAbove = auPoints[i] >= usPoints[i]
          return (
            <g key={`pts-${m}`}>
              <circle cx={xAt(i)} cy={yAt(auPoints[i])} r="2.5" fill="#c8a84b" />
              <text x={xAt(i)} y={yAt(auPoints[i]) + (auAbove ? -6 : 12)} textAnchor="middle" fontSize="8" fill="#c8a84b" fontFamily="IBM Plex Mono">{auPoints[i].toFixed(2)}</text>
              <circle cx={xAt(i)} cy={yAt(usPoints[i])} r="2.5" fill="#3b82f6" />
              <text x={xAt(i)} y={yAt(usPoints[i]) + (auAbove ? 12 : -6)} textAnchor="middle" fontSize="8" fill="#3b82f6" fontFamily="IBM Plex Mono">{usPoints[i].toFixed(2)}</text>
            </g>
          )
        })}
        {maturities.map((m, i) => (
          <text key={`lbl-${m}`} x={xAt(i)} y={h - 4} textAnchor="middle" fontSize="8" fill="#6b7f99" fontFamily="IBM Plex Mono">{m}</text>
        ))}
      </svg>
    </div>
  )
}

// Currency heatmap — AUD vs 6 major pairs, rate + real 1D change from a single
// 3-day Frankfurter time-series call (multi-currency `to` param, one request).
const HEATMAP_PAIRS = [
  { label: 'AUD/USD', ccy: 'USD' },
  { label: 'AUD/JPY', ccy: 'JPY' },
  { label: 'AUD/EUR', ccy: 'EUR' },
  { label: 'AUD/GBP', ccy: 'GBP' },
  { label: 'AUD/CNY', ccy: 'CNY' },
  { label: 'AUD/NZD', ccy: 'NZD' },
]

function CurrencyHeatmap() {
  const { data, isError } = useQuery({
    queryKey:  ['fxHistory', 'AUD', 'heatmap6'],
    queryFn:   () => fetchFxHistory('AUD', HEATMAP_PAIRS.map(p => p.ccy).join(','), 3),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rows = useMemo(() => {
    const dates = data?.rates ? Object.keys(data.rates).sort() : []
    if (dates.length < 1) return null
    const latest = data.rates[dates[dates.length - 1]]
    const prior  = dates.length > 1 ? data.rates[dates[0]] : null
    return HEATMAP_PAIRS.map(({ label, ccy }) => {
      const rate = latest?.[ccy]
      const prevRate = prior?.[ccy]
      const pct = rate != null && prevRate != null ? ((rate - prevRate) / prevRate) * 100 : null
      const dec = ccy === 'JPY' ? 2 : 4
      return { label, rate: rate != null ? rate.toFixed(dec) : '—', pct }
    })
  }, [data])

  const display = rows ?? HEATMAP_PAIRS.map(p => ({ label: p.label, rate: '—', pct: null }))

  return (
    <div className="border border-terminal-border p-2.5 bg-terminal-panel/40">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xs text-terminal-gold tracking-widest font-bold">CURRENCY HEATMAP</span>
        {isError && <span className="text-2xs text-terminal-red">⚠ UNAVAILABLE</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {display.map((r) => (
          <div
            key={r.label}
            className="border border-terminal-border/50 p-1.5 text-center"
            style={{ background: r.pct == null ? 'transparent' : r.pct >= 0 ? 'rgba(45,138,80,0.08)' : 'rgba(168,50,50,0.08)' }}
          >
            <div className="text-2xs text-terminal-text-dim">{r.label}</div>
            <div className="text-xs font-bold text-terminal-text-bright">{r.rate}</div>
            <div className="text-2xs font-semibold" style={{ color: r.pct == null ? 'var(--color-text-dim)' : r.pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(2)}%` : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export default function MacroModule() {
  const [globalExpanded, setGlobalExpanded] = useState(false)
  const [expandedChart, setExpandedChart]   = useState(null)

  const askAI = (fields) => dispatchAskAI(fields)

  // RBA Cash Rate — hardcoded from official rba.gov.au 19 May 2026 board decision.
  // The live RBA API (api.rba.gov.au) is unreliable; for a single data point that
  // changes at most 8 times per year, hardcoding the confirmed rate is more reliable.
  const rbaRate    = 3.85
  const rbaRateStr = '3.85%'

  // AU indicator stats from ABS (updated in placeholders to latest known release)
  const latestCPI   = AU_CPI_HISTORY[AU_CPI_HISTORY.length - 1]?.value ?? 2.4
  const prevCPI     = AU_CPI_HISTORY[AU_CPI_HISTORY.length - 2]?.value ?? 2.4
  const latestUnemp = AU_UNEMP_HISTORY[AU_UNEMP_HISTORY.length - 1]?.value ?? 4.1
  const prevUnemp   = AU_UNEMP_HISTORY[AU_UNEMP_HISTORY.length - 2]?.value ?? 4.0
  const latestGDP   = AU_GDP_HISTORY[AU_GDP_HISTORY.length - 1]?.value ?? 0.6
  const prevGDP     = AU_GDP_HISTORY[AU_GDP_HISTORY.length - 2]?.value ?? 0.3

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
                <FreshnessDot date={ind.date} name={ind.name} />
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
        <div style={{ marginTop: 8 }}>
          <PreviousEventsPanel />
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
          <div className="border-t border-terminal-border p-3 space-y-3">
            <MacroRegimeGauge />

            <div>
              <div className="text-2xs text-terminal-gold tracking-widest font-bold mb-2">KEY MACRO THEMES</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {MACRO_THEMES.map((t) => <MacroThemeCard key={t.title} theme={t} />)}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <YieldCurveVisual />
              <CurrencyHeatmap />
            </div>

            <div className="px-0.5 text-2xs text-terminal-text-dim/60">
              Regime call and theme summaries are editorial, updated periodically — not a live computed feed. Yield curve: AOFM/RBA · US Treasury, as at 2 Aug 2026. Currency heatmap: Frankfurter.app (ECB reference rates).
            </div>
          </div>
        )}
      </div>

      {/* Subtle data attribution footer */}
      <div className="px-3 py-2 border-t border-terminal-border/30 mt-2">
        <span style={{ fontSize: 9, color: 'var(--color-text-dim, #8899aa)' }}>
          Data current as at 2 August 2026 · Sources: RBA, ABS, IMF, BLS, BEA, ONS, Eurostat
        </span>
      </div>

    </div>
  )
}
