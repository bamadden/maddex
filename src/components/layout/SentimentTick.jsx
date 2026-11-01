import Tooltip from '../ui/Tooltip'
import { useMarketSentiment, sentimentTooltip } from '../../hooks/useMarketSentiment'

// The market sentiment score (hooks/useMarketSentiment): the same number the
// Markets banner, dashboard, News and Brief show. Computed from market data,
// never by MaddenAI. Score + direction here; method and inputs in the tooltip.
export default function SentimentTick() {
  const ms = useMarketSentiment()
  const s = ms.sentiment
  if (!s) return null
  const bullish = s.score >= 50
  return (
    <Tooltip content={`Market sentiment ${s.score} / 100 — ${s.label}\n${sentimentTooltip(ms)}`}>
    <span data-sentiment-score={s.score} className={`text-[9px] font-mono font-bold whitespace-nowrap flex-shrink-0 ${bullish ? 'text-terminal-gold' : 'text-terminal-red'}`}>
      {s.score}{bullish ? ' ▲' : ' ▼'}
    </span>
    </Tooltip>
  )
}

