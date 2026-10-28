import { useEffect, useState } from 'react'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'
import { getCachedBrief, isAuWeekend, auHour } from '../../../services/morningBriefService'
import { scoreColour } from '../../../utils/briefScore'

// Today's morning brief, read from the brief module's own cache — no second
// AI call. When there is no brief for today it says when one arrives and
// offers to generate it; GENERATE NOW opens the Brief module, which generates
// on open under the plan's weekly allowance, so the gate lives in one place.

function Gauge({ score }) {
  // Semicircle, 0–100 left to right, in the Brief module's own score bands.
  const s = Math.max(0, Math.min(100, Number(score) || 0))
  const a = Math.PI * (1 - s / 100)
  const x = 30 + 24 * Math.cos(a), y = 30 - 24 * Math.sin(a)
  const tone = scoreColour(s)
  return (
    <svg width="60" height="34" viewBox="0 0 60 34" aria-hidden="true">
      <path d="M6 30 A24 24 0 0 1 54 30" fill="none" stroke="rgba(74,96,128,0.3)" strokeWidth="4" strokeLinecap="round" />
      <path d={`M6 30 A24 24 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function MorningBriefWidget() {
  // Re-read every minute so a brief generated in another tab or module shows
  // up without a reload.
  const [brief, setBrief] = useState(() => getCachedBrief())
  useEffect(() => { const id = setInterval(() => setBrief(getCachedBrief()), 60_000); return () => clearInterval(id) }, [])

  if (!brief || brief.isWeekend) {
    const weekend = isAuWeekend()
    const early = !weekend && auHour() < 7
    return (
      <WidgetBody className="justify-center items-center text-center">
        <span className="font-mono text-[11px]" style={{ color: '#8BA3C4' }}>
          ☀ {weekend ? 'Next brief Monday from 7am' : early ? 'Brief ready at 7am weekdays' : 'No brief yet today'}
        </span>
        {!weekend && (
          <button onClick={() => goModule('brief')} className="mt-2 font-mono text-[9px] tracking-widest px-2.5 py-1 transition-colors" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)' }}>
            GENERATE NOW →
          </button>
        )}
      </WidgetBody>
    )
  }

  const first = brief.headline || brief.sections?.[0]?.content || ''
  const time = brief.generatedAt ? new Date(brief.generatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' }) : null
  return (
    <WidgetBody>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Gauge score={brief.maddenAIScore} />
        <div className="min-w-0">
          <div className="font-mono tabular-nums leading-none" style={{ fontSize: 20, color: '#E8EDF5' }}>{brief.maddenAIScore ?? '—'}</div>
          <div className="font-mono truncate mt-0.5" style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '0.1em' }}>{String(brief.scoreLabel ?? '').toUpperCase()}</div>
        </div>
        {time && <span className="ml-auto font-mono flex-shrink-0" style={{ fontSize: 8, color: '#4A6080' }}>{time}</span>}
      </div>
      <div className="flex-1 min-h-0 font-sans text-[11px] leading-snug mt-2 line-clamp-4" style={{ color: '#8BA3C4' }}>{first}</div>
      <button onClick={() => goModule('brief')} className="font-mono text-[9px] tracking-widest text-left flex-shrink-0 mt-1" style={{ color: '#C9A84C' }}>
        READ FULL BRIEF →
      </button>
    </WidgetBody>
  )
}
