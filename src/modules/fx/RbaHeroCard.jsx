import { useEffect, useState } from 'react'
import LiveCheckBadge from '../../components/ui/LiveCheckBadge'
import VERIFIED_CONSTANTS, { provenance, pendingRbaDecision } from '../../data/verifiedConstants'
import { sydneyTzAbbr, sydneyISO } from '../../utils/dateUtils'
import { useStore } from '../../store/useStore'
import { openRipple } from '../../utils/openRelationships'
import { announcement, ANNOUNCE_AT, daysBetweenDays } from '../../services/centralBankSchedule'

const PAST_TENSE = { HIKE: 'HIKED', CUT: 'CUT', HOLD: 'HELD' }
const READING_MAX_DAYS = 30
// The RBA's stated announcement time (cb-announce-times in the registry):
// '14:30' → '2:30PM'.
const RBA_TIME = (() => { const [h, m] = ANNOUNCE_AT.rba[0].split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}` })()

// The RBA card.
//
// This is an Australian terminal. The cash rate is the single figure in the
// Rates module that prices the reader's mortgage, their term deposit and the
// discount rate under half their portfolio — and it was a 16px number in a
// one-line strip, sharing a row with a period selector.
//
// NO TYPED CONSENSUS BARS:
//
// This terminal once showed "MARKET CONSENSUS — HOLD 82% / CUT 14% / HIKE 4%"
// as three filled bars, in this module and in Macro, and both were literals
// somebody typed. There is no rate-futures feed connected here, so nothing on
// this card is a live market measure.
//
// In the week before a decision RbaDecisionPreview (below this card) shows one
// futures reading a person took, with its source and date — a measured number,
// labelled as not live, which is a different thing from the typed-in bars.
// That same reading is surfaced here as one bar, with its source and date,
// only while it is the reading for the meeting being counted down to and only
// when it has both. (16 Nov 2026: the derived HOLD bar, the emphasis on the
// larger bar, the amber on a move and an unsourced "key driver" line were
// removed; the colours are the same whatever the reading or decision.)
//

// The reading as a row, in the layout the HIKE / HOLD rows had: label, bar,
// percentage, the rate it prices. One neutral colour whatever the value.
const NEUTRAL = '#8BA3C4'
function PricingBar({ label, pct, rate }) {
  return (
    <div className="flex items-center gap-2 font-mono" style={{ fontSize: 10 }}>
      <span className="font-bold w-9" style={{ color: NEUTRAL, letterSpacing: '0.12em' }}>{label}</span>
      <div className="flex-1 h-2 rounded-sm overflow-hidden" style={{ background: 'rgba(74,96,128,0.18)', minWidth: 120 }}>
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: NEUTRAL, opacity: 0.6 }} />
      </div>
      <span className="tabular-nums w-9 text-right" style={{ color: NEUTRAL }}>~{pct}%</span>
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
  const ms = announcement('rba', target).at - now
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
  const { setActiveModule } = useStore()
  const rba = VERIFIED_CONSTANTS.rba
  const cd = useCountdown(rba?.nextMeeting)
  const gov = VERIFIED_CONSTANTS.centralBankOfficials?.rba
  const verb = (rba?.lastDecisionVerb ?? '').toUpperCase()
  const moved = verb === 'HIKE' || verb === 'CUT'
  const nd = pendingRbaDecision()
  const pricing = cd && nd?.date === rba?.nextMeeting && nd.marketHikePct != null ? nd : null
  // Shown only with a source and a date no more than READING_MAX_DAYS old
  // (the registry's limit for vc:rbaNextDecision, a manually checked reading).
  const sourcedPricing = pricing && pricing.marketSource && pricing.marketAsOf && pricing.hikeRate != null
    && daysBetweenDays(pricing.marketAsOf, sydneyISO()) <= READING_MAX_DAYS ? pricing : null

  return (
    <>
    {/* The market reading as a reading: value, source and date, shown
        whenever a sourced, dated reading exists (16 Nov 2026, Ben's decision:
        "⚠ HIGH HIKE PROBABILITY" and the above-threshold trigger read as a
        forecast). No reading with a source and date, no strip. */}
    {sourcedPricing && (
      <div
        className="font-mono text-terminal-gold flex items-center gap-2 flex-wrap flex-shrink-0"
        style={{ background: 'rgba(201,168,76,0.12)', borderLeft: '3px solid #C9A84C', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
        role="status"
        data-rba-pricing
      >
        <span>RBA MEETING IN {cd.d} {cd.d === 1 ? 'DAY' : 'DAYS'}</span>
        <span>MARKET PRICING: ~{sourcedPricing.marketHikePct}% FOR A RISE TO {sourcedPricing.hikeRate.toFixed(2)}%</span>
        <span className="text-terminal-text-dim">{sourcedPricing.marketSource}, {fmtDate(sourcedPricing.marketAsOf)}</span>
        {/* The link's defect was 9px text with no hit area: 11px text and a
            44px target are the fix; its destination is unchanged. */}
        <button onClick={() => openRipple(setActiveModule, 'macro:rba-cash-rate', 'rate')}
          className="ml-auto underline decoration-dotted text-terminal-gold hover:text-terminal-text-bright inline-flex items-center"
          style={{ fontSize: 11, minHeight: 44, padding: '0 6px' }}
          title="Relationships: which holdings connect to rates — connected exposure, not forecast">WHICH HOLDINGS CONNECT? ⊶</button>
      </div>
    )}
    <div
      data-tip="rba-hero"
      className="flex-shrink-0"
      style={{
        borderLeft: '3px solid #C9A84C',
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
          {/* The last decision as recorded: the same colour for a rise, a
              cut or a hold, so the colour carries no view. */}
          <div className="flex items-center gap-2 mt-2 font-mono" style={{ fontSize: 10, letterSpacing: '0.06em' }}>
            <span
              className="font-bold"
              style={{
                color: '#C9A84C',
                border: '1px solid rgba(201,168,76,0.3)',
                background: 'transparent',
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
            // Past the announcement time but rba is not yet updated: say so rather than
            // count down to nothing or guess the outcome.
            <div className="font-mono text-terminal-text-dim mt-2 leading-snug" style={{ fontSize: 11 }}>
              Announced {RBA_TIME.toLowerCase()}<br />
              <span style={{ fontSize: 9 }}>Result shown here once verified</span>
            </div>
          )}
          <div className="font-mono text-terminal-gold/80 mt-2" style={{ fontSize: 9, letterSpacing: '0.12em' }}>
            {fmtDate(rba?.nextMeeting).replace(/ \d{4}$/, '')} · {RBA_TIME} {sydneyTzAbbr(rba?.nextMeeting)}
          </div>
          <div className="font-mono text-terminal-text-dim/50 mt-1" style={{ fontSize: 8 }}>
            {provenance('rba')}
          </div>
        </div>

        {sourcedPricing && (
          <>
            <div className="w-px self-stretch" style={{ background: 'rgba(201,168,76,0.12)' }} />
            <div className="min-w-0 flex-1" style={{ maxWidth: 380 }} data-rba-pricing-bars>
              <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
                MARKET PRICING · {fmtDate(rba?.nextMeeting).replace(/ \d{4}$/, '')}
              </div>
              <div className="flex flex-col gap-1.5 mt-2.5">
                <PricingBar label="HIKE" pct={sourcedPricing.marketHikePct} rate={sourcedPricing.hikeRate} />
              </div>
              <div className="font-mono text-terminal-text-dim/60 mt-1.5" style={{ fontSize: 8 }}>
                {sourcedPricing.marketSource} · {fmtDate(sourcedPricing.marketAsOf)} · a dated reading, not live
              </div>
            </div>
          </>
        )}

        <div className="ml-auto flex flex-col items-end gap-2">
          <button
            onClick={onAskAI}
            className="text-2xs font-bold border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-3 py-1.5 transition-colors tracking-widest"
          >ASK MADDENAI ▶</button>
          {/* With no sourced reading there is no strip above, and the link
              lived only in the strip, so it could not be reached at all; it
              sits here then. It is about exposure, not pricing. */}
          {!sourcedPricing && (
            <button onClick={() => openRipple(setActiveModule, 'macro:rba-cash-rate', 'rate')}
              className="underline decoration-dotted text-terminal-gold hover:text-terminal-text-bright inline-flex items-center"
              style={{ fontSize: 11, minHeight: 44, padding: '0 6px' }}
              data-rba-holdings-link
              title="Relationships: which holdings connect to rates — connected exposure, not forecast">WHICH HOLDINGS CONNECT? ⊶</button>
          )}
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
