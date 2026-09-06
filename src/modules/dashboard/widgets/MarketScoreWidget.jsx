import { useSentiment } from '../../../hooks/useSentiment'
import {WidgetBody, WidgetFigure} from './_shared'
import { goModule } from './navigate'

export default function MarketScoreWidget() {
  const { sentiment, status } = useSentiment()
  const score = sentiment?.score
  const label = sentiment?.label ?? (status === 'loading' ? 'Analysing…' : '—')
  const tone = score == null ? '#8BA3C4' : score >= 60 ? '#2D8A50' : score >= 45 ? '#C9A84C' : '#A83232'

  return (
    <WidgetBody>
      <WidgetFigure value={score ?? '·'} sub={String(label).toUpperCase()} tone={tone} />
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-2">
        {/* Track plus marker rather than a filled bar: the score is a
            position on a scale, not a quantity accumulated. */}
        <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(99,120,153,0.2)' }}>
          {score != null && (
            <span style={{
              position: 'absolute', left: `${Math.min(100, Math.max(0, score))}%`, top: -2,
              width: 2, height: 8, background: tone, transform: 'translateX(-1px)',
            }} />
          )}
        </div>
        <button onClick={() => goModule('markets')} className="font-mono text-[9px] tracking-widest text-left" style={{ color: '#4A6080' }}>
          MARKETS →
        </button>
      </div>
    </WidgetBody>
  )
}
