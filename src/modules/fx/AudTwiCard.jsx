import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { useAudStrength, meanMove, STRENGTH_MAJORS } from './useAudStrength'

// ─── AUD trade-weighted index ───────────────────────────────────────────────
//
// The single most useful AUD number that is not a pair. AUD/USD tells you
// about the US dollar as much as about the Australian one; the TWI is the AUD
// against the basket of currencies Australia actually trades in, weighted by
// trade share, so it separates "the AUD moved" from "the dollar moved".
//
// WHAT THIS CARD DOES NOT SAY, AND WHY.
//
// The obvious things to put under the level are "▲ +0.2% today" and
// "6-month high". Neither exists here. The RBA publishes the TWI every
// business day, but this build holds one verified snapshot, not the series —
// so there is no previous close to difference against and no six months of
// history to rank today's reading within. Both would have to be invented, and
// an invented change on a real index level is exactly the failure the rest of
// this terminal is built to avoid: the level is checkable, so the fabricated
// figure beside it inherits its credibility.
//
// What goes there instead is measured: the AUD's 30-day move against the six
// majors this module already fetches live, labelled as what it is rather than
// dressed up as the TWI's own change.

const fmtDate = (iso) => (iso
  ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—')

export default function AudTwiCard() {
  const au = VERIFIED_CONSTANTS.au
  const { data, isFetching } = useAudStrength()
  const mean = meanMove(data)
  const counted = (data ?? []).filter((r) => typeof r.pct === 'number').length

  if (au?.twi == null) return null

  return (
    <div
      className="border-b border-terminal-border flex-shrink-0"
      style={{
        borderLeft: '3px solid #C9A84C',
        background: 'linear-gradient(90deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.015) 60%, transparent 100%)',
        padding: '12px 16px',
      }}
    >
      <div className="flex items-start gap-5 flex-wrap">
        <div className="min-w-0">
          <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
            AUD TRADE-WEIGHTED INDEX
          </div>
          <div className="font-mono font-bold text-terminal-gold leading-none tabular-nums" style={{ fontSize: 24, marginTop: 5 }}>
            {au.twi.toFixed(1)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <VerifiedBadge dataKey="au" alwaysShow />
            <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8 }}>
              {au.twiSource?.split('/')[0] ?? 'rba.gov.au'} · as at {fmtDate(au.twiAsOf)}
            </span>
          </div>
        </div>

        <div className="w-px self-stretch" style={{ background: 'rgba(201,168,76,0.12)' }} />

        <div className="min-w-0 flex-1">
          <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
            AUD VS SIX MAJORS · 30 DAYS
            {isFetching && <span className="text-terminal-text-dim/60 ml-1 animate-pulse">…</span>}
          </div>
          {mean != null ? (
            <>
              <div
                className="font-mono font-bold leading-none tabular-nums"
                style={{ fontSize: 20, marginTop: 5, color: mean >= 0 ? '#2D8A50' : '#CC4444' }}
              >
                {mean >= 0 ? '▲ +' : '▼ '}{mean.toFixed(2)}%
              </div>
              <div className="font-mono text-terminal-text-dim/60 mt-2 leading-snug" style={{ fontSize: 8, maxWidth: 340 }}>
                Unweighted mean across {counted} of {STRENGTH_MAJORS.length} majors, from live Frankfurter history.
                Not the TWI&apos;s own change — the index is trade-weighted and this is not.
              </div>
            </>
          ) : (
            <div className="font-mono text-terminal-text-dim/50 mt-2 leading-snug" style={{ fontSize: 9, maxWidth: 300 }}>
              {isFetching ? 'Loading 30-day history…' : 'Unavailable — Frankfurter did not return history.'}
            </div>
          )}
        </div>

        <div
          className="font-mono text-right text-terminal-text-dim/45 leading-snug ml-auto"
          style={{ fontSize: 8, maxWidth: 190 }}
        >
          One verified snapshot, not a series — so no daily change and no
          high/low ranking is shown for the index itself.
        </div>
      </div>
    </div>
  )
}
