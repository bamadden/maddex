// Shared "premium empty state" — icon circle, title, subtitle, optional CTA.
// Several modules (Watchlist, Portfolio, Screener) already hand-roll this
// exact shape locally; this is the reusable version for anything new, not
// a forced retrofit of those already-working ones.
export function EmptyState({ icon, title, subtitle, action, actionLabel, className = '' }) {
  return (
    <div className={`h-full min-h-[200px] flex flex-col items-center justify-center gap-2 px-8 text-center ${className}`}>
      <div className="w-14 h-14 rounded-full bg-terminal-gold/[0.08] border border-terminal-gold/20 flex items-center justify-center text-2xl mb-1">
        {icon}
      </div>
      <div className="text-terminal-text-bright text-xs font-semibold tracking-widest uppercase">{title}</div>
      {subtitle && (
        <div className="text-terminal-text-dim text-2xs leading-relaxed max-w-[280px]">{subtitle}</div>
      )}
      {action && (
        <button
          onClick={action}
          className="mt-3 text-2xs font-bold tracking-wide text-terminal-bg bg-terminal-gold px-5 py-2 hover:bg-terminal-gold-bright transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default EmptyState
