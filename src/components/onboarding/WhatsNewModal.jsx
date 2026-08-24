// Recent, genuinely-shipped features — update this list as new ones land.
const RECENT_FEATURES = [
  { title: 'Market Scanner', desc: 'Real-time breakout, RSI, volume, gap, and AI pattern detection across the ASX and US.' },
  { title: 'Voice Interface', desc: 'Talk to MaddenAI — navigate or ask questions hands-free via the mic button in the AI panel.' },
  { title: 'Advanced Portfolio Analytics', desc: 'Beta, Sharpe ratio, concentration risk, dividend calendar, and performance attribution.' },
]

export default function WhatsNewModal({ onDismiss, onShowMe }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-terminal-panel border border-terminal-gold/40 w-full max-w-sm shadow-2xl font-mono p-6">
        <div className="text-terminal-gold font-bold text-sm tracking-widest mb-1">WHAT'S NEW</div>
        <div className="text-2xs text-terminal-text-dim mb-4">A few things that shipped recently.</div>

        <div className="space-y-3 mb-6">
          {RECENT_FEATURES.map((f) => (
            <div key={f.title} className="border-l-2 border-terminal-gold/50 pl-3">
              <div className="text-2xs font-bold text-terminal-text-bright">{f.title}</div>
              <div className="text-2xs text-terminal-text-dim leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 text-2xs text-terminal-text-dim border border-terminal-border py-2 hover:text-terminal-text transition-colors"
          >DISMISS</button>
          <button
            onClick={onShowMe}
            className="flex-1 text-2xs font-bold text-terminal-gold border border-terminal-gold/50 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >SHOW ME</button>
        </div>
      </div>
    </div>
  )
}
