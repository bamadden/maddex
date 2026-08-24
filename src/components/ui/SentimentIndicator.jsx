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

// Compact score + label + mini gauge — for the TopBar, right after the
// market status dots.
export function SentimentCompact({ sentiment, status }) {
  if (status === 'error' || (status === 'idle' && !sentiment)) return null
  const score = sentiment?.score
  const label = sentiment?.label ?? (status === 'loading' ? 'ANALYSING...' : '—')
  const color = colorForScore(score)
  return (
    <span className="hidden lg:flex items-center gap-1.5" title={sentiment?.keyTheme}>
      <span className="text-2xs font-bold font-mono" style={{ color }}>{score ?? '·'}</span>
      <span className="text-2xs font-mono text-terminal-muted tracking-wider">{label}</span>
      <SentimentMiniGauge score={score} />
    </span>
  )
}

// Full sentiment bar — News module top.
export function SentimentBar({ sentiment, status, error }) {
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="border border-terminal-border px-3 py-2 flex items-center gap-2">
        <span className="text-2xs text-terminal-gold tracking-widest animate-pulse">MADDENAI · READING THE MARKET...</span>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="border border-terminal-red/30 px-3 py-2">
        <span className="text-2xs text-terminal-red">{error}</span>
      </div>
    )
  }
  const score = sentiment?.score
  const color = colorForScore(score)
  const biasColor = sentiment?.asxBias === 'POSITIVE' ? 'text-terminal-green' : sentiment?.asxBias === 'NEGATIVE' ? 'text-terminal-red' : 'text-terminal-text-dim'
  return (
    <div className="border border-terminal-border px-3 py-2 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold" style={{ color }}>{score}</span>
        <span className="text-2xs font-bold tracking-widest" style={{ color }}>{sentiment?.label}</span>
        <SentimentMiniGauge score={score} width={90} height={8} />
      </div>
      <span className={`text-2xs font-bold ${biasColor}`}>ASX BIAS: {sentiment?.asxBias}</span>
      {sentiment?.drivers?.length > 0 && (
        <span className="text-2xs text-terminal-text-dim">
          <span className="text-terminal-green">▲ {sentiment.drivers[0]}</span>
          {sentiment.drivers[1] && <> · <span className="text-terminal-red">▼ {sentiment.drivers[1]}</span></>}
        </span>
      )}
      {sentiment?.keyTheme && <span className="text-2xs text-terminal-text flex-1 min-w-[200px]">{sentiment.keyTheme}</span>}
    </div>
  )
}
