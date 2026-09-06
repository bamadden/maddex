import {} from './_shared'
import { goModule } from './navigate'

const ACTIONS = [
  { label: 'MARKETS',   icon: '📈', to: 'markets' },
  { label: 'WATCHLIST', icon: '★',  to: 'watchlist' },
  { label: 'PORTFOLIO', icon: '💼', to: 'portfolio' },
  { label: 'NEWS',      icon: '📰', to: 'news' },
  { label: 'GLOBAL',    icon: '🗺',  to: 'global' },
  { label: 'ASK AI',    icon: '▲',  ai: true },
]

export default function QuickActionsWidget() {
  return (
    <div className="h-full w-full grid grid-cols-3 grid-rows-2" style={{ gap: 1, background: 'rgba(201,168,76,0.06)' }}>
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => (a.ai
            ? window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt: '', context: 'Dashboard' } }))
            : goModule(a.to))}
          className="flex flex-col items-center justify-center gap-1 transition-colors"
          style={{ background: '#060D1A' }}
        >
          <span className="text-[13px] leading-none">{a.icon}</span>
          <span className="font-mono text-[8px] tracking-widest" style={{ color: '#637899' }}>{a.label}</span>
        </button>
      ))}
    </div>
  )
}
