import Tooltip from '../ui/Tooltip'
import { useMarketSentiment, sentimentTooltip } from '../../hooks/useMarketSentiment'
import SentimentClass from '../ui/SentimentClass'

// The market sentiment score (hooks/useMarketSentiment): the same number the
// Markets banner, dashboard, News and Brief show. Computed in code (a DEMO
// composite while equity inputs are simulated),
// never by MaddenAI. Score + direction here; method and inputs in the tooltip.
export default function SentimentTick() {
  const ms = useMarketSentiment()
  const s = ms.sentiment
  if (!s) return null
  const bullish = s.score >= 50
  return (
    <Tooltip content={`Market sentiment ${s.score} / 100 — ${s.label}\n${sentimentTooltip(ms)}`}>
    <span className="inline-flex items-center gap-1 flex-shrink-0">
    <span data-sentiment-score={s.score} className={`text-[11px] font-mono font-bold whitespace-nowrap flex-shrink-0 ${bullish ? 'text-terminal-gold' : 'text-terminal-red'}`}>
      {s.score}{bullish ? ' ▲' : ' ▼'}
    </span>
    <SentimentClass ms={ms} />
    </span>
    </Tooltip>
  )
}

