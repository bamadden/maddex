import {WidgetBody, WidgetFigure} from './_shared'
import { goModule } from './navigate'
import { useSentiment } from '../../../hooks/useSentiment'

// Reads the same sentiment the brief module leads with rather than
// re-generating anything — a second AI call for a preview of the first is
// the kind of duplication this dashboard is meant to avoid.
export default function MorningBriefWidget() {
  const { sentiment } = useSentiment()
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <WidgetBody>
      <div className="flex items-start justify-between gap-3 min-w-0">
        <WidgetFigure value={sentiment?.score ?? '·'} sub={today.toUpperCase()} tone="#C9A84C" />
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-2">
        <div className="font-sans text-[11px] leading-snug line-clamp-2" style={{ color: '#8BA3C4' }}>
          {sentiment?.summary ?? sentiment?.label ?? 'Your daily market briefing.'}
        </div>
        <button onClick={() => goModule('brief')} className="font-mono text-[9px] tracking-widest text-left" style={{ color: '#C9A84C' }}>
          READ FULL BRIEF →
        </button>
      </div>
    </WidgetBody>
  )
}
