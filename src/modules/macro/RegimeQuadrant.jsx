import { useMemo, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import Tooltip from '../../components/ui/Tooltip'

// ─── Growth / inflation quadrant ────────────────────────────────────────────
//
// Where the Australian economy sits on the two axes that decide policy, and
// the path it took to get there.
//
// The gauge this replaces was a needle on a semicircle running "restrictive"
// to "accommodative" — one dimension, describing policy rather than the
// economy policy is responding to. A stagflationary economy and a cooling one
// can carry the same cash rate, and the needle rendered them identically. Two
// axes separate them, which is the whole reason the four names exist.
//
// EVERY POINT PLOTTED IS A PUBLISHED FIGURE. The current dot comes from
// verifiedConstants; the trail comes from auQuarterlyPath, which is three ABS
// releases. Nothing here is interpolated, and a quarter without both readings
// simply does not get a dot.

const SIZE = 280
const MID = SIZE / 2

// Axis anchors. Trend growth is the usual dividing line for "at or below
// capacity"; the target band's midpoint is the RBA's own centre of gravity.
// Both are stated so the reader can see what "centre" means rather than
// taking the crosshair on faith.
const TREND_GDP = 2.25
const TARGET_MID = 2.5

// Half-width of each axis in its own units — how far from centre the edge of
// the box is. Chosen so a normal cycle uses most of the plane without a
// single unusual quarter pinning to the wall.
const GDP_SPAN = 2.75      // centre ±2.75pp → 2.25% growth sits mid, -0.5% at the far left
const CPI_SPAN = 2.5       // centre ±2.5pp  → 2.5% CPI sits mid, 5.0% at the top

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Growth runs left (weak) to right (strong); inflation runs bottom (low) to
// top (high), so SVG's downward y is inverted.
const xFor = (gdp) => clamp(MID + ((gdp - TREND_GDP) / GDP_SPAN) * MID, 12, SIZE - 12)
const yFor = (cpi) => clamp(MID - ((cpi - TARGET_MID) / CPI_SPAN) * MID, 12, SIZE - 12)

const QUADRANTS = [
  { key: 'stag',  label: 'STAGFLATION', x: 20,  y: 22,       fill: 'rgba(168,50,50,0.06)',  rect: [0, 0, MID, MID] },
  { key: 'over',  label: 'OVERHEATING', x: 168, y: 22,       fill: 'rgba(201,168,76,0.06)', rect: [MID, 0, MID, MID] },
  { key: 'rec',   label: 'RECESSION',   x: 20,  y: SIZE - 12, fill: 'rgba(168,50,50,0.08)',  rect: [0, MID, MID, MID] },
  { key: 'gold',  label: 'GOLDILOCKS',  x: 160, y: SIZE - 12, fill: 'rgba(45,138,80,0.06)',  rect: [MID, MID, MID, MID] },
]

// Which quadrant a reading falls in, and what that combination is called.
function quadrantFor(gdp, cpi) {
  const weak = gdp < TREND_GDP
  const hot = cpi > TARGET_MID
  if (weak && hot) return { key: 'stag', label: 'STAGFLATION', tone: '#CC4444', sub: 'Below-trend growth with inflation above the band midpoint' }
  if (!weak && hot) return { key: 'over', label: 'OVERHEATING', tone: '#C9A84C', sub: 'Growth at or above trend with inflation running hot' }
  if (weak && !hot) return { key: 'rec', label: 'CONTRACTIONARY', tone: '#CC4444', sub: 'Below-trend growth with inflation contained' }
  return { key: 'gold', label: 'GOLDILOCKS', tone: '#2D8A50', sub: 'Growth at or above trend with inflation contained' }
}

export default function RegimeQuadrant() {
  const [hover, setHover] = useState(null)
  const au = VERIFIED_CONSTANTS.au
  const rba = VERIFIED_CONSTANTS.rba

  const model = useMemo(() => {
    const path = (au.auQuarterlyPath ?? []).filter(
      (p) => Number.isFinite(p.cpi) && Number.isFinite(p.gdpAnnual),
    )
    // The current reading is the terminal's own headline pair, which is what
    // every other panel in this module quotes.
    const current = { period: au.gdpPeriod ?? 'Current', cpi: au.cpi, gdpAnnual: au.gdpAnnual }
    // The trail is the quarters BEFORE the current one — if the last recorded
    // quarter is the same reading the headline carries, it is not drawn twice.
    const trail = path.filter((p) => !(p.cpi === current.cpi && p.gdpAnnual === current.gdpAnnual))
    return { trail: trail.slice(-3), current, quadrant: quadrantFor(current.gdpAnnual, current.cpi) }
  }, [au])

  const { trail, current, quadrant } = model
  const cx = xFor(current.gdpAnnual)
  const cy = yFor(current.cpi)

  // The trail fades backwards in time: the most recent prior quarter is the
  // most opaque, so the direction of travel reads without a legend.
  const trailOpacity = (i, n) => [0.2, 0.4, 0.6].slice(-n)[i] ?? 0.3

  return (
    <div className="flex items-start gap-5 flex-wrap">
      <div style={{ flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} style={{ display: 'block', overflow: 'visible' }}>
          {QUADRANTS.map((q) => (
            <rect
              key={q.key}
              x={q.rect[0]} y={q.rect[1]} width={q.rect[2]} height={q.rect[3]}
              fill={q.fill}
              stroke={quadrant.key === q.key ? 'rgba(201,168,76,0.35)' : 'none'}
            />
          ))}

          <line x1={0} x2={SIZE} y1={MID} y2={MID} stroke="rgba(201,168,76,0.08)" />
          <line x1={MID} x2={MID} y1={0} y2={SIZE} stroke="rgba(201,168,76,0.08)" />

          {QUADRANTS.map((q) => (
            <text
              key={q.key} x={q.x} y={q.y}
              fill={quadrant.key === q.key ? '#C9A84C' : '#4A6080'}
              style={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.1em', fontWeight: quadrant.key === q.key ? 700 : 400 }}
            >{q.label}</text>
          ))}

          {/* Axes, labelled with what "centre" actually means. A crosshair with
              no stated origin is a chart that cannot be checked. */}
          <text x={MID} y={SIZE + 14} textAnchor="middle" fill="#4A6080"
            style={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.1em' }}>
            GROWTH →
          </text>
          <text x={-MID} y={-8} textAnchor="middle" transform="rotate(-90)" fill="#4A6080"
            style={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.1em' }}>
            ↑ INFLATION
          </text>

          {/* The trail. Connected, so the direction of travel is a line rather
              than three dots the reader has to order themselves. */}
          {trail.length > 0 && (
            <polyline
              points={[...trail, current].map((p) => `${xFor(p.gdpAnnual)},${yFor(p.cpi)}`).join(' ')}
              fill="none" stroke="#C9A84C" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 3"
            />
          )}
          {trail.map((p, i) => (
            <g key={p.period} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}>
              <circle
                cx={xFor(p.gdpAnnual)} cy={yFor(p.cpi)} r={5}
                fill="#C9A84C" opacity={trailOpacity(i, trail.length)}
              />
              <circle cx={xFor(p.gdpAnnual)} cy={yFor(p.cpi)} r={9} fill="transparent" />
            </g>
          ))}

          <circle cx={cx} cy={cy} r={8} fill="#C9A84C" />
          <circle cx={cx} cy={cy} r={13} fill="none" stroke="#C9A84C" strokeOpacity={0.35} />
        </svg>
      </div>

      <div className="min-w-0 flex-1" style={{ minWidth: 210 }}>
        <div className="font-mono font-bold tracking-widest" style={{ fontSize: 12, color: quadrant.tone }}>
          {quadrant.label}
        </div>
        <div className="font-mono text-terminal-text-dim leading-snug mt-1" style={{ fontSize: 10 }}>
          {quadrant.sub}
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9, width: 60 }}>GROWTH</span>
            <span className="font-mono font-bold text-terminal-text-bright tabular-nums" style={{ fontSize: 11 }}>
              {current.gdpAnnual}%
            </span>
            <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9 }}>
              vs ~{TREND_GDP}% trend · {au.gdpPeriod}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9, width: 60 }}>INFLATION</span>
            <span className="font-mono font-bold text-terminal-text-bright tabular-nums" style={{ fontSize: 11 }}>
              {au.cpi}%
            </span>
            <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9 }}>
              vs {au.rbaTargetBand} band · {au.cpiPeriod}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9, width: 60 }}>POLICY</span>
            <span className="font-mono font-bold text-terminal-gold tabular-nums" style={{ fontSize: 11 }}>
              {rba.cashRate}%
            </span>
            <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9 }}>cash rate</span>
          </div>
        </div>

        {trail.length > 0 && (
          <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="font-mono text-terminal-text-dim/50 mb-1" style={{ fontSize: 8, letterSpacing: '0.14em' }}>
              PATH · LAST {trail.length} QUARTERS
            </div>
            {[...trail].reverse().map((p) => (
              <div key={p.period} className="flex items-baseline gap-2 font-mono" style={{ fontSize: 9 }}>
                <span className="text-terminal-text-dim/60" style={{ width: 46 }}>{p.period}</span>
                <span className="text-terminal-text-dim">growth <b className="text-terminal-text">{p.gdpAnnual}%</b></span>
                <span className="text-terminal-text-dim">CPI <b className="text-terminal-text">{p.cpi}%</b></span>
              </div>
            ))}
            <Tooltip content={`Every point plotted is a published ABS reading — three quarters of annual CPI and annual GDP. Nothing is interpolated, and a quarter missing either figure gets no dot.\n\nSource: ${au.auQuarterlyPathSource ?? 'abs.gov.au'}`}>
              <div className="font-mono text-terminal-text-dim/40 mt-1.5 leading-snug" style={{ fontSize: 8 }}>
                Axes centred on ~{TREND_GDP}% trend growth and the {au.rbaTargetBand} band midpoint.
                Path from {au.auQuarterlyPathSource ?? 'abs.gov.au'}.
              </div>
            </Tooltip>
          </div>
        )}

        {hover && (
          <div className="font-mono text-terminal-gold mt-2" style={{ fontSize: 9 }}>
            {hover.period}: growth {hover.gdpAnnual}% · CPI {hover.cpi}%
          </div>
        )}
      </div>
    </div>
  )
}
