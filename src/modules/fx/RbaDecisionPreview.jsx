import { useEffect, useState } from 'react'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { sydneyOffset, sydneyTzAbbr } from '../../utils/dateUtils'

// The next RBA decision, for the week before it.
//
// The market figure is one dated reading of ASX 30-day cash rate futures,
// typed in by a person with its source — see RbaHeroCard's note on why this
// card had no probability block before. It is shown as exactly that: a
// number with a date and a source, labelled not-live, never a bar that
// implies it moves. Hold is the complement of the hike reading (the futures
// price no cut), not a second measurement.

const SHOW_BEFORE_MS = 8 * 86400_000

function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }).toUpperCase()

export default function RbaDecisionPreview() {
  const nd = VERIFIED_CONSTANTS.rbaNextDecision
  const cp = VERIFIED_CONSTANTS.cpiPreview
  const now = useNow()
  if (!nd) return null
  const at = new Date(`${nd.date}T${nd.time}:00${sydneyOffset(nd.date)}`).getTime()
  if (now >= at || now < at - SHOW_BEFORE_MS) return null

  const cpiAt = cp ? new Date(`${cp.releaseDate}T${cp.releaseTime}:00${sydneyOffset(cp.releaseDate)}`).getTime() : null
  const cpiOut = cpiAt != null && now >= cpiAt
  const hold = 100 - nd.marketHikePct

  const scenario = (label, rate, p, tone) => (
    <div className="flex items-baseline gap-3 py-1">
      <span className="font-mono font-bold w-24" style={{ color: tone, fontSize: 11 }}>{label}</span>
      <span className="font-mono text-terminal-text-bright tabular-nums" style={{ fontSize: 13 }}>{rate.toFixed(2)}%</span>
      <span className="font-mono text-terminal-text-dim tabular-nums" style={{ fontSize: 11 }}>~{p}% market-implied</span>
    </div>
  )

  return (
    <div className="px-4 py-2.5 border-b border-terminal-border flex-shrink-0" style={{ background: 'rgba(15,30,53,0.5)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 10 }}>
          RBA {dayLabel(nd.date)} — DECISION PREVIEW
        </span>
        <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
          {nd.time === '14:30' ? '2:30PM' : nd.time} {sydneyTzAbbr(nd.date)} · now {nd.currentRate.toFixed(2)}%
        </span>
        <VerifiedBadge dataKey="rbaNextDecision" alwaysShow />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-1.5">
        <div>
          {scenario('HIKE ▲25bp', nd.hikeRate, nd.marketHikePct, '#A83232')}
          {scenario('HOLD', nd.currentRate, hold, '#8BA3C4')}
          <div className="font-mono text-terminal-text-dim/60 leading-snug mt-0.5" style={{ fontSize: 8 }}>
            Market-implied estimate as at {nd.marketAsOf}: {nd.marketSource} implied {nd.marketImpliedRate.toFixed(2)}%.
            A dated reading, not a live feed. {nd.marketContext}
          </div>
        </div>
        <div className="mt-2 md:mt-0">
          <div className="font-mono text-terminal-text-bright leading-snug" style={{ fontSize: 10 }}>
            {cpiOut
              ? 'The September quarter CPI is out — the market reading at left predates it.'
              : `The last major data point before the decision: ${nd.keyFactor}, ${cp?.releaseTime ?? ''} ${cp ? sydneyTzAbbr(cp.releaseDate) : ''}.`}
          </div>
          <blockquote className="font-mono text-terminal-text-dim italic leading-snug mt-1.5 pl-2" style={{ fontSize: 9, borderLeft: '2px solid rgba(201,168,76,0.4)' }}>
            “{nd.statementQuote}”
          </blockquote>
          <a href={nd.statementUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-terminal-gold/80 hover:underline" style={{ fontSize: 8 }}>
            {nd.statementSource} ↗
          </a>
        </div>
      </div>
    </div>
  )
}
