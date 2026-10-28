import { useState } from 'react'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'
import { sydneyOffset } from '../../utils/dateUtils'
import { MORTGAGE_MARGIN, repaymentChange } from '../calculators/calcMath'

// "If the RBA hikes" — what a 25bp move means, under the decision preview.
//
// Two kinds of content, labelled differently because they are different:
//
// MORTGAGES are arithmetic. A 30-year principal-and-interest loan at the
// terminal's assumed variable rate (cash rate + MORTGAGE_MARGIN), repayment
// recalculated at +25bp. The assumption is printed under the numbers.
//
// SECTORS and the AUD are the textbook direction of the relationship, written
// by a person, not generated and not measured — so they carry an ESTIMATE
// badge and say "tends to". With a hike mostly priced, much of any move has
// already happened; the AUD line says so rather than promising a rally.
//
// Shown while a decision is pending and the market leans to a hike.

const LOANS = [600_000, 800_000, 1_000_000]

const SECTORS = [
  { name: 'BANKS', dir: '↑', why: 'Wider net interest margins, offset by credit-quality risk', tone: '#2D8A50' },
  { name: 'REITS', dir: '↓', why: 'Higher discount rates and funding costs', tone: '#CC4444' },
  { name: 'CONSUMER', dir: '↓', why: 'Less disposable income for mortgaged households', tone: '#CC4444' },
  { name: 'UTILITIES', dir: '↓', why: 'Bond-like income loses appeal as yields rise', tone: '#CC4444' },
  { name: 'MATERIALS', dir: '→', why: 'Driven more by China and commodity prices', tone: '#8BA3C4' },
]

const money = (v) => `$${Math.round(v).toLocaleString('en-AU')}`

export default function RbaHikeImpact() {
  const nd = VERIFIED_CONSTANTS.rbaNextDecision
  const [now] = useState(() => Date.now())
  if (!nd || nd.marketHikePct == null || nd.marketHikePct < 50) return null
  const at = new Date(`${nd.date}T${nd.time}:00${sydneyOffset(nd.date)}`).getTime()
  if (now >= at) return null

  const delta = nd.hikeRate - nd.currentRate
  const fromRate = nd.currentRate + MORTGAGE_MARGIN
  const bp = Math.round(delta * 100)

  return (
    <div className="px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
      <div className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 10 }}>
        IF THE RBA HIKES TO {nd.hikeRate.toFixed(2)}%
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-2">
        <div>
          <div className="flex items-center gap-2 font-mono text-terminal-text-dim" style={{ fontSize: 8, letterSpacing: '0.16em' }}>
            MORTGAGE REPAYMENTS <span className="text-terminal-green/80 border border-terminal-green/40 px-1" style={{ fontSize: 7 }}>CALCULATED</span>
          </div>
          <table className="w-full font-mono mt-1" style={{ fontSize: 10 }}>
            <tbody>
              {LOANS.map((p) => (
                <tr key={p}>
                  <td className="text-terminal-text-dim py-0.5">{money(p)} variable</td>
                  <td className="text-right tabular-nums font-bold" style={{ color: '#E8A33D' }}>+{money(repaymentChange(p, fromRate, delta))}/month</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="font-mono text-terminal-text-dim/55 leading-snug mt-1" style={{ fontSize: 8 }}>
            30-year principal and interest, {fromRate.toFixed(2)}% → {(fromRate + delta).toFixed(2)}% (cash rate + an assumed {MORTGAGE_MARGIN.toFixed(2)}% margin),
            passed on in full. Your lender&apos;s rate and timing will differ.
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 font-mono text-terminal-text-dim" style={{ fontSize: 8, letterSpacing: '0.16em' }}>
            SECTORS &amp; AUD <AIContentBadge source="fallback" label="ESTIMATE" />
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {SECTORS.map((s) => (
              <span
                key={s.name}
                title={s.why}
                className="font-mono font-bold"
                style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, color: s.tone, border: `1px solid ${s.tone}66`, background: `${s.tone}14`, letterSpacing: '0.08em' }}
              >{s.name} {s.dir}</span>
            ))}
          </div>
          <div className="font-mono text-terminal-text-dim leading-snug mt-1.5" style={{ fontSize: 9 }}>
            Higher rates tend to support the AUD. With ~{nd.marketHikePct}% already priced, a hike is largely expected — a hold would be the bigger surprise for the currency.
          </div>
          <div className="font-mono text-terminal-text-dim/55 leading-snug mt-1" style={{ fontSize: 8 }}>
            Typical direction of each relationship for a {bp}bp hike, not a forecast. Hover a sector for why. General information, not advice.
          </div>
        </div>
      </div>
    </div>
  )
}
