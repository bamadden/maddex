// Shared furniture for dashboard widgets.
//
// Every widget fills its cell, pads to 16px, and never scrolls internally —
// a scrollbar inside a 160px tile inside a scrolling grid is two scroll
// contexts fighting over one wheel event. Widgets that could overflow show
// fewer rows instead.

export function WidgetBody({ children, className = '' }) {
  return (
    <div className={`h-full w-full overflow-hidden flex flex-col ${className}`} style={{ padding: 16 }}>
      {children}
    </div>
  )
}

export function WidgetEmpty({ children, action, onAction }) {
  return (
    <WidgetBody className="items-center justify-center text-center">
      <span className="font-sans text-[11px]" style={{ color: '#4A6080' }}>{children}</span>
      {action && (
        <button
          onClick={onAction}
          className="mt-2 font-mono text-[9px] tracking-widest transition-colors"
          style={{ color: '#C9A84C' }}
        >
          {action} →
        </button>
      )}
    </WidgetBody>
  )
}

// A number that is the point of the widget. One per tile at most — two
// competing 22px figures is a tile with no answer on it.
export function WidgetFigure({ value, sub, tone }) {
  return (
    <div className="min-w-0">
      <div
        className="font-mono tabular-nums truncate"
        style={{ fontSize: 22, lineHeight: 1.15, color: tone ?? '#E8EDF5' }}
      >
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[9px] mt-0.5 truncate" style={{ color: '#4A6080', letterSpacing: '0.08em' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function WidgetRows({ children }) {
  return <div className="flex-1 min-h-0 flex flex-col justify-center gap-1.5">{children}</div>
}

export function WidgetRow({ label, value, change, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`flex items-center justify-between gap-2 w-full ${onClick ? 'hover:opacity-80 transition-opacity' : ''}`}
    >
      <span className="font-mono text-[10px] truncate min-w-0" style={{ color: '#8BA3C4' }}>{label}</span>
      <span className="flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-[10px] tabular-nums" style={{ color: '#E8EDF5' }}>{value}</span>
        {change != null && (
          <span
            className="font-mono text-[9px] tabular-nums text-right"
            style={{ width: 46, color: change >= 0 ? '#2D8A50' : '#A83232' }}
          >
            {change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
          </span>
        )}
      </span>
    </Tag>
  )
}
