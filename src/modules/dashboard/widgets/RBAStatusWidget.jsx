import { useEffect, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../../data/verifiedConstants'
import VerifiedBadge from '../../../components/ui/VerifiedBadge'
import {WidgetBody, WidgetFigure} from './_shared'
import { goModule } from './navigate'

// Figures come from verifiedConstants, never from a live guess — see that
// file for why policy rates are maintained rather than fetched.
export default function RBAStatusWidget() {
  const { rba } = VERIFIED_CONSTANTS
  const next = new Date(`${rba.nextMeeting}T00:00:00`)

  // Held in state and refreshed hourly rather than read during render:
  // "days away" has to decrement on its own, and reading the clock in a
  // render body makes it change only when something else re-renders.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 3600000)
    return () => clearInterval(id)
  }, [])
  const days = Math.max(0, Math.ceil((next - now) / 86400000))

  return (
    <WidgetBody>
      <div className="flex items-start justify-between gap-2">
        <WidgetFigure value={`${rba.cashRate}%`} sub={`${rba.lastDecisionVerb} · ${rba.lastDecision}`} tone="#C9A84C" />
        <VerifiedBadge dataKey="rba" />
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px]" style={{ color: '#4A6080' }}>NEXT MEETING</span>
          <span className="font-mono text-[10px]" style={{ color: '#E8EDF5' }}>
            {next.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px]" style={{ color: '#4A6080' }}>DAYS AWAY</span>
          <span className="font-mono text-[10px] tabular-nums" style={{ color: '#C9A84C' }}>{days}d</span>
        </div>
        <button onClick={() => goModule('macro')} className="font-mono text-[9px] tracking-widest text-left mt-1" style={{ color: '#4A6080' }}>
          MACRO →
        </button>
      </div>
    </WidgetBody>
  )
}
