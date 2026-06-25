export function Skeleton({ className = '', lines = 1 }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-terminal-border/40 rounded-none h-3"
          style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full">
      {/* Header row */}
      <div className="flex gap-2 px-2 py-1 border-b border-terminal-border mb-1">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-terminal-border/60 h-2.5 flex-1"
            style={{ maxWidth: i === 0 ? '60px' : undefined }}
          />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2 px-2 py-1.5 border-b border-terminal-border/30">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="animate-pulse bg-terminal-border/40 h-2.5 flex-1"
              style={{
                opacity: 1 - r * 0.12,
                maxWidth: c === 0 ? '60px' : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
