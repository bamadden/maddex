import { useStore } from '../../store/useStore'

const NAV_ITEMS = [
  { id: 'markets',   label: 'MARKETS',   short: 'MKT'  },
  { id: 'portfolio', label: 'PORTFOLIO', short: 'PORT' },
  { id: 'crypto',    label: 'CRYPTO',    short: 'CRY'  },
  { id: 'fx',        label: 'FX / RATES',short: 'FX'   },
  { id: 'macro',     label: 'MACRO',     short: 'MAC'  },
  { id: 'watchlist', label: 'WATCHLIST', short: 'WL'   },
  { id: 'news',      label: 'NEWS',      short: 'NWS'  },
  { id: 'global',    label: 'GLOBAL',    short: 'GLB'  },
]

export default function NavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()

  return (
    <div className="flex items-center bg-terminal-bg border-b border-terminal-border flex-shrink-0">
      {NAV_ITEMS.map((item, i) => (
        <button
          key={item.id}
          onClick={() => setActiveModule(item.id)}
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
