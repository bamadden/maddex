import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { StoreProvider, useStore } from './store/useStore'
import { useAuthStore } from './store/useAuthStore'
import { fetchNews } from './services/api'
import DiagPage from './DiagPage'
import TopBar from './components/layout/TopBar'
import NavBar, { MobileNavBar } from './components/layout/NavBar'
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
import ScreenerModule from './modules/screener/ScreenerModule'
import AuthModal from './components/auth/AuthModal'
import OnboardingFlow from './components/auth/OnboardingFlow'
import TrialExpiredModal from './components/auth/TrialExpiredModal'
import { useSubscription } from './hooks/useSubscription'

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
  screener:  ScreenerModule,
}

const MODULE_TITLES = {
  markets:   'Markets',
  portfolio: 'Portfolio',
  crypto:    'Crypto',
  fx:        'Rates',
  macro:     'Macro',
  watchlist: 'Watchlist',
  news:      'News',
  global:    'Global',
  screener:  'Screener',
}

// ── Keyboard shortcuts modal ──────────────────────────────────────────────────

const SHORTCUT_GROUPS = [
  {
    title: 'MODULES',
    items: [
      { keys: ['F1–F8'], desc: 'Switch module by position' },
      { keys: ['M'], desc: 'Markets' },
      { keys: ['C'], desc: 'Crypto' },
      { keys: ['F'], desc: 'Rates' },
      { keys: ['X'], desc: 'Macro' },
      { keys: ['G'], desc: 'Global intelligence' },
      { keys: ['W'], desc: 'Watchlist' },
      { keys: ['P'], desc: 'Portfolio' },
      { keys: ['N'], desc: 'News' },
    ],
  },
  {
    title: 'NAVIGATION & SEARCH',
    items: [
      { keys: ['/'], desc: 'Focus the command bar' },
      { keys: ['⌘', 'K'], desc: 'Focus the command bar (Mac)' },
      { keys: ['?'], desc: 'Show this shortcut reference' },
      { keys: ['Esc'], desc: 'Close modal / panel / shortcuts' },
    ],
  },
  {
    title: 'AI PANEL',
    items: [
      { keys: ['A'], desc: 'Toggle the AI panel' },
    ],
  },
]

function KeyBadge({ label }) {
  return (
    <kbd className="min-w-[26px] h-6 inline-flex items-center justify-center px-1.5 rounded border border-terminal-border bg-terminal-accent text-terminal-gold font-bold font-mono text-2xs shadow-[0_1px_0_rgba(0,0,0,0.4)]">
      {label}
    </kbd>
  )
}

function ShortcutModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-terminal-panel border border-terminal-border-gold p-6 w-[420px] max-w-[90vw] shadow-2xl font-mono"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">KEYBOARD SHORTCUTS</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>
        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-2xs text-terminal-text-dim/60 tracking-widest mb-2">{group.title}</div>
              <div className="space-y-2">
                {group.items.map((s) => (
                  <div key={s.desc} className="flex items-center gap-3 text-2xs">
                    <div className="flex items-center gap-1 min-w-[64px]">
                      {s.keys.map((k, i) => <KeyBadge key={i} label={k} />)}
                    </div>
                    <span className="text-terminal-text-dim">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Loading screen ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setProgress(p => Math.min(p + Math.random() * 15, 95)), 120)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="fixed inset-0 z-[100] bg-terminal-bg flex flex-col items-center justify-center gap-6 font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="text-terminal-gold text-4xl font-bold tracking-[0.3em]">▲ MADDEX</div>
        <div className="text-terminal-text-dim text-xs tracking-[0.5em]">FINANCIAL INTELLIGENCE</div>
      </div>
      <div className="w-48 h-0.5 bg-terminal-border overflow-hidden">
        <div className="h-full bg-terminal-gold transition-all duration-200" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-terminal-text-dim text-2xs tracking-widest animate-pulse">INITIALISING TERMINAL...</div>
    </div>
  )
}

// ── Terminal ──────────────────────────────────────────────────────────────────

const NEWS_SEEN_TS_KEY = 'madden_news_seen_ts'

function Terminal() {
  const { activeModule, setActiveModule, modalAsset, closeModal, chatOpen, setChatOpen, aiMode, setAiMode, setNewsBadgeCount, clearNewsBadge } = useStore()

  // Background news subscription — keeps the ['news'] query alive and enables nav badge
  const { data: bgNewsData } = useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
    staleTime: 3 * 60_000,
    refetchInterval: 3 * 60_000,
    select: (d) => d?.articles ?? [],
  })

  const lastSeenTsRef = useRef(parseInt(localStorage.getItem(NEWS_SEEN_TS_KEY) ?? '0'))

  useEffect(() => {
    if (!bgNewsData?.length) return
    if (activeModule === 'news') {
      clearNewsBadge()
      const maxTs = Math.max(...bgNewsData.map(a => new Date(a.pubDate).getTime()))
      const ts = isFinite(maxTs) ? maxTs : Date.now()
      localStorage.setItem(NEWS_SEEN_TS_KEY, String(ts))
      lastSeenTsRef.current = ts
    } else {
      const newCount = bgNewsData.filter(a => {
        const t = new Date(a.pubDate).getTime()
        return isFinite(t) && t > lastSeenTsRef.current
      }).length
      if (newCount > 0) setNewsBadgeCount(newCount)
    }
  }, [bgNewsData, activeModule, clearNewsBadge, setNewsBadgeCount])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const ActiveModule = MODULE_MAP[activeModule] || MarketsModule

  // Dynamic tab title — "Markets — Maddex" etc, falls back to the base title
  useEffect(() => {
    const label = MODULE_TITLES[activeModule]
    document.title = label ? `${label} — Maddex` : 'Maddex — Financial Intelligence'
  }, [activeModule])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable

      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return }
        if (modalAsset) { closeModal(); return }
        if (chatOpen) {
          // Fullscreen AI mode gets its own Escape stop — drop back to
          // sidebar first, only close the panel entirely on a second Escape.
          if (aiMode === 'fullscreen') setAiMode('sidebar')
          else setChatOpen(false)
        }
        return
      }

      if (isInput) return

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowShortcuts(v => !v)
        return
      }

      // Cmd/Ctrl+K is the Mac-familiar alias for focusing the command bar —
      // same target as plain "/".
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.querySelector('.cmd-input')?.focus()
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        document.querySelector('.cmd-input')?.focus()
        return
      }

      // Module navigation + AI panel toggle (no modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (e.key.toLowerCase() === 'a') {
          setChatOpen((v) => !v)
          return
        }
        const navMap = { m: 'markets', c: 'crypto', f: 'fx', n: 'news', g: 'global', p: 'portfolio', w: 'watchlist', x: 'macro' }
        const dest = navMap[e.key.toLowerCase()]
        if (dest) setActiveModule(dest)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalAsset, closeModal, chatOpen, setChatOpen, aiMode, setAiMode, showShortcuts, setActiveModule])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden font-mono bg-terminal-bg">
      <div className="fixed inset-0 scanlines pointer-events-none z-50" />
      <TopBar />
      <TickerTape />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <NavBar />
        <div key={activeModule} className="flex-1 min-w-0 overflow-hidden module-fade">
          <ActiveModule />
        </div>
        <AIPanel />
      </div>
      <CommandBar />
      <MobileNavBar />
      <DetailModal />
      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}

// ── App root ──────────────────────────────────────────────────────────────────

function AuthGate() {
  const { user, profile, loading, initialize, settings } = useAuthStore()
  const { setCurrency, setActiveModule } = useStore()
  const { isTrial, isTrialExpired } = useSubscription()
  const [appReady, setAppReady] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    initialize().then(() => {
      const t = setTimeout(() => setAppReady(true), 600)
      return () => clearTimeout(t)
    })
  }, [initialize])

  // Apply persisted settings when they load
  useEffect(() => {
    if (settings) {
      if (settings.currency) setCurrency(settings.currency)
      if (settings.default_module) setActiveModule(settings.default_module)
    }
  }, [settings, setCurrency, setActiveModule])

  if (loading || !appReady) return <LoadingScreen />
  // TEMPORARY dev-only bypass — `npm run dev` skips the Supabase sign-in gate
  // so the terminal can be exercised without a real account. import.meta.env.DEV
  // is false in `vite build`, so production is unaffected. Remove once no
  // longer needed for local testing.
  const isDev = import.meta.env.DEV
  if (!user && !isDev) return <AuthModal />
  if (profile && !profile.onboarding_complete && !onboardingDone) {
    return <OnboardingFlow onComplete={() => setOnboardingDone(true)} />
  }
  if (user && isTrial && isTrialExpired) return <TrialExpiredModal />
  return <Terminal />
}

export default function App() {
  if (window.location.search.includes('diag')) return <DiagPage />
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AuthGate />
      </StoreProvider>
    </QueryClientProvider>
  )
}
