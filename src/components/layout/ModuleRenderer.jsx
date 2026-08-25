import { lazy, Suspense } from 'react'
import ErrorBoundary from '../ui/ErrorBoundary'
import { WORKSPACE_MODULE_LIST } from '../../config/workspaceModules'

// Lazily-loaded so a workspace panel only pulls in the modules it actually
// displays. Keys mirror App.jsx's MODULE_MAP — the set of modules that are
// independently routable outside the fixed left-nav (AI panel is a global
// singleton, not included here — see workspaceService.js).
const MODULES = {
  markets:   lazy(() => import('../../modules/markets/MarketsModule')),
  portfolio: lazy(() => import('../../modules/portfolio/PortfolioModule')),
  crypto:    lazy(() => import('../../modules/crypto/CryptoModule')),
  fx:        lazy(() => import('../../modules/fx/FXModule')),
  macro:     lazy(() => import('../../modules/macro/MacroModule')),
  watchlist: lazy(() => import('../../modules/watchlist/WatchlistModule')),
  news:      lazy(() => import('../../modules/news/NewsModule')),
  global:    lazy(() => import('../../modules/global/GlobalModule')),
  screener:  lazy(() => import('../../modules/screener/ScreenerModule')),
  brief:     lazy(() => import('../../modules/brief/MorningBriefModule')),
  replay:    lazy(() => import('../../modules/replay/MarketReplayModule')),
  scanner:   lazy(() => import('../../modules/scanner/MarketScannerModule')),
}

function ModuleFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="text-terminal-text-dim text-2xs tracking-widest animate-pulse font-mono">LOADING MODULE...</span>
    </div>
  )
}

export default function ModuleRenderer({ module }) {
  const Module = MODULES[module] || MODULES.markets
  return (
    <ErrorBoundary label={WORKSPACE_MODULE_LIST.find((m) => m.id === module)?.label ?? module}>
      <Suspense fallback={<ModuleFallback />}>
        <Module />
      </Suspense>
    </ErrorBoundary>
  )
}
