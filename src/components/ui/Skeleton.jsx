// Shimmer loading placeholders — content-shaped rather than a generic
// spinner, so the layout doesn't jump when real data arrives. Built on the
// existing `.skeleton` CSS class (index.css) — same shimmer gradient/timing
// ModuleLoader already uses; these add specific shapes (a coin row, an
// index-bar cell, a news row) for modules that want a closer approximation
// of their real content than ModuleLoader's generic row-shaped skeleton.

export function Skeleton({ width = '100%', height = 12, className = '', style = {} }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, ...style }}
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '65%' : '100%'} height={12} />
      ))}
    </div>
  )
}

export function SkeletonCard({ rows = 4, className = '' }) {
  return (
    <div className={`bg-terminal-panel border border-terminal-border-gold/20 rounded-[4px] p-4 flex flex-col gap-2.5 ${className}`}>
      <Skeleton width="40%" height={10} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between gap-3">
          <Skeleton width="30%" height={11} />
          <Skeleton width="20%" height={11} />
          <Skeleton width="15%" height={11} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonIndexBar({ count = 10 }) {
  return (
    <div className="flex">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-1 px-3 py-2 border-r border-terminal-border-gold/10">
          <Skeleton width="60%" height={9} className="mb-1.5" />
          <Skeleton width="80%" height={14} className="mb-1" />
          <Skeleton width="50%" height={9} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonNewsCard() {
  return (
    <div className="flex items-center gap-2.5 py-3 border-b border-terminal-border-gold/10">
      <Skeleton width={8} height={8} className="rounded-full flex-shrink-0" />
      <Skeleton width="12%" height={9} />
      <Skeleton width="55%" height={11} />
      <Skeleton width="8%" height={9} className="ml-auto" />
    </div>
  )
}

export function SkeletonCoinRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-terminal-border-gold/5">
      <Skeleton width={28} height={28} className="rounded-full flex-shrink-0" />
      <div className="w-20">
        <Skeleton width="70%" height={11} className="mb-1" />
        <Skeleton width="50%" height={9} />
      </div>
      <Skeleton width={70} height={13} className="ml-auto" />
      <Skeleton width={55} height={11} />
      <Skeleton width={55} height={11} />
    </div>
  )
}
