import { lazy, Suspense } from 'react'
import { dashboardService } from '../../services/dashboardService'

// Widget router. Every widget is code-split: a dashboard shows five of
// fifteen, and loading the other ten costs a slower first paint for content
// nobody asked for.
const WIDGET_COMPONENTS = {
  'portfolio-snapshot':    lazy(() => import('./widgets/PortfolioSnapshotWidget')),
  'market-score':          lazy(() => import('./widgets/MarketScoreWidget')),
  'next-event':            lazy(() => import('./widgets/NextEventWidget')),
  'index-bar':             lazy(() => import('./widgets/IndexBarWidget')),
  'watchlist-preview':     lazy(() => import('./widgets/WatchlistPreviewWidget')),
  'sector-breadth':        lazy(() => import('./widgets/SectorBreadthWidget')),
  'news-feed':             lazy(() => import('./widgets/NewsFeedWidget')),
  'calendar-events':       lazy(() => import('./widgets/CalendarEventsWidget')),
  'quick-actions':         lazy(() => import('./widgets/QuickActionsWidget')),
  'activity-feed':         lazy(() => import('./widgets/ActivityFeedWidget')),
  'fx-rates':              lazy(() => import('./widgets/FXRatesWidget')),
  'crypto-overview':       lazy(() => import('./widgets/CryptoOverviewWidget')),
  'rba-status':            lazy(() => import('./widgets/RBAStatusWidget')),
  'commodity-pulse':       lazy(() => import('./widgets/CommodityWidget')),
  'morning-brief-preview': lazy(() => import('./widgets/MorningBriefWidget')),
}

// Staggered so a six-widget dashboard does not shimmer in lockstep, which
// reads as one broken screen rather than six things loading.
function WidgetSkeleton({ index = 0 }) {
  return (
    <div className="h-full w-full p-4 flex flex-col gap-2" style={{ animationDelay: `${(index % 6) * 60}ms` }}>
      <div className="skeleton-line" style={{ height: 8, width: '38%' }} />
      <div className="skeleton-line" style={{ height: 22, width: '62%', marginTop: 6 }} />
      <div className="skeleton-line" style={{ height: 8, width: '85%' }} />
      <div className="skeleton-line" style={{ height: 8, width: '70%' }} />
    </div>
  )
}

function UnknownWidget({ id }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4 text-center">
      <span className="font-mono text-[9px] tracking-widest" style={{ color: '#4A6080' }}>
        UNKNOWN WIDGET
        <br />
        <span style={{ color: '#3A4A61' }}>{id}</span>
      </span>
    </div>
  )
}

export default function WidgetContent({ widgetId, index = 0 }) {
  const Component = WIDGET_COMPONENTS[widgetId]
  if (!Component) return <UnknownWidget id={widgetId} />

  const meta = dashboardService.getWidget(widgetId)

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      {/* Widget header — names the tile without the module chrome a card
          would bring. 20px so it reads as a label, not a title bar. */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ height: 20, padding: '0 16px', borderBottom: '1px solid rgba(201,168,76,0.06)' }}
      >
        <span
          className="font-mono uppercase truncate"
          style={{ fontSize: 8, letterSpacing: '0.18em', color: '#C9A84C' }}
        >
          {meta?.name ?? widgetId}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<WidgetSkeleton index={index} />}>
          <Component />
        </Suspense>
      </div>
    </div>
  )
}
