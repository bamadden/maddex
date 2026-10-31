import { useEffect, useState } from 'react'
import { pendingRbaDecision, rbaDecisionAt } from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { sydneyTzAbbr } from '../../utils/dateUtils'
import { rbaPreview } from '../../utils/askAI'

// The next RBA decision, for the week before it.
//
// The market figure is one dated reading of ASX 30-day cash rate futures,
// typed in by a person with its source — see RbaHeroCard's note on why this
// card had no probability block before. It is shown as exactly that: a
// number with a date and a source, labelled not-live. The HIKE / HOLD bars
// for it are on RbaHeroCard; this card carries the context and the statement.
// Hold is the complement of the hike reading (the futures price no cut), not
// a second measurement.

const SHOW_BEFORE_MS = 8 * 86400_000

function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }).toUpperCase()

export default function RbaDecisionPreview() {
  const now = useNow()
  const nd = pendingRbaDecision(now)
  if (!nd || now < rbaDecisionAt(nd.date, nd.time) - SHOW_BEFORE_MS) return null

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
        <button
          onClick={() => rbaPreview(nd.date)}
          title="MaddenAI's six-part pre-decision brief — kept in Saved Research. Also: type 'rba preview' in the command bar."
          className="ml-auto text-2xs font-bold border border-terminal-gold/50 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-2 py-0.5 transition-colors tracking-widest"
        >RBA PREVIEW ▶</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-1.5">
        <div>
          {/* The HIKE / HOLD bars themselves are on the hero card above. */}
          <div className="font-mono text-terminal-text-bright leading-snug" style={{ fontSize: 10 }}>
            ~{nd.marketHikePct}% priced for {nd.hikeRate.toFixed(2)}%, ~{100 - nd.marketHikePct}% for a hold at {nd.currentRate.toFixed(2)}%.
          </div>
          <div className="font-mono text-terminal-text-dim/60 leading-snug mt-1" style={{ fontSize: 8 }}>
            Market-implied estimate as at {nd.marketAsOf}: {nd.marketSource}{nd.marketImpliedRate != null && <> implied {nd.marketImpliedRate.toFixed(2)}%</>}.
            A dated reading, not a live feed. {nd.marketContext}
          </div>
          {nd.peerContext && (
            <div className="font-mono leading-snug mt-1.5" style={{ fontSize: 9, color: '#E8A33D' }}>⚑ {nd.peerContext}</div>
          )}
        </div>
        <div className="mt-2 md:mt-0">
          <div className="font-mono text-terminal-text-bright leading-snug" style={{ fontSize: 10 }}>
            {nd.keyFactor}
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
