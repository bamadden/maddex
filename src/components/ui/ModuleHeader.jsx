function timeAgoShort(ts) {
  if (!ts) return null
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

// Page-level header for each top-level module (Markets, Crypto, Rates, ...).
// Distinct from the smaller `.panel-header` class used on sub-panels within
// a module — this is the one identity banner per module, always in the same
// place with the same shape, so switching modules feels consistent.
export default function ModuleHeader({ title, subtitle, lastUpdated, onRefresh, isFetching = false, right = null }) {
  return (
    <div className="flex-shrink-0 border-b border-terminal-border relative">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="min-w-0">
          <div className="text-terminal-gold font-mono font-bold text-sm tracking-wider uppercase truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-terminal-text-dim text-2xs truncate">{subtitle}</div>
          )}
        </div>
        <div className="flex-1" />
        {right}
        {(lastUpdated || onRefresh) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {isFetching ? (
              <span className="text-terminal-text-dim text-2xs animate-pulse">REFRESHING...</span>
            ) : lastUpdated ? (
              <span className="text-terminal-text-dim text-2xs">Updated {timeAgoShort(lastUpdated)}</span>
            ) : null}
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh"
                className="text-terminal-text-dim hover:text-terminal-gold transition-colors text-2xs px-1.5 py-0.5 border border-terminal-border hover:border-terminal-gold/50"
              >
                ⟳
              </button>
            )}
          </div>
        )}
      </div>
      {/* Gold gradient underline, fading to transparent */}
      <div
        className="absolute bottom-0 left-0 h-px w-full"
        style={{ background: 'linear-gradient(90deg, rgba(200,168,75,0.7), rgba(200,168,75,0))' }}
      />
    </div>
  )
}
