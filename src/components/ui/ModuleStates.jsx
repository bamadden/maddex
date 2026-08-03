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

export function ModuleLoader({ name, className = '' }) {
  return (
    <div className={`h-full flex flex-col items-center justify-center gap-3 ${className}`}>
      {name && <div className="text-terminal-gold text-sm font-bold tracking-[0.25em]">{name}</div>}
      <div className="relative w-40 h-0.5 bg-terminal-border/50 overflow-hidden">
        <div className="absolute inset-y-0 w-1/3 bg-terminal-gold module-loader-scan" />
      </div>
      <div className="text-terminal-text-dim text-2xs tracking-widest animate-pulse">FETCHING LIVE DATA...</div>
    </div>
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
