import { useMemo, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { getMockFMPHistory, getMockFMPRow } from '../../services/mockData'
import { SECTOR_BY_SYMBOL } from './sectorMap'
import { computeRisk } from './portfolioRisk'
import Tooltip from '../../components/ui/Tooltip'

// ─── Performance tab ────────────────────────────────────────────────────────
//
// Four panels: a normalised benchmark comparison, a return-attribution
// waterfall, a sector donut against the index, and the risk cards.
//
// WHAT IS REAL HERE AND WHAT IS NOT — the whole tab in one paragraph, because
// it matters more than anything else on the page.
//
//   Your holdings, units, cost and current value: real, entered by you.
//   Your portfolio's shape over time: derived from each holding's own demo
//     price history, so it is exactly as real as the DEMO prices this module
//     labels everywhere else.
//   ASX 200, S&P 500 and Gold lines: SEEDED SYNTHETIC. There is no index
//     history in this build. They are stable across renders and periods rather
//     than random, but they describe nothing, and the legend marks each one.
//   Cash: genuinely computed, at the verified RBA cash rate.
//   ASX 200 sector weights: three verified from a published factsheet; the
//     rest absent rather than guessed.

const PERIODS = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }

// Trading days in a calendar window, which is what the price history is indexed
// by. Five for a week, floor 5 so the shortest period still draws a line.
const tradingDays = (calDays) => Math.max(5, Math.round((calDays * 5) / 7))

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A seeded walk from 100 to 100×(1+ret), with noise that tapers toward the end
// so the series lands exactly on its target return rather than near it.
function syntheticSeries(points, totalReturnPct, seed, wobble = 0.9) {
  const rng = mulberry32(seed)
  const end = 100 * (1 + totalReturnPct / 100)
  const out = []
  for (let i = 0; i < points; i++) {
    const t = points > 1 ? i / (points - 1) : 1
    const target = 100 + (end - 100) * t
    out.push(target + (rng() - 0.5) * wobble * (1 - t * 0.55))
  }
  out[0] = 100
  out[points - 1] = end
  return out
}

const SERIES = [
  { key: 'port', label: 'My Portfolio', colour: '#C9A84C', width: 2, real: true },
  { key: 'asx',  label: 'ASX 200',      colour: '#4A7FB5', width: 1, seed: 7331, ret: 3.1 },
  { key: 'spx',  label: 'S&P 500',      colour: '#637899', width: 1, seed: 2211, ret: 4.4 },
  { key: 'gold', label: 'Gold',         colour: '#D69E2E', width: 1, seed: 9182, ret: 2.2, wobble: 1.4 },
  { key: 'cash', label: 'Cash',         colour: '#2D8A50', width: 1, computed: true },
]

// ─── 1. Benchmark comparison ────────────────────────────────────────────────

function BenchmarkComparison({ holdings }) {
  const [period, setPeriod] = useState('3M')
  // My Portfolio is always on — it is the subject of the chart, and a chart of
  // four benchmarks with the portfolio switched off answers nobody's question.
  const [on, setOn] = useState(() => new Set(['port', 'asx', 'cash']))
  const [hoverIdx, setHoverIdx] = useState(null)

  const calDays = PERIODS[period]
  const cashRate = VERIFIED_CONSTANTS.rba.cashRate

  const model = useMemo(() => {
    const n = tradingDays(calDays)

    // The portfolio's own path: each holding's demo history × units, summed,
    // then normalised. Not a scaled version of the since-purchase P&L — that
    // is a return over an unknown holding period, and stretching it to fit a
    // 1W window would make the 1W number a fiction.
    const totals = Array.from({ length: n }, () => 0)
    let covered = 0
    for (const h of holdings) {
      const hist = getMockFMPHistory(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol, n)
      if (hist.length !== n) continue
      covered++
      hist.forEach((d, i) => { totals[i] += d.close * h.shares })
    }
    const base = totals[0] || 0
    const port = base > 0 ? totals.map((v) => (v / base) * 100) : null

    const series = {}
    if (port) series.port = port
    for (const s of SERIES) {
      if (s.key === 'port') continue
      if (s.computed) {
        // The only line here that is arithmetic rather than illustration.
        series.cash = Array.from({ length: n }, (_, i) => {
          const elapsed = (i / Math.max(1, n - 1)) * calDays
          return 100 * (1 + cashRate / 100 / 365) ** elapsed
        })
        continue
      }
      // Scale the illustrative return with the window, so a 1Y view does not
      // show the same move as a 1W one.
      const scaled = s.ret * (calDays / 90)
      series[s.key] = syntheticSeries(n, scaled, s.seed + calDays, s.wobble)
    }

    const rows = Array.from({ length: n }, (_, i) => {
      const row = { i }
      for (const k of Object.keys(series)) row[k] = series[k][i]
      return row
    })

    const returns = {}
    for (const k of Object.keys(series)) {
      const arr = series[k]
      returns[k] = arr[arr.length - 1] - 100
    }

    return { rows, returns, n, covered, hasPortfolio: !!port }
  }, [holdings, calDays, cashRate])

  const active = SERIES.filter((s) => on.has(s.key) && (s.key !== 'port' || model.hasPortfolio))
  const toggle = (key) => {
    if (key === 'port') return
    setOn((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // Plot geometry. Hand-drawn SVG rather than Recharts: five series with a
  // shared crosshair and per-series hover readout is the one thing this
  // module's chart wrapper does not do well, and the shape is simple.
  const W = 900, H = 210, padL = 38, padR = 10, padT = 10, padB = 18
  const all = active.flatMap((s) => model.rows.map((r) => r[s.key])).filter((v) => Number.isFinite(v))
  const minV = all.length ? Math.min(...all) : 98
  const maxV = all.length ? Math.max(...all) : 102
  const span = (maxV - minV) || 1
  const lo = minV - span * 0.08
  const hi = maxV + span * 0.08
  const x = (i) => padL + (i / Math.max(1, model.n - 1)) * (W - padL - padR)
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)

  const pathFor = (key) => model.rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' ')

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((rel - padL) / (W - padL - padR)) * (model.n - 1))
    setHoverIdx(idx >= 0 && idx < model.n ? idx : null)
  }

  return (
    <div className="border-b border-terminal-border">
      <div className="panel-header flex items-center gap-2">
        <span>BENCHMARK COMPARISON</span>
        <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">all series indexed to 100 at period start</span>
        <div className="ml-auto flex border border-terminal-border rounded-full overflow-hidden">
          {Object.keys(PERIODS).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-2xs px-2.5 py-0.5 font-bold normal-case transition-colors ${
                period === p ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
            >{p}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap px-3 py-1.5">
        {SERIES.map((s) => {
          const isOn = on.has(s.key)
          const locked = s.key === 'port'
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              disabled={locked}
              title={locked ? 'The subject of the chart — always shown' : `Toggle ${s.label}`}
              className="font-mono uppercase tracking-wider transition-colors"
              style={{
                fontSize: 9, padding: '2px 8px', borderRadius: 2,
                border: `1px solid ${isOn ? s.colour : 'rgba(201,168,76,0.12)'}`,
                background: isOn ? `${s.colour}26` : 'transparent',
                color: isOn ? s.colour : '#4A6080',
                cursor: locked ? 'default' : 'pointer',
              }}
            >{s.label}{locked ? ' ●' : ''}</button>
          )
        })}
      </div>

      {!model.hasPortfolio ? (
        <div className="text-2xs text-terminal-text-dim/60 text-center py-8">
          No price history for these holdings — the portfolio line cannot be drawn.
        </div>
      ) : (
        <>
          <div className="px-2">
            <svg
              width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}
              onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}
            >
              {/* The 100 line — the only gridline that means anything on a
                  normalised chart: above it you are up, below it you are down. */}
              {[lo, 100, hi].filter((v) => v >= lo && v <= hi).map((v, i) => (
                <g key={i}>
                  <line
                    x1={padL} x2={W - padR} y1={y(v)} y2={y(v)}
                    stroke={v === 100 ? 'rgba(201,168,76,0.35)' : '#0F1E35'}
                    strokeDasharray={v === 100 ? '4 3' : undefined}
                  />
                  <text x={4} y={y(v) + 3} fill="#4A6080" style={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }}>
                    {v.toFixed(0)}
                  </text>
                </g>
              ))}

              {active.map((s) => (
                <path
                  key={s.key} d={pathFor(s.key)} fill="none"
                  stroke={s.colour} strokeWidth={s.width}
                  strokeOpacity={s.key === 'port' ? 1 : 0.85}
                  strokeLinejoin="round"
                />
              ))}

              {hoverIdx != null && (
                <>
                  <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={H - padB} stroke="#C9A84C" strokeOpacity={0.45} />
                  {active.map((s) => (
                    <circle key={s.key} cx={x(hoverIdx)} cy={y(model.rows[hoverIdx][s.key])} r={2.5} fill={s.colour} />
                  ))}
                </>
              )}
            </svg>
          </div>

          {/* Crosshair readout. Sits under the chart rather than floating over
              it, so five values never cover the lines they describe. */}
          <div className="flex items-center gap-4 flex-wrap px-3 py-1" style={{ minHeight: 22 }}>
            {hoverIdx != null ? (
              <>
                <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9 }}>
                  day {Math.round((hoverIdx / Math.max(1, model.n - 1)) * calDays)} of {calDays}
                </span>
                {active.map((s) => (
                  <span key={s.key} className="font-mono flex items-center gap-1.5" style={{ fontSize: 9 }}>
                    <span className="rounded-full" style={{ width: 5, height: 5, background: s.colour }} />
                    <span className="text-terminal-text-dim">{s.label}</span>
                    <span className="text-terminal-text-bright tabular-nums">{model.rows[hoverIdx][s.key].toFixed(1)}</span>
                  </span>
                ))}
              </>
            ) : (
              <span className="font-mono text-terminal-text-dim/40" style={{ fontSize: 9 }}>Hover the chart for a crosshair reading</span>
            )}
          </div>

          {/* Legend: dot, name, period return — and what each line actually is. */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-2">
            {SERIES.filter((s) => s.key !== 'port' || model.hasPortfolio).map((s) => {
              const ret = model.returns[s.key]
              const isOn = on.has(s.key)
              return (
                <span key={s.key} className="flex items-center gap-1.5" style={{ opacity: isOn ? 1 : 0.35 }}>
                  <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: s.colour }} />
                  <span className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>{s.label}</span>
                  <span
                    className="font-mono font-bold tabular-nums"
                    style={{ fontSize: 10, color: ret >= 0 ? '#2D8A50' : '#CC4444' }}
                  >{ret >= 0 ? '+' : ''}{ret.toFixed(1)}%</span>
                  <Tooltip content={
                    s.real ? 'Built from your actual units against each holding’s own price history. Those prices are DEMO data in this build.'
                      : s.computed ? `Arithmetic: 100 × (1 + ${cashRate}%/365)^days, at the verified RBA cash rate.`
                      : 'ILLUSTRATIVE. No index history is wired into this build, so this line is a seeded synthetic walk. It is stable across renders, and it describes nothing.'
                  }>
                    <span
                      className="font-mono tracking-wider"
                      style={{ fontSize: 7, color: s.real ? '#2D8A50' : s.computed ? '#637899' : '#C9A84C' }}
                    >{s.real ? 'YOUR DATA' : s.computed ? 'COMPUTED' : 'ILLUSTRATIVE'}</span>
                  </Tooltip>
                </span>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── 2. Return attribution waterfall ────────────────────────────────────────

function AttributionWaterfall({ holdings, mktTotal, fmtCur }) {
  const [hover, setHover] = useState(null)

  const model = useMemo(() => {
    const rows = holdings
      .filter((h) => h.mktVal != null && h.pnl != null)
      .map((h) => ({ label: h.symbol.replace(/\.AX$/, ''), delta: h.pnl, kind: 'stock' }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    // Dividends: one year's income at each holding's own yield. Not "dividends
    // received" — this module has no transaction history behind it, and the
    // note under the chart says so.
    //
    // h.divYield is null for every holding: api.js's quote shape declares the
    // field and never populates it. The demo rows DO carry a yield per symbol
    // (BHP 5.4%, CBA 3.1%), and the dividend panel in the Analytics tab
    // already reads it that way — so this falls back to the same source rather
    // than silently dropping the bar, which is what it did on first render.
    const yieldOf = (h) =>
      h.divYield ?? getMockFMPRow(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol)?.dividendYield ?? 0
    const divs = holdings.reduce((s, h) => s + (h.mktVal ?? 0) * (yieldOf(h) / 100), 0)
    if (divs > 0) rows.push({ label: 'Dividends', delta: divs, kind: 'dividend' })

    const totalDelta = rows.reduce((s, r) => s + r.delta, 0)
    const opening = (mktTotal ?? 0) - rows.filter((r) => r.kind === 'stock').reduce((s, r) => s + r.delta, 0)
    return { rows, totalDelta, opening, closing: opening + totalDelta }
  }, [holdings, mktTotal])

  if (!holdings.length) {
    return (
      <div className="text-2xs text-terminal-text-dim/60 text-center py-8 border border-terminal-border">
        Add holdings to see return attribution.
      </div>
    )
  }

  const W = 720, H = 200, padT = 24, padB = 30, gap = 8
  const steps = [
    { label: 'Cost', kind: 'anchor', running: model.opening },
    ...model.rows,
    { label: 'Value', kind: 'anchor', running: model.closing },
  ]

  // Running totals, so each bar starts where the last one finished.
  const laid = []
  for (let i = 0, running = model.opening; i < steps.length; i++) {
    const s = steps[i]
    if (s.kind === 'anchor') { laid.push({ ...s, from: 0, to: s.running }); continue }
    const from = running
    running += s.delta
    laid.push({ ...s, from, to: running })
  }

  const values = laid.flatMap((s) => [s.from, s.to])
  const maxV = Math.max(...values) * 1.06
  const minV = Math.min(0, ...values)
  const y = (v) => padT + (1 - (v - minV) / ((maxV - minV) || 1)) * (H - padT - padB)
  const barW = (W - gap * (laid.length - 1)) / laid.length

  const colourFor = (s) =>
    s.kind === 'anchor' ? '#8BA3C4'
      : s.kind === 'dividend' ? '#C9A84C'
        : s.delta >= 0 ? '#2D8A50' : '#A83232'

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#0F1E35" />
        {laid.map((s, i) => {
          const bx = i * (barW + gap)
          const top = Math.min(y(s.from), y(s.to))
          const h = Math.max(2, Math.abs(y(s.to) - y(s.from)))
          const pctOfReturn = model.totalDelta !== 0 && s.kind !== 'anchor'
            ? (s.delta / model.totalDelta) * 100
            : null
          return (
            <g
              key={s.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: s.kind === 'anchor' ? 'default' : 'pointer' }}
            >
              {/* Connector to the next bar, so the eye follows the running
                  total instead of reading each bar as its own column. */}
              {i < laid.length - 1 && (
                <line
                  x1={bx} x2={bx + barW + gap} y1={y(s.to)} y2={y(s.to)}
                  stroke="rgba(139,163,196,0.3)" strokeDasharray="2 2"
                />
              )}
              <rect
                x={bx} y={top} width={barW} height={h}
                fill={colourFor(s)} fillOpacity={hover === i ? 1 : 0.8}
              />
              <text
                x={bx + barW / 2} y={top - 5} textAnchor="middle"
                fill={colourFor(s)}
                style={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}
              >
                {s.kind === 'anchor'
                  ? fmtCur(s.running)
                  : `${s.delta >= 0 ? '+' : '−'}${fmtCur(Math.abs(s.delta))}`}
              </text>
              <text
                x={bx + barW / 2} y={H - padB + 14} textAnchor="middle"
                fill="#8BA3C4"
                style={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace' }}
              >{s.label}</text>
              {hover === i && pctOfReturn != null && (
                <text
                  x={bx + barW / 2} y={H - padB + 26} textAnchor="middle"
                  fill="#C9A84C"
                  style={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }}
                >{pctOfReturn >= 0 ? '+' : ''}{pctOfReturn.toFixed(1)}% of return</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="text-terminal-text-dim/50 px-1 leading-snug" style={{ fontSize: 8 }}>
        Cost is what you paid; each bar is that holding&apos;s unrealised gain or loss
        (units × [price − average cost]). Dividends are one year&apos;s income at each
        holding&apos;s current yield, not payments received — this build has no
        transaction history behind it. Hover a bar for its share of the total.
      </div>
    </div>
  )
}

// ─── 3. Sector donut ────────────────────────────────────────────────────────

const SECTOR_COLOUR = {
  Materials: '#B05030',
  Financials: '#2D5A8A',
  Health: '#2D8A50',
  IT: '#7B2D8A',
  'Cons Disc': '#C9A84C',
  Staples: '#A08A3C',
  Energy: '#8A6A2D',
  Comms: '#5A7D9A',
  Industrials: '#6A6A8A',
  'Real Est': '#8A5A7D',
  Utilities: '#4A7D7D',
  Other: '#4A6080',
}

const SECTOR_LABEL = {
  Health: 'Healthcare', IT: 'Technology', 'Cons Disc': 'Consumer Disc.',
  Staples: 'Consumer Staples', 'Real Est': 'Real Estate', Comms: 'Communications',
}

function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  const [x1, y1] = p(rOuter, startAngle)
  const [x2, y2] = p(rOuter, endAngle)
  const [x3, y3] = p(rInner, endAngle)
  const [x4, y4] = p(rInner, startAngle)
  return `M${x1},${y1} A${rOuter},${rOuter} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${rInner},${rInner} 0 ${large} 0 ${x4},${y4} Z`
}

function SectorDonut({ holdings, mktTotal }) {
  const [hover, setHover] = useState(null)
  const au = VERIFIED_CONSTANTS.au

  const sectors = useMemo(() => {
    const indexWeights = au.asx200SectorWeights ?? {}
    const by = {}
    for (const h of holdings) {
      if (h.mktVal == null) continue
      const key = SECTOR_BY_SYMBOL[h.symbol] ?? 'Other'
      by[key] = (by[key] ?? 0) + h.mktVal
    }
    return Object.entries(by)
      .map(([sector, value]) => ({
        sector,
        label: SECTOR_LABEL[sector] ?? sector,
        pct: mktTotal ? (value / mktTotal) * 100 : 0,
        indexPct: indexWeights[sector] ?? null,
        colour: SECTOR_COLOUR[sector] ?? SECTOR_COLOUR.Other,
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [holdings, mktTotal, au])

  if (!sectors.length) {
    return <div className="text-2xs text-terminal-text-dim/60 text-center py-8">Add holdings to see sector allocation.</div>
  }

  const SIZE = 200, R = 92, RI = 58, cx = SIZE / 2, cy = SIZE / 2
  // Cumulative sweep built with a plain loop rather than an accumulator
  // captured by a map callback — the same result, without a closure
  // reassigning a variable that outlives the render.
  const arcs = []
  for (let i = 0, angle = -Math.PI / 2; i < sectors.length; i++) {
    const sweep = (sectors[i].pct / 100) * Math.PI * 2
    arcs.push({ ...sectors[i], start: angle, end: angle + sweep })
    angle += sweep
  }
  const largest = sectors[0]

  return (
    <div className="flex items-start gap-4 flex-wrap">
      <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
        {arcs.map((a) => (
          <path
            key={a.sector}
            d={arcPath(cx, cy, hover === a.sector ? R + 4 : R, RI, a.start, a.end)}
            fill={a.colour}
            fillOpacity={hover == null || hover === a.sector ? 0.9 : 0.4}
            onMouseEnter={() => setHover(a.sector)}
            onMouseLeave={() => setHover(null)}
            style={{ transition: 'fill-opacity 120ms' }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#4A6080"
          style={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.16em' }}>PORTFOLIO</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="#E6EDF6"
          style={{ fontSize: 11, fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
          {(hover ? sectors.find((s) => s.sector === hover) : largest)?.label}
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill="#C9A84C"
          style={{ fontSize: 10, fontFamily: '"IBM Plex Mono", monospace' }}>
          {((hover ? sectors.find((s) => s.sector === hover) : largest)?.pct ?? 0).toFixed(1)}%
        </text>
      </svg>

      <div className="flex-1 min-w-0" style={{ minWidth: 220 }}>
        {sectors.map((s) => {
          const diff = s.indexPct == null ? null : s.pct - s.indexPct
          const tone = diff == null ? '#4A6080' : diff > 2 ? '#C9A84C' : diff < -2 ? '#637899' : '#2D8A50'
          const verdict = diff == null ? null : diff > 2 ? 'OVERWEIGHT' : diff < -2 ? 'UNDERWEIGHT' : 'IN LINE'
          return (
            <div
              key={s.sector}
              className="flex items-baseline gap-2 py-1"
              style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}
              onMouseEnter={() => setHover(s.sector)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: s.colour }} />
              <span className="font-mono text-terminal-text-bright" style={{ fontSize: 10 }}>{s.label}</span>
              <span className="font-mono font-bold text-terminal-gold tabular-nums" style={{ fontSize: 10 }}>{s.pct.toFixed(1)}%</span>
              {s.indexPct != null ? (
                <>
                  <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9 }}>
                    (ASX {s.indexPct.toFixed(1)}%)
                  </span>
                  <span className="font-mono font-bold ml-auto flex-shrink-0" style={{ fontSize: 8, letterSpacing: '0.1em', color: tone }}>
                    {verdict}
                  </span>
                </>
              ) : (
                <Tooltip content="No published ASX 200 weight is recorded for this sector in this build, so no overweight/underweight call is made. Inventing the index half of the comparison would make the verdict meaningless.">
                  <span className="font-mono text-terminal-text-dim/40 ml-auto flex-shrink-0" style={{ fontSize: 8, letterSpacing: '0.1em' }}>
                    ASX WEIGHT NOT VERIFIED
                  </span>
                </Tooltip>
              )}
            </div>
          )
        })}
        <div className="text-terminal-text-dim/50 mt-1.5 leading-snug" style={{ fontSize: 8 }}>
          Index weights: {au.asx200SectorWeightsSource} · as at{' '}
          {new Date(`${au.asx200SectorWeightsAsOf}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}.
          Only the sectors that factsheet stated are compared.
        </div>
      </div>
    </div>
  )
}

// ─── 4. Risk metrics ────────────────────────────────────────────────────────

function Gauge({ min, max, value, colour }) {
  const t = Math.max(0, Math.min(1, (value - min) / ((max - min) || 1)))
  return (
    <div className="mt-2">
      <div className="relative" style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div
          className="absolute rounded-full"
          style={{ left: `calc(${t * 100}% - 3px)`, top: -1, width: 6, height: 6, background: colour }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="font-mono text-terminal-text-dim/40" style={{ fontSize: 8 }}>{min}</span>
        <span className="font-mono text-terminal-text-dim/40" style={{ fontSize: 8 }}>{max}</span>
      </div>
    </div>
  )
}

function RiskCard({ label, value, colour, min, max, gaugeValue, description, tip }) {
  return (
    <div className="border border-terminal-border p-3 flex flex-col">
      <div className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 8 }}>{label}</div>
      <div className="font-mono font-bold tabular-nums text-center flex-1 flex items-center justify-center py-2"
        style={{ fontSize: 24, color: colour }}>{value}</div>
      <Gauge min={min} max={max} value={gaugeValue} colour={colour} />
      <Tooltip content={tip}>
        <div className="font-mono text-terminal-text-dim mt-1.5 leading-snug" style={{ fontSize: 9 }}>{description}</div>
      </Tooltip>
    </div>
  )
}

const AMBER = '#D69E2E', GREEN = '#2D8A50', RED = '#CC4444'

function RiskMetrics({ holdings, mktTotal }) {
  const risk = useMemo(() => computeRisk(holdings, mktTotal), [holdings, mktTotal])

  if (!risk) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {['BETA', 'VOLATILITY', 'SHARPE RATIO', 'MAX DRAWDOWN'].map((l) => (
          <div key={l} className="border border-terminal-border p-3">
            <div className="font-mono font-bold tracking-widest text-terminal-gold/40" style={{ fontSize: 8 }}>{l}</div>
            <div className="font-mono text-terminal-text-dim/30 text-center py-4" style={{ fontSize: 24 }}>—</div>
            <div className="font-mono text-terminal-text-dim/40" style={{ fontSize: 9 }}>Add holdings to compute.</div>
          </div>
        ))}
      </div>
    )
  }

  const beta = risk.portfolioBeta
  const vol = risk.portfolioVol * 100
  const asxVol = risk.asxVol * 100
  const dd = risk.maxDD * 100

  return (
    <div className="grid grid-cols-2 gap-3">
      <RiskCard
        label="BETA"
        value={beta.toFixed(2)}
        colour={beta > 1.15 ? RED : beta > 1.02 ? AMBER : GREEN}
        min={0} max={2} gaugeValue={beta}
        description={`Moves ${beta.toFixed(2)}× with the market`}
        tip={`Sector betas weighted by position size — not a regression against an index, because this build has no index return series to regress against. Driven mainly by ${risk.topDrivers.map((d) => d.symbol).join(', ')}.`}
      />
      <RiskCard
        label="VOLATILITY (ANNUALISED)"
        value={`${vol.toFixed(1)}%`}
        colour={vol > asxVol * 1.2 ? RED : vol > asxVol ? AMBER : GREEN}
        min={0} max={30} gaugeValue={vol}
        description={`vs ASX 200: ${asxVol.toFixed(1)}%`}
        tip="Annualised standard deviation of daily returns over 90 days, weighted by position. Computed from each holding's own price history — which is DEMO data in this build."
      />
      <RiskCard
        label="SHARPE RATIO"
        value={risk.sharpe.toFixed(2)}
        colour={risk.sharpe >= 1 ? GREEN : risk.sharpe >= 0 ? AMBER : RED}
        min={-1} max={2} gaugeValue={risk.sharpe}
        description={risk.sharpe >= 1 ? 'Above a market average of ~1.0' : 'Below a market average of ~1.0'}
        tip="Rough and illustrative: since-purchase return over annualised volatility. Not the textbook ratio — the numerator is a return over an unknown holding period rather than an annualised excess return over the risk-free rate."
      />
      <RiskCard
        label="MAX DRAWDOWN"
        value={`${dd.toFixed(1)}%`}
        colour={Math.abs(dd) > 20 ? RED : Math.abs(dd) > 8 ? AMBER : GREEN}
        min={-30} max={0} gaugeValue={dd}
        description={`${risk.peakDate.toLocaleDateString('en-AU', { month: 'short' })}–${risk.troughDate.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })}`}
        tip="Largest peak-to-trough fall in book value over the last 90 days, from each holding's own price history."
      />
    </div>
  )
}

// ─── The tab ────────────────────────────────────────────────────────────────

export default function PerformanceTab({ holdings, mktTotal, fmtCur }) {
  const priced = useMemo(() => holdings.filter((h) => h.mktVal != null), [holdings])

  if (!holdings.length) {
    return (
      <div className="text-2xs text-terminal-text-dim/60 text-center py-12">
        Add holdings to see performance analytics.
      </div>
    )
  }

  return (
    <div>
      <BenchmarkComparison holdings={priced} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-3 border-b border-terminal-border">
        <div>
          <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">WHAT DROVE YOUR RETURN</div>
          <AttributionWaterfall holdings={priced} mktTotal={mktTotal} fmtCur={fmtCur} />
        </div>
        <div>
          <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">SECTOR ALLOCATION</div>
          <SectorDonut holdings={priced} mktTotal={mktTotal} />
        </div>
      </div>

      <div className="p-3">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">RISK METRICS</div>
        <RiskMetrics holdings={priced} mktTotal={mktTotal} />
      </div>
    </div>
  )
}
