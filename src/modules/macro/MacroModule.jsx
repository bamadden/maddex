import { useState, useRef, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import {
  AU_MACRO,
  AU_CPI_HISTORY, AU_UNEMP_HISTORY, AU_GDP_HISTORY,
  RBA_RATE_HISTORY, RBA_BOARD_MEMBERS, RBA_RECENT_STATEMENTS,
  AU_CONSUMER_SENTIMENT, AU_BUSINESS_CONFIDENCE, AU_TRADE_BALANCE,
  IRON_ORE_HISTORY, CHINA_WATCH, AU_BONDS, US_BONDS,
} from '../../data/placeholders'
import { fetchFxHistory } from '../../services/api'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import {
  RBA_MEETINGS_2026, FOMC_MEETINGS_2026, LAST_DECISIONS, getNextMeeting,
} from '../../services/centralBankSchedule'
import { getEconomicCalendar, upcomingEvents, getPreviousEvents } from '../../services/calendarService'
import { getMacroThemes, FALLBACK_THEMES } from '../../services/macroThemeService'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell,
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

// Next RBA meeting, computed from the published schedule — auto-advances as
// soon as today crosses each meeting date, no manual bumping required.
const nextRbaMeetingDate = getNextMeeting(RBA_MEETINGS_2026)
const nextRbaMeetingLabel = nextRbaMeetingDate
  ? nextRbaMeetingDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—'

// Next official release date per indicator — only populated where the release
// calendar is well known; indicators without a confirmed next date are left
// blank rather than guessed.
const NEXT_RELEASE = {
  'RBA Cash Rate':       nextRbaMeetingLabel,
  'AU CPI YoY':          'Late October 2026 (Q3 2026)',
  'AU CPI Trimmed Mean': 'Late October 2026 (Q3 2026)',
  'AU Unemployment':     'Mid-September 2026',
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
    className={`relative w-full h-full ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
    title={onClick ? 'Click to expand' : undefined}
  >
    {onClick && (
      <span className="absolute top-0 right-0 z-10 text-terminal-text-dim/50 hover:text-terminal-gold text-2xs leading-none px-1">
        ⤢
      </span>
    )}
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

// Serialises the modal's rendered <svg> to a PNG and triggers a download —
// recharts has no built-in export, but its output is a plain SVG so this
// works without a charting-specific export library.
function downloadChartPng(containerEl, filename) {
  const svg = containerEl?.querySelector('svg')
  if (!svg) return
  const svgStr = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  const img = new Image()
  img.onload = () => {
    const scale = 2 // 2x for a crisper export than the on-screen size
    const canvas = document.createElement('canvas')
    canvas.width = svg.clientWidth * scale
    canvas.height = svg.clientHeight * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#0B1628'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
    }, 'image/png')
  }
  img.src = url
}

function ExpandedChartModal({ chartKey, data, onClose }) {
  const overlayRef = useRef(null)
  const chartWrapRef = useRef(null)
  const cfg = CHART_CONFIGS[chartKey]

  // Drag-to-zoom: track the date labels under the pointer during a drag,
  // then slice the data array to that range on release. Double-click resets.
  const [refLeft, setRefLeft] = useState(null)
  const [refRight, setRefRight] = useState(null)
  const [zoomRange, setZoomRange] = useState(null) // [startIdx, endIdx] or null

  if (!cfg) return null

  const viewData = zoomRange ? data.slice(zoomRange[0], zoomRange[1] + 1) : data
  const latest = viewData[viewData.length - 1]
  const prev   = viewData[viewData.length - 2]
  const trend  = latest?.value > prev?.value ? 'UP' : latest?.value < prev?.value ? 'DOWN' : 'FLAT'
  const trendCls = trend === 'UP'
    ? (chartKey === 'unemp' ? 'text-terminal-red' : 'text-terminal-green')
    : trend === 'DOWN'
      ? (chartKey === 'unemp' ? 'text-terminal-green' : 'text-terminal-red')
      : 'text-terminal-text-dim'

  const handleMouseDown = (e) => { if (e?.activeLabel != null) setRefLeft(e.activeLabel) }
  const handleMouseMove = (e) => { if (refLeft != null && e?.activeLabel != null) setRefRight(e.activeLabel) }
  const handleMouseUp = () => {
    if (refLeft != null && refRight != null && refLeft !== refRight) {
      const i1 = data.findIndex(d => d.date === refLeft)
      const i2 = data.findIndex(d => d.date === refRight)
      if (i1 !== -1 && i2 !== -1) setZoomRange([Math.min(i1, i2), Math.max(i1, i2)])
    }
    setRefLeft(null)
    setRefRight(null)
  }
  const resetZoom = () => { setZoomRange(null); setRefLeft(null); setRefRight(null) }

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
          {zoomRange && (
            <button onClick={resetZoom} className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">
              RESET ZOOM
            </button>
          )}
          <button
            onClick={() => downloadChartPng(chartWrapRef.current, `${chartKey}-chart.png`)}
            className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border hover:border-terminal-gold/40 px-2 py-0.5 transition-colors"
          >
            ⤓ PNG
          </button>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text text-lg">✕</button>
        </div>

        {/* Chart — drag to zoom, double-click to reset */}
        <div className="flex-1 p-4" ref={chartWrapRef} onDoubleClick={resetZoom}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={viewData}
              margin={{ top: 12, right: 20, left: 0, bottom: 8 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ cursor: refLeft != null ? 'col-resize' : 'crosshair' }}
            >
              <CartesianGrid stroke="#0d2244" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4a6580' }} interval={1} allowDataOverflow />
              <YAxis
                tick={{ fontSize: 10, fill: '#4a6580' }}
                tickFormatter={(v) => `${v}${cfg.unit}`}
                domain={['auto', 'auto']}
                width={50}
                allowDataOverflow
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
              {refLeft != null && refRight != null && (
                <ReferenceArea x1={refLeft} x2={refRight} strokeOpacity={0.3} fill="#c8a84b" fillOpacity={0.15} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer stats */}
        <div className="border-t border-terminal-border px-4 py-2 flex items-center gap-6 text-2xs flex-shrink-0">
          <span className="text-terminal-text-dim">LATEST: <span style={{ color: cfg.color }}>{latest?.value}{cfg.unit} ({latest?.date})</span></span>
          <span className="text-terminal-text-dim">{zoomRange ? 'RANGE' : 'PERIOD'} HIGH: <span className="text-terminal-green">{Math.max(...viewData.map(d => d.value)).toFixed(1)}{cfg.unit}</span></span>
          <span className="text-terminal-text-dim">{zoomRange ? 'RANGE' : 'PERIOD'} LOW: <span className="text-terminal-red">{Math.min(...viewData.map(d => d.value)).toFixed(1)}{cfg.unit}</span></span>
          <span className="text-terminal-text-dim ml-auto">SOURCE: ABS · Drag to zoom · Double-click to reset</span>
        </div>
      </div>
    </div>
  )
}

// Highlight calendar events dated today (handles 'DD MMM' format like '14 JUN')
// ─── Meeting Countdown ────────────────────────────────────────────────────────

// Next meeting date string from a published schedule, today included.
function nextMeetingDateStr(dates) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dates.find((d) => new Date(`${d}T00:00:00`) >= today) ?? null
}

const nextRbaDateStr  = nextMeetingDateStr(RBA_MEETINGS_2026)
const nextFomcDateStr = nextMeetingDateStr(FOMC_MEETINGS_2026)

// RBA announces at 2:30pm AEST (04:30 UTC); FOMC at ~2:00pm EDT (18:00 UTC) —
// only the date itself comes from the schedule, the time-of-day is fixed.
const RBA_NEXT_MEETING  = nextRbaDateStr  ? new Date(`${nextRbaDateStr}T04:30:00Z`)  : null
const FOMC_NEXT_MEETING = nextFomcDateStr ? new Date(`${nextFomcDateStr}T18:00:00Z`) : null

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
// Calendar events now come from calendarService with ISO ('YYYY-MM-DD') dates.

function getCountdown(isoDate, timeStr) {
  if (!isoDate) return null
  const [h, min] = (timeStr && timeStr !== '—' ? timeStr : '00:00').split(':').map(Number)
  const d = new Date(`${isoDate}T00:00:00`)
  if (isNaN(d)) return null
  d.setHours(h || 0, min || 0, 0, 0)
  const diff = d - Date.now()
  if (diff <= 0) return null
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  return days > 0 ? `${days}D ${hours}H` : `${hours}H`
}

// ─── Section 7: RBA Dashboard ─────────────────────────────────────────────────

function RBADashboard({ askAI }) {
  const [showBoard, setShowBoard] = useState(false)

  const diffMs   = RBA_NEXT_MEETING ? RBA_NEXT_MEETING - Date.now() : 0
  const daysLeft = Math.max(0, Math.floor(diffMs / 86400000))
  const hrsLeft  = Math.max(0, Math.floor((diffMs % 86400000) / 3600000))
  const nextMeetingBadge = nextRbaDateStr
    ? new Date(`${nextRbaDateStr}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
    : '—'

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
          <span className="text-2xs font-bold text-terminal-text-bright">{nextMeetingBadge}</span>
          <span className="text-2xs border border-terminal-gold/40 text-terminal-gold px-1.5 py-0.5">
            IN {daysLeft}D {hrsLeft}H
          </span>
          <button
            onClick={() => askAI({
              name:        'RBA Cash Rate',
              price:       '4.35% p.a.',
              sector:      'Interest Rates',
              date:        todayAEST(),
              instruction: `What is the RBA likely to do at the next meeting on ${nextMeetingBadge} and why? Current cash rate 4.35% (hiked from 4.10% in May 2026, the third consecutive 2026 hike after Feb and Mar, in response to the global energy shock from the Iran-Middle East conflict — reversing the 2025 easing cycle). The Board held at 4.35% at the 17 Jun 2026 meeting, and held again at 4.35% at the ${LAST_DECISIONS.RBA.date} meeting (${LAST_DECISIONS.RBA.note}). What is the market pricing for a hold?`,
            })}
            className="text-2xs border border-terminal-gold/40 text-terminal-gold/70 hover:border-terminal-gold hover:text-terminal-gold px-2 py-0.5 transition-colors"
          >
            AI ▶
          </button>
        </div>
      </div>

      {/* Fixed row height so every column has something concrete to fill —
          "h-full" is meaningless without an ancestor that actually has a
          resolved height, and grid's default row-stretch only matches
          whichever column ends up tallest, not a specific target. */}
      <div className="grid grid-cols-[1fr_auto_auto] divide-x divide-terminal-border" style={{ height: 420 }}>
        {/* Rate history chart — fills 100% of the cell: fixed header, chart
            takes all remaining space via flex-1/min-h-0, fixed footer. */}
        <div className="p-2 flex flex-col h-full">
          <div className="text-2xs text-terminal-text-dim mb-1 flex-shrink-0">CASH RATE HISTORY (Jan 2022 – Aug 2026)</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={RBA_RATE_HISTORY} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <defs>
                  <linearGradient id="rbaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c8a84b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c8a84b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#0d2244" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 7 }} interval={2}
                  tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })} />
                <YAxis tick={{ fontSize: 7 }} tickFormatter={v => `${v}%`} domain={[0, 5]} width={32} />
                <Tooltip content={({ active, payload, label }) =>
                  active && payload?.length
                    ? <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                        <div className="text-terminal-text-dim">{new Date(label + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
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
          <div className="flex gap-4 mt-1 text-2xs text-terminal-text-dim flex-wrap flex-shrink-0">
            <span>Aug-25: Trough 3.60% (2025 easing cycle ends)</span>
            <span>May-26: Rehiked to 4.35% (matches 2023 peak)</span>
            <span className="text-terminal-blue-bright">— neutral ~2.5%</span>
          </div>
        </div>

        {/* Market pricing — same h-full + justify-between treatment so it
            doesn't look short next to the other two once they're filled. */}
        <div className="p-3 w-44 flex-shrink-0 flex flex-col h-full justify-between">
          <div>
            <div className="text-2xs text-terminal-gold font-bold mb-2">NEXT MEETING PRICING</div>
            <div className="space-y-2">
              {[
                { label: 'HOLD 4.35%', pct: 82, color: 'var(--color-neutral)' },
                { label: 'CUT 4.10%',  pct: 18, color: 'var(--color-loss)' },
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
            <div className="mt-1 text-2xs text-terminal-text-dim/60">Big 4: all HOLD for Sep</div>
          </div>
          <div className="pt-2 border-t border-terminal-border/40">
            <div className="text-2xs text-terminal-blue-bright font-bold mb-1">FOMC · 4.25–4.50%</div>
            <div className="flex justify-between text-2xs">
              <span style={{ color: 'var(--color-neutral)' }}>HOLD 65%</span>
              <span style={{ color: 'var(--color-loss)' }}>CUT 35%</span>
            </div>
            <div className="text-2xs text-terminal-text-dim/60 mt-1">Next: 17 Sep 2026</div>
            <div className="text-2xs text-terminal-text-dim/60">Jackson Hole (22–24 Aug): Powell dovish</div>
          </div>
        </div>

        {/* Recent statements — fills 100% of the cell: fixed header, then
            exactly 3 statements spread evenly across the remaining height. */}
        <div className="p-3 w-72 flex-shrink-0 flex flex-col h-full">
          <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
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
            <div className="flex flex-col justify-between flex-1 min-h-0">
              {RBA_RECENT_STATEMENTS.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col justify-center border-b border-terminal-border last:border-b-0 py-4 min-h-0">
                  <div className="flex items-center gap-2 mb-1 flex-shrink-0">
                    <span className="text-2xs text-terminal-text-dim">{s.date}</span>
                    <span className="text-2xs font-bold text-terminal-gold">{s.decision}</span>
                  </div>
                  <div className="text-xs text-terminal-text-dim italic leading-relaxed">{s.key}</div>
                  <div className="text-2xs text-terminal-text-dim/50 mt-1 flex-shrink-0">— RBA Board</div>
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
// Events come from calendarService — live FMP calendar when available,
// otherwise a rolling fallback list, with past events auto-dropped by
// upcomingEvents() rather than hand-pruned every session.

const COUNTRY_FLAG = { AU: '🇦🇺', US: '🇺🇸', CN: '🇨🇳', JP: '🇯🇵', GLOBAL: '🌐' }

// Relative label ("Today" / "Tomorrow" / "Tue 5 Aug") from an ISO date string.
function relativeDateLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  if (isNaN(d)) return isoDate
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

function formatShortDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  if (isNaN(d)) return isoDate
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const REMINDER_KEY = 'maddex_calendar_reminders'
const REMINDER_NOTIFIED_KEY = 'maddex_calendar_reminders_notified'

function readReminders() {
  try { return JSON.parse(localStorage.getItem(REMINDER_KEY) ?? '[]') } catch { return [] }
}
function reminderKey(evt) { return `${evt.date}|${evt.event}` }

const CALENDAR_FILTERS = ['ALL', 'AU', 'US', 'ASIA', 'HIGH IMPACT']

function EnhancedEvents() {
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [reminders, setReminders] = useState(readReminders)
  const { addNotification } = useStore()
  const { data: calResult, isLoading } = useQuery({
    queryKey:  ['econCalendar'],
    queryFn:   getEconomicCalendar,
    staleTime: 60 * 60_000,
  })
  const allEvents = useMemo(() => upcomingEvents(calResult?.events ?? [], 30), [calResult])
  const isFallback = calResult?.source === 'fallback'

  const events = useMemo(() => {
    if (filter === 'ALL') return allEvents
    if (filter === 'HIGH IMPACT') return allEvents.filter(e => e.importance === 'high')
    if (filter === 'ASIA') return allEvents.filter(e => e.region === 'CN' || e.region === 'JP')
    return allEvents.filter(e => e.region === filter)
  }, [allEvents, filter])

  // Reminders set for today fire a real notification into the app's
  // notification centre (same addNotification the rest of the app uses),
  // once per event per day — dedup key persisted separately from the
  // reminder list itself so toggling a reminder off/on doesn't re-notify.
  useEffect(() => {
    if (!allEvents.length || !reminders.length) return
    const todayIso = new Date().toLocaleDateString('en-CA')
    let notified = []
    try { notified = JSON.parse(localStorage.getItem(REMINDER_NOTIFIED_KEY) ?? '[]') } catch { /* ignore */ }
    const dueToday = allEvents.filter(e => e.date === todayIso && reminders.includes(reminderKey(e)))
    const fresh = dueToday.filter(e => !notified.includes(reminderKey(e)))
    if (!fresh.length) return
    fresh.forEach(e => addNotification('CALENDAR', `Reminder: ${e.event} is today${e.time !== '—' ? ` at ${e.time} AEST` : ''}`))
    try { localStorage.setItem(REMINDER_NOTIFIED_KEY, JSON.stringify([...notified, ...fresh.map(reminderKey)])) } catch { /* ignore */ }
  }, [allEvents, reminders, addNotification])

  const toggleReminder = (evt) => {
    setReminders((prev) => {
      const key = reminderKey(evt)
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      try { localStorage.setItem(REMINDER_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

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
        {isLoading && <span className="text-2xs text-terminal-text-dim animate-pulse">LOADING...</span>}
        {isFallback && <span className="text-2xs text-terminal-gold/70">DEMO SCHEDULE</span>}
        <div className="ml-auto flex items-center gap-3 text-2xs text-terminal-text-dim">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-terminal-red inline-block" /> HIGH</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-terminal-gold inline-block" /> MED</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-terminal-border inline-block" /> LOW</span>
        </div>
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-terminal-border/40">
        {CALENDAR_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-2xs px-2 py-0.5 rounded-full border transition-colors ${
              filter === f
                ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold'
                : 'text-terminal-text-dim border-terminal-border hover:border-terminal-gold hover:text-terminal-gold'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="overflow-auto" style={{ maxHeight: 260 }}>
        {events.map((evt, i) => {
          const countdown = getCountdown(evt.date, evt.time)
          const isOpen    = expanded === i
          return (
            <div
              key={`${evt.date}-${evt.event}-${i}`}
              className={`border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-accent/15 transition-colors ${impactCls(evt.importance)}`}
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${impactDot(evt.importance)}`} />
                <div className="flex items-center gap-1.5 flex-shrink-0 w-24">
                  <span className="text-2xs font-bold text-terminal-text-bright">{relativeDateLabel(evt.date)}</span>
                </div>
                <span className="text-2xs text-terminal-text-dim w-12 flex-shrink-0">{evt.time === '—' ? '' : evt.time}</span>
                <span className="flex-shrink-0" title={evt.region}>{COUNTRY_FLAG[evt.region] ?? '🌐'}</span>
                <span className={`text-2xs px-1 font-bold flex-shrink-0 ${regionCls(evt.region)}`}>{evt.region}</span>
                <span className="text-2xs font-semibold text-terminal-text-bright flex-1 truncate">{evt.event}</span>
                {(evt.forecast || evt.prev) && (
                  <div className="flex items-center gap-3 flex-shrink-0 text-2xs text-terminal-text-dim">
                    <span>FCST: <span className="text-terminal-text">{evt.forecast ?? '—'}</span></span>
                    <span>PREV: <span className="text-terminal-text">{evt.prev ?? '—'}</span></span>
                  </div>
                )}
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
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleReminder(evt) }}
                    className={`mt-2 text-2xs px-2 py-1 border font-bold tracking-wide transition-colors ${
                      reminders.includes(reminderKey(evt))
                        ? 'bg-terminal-gold text-terminal-bg border-terminal-gold'
                        : 'text-terminal-gold border-terminal-gold/40 hover:bg-terminal-gold hover:text-terminal-bg'
                    }`}
                  >
                    {reminders.includes(reminderKey(evt)) ? '✓ REMINDER SET' : 'SET REMINDER'}
                  </button>
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
  const events = useMemo(() => getPreviousEvents(), [])
  const regionCls = (r) =>
    r === 'AU' ? 'text-terminal-gold bg-terminal-gold/10' :
    r === 'US' ? 'text-terminal-blue-bright bg-blue-900/20' : 'text-terminal-text-dim bg-terminal-border/20'

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        <span>PREVIOUS</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">Last 7 days · Confirmed results</span>
      </div>
      <div>
        {events.map((evt, i) => (
          <div key={`${evt.date}-${i}`} className="border-b border-terminal-border/30 flex items-center gap-2 px-3 py-1.5">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-terminal-gold/50" />
            <span className="text-2xs font-bold text-terminal-text-dim w-14 flex-shrink-0">{formatShortDate(evt.date)}</span>
            <span className="flex-shrink-0" title={evt.region}>{COUNTRY_FLAG[evt.region] ?? '🌐'}</span>
            <span className={`text-2xs px-1 font-bold flex-shrink-0 ${regionCls(evt.region)}`}>{evt.region}</span>
            <span className="text-2xs font-semibold text-terminal-text-bright flex-1 truncate">{evt.event}</span>
            <span className="flex-shrink-0 text-2xs text-terminal-text-dim">
              RESULT: <span className="text-terminal-text font-semibold">{evt.result}</span>
            </span>
          </div>
        ))}
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
  label: 'RESTRICTIVE', angle: -20, color: '#c8a84b',
  reason: 'Both the RBA (4.35%) and Fed (4.50%) are holding policy rates above neutral. Growth is slowing globally, but easing inflation is opening a path toward cuts into 2027 rather than forcing one now.',
}

// Hand-set editorial judgment, same convention as MACRO_REGIME itself — no
// single live "3 indicator" feed exists, so these are periodically updated
// from the same published data (ABS/RBA/Fed releases) driving the rest of
// this module rather than a computed score. As at 22 August 2026.
const MACRO_INDICATORS = [
  { label: 'GLOBAL GROWTH', status: 'SLOWING',     arrow: '▼', color: 'var(--color-loss)', context: 'PMI readings below 50 in both China and Europe are weighing on global trade volumes.' },
  { label: 'INFLATION',     status: 'EASING',      arrow: '▼', color: 'var(--color-gain)', context: 'AU CPI at 3.8% and moderating US CPI both support an extended RBA/Fed hold into September.' },
  { label: 'POLICY',        status: 'RESTRICTIVE', arrow: '▬', color: '#c8a84b',           context: 'RBA at 4.35% and Fed at 4.50% — both above neutral, with cuts not yet confirmed for September.' },
]

// Same -90..+90 scale as MACRO_REGIME.angle — a hand-set monthly snapshot,
// not a computed time series, for the same reason noted above.
const MACRO_REGIME_HISTORY = [
  { date: 'Mar', label: 'RISK-ON',       score: 45  },
  { date: 'Apr', label: 'RISK-ON',       score: 35  },
  { date: 'May', label: 'TRANSITIONING', score: 10  },
  { date: 'Jun', label: 'TRANSITIONING', score: -5  },
  { date: 'Jul', label: 'RISK-OFF',      score: -30 },
  { date: 'Aug', label: 'RESTRICTIVE',   score: -20 },
]
const regimeColor = (score) => score > 15 ? 'var(--color-gain)' : score < -15 ? 'var(--color-loss)' : '#c8a84b'

function RegimeHistoryTimeline() {
  return (
    <div className="mt-2 pt-2 border-t border-terminal-border/40">
      <div className="text-2xs text-terminal-text-dim tracking-widest mb-1.5">REGIME HISTORY (6MO)</div>
      <div className="flex items-end gap-1" style={{ height: 36 }}>
        {MACRO_REGIME_HISTORY.map((r) => (
          <div key={r.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${r.date}: ${r.label}`}>
            <div
              className="w-full rounded-sm"
              style={{ height: Math.max(4, ((r.score + 90) / 180) * 28), background: regimeColor(r.score) }}
            />
            <span className="text-[8px] text-terminal-text-dim">{r.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MacroRegimeGauge() {
  return (
    <div className="border border-terminal-border p-3 bg-terminal-panel/40">
      <div className="flex items-center gap-4 flex-wrap">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        {MACRO_INDICATORS.map((ind) => (
          <div key={ind.label} className="border border-terminal-border/60 px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-terminal-text-dim tracking-wide">{ind.label}</span>
              <span className="text-2xs font-bold" style={{ color: ind.color }}>{ind.arrow}</span>
            </div>
            <div className="text-xs font-bold mb-0.5" style={{ color: ind.color }}>{ind.status}</div>
            <div className="text-2xs text-terminal-text-dim leading-snug">{ind.context}</div>
          </div>
        ))}
      </div>

      <RegimeHistoryTimeline />
    </div>
  )
}

// Macro themes are generated daily by MaddenAI (see macroThemeService) rather
// than hardcoded here — see MacroThemesSection below. FALLBACK_THEMES (used
// while loading and if the AI call fails) lives alongside that service.

const THEME_IMPACT_COLOR = {
  BULLISH: 'var(--color-gain)', BEARISH: 'var(--color-loss)',
  MIXED: '#c8a84b', NEUTRAL: 'var(--color-text-dim)', BINARY: '#a855f7',
}

const CATEGORY_ICON = {
  RBA: '💰', FED: '🏦', CHINA: '🇨🇳', GLOBAL: '🌐', COMMODITIES: '⛏️', GEOPOLITICAL: '⚠️',
}

function MacroThemeCard({ theme }) {
  const [expanded, setExpanded] = useState(false)
  const color = THEME_IMPACT_COLOR[theme.impact] ?? 'var(--color-text-dim)'
  const analysis = theme.analysis ?? theme.impactNote ?? theme.note

  return (
    <div className="border border-terminal-border bg-terminal-panel/40" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="p-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm">{CATEGORY_ICON[theme.category] ?? '📌'}</span>
          <span className="text-2xs font-bold text-terminal-gold tracking-widest flex-1">{theme.title}</span>
          <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full border" style={{ color, borderColor: color }}>
            {theme.impact}
          </span>
        </div>
        <div className="text-2xs text-terminal-text-dim leading-relaxed mb-1.5">{theme.summary}</div>

        {expanded && analysis && (
          <div className="text-2xs text-terminal-text-dim leading-relaxed mb-1.5 pt-1.5 border-t border-terminal-border/40">
            {analysis}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors"
          >
            {expanded ? '▲ LESS' : '▼ FULL ANALYSIS'}
          </button>
          <button
            onClick={() => dispatchAskAI({
              name: theme.title, sector: theme.category, date: todayAEST(),
              instruction: `Give a deeper analysis of this macro theme for Australian investors: "${theme.title}" — ${theme.summary} Current stance: ${theme.impact}.`,
            })}
            className="ml-auto text-2xs text-terminal-gold/70 hover:text-terminal-gold border border-terminal-gold/20 hover:border-terminal-gold/60 px-1.5 py-0.5 transition-colors"
          >
            ASK MADDENAI →
          </button>
        </div>
      </div>
    </div>
  )
}

function ThemeCardSkeleton() {
  return (
    <div className="border border-terminal-border p-2.5 bg-terminal-panel/40 animate-pulse">
      <div className="h-2.5 w-2/3 bg-terminal-border/50 mb-2" />
      <div className="h-2 w-full bg-terminal-border/30 mb-1" />
      <div className="h-2 w-5/6 bg-terminal-border/30 mb-2" />
      <div className="h-2 w-1/3 bg-terminal-border/30" />
    </div>
  )
}

// Fetches (or reuses today's cached) AI-generated macro themes. Falls back to
// a static baseline while loading and if the AI call/parse fails.
function MacroThemesSection() {
  const todayKey = new Date().toLocaleDateString('en-CA')
  const { data: themeResult, isLoading } = useQuery({
    queryKey:  ['macroThemes', todayKey],
    queryFn:   getMacroThemes,
    staleTime: 60 * 60_000,
  })
  const themes     = themeResult?.themes ?? FALLBACK_THEMES
  const isLive     = themeResult?.source === 'live'
  const isFallback = themeResult?.source === 'fallback'

  return (
    <div>
      <div className="text-2xs text-terminal-gold tracking-widest font-bold mb-2 flex items-center gap-2">
        KEY MACRO THEMES
        {isLoading    && <span className="text-terminal-text-dim font-normal normal-case animate-pulse">GENERATING...</span>}
        {isLive       && <span className="text-terminal-green font-normal normal-case">● MaddenAI · updated today</span>}
        {isFallback   && <span className="text-terminal-text-dim font-normal normal-case">Baseline themes</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <ThemeCardSkeleton key={i} />)
          : themes.map((t) => <MacroThemeCard key={t.title} theme={t} />)}
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
  const { canAccess, tier } = useSubscription()

  if (!canAccess('prime')) {
    return (
      <div className="h-full overflow-hidden relative">
        <ModuleHeader title="MACRO" subtitle="RBA Cash Rate · AU Indicators · Global Watch" />
        <UpgradePrompt feature="Macro Module" requiredTier="prime" currentTier={tier} />
      </div>
    )
  }

  const askAI = (fields) => dispatchAskAI(fields)

  // RBA Cash Rate — hardcoded from official rba.gov.au 19 May 2026 board decision.
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

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <ModuleHeader title="MACRO" subtitle="RBA Cash Rate · AU Indicators · Global Watch" />

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

            <MacroThemesSection />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <YieldCurveVisual />
              <CurrencyHeatmap />
            </div>

            <div className="px-0.5 text-2xs text-terminal-text-dim/60">
              Regime call is editorial. Macro themes are generated daily by MaddenAI (cached per day) — not a live computed feed. Yield curve: AOFM/RBA · US Treasury, as at 2 Aug 2026. Currency heatmap: Frankfurter.app (ECB reference rates).
            </div>
          </div>
        )}
      </div>

      {/* Subtle data attribution footer */}
      <div className="px-3 py-2 border-t border-terminal-border/30 mt-2">
        <span style={{ fontSize: 9, color: 'var(--color-text-dim, #8899aa)' }}>
          Data current as at 12 August 2026 · Sources: RBA, ABS, IMF, BLS, BEA, ONS, Eurostat
        </span>
      </div>

    </div>
  )
}
