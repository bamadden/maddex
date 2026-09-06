import { useEffect, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../../data/verifiedConstants'
import VerifiedBadge from '../../../components/ui/VerifiedBadge'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'

// Figures come from verifiedConstants, never from a live guess — see that
// file for why policy rates are maintained rather than fetched.
//
// NOTE ON THE BAR
//
// The obvious thing to put here is a market-implied "68% hold / 32% cut"
// probability bar. There is no probability feed connected to this app, so any
// such figure would be typed in by hand and displayed as market pricing — the
// same failure class as the fabricated Brent price in the morning brief, and
// more actionable, because a rate-cut probability is exactly what someone
// positions against. The bar therefore shows the one thing that IS known
// exactly: how far through the inter-meeting period we are.
export default function RBAStatusWidget() {
  const { rba } = VERIFIED_CONSTANTS
  const next = new Date(`${rba.nextMeeting}T00:00:00`)
  const last = new Date(`${rba.lastDecision}T00:00:00`)

  // Held in state and refreshed hourly rather than read during render:
  // "days away" has to decrement on its own, and reading the clock in a
  // render body makes it change only when something else re-renders.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 3600000)
    return () => clearInterval(id)
  }, [])

  const days = Math.max(0, Math.ceil((next - now) / 86400000))
  const cycleMs = next - last
  const progress = cycleMs > 0 ? Math.min(100, Math.max(0, ((now - last) / cycleMs) * 100)) : 0

  // Direction of the last actual move, from the two rates we hold. A HOLD
  // leaves the rate unchanged, so the arrow describes the last change in the
  // level rather than the last decision's verb.
  const delta = rba.cashRate - (rba.previousRate ?? rba.cashRate)
  const trend = delta > 0
    ? { arrow: '▲', colour: '#A83232', text: `up ${Math.abs(delta).toFixed(2)}pp from ${rba.previousRate}%` }
    : delta < 0
      ? { arrow: '▼', colour: '#2D8A50', text: `down ${Math.abs(delta).toFixed(2)}pp from ${rba.previousRate}%` }
      : { arrow: '▬', colour: '#4A6080', text: 'unchanged' }

  return (
    <WidgetBody>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular-nums leading-none" style={{ fontSize: 28, color: '#C9A84C' }}>
              {rba.cashRate}%
            </span>
            <span className="font-mono leading-none" style={{ fontSize: 12, color: trend.colour }}>{trend.arrow}</span>
          </div>
          <div className="font-mono text-[9px] mt-1 truncate" style={{ color: '#4A6080', letterSpacing: '0.08em' }}>
            {rba.lastDecisionVerb} · {trend.text}
          </div>
        </div>
        <VerifiedBadge dataKey="rba" alwaysShow />
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[8px]" style={{ color: '#4A6080', letterSpacing: '0.1em' }}>
              SINCE LAST DECISION
            </span>
            <span className="font-mono text-[9px] tabular-nums" style={{ color: '#C9A84C' }}>
              {days}d to go
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(99,120,153,0.2)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', width: `${progress}%`, background: '#C9A84C',
                transition: 'width 600ms ease',
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button onClick={() => goModule('macro')} className="font-mono text-[9px] tracking-widest" style={{ color: '#4A6080' }}>
            MACRO →
          </button>
          <span className="font-mono text-[9px]" style={{ color: '#8BA3C4' }}>
            {next.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
    </WidgetBody>
  )
}
