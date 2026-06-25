import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './store/useStore'
import DiagPage from './DiagPage'
import TopBar from './components/layout/TopBar'
import NavBar from './components/layout/NavBar'
import TickerTape from './components/layout/TickerTape'
import CommandBar from './components/layout/CommandBar'
import AIPanel from './components/layout/AIPanel'
import DetailModal from './components/ui/DetailModal'
import MarketsModule from './modules/markets/MarketsModule'
import PortfolioModule from './modules/portfolio/PortfolioModule'
import CryptoModule from './modules/crypto/CryptoModule'
import FXModule from './modules/fx/FXModule'
import MacroModule from './modules/macro/MacroModule'
import WatchlistModule from './modules/watchlist/WatchlistModule'
import NewsModule from './modules/news/NewsModule'
import GlobalModule from './modules/global/GlobalModule'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (count, err) => {
        if (err?.message?.includes('rate limited')) return false
        return count < 1
      },
    },
  },
})

const MODULE_MAP = {
  markets:   MarketsModule,
  portfolio: PortfolioModule,
  crypto:    CryptoModule,
  fx:        FXModule,
  macro:     MacroModule,
  watchlist: WatchlistModule,
  news:      NewsModule,
  global:    GlobalModule,
}

// ── Keyboard shortcuts modal ──────────────────────────────────────────────────

const SHORTCUTS = [
  { key: '/',    desc: 'Focus command / search bar' },
  { key: 'Esc', desc: 'Close modal / AI panel' },
  { key: '?',   desc: 'Show keyboard shortcuts' },
  { key: 'M',   desc: 'Navigate → Markets' },
  { key: 'C',   desc: 'Navigate → Crypto' },
  { key: 'F',   desc: 'Navigate → FX' },
  { key: 'N',   desc: 'Navigate → News' },
  { key: 'G',   desc: 'Navigate → Global Intelligence' },
]

function ShortcutModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-terminal-panel border border-terminal-border p-6 min-w-72 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">KEYBOARD SHORTCUTS</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text text-lg">✕</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center gap-4 text-2xs">
              <kbd className="min-w-10 text-center bg-terminal-accent border border-terminal-border px-2 py-0.5 text-terminal-gold font-bold font-mono">
                {s.key}
              </kbd>
              <span className="text-terminal-text-dim">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Loading screen ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-terminal-bg flex flex-col items-center justify-center gap-6 loading-fade">
      <div className="flex flex-col items-center gap-3">
        <div className="text-terminal-gold text-4xl font-bold tracking-[0.3em]">MADDEX</div>
        <div className="text-terminal-text-dim text-xs tracking-[0.5em]">FINANCIAL INTELLIGENCE</div>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-terminal-gold rounded-full animate-pulse"
            style={{ animationDelay: `${i * 120}ms`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
      <div className="text-terminal-text-dim text-2xs tracking-widest">INITIALISING DATA FEEDS...</div>
    </div>
  )
}

// ── Terminal ──────────────────────────────────────────────────────────────────

function Terminal() {
  const { activeModule, setActiveModule, modalAsset, closeModal, chatOpen, setChatOpen } = useStore()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const ActiveModule = MODULE_MAP[activeModule] || MarketsModule

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable

      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return }
        if (modalAsset) { closeModal(); return }
        if (chatOpen) setChatOpen(false)
        return
      }

      if (isInput) return

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowShortcuts(v => !v)
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        document.querySelector('.cmd-input')?.focus()
        return
      }

      // Module navigation (no modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const navMap = { m: 'markets', c: 'crypto', f: 'fx', n: 'news', g: 'global', p: 'portfolio', w: 'watchlist', x: 'macro' }
        const dest = navMap[e.key.toLowerCase()]
        if (dest) setActiveModule(dest)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalAsset, closeModal, chatOpen, setChatOpen, showShortcuts, setActiveModule])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden font-mono bg-terminal-bg">
      <div className="fixed inset-0 scanlines pointer-events-none z-50" />
      <TopBar />
      <TickerTape />
      <NavBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div key={activeModule} className="flex-1 min-w-0 overflow-hidden module-fade">
          <ActiveModule />
        </div>
        <AIPanel />
      </div>
      <CommandBar />
      <DetailModal />
      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}

// ── App root ──────────────────────────────────────────────────────────────────

function AppWithLoading() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1400)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      {!loaded && <LoadingScreen />}
      <Terminal />
    </>
  )
}

export default function App() {
  if (window.location.search.includes('diag')) return <DiagPage />
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AppWithLoading />
      </StoreProvider>
    </QueryClientProvider>
  )
}
