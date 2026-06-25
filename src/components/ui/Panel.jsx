export function Panel({ title, children, className = '', action }) {
  return (
    <div className={`panel flex flex-col min-h-0 ${className}`}>
      {title && (
        <div className="panel-header flex items-center justify-between flex-shrink-0">
          <span>{title}</span>
          {action && <span className="text-terminal-text-dim">{action}</span>}
        </div>
      )}
      <div className="flex-1 overflow-auto min-h-0">{children}</div>
    </div>
  )
}

export function StatBox({ label, value, sub, color }) {
  return (
    <div className="border border-terminal-border bg-terminal-bg p-2">
      <div className="text-2xs text-terminal-text-dim uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-semibold ${color || 'text-terminal-text-bright'}`}>{value}</div>
      {sub && <div className="text-2xs text-terminal-text-dim mt-0.5">{sub}</div>}
    </div>
  )
}

export function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-terminal-border text-terminal-text-dim',
    gold: 'bg-terminal-gold/20 text-terminal-gold border border-terminal-gold/40',
    green: 'bg-terminal-green-dim/30 text-terminal-green border border-terminal-green-dim',
    red: 'bg-terminal-red-dim/30 text-terminal-red border border-terminal-red-dim',
    blue: 'bg-terminal-blue/30 text-terminal-blue-bright border border-terminal-blue',
  }
  return (
    <span className={`inline-block px-1 py-0 text-2xs font-semibold tracking-wider ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function Divider() {
  return <div className="border-b border-terminal-border" />
}
