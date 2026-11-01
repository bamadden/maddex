import { useEffect, useState } from 'react'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'
import { getCachedBrief, isAuWeekend, auHour } from '../../../services/morningBriefService'
import { outlookColour } from '../../../utils/briefScore'
import { PAL } from '../../../styles/palette.js'

// Today's morning brief, read from the brief module's own cache — no second
// AI call. When there is no brief for today it says when one arrives and
// offers to generate it; GENERATE NOW opens the Brief module, which generates
// on open under the plan's weekly allowance, so the gate lives in one place.

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
        <span className="font-mono text-[11px]" style={{ color: PAL.dim }}>
          ☀ {weekend ? 'Next brief Monday from 7am' : early ? 'Brief ready at 7am weekdays' : 'No brief yet today'}
        </span>
        {!weekend && (
          <button onClick={() => goModule('brief')} className="mt-2 font-mono text-[11px] tracking-widest px-2.5 py-1 transition-colors" style={{ color: PAL.gold, border: '1px solid rgba(201,168,76,0.4)' }}>
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
        {/* MaddenAI's outlook in words; the brief carries no model-made score. */}
        <div className="min-w-0">
          <div className="font-mono" style={{ fontSize: 11, color: PAL.muted, letterSpacing: '0.1em' }}>MADDENAI OUTLOOK</div>
          <div className="font-mono font-bold truncate mt-0.5" style={{ fontSize: 14, color: outlookColour(brief.scoreLabel), letterSpacing: '0.1em' }}>{brief.scoreLabel ? String(brief.scoreLabel).toUpperCase() : '—'}</div>
        </div>
        {time && <span className="ml-auto font-mono flex-shrink-0" style={{ fontSize: 11, color: PAL.muted }}>{time}</span>}
      </div>
      <div className="flex-1 min-h-0 font-sans text-[11px] leading-snug mt-2 line-clamp-4" style={{ color: PAL.dim }}>{first}</div>
      <button onClick={() => goModule('brief')} className="font-mono text-[11px] tracking-widest text-left flex-shrink-0 mt-1" style={{ color: PAL.gold }}>
        READ FULL BRIEF →
      </button>
    </WidgetBody>
  )
}
