// Same 5-band colour scale as MorningBriefModule's score gauge (0-30 red /
// 30-50 amber / 50-70 gold / 70-85 light-green / 85-100 green) — kept in
// sync deliberately so a score means the same colour everywhere in the app.
const BANDS = [
  { max: 30, color: '#A83232' },
  { max: 50, color: '#C9A84C' },
  { max: 70, color: '#E8C96A' },
  { max: 85, color: '#6FCB8F' },
  { max: 100, color: '#2D8A50' },
]

function colorForScore(score) {
  if (score == null) return '#8BA3C4'
  return (BANDS.find((b) => score <= b.max) ?? BANDS[BANDS.length - 1]).color
}

// 60px x 6px horizontal fill bar, per the brief's exact spec.
export function SentimentMiniGauge({ score, width = 60, height = 6 }) {
  const color = colorForScore(score)
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score))
  return (
    <div style={{ width, height }} className="bg-terminal-border/40 overflow-hidden flex-shrink-0">
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, transition: 'width 300ms ease' }} />
    </div>
  )
}

// Full sentiment bar — Morning Brief. The number is the one market sentiment
// score (hooks/useMarketSentiment), computed from market data; MaddenAI's daily
// read of the headlines (`read`) adds words only — bias, drivers, theme.
export function SentimentBar({ market, read }) {
  const m = market?.sentiment
  if (!m) {
    return (
      <div className="border border-terminal-border px-3 py-2 flex items-center gap-2">
        <span className="text-2xs text-terminal-text-dim tracking-widest">{market?.status === 'loading' ? 'MARKET SENTIMENT · READING MARKET DATA…' : 'MARKET SENTIMENT · NO MARKET DATA YET'}</span>
      </div>
    )
  }
  const color = colorForScore(m.score)
  const biasColor = read?.asxBias === 'POSITIVE' ? 'text-terminal-green' : read?.asxBias === 'NEGATIVE' ? 'text-terminal-red' : 'text-terminal-text-dim'
  return (
    <div className="border border-terminal-border px-3 py-2 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2" title={market.method}>
        <span className="text-2xs tracking-widest text-terminal-text-dim">MARKET SENTIMENT</span>
        <span className="text-lg font-bold" style={{ color }}>{m.score}</span>
        <span className="text-2xs font-bold tracking-widest" style={{ color }}>{m.label.toUpperCase()}</span>
        <SentimentMiniGauge score={m.score} width={90} height={8} />
      </div>
      {read?.asxBias && <span className={`text-2xs font-bold ${biasColor}`} title="MaddenAI's read of today's headlines">HEADLINES: ASX BIAS {read.asxBias}</span>}
      {read?.drivers?.length > 0 && (
        <span className="text-2xs text-terminal-text-dim">
          <span className="text-terminal-green">▲ {read.drivers[0]}</span>
          {read.drivers[1] && <> · <span className="text-terminal-red">▼ {read.drivers[1]}</span></>}
        </span>
      )}
      {read?.keyTheme && <span className="text-2xs text-terminal-text flex-1 min-w-[200px]">{read.keyTheme}</span>}
    </div>
  )
}
