import {} from './_shared'
import { goModule } from './navigate'
import { useContainerWidth } from '../../../hooks/useContainerWidth'

const ACTIONS = [
  { label: 'MARKETS',   icon: '📈', to: 'markets' },
  { label: 'WATCHLIST', icon: '★',  to: 'watchlist' },
  { label: 'PORTFOLIO', icon: '💼', to: 'portfolio' },
  { label: 'NEWS',      icon: '📰', to: 'news' },
  { label: 'GLOBAL',    icon: '🗺',  to: 'global' },
  { label: 'ASK AI',    icon: '▲',  ai: true },
]

export default function QuickActionsWidget() {
  // 3x2 when there is room, 2x3 when there is not.
  //
  // Six actions across three columns gives each about 60px on a phone — under
  // the 44px minimum once padding is taken off, and too narrow for the label
  // to sit under the icon without wrapping. Two columns give roughly 95px
  // each, which clears the touch target with room for the word.
  // 260px, not the module default of 560. A widget cell is around 340px wide
  // even on a large screen, so the module threshold would keep this in the
  // two-column phone layout permanently. Below 260px, three columns gives
  // each button under 85px and the label starts wrapping.
  const { ref, isNarrow } = useContainerWidth({ narrowAt: 260 })

  return (
    <div
      ref={ref}
      className={`h-full w-full grid ${isNarrow ? 'grid-cols-2 grid-rows-3' : 'grid-cols-3 grid-rows-2'}`}
      style={{ gap: 1, background: 'rgba(201,168,76,0.06)' }}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => (a.ai
            ? window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt: '', context: 'Dashboard' } }))
            : goModule(a.to))}
          className="flex flex-col items-center justify-center gap-1 transition-colors"
          // 44px is the minimum comfortable touch target. It applies at every
          // size — a cramped button is no easier to hit with a mouse, it is
          // just more forgivable.
          style={{ background: '#060D1A', minHeight: 44 }}
        >
          <span className={isNarrow ? 'text-[16px] leading-none' : 'text-[13px] leading-none'}>{a.icon}</span>
          <span
            className="font-mono tracking-widest"
            style={{ color: '#637899', fontSize: isNarrow ? 9 : 8 }}
          >{a.label}</span>
        </button>
      ))}
    </div>
  )
}
