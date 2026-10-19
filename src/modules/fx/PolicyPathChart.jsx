import { useMemo, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { RBA_RATE_HISTORY, FED_RATE_HISTORY } from '../../data/placeholders'
import { RBA_PATH, FED_PATH, rateOn } from '../../data/policySpread'
import SafeChart from '../../components/ui/SafeChart'

// ─── RBA and Fed policy paths, with this year's decisions marked ───────────
//
// Both banks' rates as step lines on a real time axis (the old chart spaced
// decisions evenly, so eighteen quiet months took the same width as one busy
// one). Every decision of the current year — holds included — is a dot;
// clicking one opens what the bank decided, the vote and a one-line reason,
// all from the decision lists in verifiedConstants. Dots are drawn only where
// that record exists, so an older move never shows a blank vote.

const DAY = 86400000
const toMs = (d) => Date.parse(`${d}T00:00:00Z`)
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

const RBA_COLOUR = '#C9A84C'
const FED_COLOUR = '#5B9BD5'
const DECISION_COLOUR = { HIKE: '#2D8A50', CUT: '#CC4444', HOLD: '#C9A84C' }

const MARK_YEAR = VERIFIED_CONSTANTS.rba.lastDecision.slice(0, 4)

// Effective date (the series' key) → the decision record, for MARK_YEAR.
function marksFor(history, decisions) {
  const byAnnounced = new Map(decisions.filter((d) => d.date.startsWith(MARK_YEAR)).map((d) => [d.date, d]))
  const out = new Map()
  for (const r of history) { const d = byAnnounced.get(r.announced); if (d) out.set(r.date, d) }
  return out
}
const RBA_MARKS = marksFor(RBA_RATE_HISTORY, VERIFIED_CONSTANTS.rba.decisions)
const FED_MARKS = marksFor(FED_RATE_HISTORY, VERIFIED_CONSTANTS.fed.decisions)

// Half-yearly ticks for short windows, yearly otherwise, on month boundaries.
function axisTicks(from, to) {
  const step = (to - from) / (365 * DAY) <= 2.5 ? 6 : 12
  const d = new Date(from); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0)
  while (d.getUTCMonth() % step !== 0 || d.getTime() < from) d.setUTCMonth(d.getUTCMonth() + 1)
  const ticks = []
  for (; d.getTime() <= to; d.setUTCMonth(d.getUTCMonth() + step)) ticks.push(d.getTime())
  return ticks
}

function HoverTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1.5 text-2xs">
      <div className="text-terminal-text-dim">{fmtDay(p.date)}</div>
      {p.rba != null && <div style={{ color: RBA_COLOUR }} className="font-semibold">RBA {p.rba.toFixed(2)}%</div>}
      {p.fed != null && <div style={{ color: FED_COLOUR }}>Fed {p.fed.toFixed(2)}% <span className="text-terminal-text-dim">(upper)</span></div>}
      {(p.rbaMark || p.fedMark) && <div className="text-terminal-text-dim/70 mt-0.5">Click the dot for the decision</div>}
    </div>
  )
}

function DecisionCard({ picked, onClose }) {
  const { bank, d, cx, w } = picked
  const isRba = bank === 'RBA'
  const bp = d.change === 0 ? 'unchanged' : `${d.change > 0 ? '+' : '−'}${Math.abs(d.change)}bp`
  const left = cx > w * 0.55
  return (
    <div
      className="absolute z-10 bg-terminal-panel border shadow-lg px-2.5 py-2 text-2xs"
      style={{
        // Pinned to the top of the plot: the chart is short, and a card hung
        // from the dot runs off the bottom of the section.
        left: cx, top: 2, width: 230,
        transform: left ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
        borderColor: isRba ? RBA_COLOUR : FED_COLOUR,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-bold tracking-wider" style={{ color: isRba ? RBA_COLOUR : FED_COLOUR }}>{isRba ? 'RBA' : 'FOMC'} · {fmtDay(d.date)}</span>
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text-bright ml-2" aria-label="Close">✕</button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="text-terminal-text-dim">Decision</span>
        <span className="font-bold" style={{ color: DECISION_COLOUR[d.decision] }}>{d.decision} {bp}</span>
        <span className="text-terminal-text-dim">{d.change === 0 ? 'Rate' : 'New rate'}</span>
        <span className="text-terminal-text-bright tabular-nums">{isRba ? `${d.rate.toFixed(2)}%` : `${d.rateRange}%`}</span>
        <span className="text-terminal-text-dim">Vote</span>
        <span className="text-terminal-text-bright">{d.vote}</span>
      </div>
      <div className="mt-1 pt-1 border-t border-terminal-border/50 text-terminal-text leading-snug">{d.reason}</div>
      <div className="mt-1 text-[9px] text-terminal-text-dim/60">Source: {isRba ? 'RBA decision statement' : 'FOMC statement'}</div>
    </div>
  )
}

export default function PolicyPathChart({ years }) {
  const [now] = useState(() => Date.now())
  const [picked, setPicked] = useState(null)

  const { data, from, to, ticks } = useMemo(() => {
    const to = now
    // Neither path reaches back before Nov 2020, so a longer window starts
    // there rather than drawing empty years.
    const first = toMs(RBA_PATH[0].date)
    const from = years === Infinity ? first : Math.max(first, to - years * 365.25 * DAY)
    const days = new Set([iso(from), iso(to)])
    for (const r of [...RBA_PATH, ...FED_PATH]) { const t = toMs(r.date); if (t > from && t < to) days.add(r.date) }
    const data = [...days].sort().map((date) => ({
      date, t: toMs(date),
      rba: rateOn(RBA_PATH, date), fed: rateOn(FED_PATH, date),
      rbaMark: RBA_MARKS.get(date) ?? null, fedMark: FED_MARKS.get(date) ?? null,
    }))
    return { data, from, to, ticks: axisTicks(from, to) }
  }, [years, now])

  const dot = (bank) => function DecisionDot(props) {
    const { cx, cy, payload } = props
    const d = bank === 'RBA' ? payload.rbaMark : payload.fedMark
    const k = `${bank}-${payload.date}`
    if (!d || cx == null || cy == null) return <g key={k} />
    const c = DECISION_COLOUR[d.decision]
    const on = picked?.bank === bank && picked.d === d
    return (
      <g key={k} style={{ cursor: 'pointer' }} role="button" aria-label={`${bank} ${d.decision} ${fmtDay(d.date)}`}
        onClick={(e) => {
          e.stopPropagation()
          const w = e.currentTarget.ownerSVGElement?.getBoundingClientRect().width ?? 0
          setPicked(on ? null : { bank, d, cx, cy, w })
        }}>
        <circle cx={cx} cy={cy} r={6.5} fill="transparent" />
        <circle cx={cx} cy={cy} r={on ? 5.5 : 4} fill={bank === 'RBA' ? c : '#0B1628'} stroke={bank === 'RBA' ? '#0B1628' : c} strokeWidth={bank === 'RBA' ? 1 : 2} />
      </g>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 text-[9px] text-terminal-text-dim mb-0.5 px-1">
        <span className="flex items-center gap-1"><span style={{ width: 12, height: 2, background: RBA_COLOUR }} />RBA cash rate</span>
        <span className="flex items-center gap-1"><span style={{ width: 12, borderTop: `2px dashed ${FED_COLOUR}` }} />Fed (upper bound)</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: DECISION_COLOUR.HIKE }} />
          <span className="w-2 h-2 rounded-full border-2" style={{ borderColor: DECISION_COLOUR.HOLD }} />
          {MARK_YEAR} decisions — click
        </span>
      </div>
      <div className="relative flex-1 min-h-0 [&_*:focus]:outline-none" onClick={() => setPicked(null)}>
        <SafeChart width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="rbaPathGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={RBA_COLOUR} stopOpacity={0.25} />
                <stop offset="95%" stopColor={RBA_COLOUR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#0F1E35" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={[from, to]} ticks={ticks} tick={{ fontSize: 8 }}
              tickFormatter={(t) => new Date(t).toLocaleDateString('en-AU', { month: 'short', year: '2-digit', timeZone: 'UTC' })} />
            <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `${v}%`} domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} width={30} />
            {!picked && <Tooltip content={<HoverTooltip />} />}
            {/* Fed first so the RBA layer, and its dots, sit on top where the two
                banks met within a day of each other (17/18 Mar). */}
            <Line type="stepAfter" dataKey="fed" stroke={FED_COLOUR} strokeWidth={1.25} strokeDasharray="4 3"
              dot={dot('FED')} activeDot={false} isAnimationActive={false} />
            <Area type="stepAfter" dataKey="rba" stroke={RBA_COLOUR} strokeWidth={1.5} fill="url(#rbaPathGrad)"
              dot={dot('RBA')} activeDot={false} isAnimationActive={false} />
          </ComposedChart>
        </SafeChart>
        {picked && <DecisionCard picked={picked} onClose={() => setPicked(null)} />}
      </div>
    </div>
  )
}
