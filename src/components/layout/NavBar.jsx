import { useStore } from '../../store/useStore'

// fkey is fixed to CommandBar.jsx's hardcoded F1–F8 handlers (independent of
// display order below) — do not derive it from array position, or the hint
// shown on a button will name the wrong key the moment display order and
// key-binding order diverge, as they now deliberately do (grouped by
// function here vs. F1/F2/F3... in CommandBar).
const NAV_ITEMS = [
  { id: 'markets',   label: 'MARKETS',   short: 'MKT',  fkey: 'F1', icon: '$' },
  { id: 'crypto',    label: 'CRYPTO',    short: 'CRY',  fkey: 'F3', icon: '₿' },
  { id: 'fx',        label: 'RATES',     short: 'FX',   fkey: 'F4', icon: '⇄' },
  { id: 'macro',     label: 'MACRO',     short: 'MAC',  fkey: 'F5', icon: 'Σ' },
  { id: 'global',    label: 'GLOBAL',    short: 'GLB',  fkey: 'F8', icon: '◎', groupBreak: true },
  { id: 'watchlist', label: 'WATCHLIST', short: 'WL',   fkey: 'F6', icon: '☆', groupBreak: true },
  { id: 'portfolio', label: 'PORTFOLIO', short: 'PORT', fkey: 'F2', icon: '◆' },
  { id: 'news',      label: 'NEWS',      short: 'NWS',  fkey: 'F7', icon: '☰', groupBreak: true },
]

const APP_VERSION = 'v0.1.0-beta'

// Desktop / tablet top nav — hidden below the md breakpoint in favour of
// MobileNavBar, a bottom tab bar that's a better fit for touch navigation.
export default function NavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()

  return (
    <div className="hidden md:flex items-center bg-terminal-bg border-b border-terminal-border flex-shrink-0">
      {NAV_ITEMS.map((item) => {
        const isActive = activeModule === item.id
        return (
          <div key={item.id} className="flex items-center">
            {item.groupBreak && <span className="w-px h-4 bg-terminal-border mx-1 flex-shrink-0" />}
            <button
              onClick={() => setActiveModule(item.id)}
              title={`${item.label} — press ${item.fkey}`}
              className={`
                flex items-center gap-1.5 px-4 py-2 text-2xs font-semibold tracking-widest uppercase
                transition-all duration-100 border-l-2
                ${isActive
                  ? 'bg-terminal-gold/[0.07] text-terminal-gold border-l-terminal-gold shadow-[inset_0_0_12px_rgba(200,168,75,0.12)]'
                  : 'text-terminal-text-dim border-l-transparent hover:text-terminal-text hover:bg-terminal-panel'
                }
              `}
            >
              <span className="opacity-80">{item.icon}</span>
              <span className="hidden lg:inline">{item.label}</span>
              <span className="inline lg:hidden">{item.short}</span>
              <span className="ml-1 text-terminal-text-dim opacity-50">{item.fkey}</span>
            </button>
          </div>
        )
      })}
      <div className="flex-1" />
      <span className="hidden xl:inline text-terminal-text-dim/40 text-2xs tracking-wider mr-3">{APP_VERSION}</span>
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
