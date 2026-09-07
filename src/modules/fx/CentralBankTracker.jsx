import { useMemo, useState } from 'react'
import { RBA_RATE_HISTORY } from '../../data/placeholders'
import { LAST_DECISIONS } from '../../services/centralBankSchedule'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

// ─── Central bank tracker ──────────────────────────────────────────────────
//
// Three panels: a timeline of RBA decisions derived from the published rate
// path, a board of every tracked bank's last decision, and the AU–US 10-year
// spread.
//
// WHY THE TIMELINE IS RBA-ONLY
//
// The brief asked for three parallel timelines — RBA, Fed, ECB. RBA_RATE_HISTORY
// is a real published series, so twelve months of RBA decisions can be derived
// from it exactly: the direction of each move is the sign of the change from
// the previous rate, and a repeated rate is a hold. There is no equivalent
// series for the Fed or the ECB in this codebase — LAST_DECISIONS holds one
// row each. Drawing three lanes would have meant inventing eleven months of
// decisions for two of them, which is precisely the class of thing this
// terminal spent several commits removing. The other banks get a board of
// what is actually known instead.

const DECISION_STYLE = {
  HIKE: { colour: '#2D8A50', bg: 'rgba(45,138,80,0.15)', border: 'rgba(45,138,80,0.5)', mark: '▲' },
  CUT:  { colour: '#CC4444', bg: 'rgba(200,100,100,0.15)', border: 'rgba(200,100,100,0.5)', mark: '▼' },
  HOLD: { colour: '#C9A84C', bg: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.4)', mark: '—' },
}

// Turns the rate path into decisions. A change in rate is a hike or a cut of
// that size; the series only records meetings where the rate is set, so a
// repeat of the previous level is a hold.
function deriveDecisions(history, now, months = 18) {
  const cutoff = now - months * 30.44 * 86400000
  const out = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const cur = history[i]
    if (new Date(`${cur.date}T00:00:00`).getTime() < cutoff) continue
    const diff = +(cur.rate - prev.rate).toFixed(2)
    out.push({
      date: cur.date,
      rate: cur.rate,
      from: prev.rate,
      bp: Math.round(diff * 100),
      decision: diff > 0 ? 'HIKE' : diff < 0 ? 'CUT' : 'HOLD',
    })
  }
  return out
}

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

function RbaTimeline() {
  const [now] = useState(() => Date.now())
  const decisions = useMemo(() => deriveDecisions(RBA_RATE_HISTORY, now), [now])
  if (!decisions.length) return null

  return (
    <div className="border border-terminal-border">
      <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-terminal-border">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">RBA DECISIONS · LAST 18 MONTHS</span>
        <span className="text-[9px] text-terminal-text-dim">Derived from the published cash-rate path</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-stretch gap-0 px-3 py-3 min-w-max">
          {decisions.map((d, i) => {
            const st = DECISION_STYLE[d.decision]
            return (
              <div key={d.date} className="flex flex-col items-center" style={{ minWidth: 74 }}>
                <div
                  className="text-2xs font-bold px-1.5 py-0.5 mb-1 whitespace-nowrap"
                  style={{ color: st.colour, background: st.bg, border: `1px solid ${st.border}` }}
                  title={`${d.from.toFixed(2)}% → ${d.rate.toFixed(2)}%`}
                >
                  {st.mark} {d.decision === 'HOLD' ? 'HOLD' : `${Math.abs(d.bp)}bp`}
                </div>
                {/* The rail. Drawn per-item rather than as one background line
                    so it scrolls with the markers instead of behind them. */}
                <div className="w-full flex items-center" style={{ height: 9 }}>
                  <div className="flex-1" style={{ height: 1, background: i === 0 ? 'transparent' : 'rgba(201,168,76,0.25)' }} />
                  <div style={{ width: 5, height: 5, borderRadius: 3, background: st.colour, flexShrink: 0 }} />
                  <div className="flex-1" style={{ height: 1, background: i === decisions.length - 1 ? 'transparent' : 'rgba(201,168,76,0.25)' }} />
                </div>
                <div className="text-[9px] text-terminal-text-dim mt-1 whitespace-nowrap">{shortDate(d.date)}</div>
                <div className="text-[9px] text-terminal-text-bright tabular-nums">{d.rate.toFixed(2)}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DecisionsBoard() {
  const rows = useMemo(
    () => Object.entries(LAST_DECISIONS)
      .map(([bank, d]) => ({ bank, ...d, ts: new Date(`${d.date}T00:00:00`).getTime() }))
      .sort((a, b) => b.ts - a.ts),
    [],
  )

  return (
    <div className="border border-terminal-border">
      <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-terminal-border">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">LAST DECISION BY BANK</span>
        <VerifiedBadge dataKey="rba" alwaysShow />
      </div>
      <table className="w-full text-2xs">
        <thead>
          <tr className="text-terminal-text-dim border-b border-terminal-border/50">
            <th className="text-left font-normal px-3 py-1">BANK</th>
            <th className="text-left font-normal py-1">DECISION</th>
            <th className="text-right font-normal py-1">RATE</th>
            <th className="text-right font-normal px-3 py-1">DATE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = DECISION_STYLE[r.decision] ?? DECISION_STYLE.HOLD
            return (
              <tr key={r.bank} className="border-b border-terminal-border/25" title={r.note ?? ''}>
                <td className="px-3 py-1 font-bold text-terminal-text-bright">{r.bank}</td>
                <td className="py-1">
                  <span className="font-bold px-1.5 py-0.5" style={{ color: st.colour, background: st.bg, border: `1px solid ${st.border}` }}>
                    {st.mark} {r.decision}
                  </span>
                  {r.note && <span className="text-terminal-text-dim/70 ml-2">{r.note}</span>}
                </td>
                <td className="py-1 text-right tabular-nums text-terminal-text">{r.rate}</td>
                <td className="px-3 py-1 text-right text-terminal-text-dim tabular-nums">{shortDate(r.date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// The AU–US 10-year spread, and which way it has moved since the previous
// curve. Both numbers come from the YIELD_CURVES block this module already
// renders, so the spread agrees with the chart above it by construction.
//
// Compared against the previous published curve, NOT against a five-year
// average: no five-year series exists here, and inventing one to say "wide
// versus history" would be a fabricated figure dressed as context.
function SpreadMonitor({ curves }) {
  const read = (key, tenor) => curves?.[key]?.points?.find((p) => p.m === tenor)?.y ?? null
  const readPrev = (key, tenor) => curves?.[key]?.prev?.[tenor] ?? null

  const au = read('AU', '10Y')
  const us = read('US', '10Y')
  if (au == null || us == null) return null

  const spread = (au - us) * 100
  const prevAu = readPrev('AU', '10Y')
  const prevUs = readPrev('US', '10Y')
  const prevSpread = prevAu != null && prevUs != null ? (prevAu - prevUs) * 100 : null
  const move = prevSpread != null ? spread - prevSpread : null

  const auDiscount = spread < 0

  return (
    <div className="border border-terminal-border">
      <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-terminal-border">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">AU / US 10-YEAR SPREAD</span>
        <span className="text-[9px] text-terminal-text-dim">{curves.AU.src}</span>
      </div>
      <div className="px-3 py-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-2xs text-terminal-text-dim">AU 10Y <b className="text-terminal-text-bright tabular-nums ml-1">{au.toFixed(2)}%</b></span>
        <span className="text-2xs text-terminal-text-dim">US 10Y <b className="text-terminal-text-bright tabular-nums ml-1">{us.toFixed(2)}%</b></span>
        <span className="text-2xs text-terminal-text-dim">
          SPREAD
          <b className="tabular-nums ml-1" style={{ color: auDiscount ? '#CC4444' : '#2D8A50' }}>
            {spread >= 0 ? '+' : ''}{spread.toFixed(0)} bp
          </b>
        </span>
        {move != null && (
          <span className="text-2xs text-terminal-text-dim">
            vs previous curve
            <b className="tabular-nums ml-1 text-terminal-text">{move >= 0 ? '+' : ''}{move.toFixed(0)} bp</b>
          </span>
        )}
      </div>
      <div className="px-3 pb-2 text-[10px] text-terminal-text-dim leading-relaxed">
        {auDiscount
          ? 'Australian 10-year yields sit below US equivalents. A negative carry on AUD assets tends to weigh on the currency, all else equal — capital is paid more to sit in US duration.'
          : 'Australian 10-year yields sit above US equivalents, which is historically supportive for the AUD: the yield pick-up rewards holding Australian duration.'}
      </div>
    </div>
  )
}

// The 90-day meeting calendar that used to sit here has moved to
// UpcomingDecisions, at the bottom of the module. It gained flags, an EXPECTED
// column and a wider table, and two 90-day calendars in one module would be
// one calendar too many — this was the strict subset, so this is the one that
// went.

export default function CentralBankTracker({ curves }) {
  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <RbaTimeline />
      {/* items-start, not the default stretch: the spread panel is four lines
          tall and the decisions board is ten rows, and a stretched panel is a
          bordered box that is mostly empty. Its own height is the honest one. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        <DecisionsBoard />
        <SpreadMonitor curves={curves} />
      </div>
    </div>
  )
}
