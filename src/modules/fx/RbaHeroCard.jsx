import { useEffect, useState } from 'react'
import LiveCheckBadge from '../../components/ui/LiveCheckBadge'
import VERIFIED_CONSTANTS, { provenance, pendingRbaDecision } from '../../data/verifiedConstants'
import { sydneyOffset, sydneyTzAbbr } from '../../utils/dateUtils'

const PAST_TENSE = { HIKE: 'HIKED', CUT: 'CUT', HOLD: 'HELD' }

// The RBA card.
//
// This is an Australian terminal. The cash rate is the single figure in the
// Rates module that prices the reader's mortgage, their term deposit and the
// discount rate under half their portfolio — and it was a 16px number in a
// one-line strip, sharing a row with a period selector.
//
// ON THE PROBABILITY BLOCK THIS DOES NOT HAVE:
//
// The obvious thing to put under the countdown is "MARKET CONSENSUS — HOLD 82%
// / CUT 14% / HIKE 4%" with three filled bars. This terminal used to show
// exactly that, in this module and in Macro, and both were literals somebody
// typed. There is no rate-futures feed connected here, so there is no
// market-implied probability to show, and a bar chart is the most persuasive
// way possible to present a number nobody measured.
//
// So the space says what is actually true. It reads as less impressive and it
// is worth considerably more: everything else on this card is checkable.
//
// In the week before a decision RbaDecisionPreview (below this card) shows one
// futures reading a person took, with its source and date — a measured number,
// labelled as not live, which is a different thing from the typed-in bars.
// That same reading is surfaced here, as HIKE / HOLD bars with the source and
// date under them, and only while it is the reading for the meeting being
// counted down to. Bars are acceptable for it where they were not for the
// typed-in literals: it is one measured, dated, attributed figure, and HOLD
// is its complement (the futures price no cut), not a second measurement.
//
// When the market prices a hike above 60%, a banner above the card says so.
// The threshold is this terminal's, not a market convention — it is the
// point where a hike is clearly the expected outcome rather than a coin toss.

const URGENT_PCT = 60
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']

// HIKE / HOLD as a row: label, bar, percentage, the rate it leads to.
function ScenarioBar({ label, pct, rate, tone, strong }) {
  return (
    <div className="flex items-center gap-2 font-mono" style={{ fontSize: 10 }}>
      <span className="font-bold w-9" style={{ color: tone, letterSpacing: '0.12em' }}>{label}</span>
      <div className="flex-1 h-2 rounded-sm overflow-hidden" style={{ background: 'rgba(74,96,128,0.18)', minWidth: 120 }}>
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: tone, opacity: strong ? 0.9 : 0.45 }} />
      </div>
      <span className="tabular-nums font-bold w-9 text-right" style={{ color: strong ? tone : '#8BA3C4' }}>{pct}%</span>
      <span className="tabular-nums text-terminal-text-dim w-14">→ {rate.toFixed(2)}%</span>
    </div>
  )
}

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!target) return null
  const ms = new Date(`${target}T14:30:00${sydneyOffset(target)}`).getTime() - now
  if (ms <= 0) return null
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
  }
}

const fmtDate = (iso) => (iso
  ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
  : '—')

function Seg({ value, unit }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 30 }}>
      <span className="font-mono tabular-nums leading-none text-terminal-text-bright" style={{ fontSize: 17 }}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="font-mono leading-none mt-1" style={{ fontSize: 7, color: '#4A6080', letterSpacing: '0.14em' }}>
        {unit}
      </span>
    </div>
  )
}

export default function RbaHeroCard({ onAskAI }) {
  const rba = VERIFIED_CONSTANTS.rba
  const cd = useCountdown(rba?.nextMeeting)
  const gov = VERIFIED_CONSTANTS.centralBankOfficials?.rba
  const verb = (rba?.lastDecisionVerb ?? '').toUpperCase()
  const moved = verb === 'HIKE' || verb === 'CUT'
  const nd = pendingRbaDecision()
  const pricing = cd && nd?.date === rba?.nextMeeting && nd.marketHikePct != null ? nd : null
  const urgent = pricing && pricing.marketHikePct > URGENT_PCT
  const au = VERIFIED_CONSTANTS.au
  // Hikes so far in the year of the coming meeting, from the decision list.
  const year = rba?.nextMeeting?.slice(0, 4)
  const hikesThisYear = (rba?.decisions ?? []).filter((d) => d.decision === 'HIKE' && d.date.startsWith(year)).length
  const nextOrdinal = ORDINAL[hikesThisYear]

  return (
    <>
    {urgent && (
      <div
        className="font-mono text-terminal-gold flex items-center gap-2 flex-wrap flex-shrink-0"
        style={{ background: 'rgba(201,168,76,0.12)', borderLeft: '3px solid #C9A84C', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
        role="status"
      >
        <span className="font-bold">⚠ HIGH HIKE PROBABILITY</span>
        <span>— RBA MEETING IN {cd.d} {cd.d === 1 ? 'DAY' : 'DAYS'} · ~{pricing.marketHikePct}% MARKET PRICING</span>
        <span className="text-terminal-text-dim/70 ml-auto" style={{ fontSize: 9 }}>{pricing.marketSource}, {fmtDate(pricing.marketAsOf)}</span>
      </div>
    )}
    <div
      data-tip="rba-hero"
      className="flex-shrink-0"
      style={{
        borderLeft: `3px solid ${['HIKE', 'CUT'].includes((VERIFIED_CONSTANTS.rba?.lastDecisionVerb ?? '').toUpperCase()) ? '#E8A33D' : '#C9A84C'}`,
        background: 'linear-gradient(90deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.015) 55%, transparent 100%)',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
      }}
    >
      <div className="flex items-start gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="font-mono text-terminal-text-dim flex items-center gap-2" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
            RBA CASH RATE <LiveCheckBadge field="cashRate" />
          </div>
          <div
            className="font-mono font-bold text-terminal-gold leading-none tabular-nums"
            style={{ fontSize: 48, marginTop: 4 }}
          >
            {rba?.cashRate?.toFixed(2)}%
          </div>
          {/* A move is news and a hold is not, so the verb carries the
              weight: amber when the Board acted, quiet gold when it held. */}
          <div className="flex items-center gap-2 mt-2 font-mono" style={{ fontSize: 10, letterSpacing: '0.06em' }}>
            <span
              className="font-bold"
              style={{
                color: moved ? '#E8A33D' : '#C9A84C',
                border: `1px solid ${moved ? 'rgba(232,163,61,0.45)' : 'rgba(201,168,76,0.3)'}`,
                background: moved ? 'rgba(232,163,61,0.10)' : 'transparent',
                padding: '2px 6px', borderRadius: 2, letterSpacing: '0.14em',
              }}
            >
              {verb === 'HIKE' ? '▲ ' : verb === 'CUT' ? '▼ ' : ''}{PAST_TENSE[verb] ?? 'SET'}
              {moved && rba?.lastChange ? ` ${rba.lastChange}` : ''}
            </span>
            <span className="text-terminal-text-dim">{fmtDate(rba?.lastDecision)}</span>
          </div>
          {moved && rba?.previousRate != null && (
            <div className="font-mono text-terminal-text-dim/70 mt-1" style={{ fontSize: 9 }}>
              from {rba.previousRate.toFixed(2)}%
            </div>
          )}
          {/* The Governor's name, from the verified office-holder block rather
              than from anyone's memory. It belongs on this card because a rate
              decision is a person's decision — "the Board" is the formal
              answer and "who is running it" is the useful one. */}
          {urgent && nextOrdinal && (
            <div className="font-mono font-bold mt-1.5" style={{ fontSize: 10, color: '#E8A33D', letterSpacing: '0.14em' }}>
              {nextOrdinal.toUpperCase()} HIKE OF {year} PRICED IN
            </div>
          )}
          {gov?.name && (
            <div className="font-mono text-terminal-text-dim/70 italic mt-1" style={{ fontSize: 10 }}>
              {gov.name}, Governor
            </div>
          )}
        </div>

        <div className="w-px self-stretch" style={{ background: 'rgba(201,168,76,0.12)' }} />

        <div className="min-w-0">
          <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
            NEXT DECISION · {fmtDate(rba?.nextMeeting)}
          </div>
          {cd ? (
            <div className="flex items-center gap-2.5 mt-2">
              <Seg value={cd.d} unit="DAYS" />
              <span className="rounded-full flex-shrink-0" style={{ width: 3, height: 3, background: 'rgba(201,168,76,0.45)' }} />
              <Seg value={cd.h} unit="HRS" />
              <span className="rounded-full flex-shrink-0" style={{ width: 3, height: 3, background: 'rgba(201,168,76,0.45)' }} />
              <Seg value={cd.m} unit="MIN" />
              <span className="rounded-full flex-shrink-0" style={{ width: 3, height: 3, background: 'rgba(201,168,76,0.45)' }} />
              <Seg value={cd.s} unit="SEC" />
            </div>
          ) : (
            // Past 2:30pm but rba is not yet updated: say so rather than
            // count down to nothing or guess the outcome.
            <div className="font-mono text-terminal-text-dim mt-2 leading-snug" style={{ fontSize: 11 }}>
              Announced 2:30pm<br />
              <span style={{ fontSize: 9 }}>Result shown here once verified</span>
            </div>
          )}
          <div className="font-mono text-terminal-gold/80 mt-2" style={{ fontSize: 9, letterSpacing: '0.12em' }}>
            {fmtDate(rba?.nextMeeting).replace(/ \d{4}$/, '')} · 2:30PM {sydneyTzAbbr(rba?.nextMeeting)}
          </div>
          <div className="font-mono text-terminal-text-dim/50 mt-1" style={{ fontSize: 8 }}>
            {provenance('rba')}
          </div>
        </div>

        {pricing && (
          <>
            <div className="w-px self-stretch" style={{ background: 'rgba(201,168,76,0.12)' }} />
            <div className="min-w-0 flex-1" style={{ maxWidth: 380 }}>
              <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
                MARKET PRICING · {fmtDate(rba?.nextMeeting).replace(/ \d{4}$/, '')}
              </div>
              <div className="flex flex-col gap-1.5 mt-2.5">
                <ScenarioBar label="HIKE" pct={pricing.marketHikePct} rate={pricing.hikeRate} tone="#E8A33D" strong={pricing.marketHikePct >= 50} />
                <ScenarioBar label="HOLD" pct={100 - pricing.marketHikePct} rate={pricing.currentRate} tone="#8BA3C4" strong={pricing.marketHikePct < 50} />
              </div>
              <div className="font-mono text-terminal-text-dim/60 mt-1.5" style={{ fontSize: 8 }}>
                {pricing.marketSource} · {fmtDate(pricing.marketAsOf)} · a dated reading, not live
              </div>
              {au?.cpiQuarterTrimmedQoQ != null && au.cpiLastRelease <= pricing.marketAsOf && (
                <div className="font-mono text-terminal-gold mt-2.5 leading-snug" style={{ fontSize: 9, letterSpacing: '0.08em' }}>
                  <div>
                    {au.cpiQuarterPeriod.replace(/^(\w+) (\d{4}) quarter$/, (_, m, y) => `${m.toUpperCase()} QTR ${y}`)} TRIMMED MEAN {au.cpiQuarterTrimmedQoQ.toFixed(1)}% Q/Q
                    {au.cpiQuarterRbaForecast != null && au.cpiQuarterTrimmedQoQ > au.cpiQuarterRbaForecast ? ` · ABOVE RBA FORECAST (${au.cpiQuarterRbaForecast.toFixed(1)}%)` : ''}
                  </div>
                  <div className="text-terminal-gold/60">KEY DRIVER OF HIKE PRICING</div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="ml-auto flex flex-col items-end gap-2">
          <button
            onClick={onAskAI}
            className="text-2xs font-bold border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-3 py-1.5 transition-colors tracking-widest"
          >ASK MADDENAI ▶</button>
          {/* See the note at the top of this file. */}
          <div
            className="font-mono text-right text-terminal-text-dim/45 leading-snug"
            style={{ fontSize: 8, maxWidth: 210 }}
          >
            No live rate-futures feed. Before a decision, the pricing
            shown is one dated, sourced reading, detailed in the preview below.
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
