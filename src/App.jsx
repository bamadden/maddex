import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, useCallback, useSyncExternalStore, lazy, Suspense } from 'react'
import { workspaceService } from './services/workspaceService'
import { WorkspaceRenderer } from './components/layout/WorkspaceRenderer'
import { StoreProvider, useStore } from './store/useStore'
import { useAuthStore } from './store/useAuthStore'
import { fetchNews } from './services/api'
import DiagPage from './DiagPage'
import AppLoader from './components/ui/AppLoader'
import SharedWatchlistPage from './pages/SharedWatchlistPage'
import SharedResearchNotePage from './pages/SharedResearchNotePage'
import NotFoundPage from './pages/NotFoundPage'
import OnboardingTour from './components/onboarding/OnboardingFlow'
import WhatsNewModal from './components/onboarding/WhatsNewModal'
import TopBar from './components/layout/TopBar'
import NavBar, { MobileNavBar } from './components/layout/NavBar'
import TickerTape from './components/layout/TickerTape'
import CommandBar from './components/layout/CommandBar'
import AIPanel from './components/layout/AIPanel'
import DetailModal from './components/ui/DetailModal'
import ComparisonView from './components/markets/ComparisonView'
import MarketsModule from './modules/markets/MarketsModule'
import PortfolioModule from './modules/portfolio/PortfolioModule'
import CryptoModule from './modules/crypto/CryptoModule'
import FXModule from './modules/fx/FXModule'
import MacroModule from './modules/macro/MacroModule'
import WatchlistModule from './modules/watchlist/WatchlistModule'
import NewsModule from './modules/news/NewsModule'
// d3 + topojson-heavy — code-split out of the main bundle.
const GlobalModule = lazy(() => import('./modules/global/GlobalModule'))
import ScreenerModule from './modules/screener/ScreenerModule'
import MorningBriefModule from './modules/brief/MorningBriefModule'
import MarketReplayModule from './modules/replay/MarketReplayModule'
import MarketScannerModule from './modules/scanner/MarketScannerModule'
import { FloatingWindow } from './components/ui/FloatingWindow'
import CorrelationExplorer from './modules/markets/CorrelationExplorer'
import ErrorBoundary from './components/ui/ErrorBoundary'
import AuthModal from './components/auth/AuthModal'
import OnboardingFlow from './components/auth/OnboardingFlow'
import TrialExpiredModal from './components/auth/TrialExpiredModal'
import { useSubscription } from './hooks/useSubscription'
import { useTheme } from './hooks/useTheme'
import { useLayoutMode } from './hooks/useLayoutMode'

// Fallback while a lazy-loaded module chunk (currently just GlobalModule)
// is still downloading — brief, so this stays minimal rather than
// reusing the full AppLoader treatment.
function ModuleSuspenseFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="text-terminal-text-dim text-2xs tracking-widest animate-pulse font-mono">LOADING MODULE...</span>
    </div>
  )
}

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
  brief:     MorningBriefModule,
  replay:    MarketReplayModule,
  scanner:   MarketScannerModule,
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
  brief:     'Morning Brief',
  replay:    'Market Replay',
  scanner:   'Market Scanner',
}

// ── Keyboard shortcuts modal ──────────────────────────────────────────────────

const SHORTCUT_GROUPS = [
  {
    title: 'NAVIGATION',
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
    title: 'INTERFACE',
    items: [
      { keys: ['/'], desc: 'Focus the command bar' },
      { keys: ['?'], desc: 'Show this shortcut reference' },
      { keys: ['Esc'], desc: 'Close modal / panel / shortcuts' },
      { keys: ['A'], desc: 'Toggle the AI panel' },
      { keys: ['R'], desc: 'Refresh all live data' },
      { keys: ['Space'], desc: 'Pause / resume the ticker tape' },
    ],
  },
  {
    title: 'CHARTS',
    items: [
      { keys: ['Scroll'], desc: 'Zoom in / out' },
      { keys: ['Drag'], desc: 'Pan across history' },
      { keys: ['Dbl-click'], desc: 'Reset zoom' },
    ],
  },
  {
    title: 'MODULES',
    items: [
      { keys: ['⌘', 'K'], desc: 'Focus the command bar' },
      { keys: ['⌘', 'F'], desc: 'Focus the command bar (alt)' },
      { keys: ['⊡'], desc: 'Pop out into a floating window' },
      { keys: ['⤢'], desc: 'Toggle fullscreen' },
    ],
  },
]

function KeyBadge({ label }) {
  return (
    <kbd className="key-badge min-w-[26px] h-6 inline-flex items-center justify-center px-1.5 text-terminal-gold font-bold font-mono text-2xs shadow-[0_1px_0_rgba(0,0,0,0.4)]">
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
                {group.items.map((s, si) => (
                  <div key={si} className="flex items-center gap-3 text-2xs">
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

// ── Terminal ──────────────────────────────────────────────────────────────────

const NEWS_SEEN_TS_KEY = 'madden_news_seen_ts'
const ONBOARDING_KEY = 'maddex_onboarding_complete'
const WHATS_NEW_SHOWN_KEY = 'maddex_whatsnew_last_shown'
const WHATS_NEW_INTERVAL_MS = 7 * 24 * 60 * 60_000

function Terminal() {
  const { activeModule, setActiveModule, modalAsset, closeModal, chatOpen, setChatOpen, aiMode, setAiMode, setNewsBadgeCount, clearNewsBadge } = useStore()
  const [showTour, setShowTour] = useState(() => {
    try { return !localStorage.getItem(ONBOARDING_KEY) } catch { return false }
  })
  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    if (showTour) return false // first-time users get the tour, not both at once
    try {
      const last = parseInt(localStorage.getItem(WHATS_NEW_SHOWN_KEY) ?? '0', 10)
      return Date.now() - last > WHATS_NEW_INTERVAL_MS
    } catch { return false }
  })
  const completeTour = () => {
    try { localStorage.setItem(ONBOARDING_KEY, 'true') } catch { /* best-effort */ }
    setShowTour(false)
  }
  const dismissWhatsNew = () => {
    try { localStorage.setItem(WHATS_NEW_SHOWN_KEY, String(Date.now())) } catch { /* best-effort */ }
    setShowWhatsNew(false)
  }
  // Applies the persisted theme (or default) to :root on mount — independent
  // of whether the Settings panel (where the switcher lives) is open.
  useTheme()
  const { layout } = useLayoutMode()
  const [splitModuleId, setSplitModuleId] = useState('crypto')
  const SplitModule = MODULE_MAP[splitModuleId] || CryptoModule

  // Custom multi-panel workspaces (see workspaceService.js / WorkspaceSwitcher).
  // 'single' is the default one-module workspace — the existing single/split
  // render path below still owns that case, so only a genuinely custom
  // multi-panel workspace takes over the main content area.
  useSyncExternalStore(
    useCallback((cb) => workspaceService.subscribe(cb), []),
    useCallback(() => `${workspaceService.active}::${JSON.stringify(workspaceService.getActive())}`, []),
  )
  const activeWorkspace = workspaceService.getActive()
  const isCustomWorkspace = activeWorkspace.layout !== 'single'

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

  // ── Multi-window mode — any module's ModuleHeader can pop itself out via
  // its "⊡" button, which dispatches this event rather than needing direct
  // prop-drilled access to floatingWindows state from nine module files.
  const [floatingWindows, setFloatingWindows] = useState([])
  const [topZ, setTopZ] = useState(1000)

  const openFloating = useCallback((moduleId, title) => {
    setFloatingWindows((prev) => {
      // Re-focus rather than duplicate if this module is already popped out.
      if (prev.some((w) => w.moduleId === moduleId)) return prev
      return [...prev, {
        id: Date.now(), moduleId, title,
        pos: { x: 120 + prev.length * 28, y: 90 + prev.length * 28 },
      }]
    })
  }, [])

  const closeFloating = useCallback((id) => {
    setFloatingWindows((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const bringToFront = useCallback((id) => {
    setTopZ((z) => z + 1)
    setFloatingWindows((prev) => prev.map((w) => w.id === id ? { ...w, z: topZ + 1 } : w))
  }, [topZ])

  useEffect(() => {
    const handler = (e) => {
      const { moduleId, title } = e.detail ?? {}
      if (moduleId) openFloating(moduleId, title ?? MODULE_TITLES[moduleId] ?? moduleId)
    }
    window.addEventListener('madden:pop-out', handler)
    return () => window.removeEventListener('madden:pop-out', handler)
  }, [openFloating])

  // Correlation Explorer — a global full-page overlay openable from the
  // Markets Correlation sub-tab, the command bar ("correlate BHP AUD"), or
  // a stock detail panel's Correlations section, all via this one event
  // rather than each entry point needing its own copy of the modal.
  const [correlationAssets, setCorrelationAssets] = useState(null)
  useEffect(() => {
    const handler = (e) => setCorrelationAssets(e.detail?.assets ?? [])
    window.addEventListener('madden:open-correlation', handler)
    return () => window.removeEventListener('madden:open-correlation', handler)
  }, [])

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
          return
        }
        // Nothing else to dismiss — if the command bar has focus, blur it so
        // the single-letter module shortcuts below work again. The command
        // bar auto-retains focus, so without this Escape-to-blur, "M/C/F/..."
        // just gets typed into the command input instead of switching modules.
        if (document.activeElement?.classList?.contains('cmd-input')) {
          document.activeElement.blur()
        }
        return
      }

      if (isInput) return

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowShortcuts(v => !v)
        return
      }

      // Cmd/Ctrl+K and Cmd/Ctrl+F are both Mac-familiar aliases for focusing
      // the command bar — same target as plain "/".
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault()
        document.querySelector('.cmd-input')?.focus()
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        document.querySelector('.cmd-input')?.focus()
        return
      }

      // Module navigation + interface toggles (no modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (e.key.toLowerCase() === 'a') {
          setChatOpen((v) => !v)
          return
        }
        if (e.key.toLowerCase() === 'r') {
          queryClient.invalidateQueries()
          return
        }
        if (e.key === ' ') {
          e.preventDefault()
          document.body.classList.toggle('ticker-paused')
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
        {layout !== 'focus' && <NavBar />}
        {isCustomWorkspace ? (
          <div key={activeWorkspace.id} className="flex-1 min-w-0 overflow-hidden module-fade">
            <WorkspaceRenderer workspace={activeWorkspace} />
          </div>
        ) : layout === 'split' ? (
          <div className="flex flex-1 min-w-0 overflow-hidden">
            <div key={activeModule} className="flex-1 min-w-0 w-1/2 overflow-hidden border-r border-terminal-border module-fade">
              <ErrorBoundary label={MODULE_TITLES[activeModule]}>
                <Suspense fallback={<ModuleSuspenseFallback />}>
                  <ActiveModule />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div className="flex-1 min-w-0 w-1/2 overflow-hidden flex flex-col">
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-terminal-border bg-terminal-surface">
                <span className="text-2xs text-terminal-text-dim tracking-widest">SPLIT PANE:</span>
                <select
                  value={splitModuleId}
                  onChange={(e) => setSplitModuleId(e.target.value)}
                  className="bg-terminal-bg border border-terminal-border px-2 py-0.5 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
                >
                  {Object.entries(MODULE_TITLES).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
              <div key={splitModuleId} className="flex-1 min-h-0 overflow-hidden module-fade">
                <ErrorBoundary label={MODULE_TITLES[splitModuleId]}>
                  <Suspense fallback={<ModuleSuspenseFallback />}>
                    <SplitModule />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </div>
        ) : (
          <div key={activeModule} className="flex-1 min-w-0 overflow-hidden module-fade">
            <ErrorBoundary label={MODULE_TITLES[activeModule]}>
              <Suspense fallback={<ModuleSuspenseFallback />}>
                <ActiveModule />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
        {layout !== 'focus' && layout !== 'split' && <AIPanel wide={layout === 'research'} />}
      </div>
      <CommandBar />
      <MobileNavBar />
      <DetailModal />
      <ComparisonView />
      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}
      {correlationAssets && (
        <CorrelationExplorer initialAssets={correlationAssets} onClose={() => setCorrelationAssets(null)} />
      )}
      {floatingWindows.map((w) => {
        const FloatingContent = MODULE_MAP[w.moduleId] || MarketsModule
        return (
          <FloatingWindow
            key={w.id}
            title={w.title}
            defaultPos={w.pos}
            zIndex={w.z ?? 1000}
            onFocus={() => bringToFront(w.id)}
            onClose={() => closeFloating(w.id)}
          >
            <ErrorBoundary label={w.title}>
              <Suspense fallback={<ModuleSuspenseFallback />}>
                <FloatingContent />
              </Suspense>
            </ErrorBoundary>
          </FloatingWindow>
        )
      })}
      {showTour && <OnboardingTour onComplete={completeTour} />}
      {showWhatsNew && (
        <WhatsNewModal
          onDismiss={dismissWhatsNew}
          onShowMe={() => { dismissWhatsNew(); setActiveModule('scanner') }}
        />
      )}
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

  if (loading || !appReady) return <AppLoader />
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
  const watchlistShare = window.location.pathname.match(/^\/watchlist\/share\/([a-z0-9]+)$/i)
  if (watchlistShare) return <SharedWatchlistPage id={watchlistShare[1]} />
  const researchShare = window.location.pathname.match(/^\/research\/share\/([a-z0-9]+)$/i)
  if (researchShare) return <SharedResearchNotePage id={researchShare[1]} />
  if (window.location.pathname !== '/') return <NotFoundPage />
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AuthGate />
      </StoreProvider>
    </QueryClientProvider>
  )
}
