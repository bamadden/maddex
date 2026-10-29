import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { intelligenceScore } from '../../services/intelligenceScore'

// TERMINAL INTELLIGENCE chip for the Dashboard status bar: the score, and on
// click what is missing, each with the step that earns its points.
export default function IntelligenceScore() {
  const { watchlist, alerts, setActiveModule } = useStore()
  const [open, setOpen] = useState(false)
  const { score, parts } = intelligenceScore({ watchlist, priceAlerts: alerts ?? [] })
  const missing = parts.filter((p) => !p.done)
  const tone = score >= 80 ? '#2D8A50' : score >= 50 ? '#C9A84C' : '#D9773B'
  const go = (a) => {
    setOpen(false)
    if (a.module) setActiveModule(a.module)
    if (a.settings) window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: { section: a.settings } }))
    if (a.shortcuts) window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }))
  }
  return (
    <span className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="font-mono font-bold tracking-widest px-2 py-0.5 whitespace-nowrap"
        style={{ fontSize: 9, color: tone, border: `1px solid ${tone}66`, borderRadius: 2 }}
        title="How much of the terminal is set up for you">
        INTELLIGENCE {score}/100
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-terminal-panel border border-terminal-border-gold shadow-xl p-2.5 font-sans">
          <div className="font-mono text-terminal-gold tracking-widest mb-1.5" style={{ fontSize: 9 }}>TERMINAL INTELLIGENCE · {score}/100</div>
          {parts.map((p) => (
            <div key={p.id} className="flex items-start gap-2 py-1 border-b border-terminal-border/30 last:border-0">
              <span style={{ color: p.done ? '#2D8A50' : '#4A6080', fontSize: 11 }}>{p.done ? '✓' : '○'}</span>
              <span className="flex-1 min-w-0">
                <span className={`block text-2xs ${p.done ? 'text-terminal-text-dim' : 'text-terminal-text-bright'}`}>{p.label}</span>
                {!p.done && <button onClick={() => go(p.action)} className="block text-left text-terminal-gold hover:underline" style={{ fontSize: 10 }}>{p.hint} (+{p.pts}) ▶</button>}
              </span>
              <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9 }}>{p.pts}</span>
            </div>
          ))}
          {!missing.length && <div className="text-2xs text-terminal-green mt-1">Everything is set up.</div>}
        </div>
      )}
    </span>
  )
}
