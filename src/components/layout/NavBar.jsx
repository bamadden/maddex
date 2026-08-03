import { useStore } from '../../store/useStore'

const NAV_ITEMS = [
  { id: 'markets',   label: 'MARKETS',   short: 'MKT',  key: 'M', icon: '$' },
  { id: 'portfolio', label: 'PORTFOLIO', short: 'PORT', key: 'P', icon: '◆' },
  { id: 'crypto',    label: 'CRYPTO',    short: 'CRY',  key: 'C', icon: '₿' },
  { id: 'fx',        label: 'RATES',     short: 'FX',   key: 'F', icon: '⇄' },
  { id: 'macro',     label: 'MACRO',     short: 'MAC',  key: 'X', icon: 'Σ' },
  { id: 'watchlist', label: 'WATCHLIST', short: 'WL',   key: 'W', icon: '☆' },
  { id: 'news',      label: 'NEWS',      short: 'NWS',  key: 'N', icon: '☰' },
  { id: 'global',    label: 'GLOBAL',    short: 'GLB',  key: 'G', icon: '◎' },
]

// Desktop / tablet top nav — hidden below the md breakpoint in favour of
// MobileNavBar, a bottom tab bar that's a better fit for touch navigation.
export default function NavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()

  return (
    <div className="hidden md:flex items-center bg-terminal-bg border-b border-terminal-border flex-shrink-0">
      {NAV_ITEMS.map((item, i) => (
        <button
          key={item.id}
          onClick={() => setActiveModule(item.id)}
          title={`${item.label} — press F${i + 1} or ${item.key}`}
          className={`
            px-4 py-2 text-2xs font-semibold tracking-widest uppercase transition-all duration-100 border-r border-terminal-border
            ${activeModule === item.id
              ? 'bg-terminal-accent text-terminal-gold border-b-2 border-b-terminal-gold'
              : 'text-terminal-text-dim hover:text-terminal-text hover:bg-terminal-panel'
            }
          `}
        >
          <span className="hidden lg:inline">{item.label}</span>
          <span className="inline lg:hidden">{item.short}</span>
          <span className="ml-1.5 text-terminal-text-dim opacity-50">F{i + 1}</span>
        </button>
      ))}
      <div className="flex-1" />
      <button
        onClick={() => setChatOpen((v) => !v)}
        className={`
          px-4 py-2 text-2xs font-semibold tracking-widest uppercase transition-all duration-100 border-l border-terminal-border
          ${chatOpen ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-gold hover:bg-terminal-accent'}
        `}
      >
        ▲ AI ANALYST
      </button>
    </div>
  )
}

// Mobile bottom tab bar (<768px) — a normal flex-flow element placed after
// CommandBar in App.jsx, not `fixed`, so it never overlaps the command input.
export function MobileNavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()

  return (
    <div className="flex md:hidden items-stretch bg-terminal-header border-t border-terminal-border flex-shrink-0 overflow-x-auto hide-scrollbar">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveModule(item.id)}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 flex-shrink-0 min-w-[56px] transition-colors ${
            activeModule === item.id ? 'text-terminal-gold' : 'text-terminal-text-dim'
          }`}
        >
          <span className="text-sm leading-none">{item.icon}</span>
          <span className="text-[8px] tracking-wide leading-none">{item.short}</span>
        </button>
      ))}
      <button
        onClick={() => setChatOpen((v) => !v)}
        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 flex-shrink-0 min-w-[56px] ml-auto border-l border-terminal-border ${
          chatOpen ? 'text-terminal-gold' : 'text-terminal-gold/70'
        }`}
      >
        <span className="text-sm leading-none">▲</span>
        <span className="text-[8px] tracking-wide leading-none">AI</span>
      </button>
    </div>
  )
}
