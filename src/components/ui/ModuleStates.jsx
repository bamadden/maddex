// Shared full-module loading/error states — used by any module while its
// primary dataset is fetching for the first time, or has failed with nothing
// to show. Nested per-widget spinners inside a module (a single chart, a
// single tile) should keep their own compact indicators; these are for the
// "the whole module has nothing to render yet" case.

function timeAgoShort(ts) {
  if (!ts) return null
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// Generic row-shaped shimmer skeleton — stands in for whatever's about to
// load (most of this app's "whole module empty" cases are eventually a
// table or a list), rather than a spinner with no relationship to the
// content's actual shape.
export function ModuleLoader({ name, className = '' }) {
  return (
    <div className={`h-full flex flex-col p-4 gap-3 ${className}`}>
      {name && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-terminal-gold text-2xs font-bold tracking-[0.25em]">{name}</span>
          <span className="text-terminal-text-dim text-2xs tracking-widest animate-pulse">FETCHING LIVE DATA...</span>
        </div>
      )}
      <div className="skeleton h-6 w-1/3" />
      <div className="flex flex-col gap-2 flex-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-full" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  )
}

// Fallback for React.lazy()-loaded 3D visualisations (three.js/@react-three
// bundles are large enough to be worth code-splitting out of the main
// bundle) — fills the same absolute-positioned canvas area the real
// component will occupy once its chunk arrives.
export function Viz3DLoader() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3">
      <div className="skeleton w-2/3 h-2/3 rounded" />
      <span className="text-terminal-text-dim text-2xs tracking-widest animate-pulse">LOADING 3D VIEW...</span>
    </div>
  )
}

// Small inline indicator for data served from dataService.js's stale-cache
// fallback — used instead of a blank panel or a bare RETRY button whenever
// *some* data (even if old) is available. `cachedAt` is the ms-epoch
// timestamp dataService captured that copy at.
export function StaleBadge({ cachedAt, className = '' }) {
  const age = timeAgoShort(cachedAt)
  return (
    <span
      title={age ? `Showing cached data from ${age}` : 'Showing cached data'}
      className={`inline-flex items-center gap-1 text-2xs text-terminal-gold/80 border border-terminal-gold/30 px-1 py-0 ${className}`}
    >
      ● DELAYED{age ? ` · ${age}` : ''}
    </span>
  )
}

// Shown instead of the "● LIVE" indicator whenever USING_MOCK_DATA (api.js)
// is true — i.e. no working equities key is configured. Calling data "LIVE"
// while it's actually mockData.js would be a lie; this replaces that claim
// rather than just decorating alongside it.
export function DemoBadge({ className = '' }) {
  return (
    <span
      title="No live equities API key configured — showing realistic demo data until one is added"
      className={`inline-flex items-center gap-1 rounded-full bg-terminal-gold/15 border border-terminal-gold/40 px-2 py-0.5 text-2xs text-terminal-gold whitespace-nowrap normal-case ${className}`}
    >
      ● DEMO <span className="text-terminal-gold/70">Live data connects on API setup</span>
    </span>
  )
}

export function ModuleError({ module = 'MODULE', lastUpdated, onRetry, className = '' }) {
  const lastSeen = timeAgoShort(lastUpdated)
  return (
    <div className={`h-full flex flex-col items-center justify-center gap-2 px-6 text-center ${className}`}>
      <span className="text-terminal-red text-xl">⚠</span>
      <div className="text-terminal-red text-2xs font-bold tracking-widest">DATA TEMPORARILY UNAVAILABLE</div>
      <div className="text-terminal-text-dim text-2xs">{module} couldn't be refreshed right now.</div>
      {lastSeen && (
        <div className="text-terminal-text-dim/60 text-2xs">Showing last known data from {lastSeen}</div>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 text-2xs text-terminal-gold border border-terminal-gold px-3 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >
          RETRY
        </button>
      )}
    </div>
  )
}
