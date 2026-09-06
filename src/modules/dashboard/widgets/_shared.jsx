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

// A small line, no axes, no labels — it exists to show shape, not values.
//
// Draws nothing at all with fewer than two points. A one-point "line" is a
// flat segment, which reads as "unchanged" rather than "no data yet", and the
// difference matters when the series is a portfolio balance.
export function Sparkline({ values, tone = '#8BA3C4', width = 76, height = 20 }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={points.join(' ')} fill="none" stroke={tone} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      {/* Latest point marked, so the eye knows which end is now. */}
      <circle cx={(width).toFixed(1)} cy={points[points.length - 1].split(',')[1]} r={1.75} fill={tone} />
    </svg>
  )
}

// A change stated as a pill rather than as text.
//
// The day's P&L and the total P&L are different claims and were previously
// rendered identically, one under the other, in the same dim grey. Giving the
// day figure a coloured chip separates "what happened today" from "what this
// position has done since you bought it" at a glance.
export function ChangePill({ value, suffix = '', positiveIsGood = true }) {
  if (value == null || !Number.isFinite(value)) return null
  const good = positiveIsGood ? value >= 0 : value < 0
  const colour = good ? '#2D8A50' : '#A83232'
  return (
    <span
      className="font-mono tabular-nums flex-shrink-0"
      style={{
        fontSize: 9, color: colour, background: `${colour}1F`,
        border: `1px solid ${colour}55`, borderRadius: 2, padding: '1px 5px',
      }}
    >
      {value >= 0 ? '▲' : '▼'} {Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}{suffix}
    </span>
  )
}
