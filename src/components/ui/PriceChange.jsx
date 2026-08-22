import { fmt } from '../../utils/format'

// Consistent price/percent-change formatting + colour + arrow, for every
// place the app shows a change value. Positive → green ▲, negative → red ▼,
// zero/null → dim ▶. Pass either `pct` (percentage) or `value` (absolute
// change) — or both, to show "▲ 2.15 (+1.23%)" in one line.
export default function PriceChange({ pct, value, showArrow = true, className = '', size = 'text-2xs' }) {
  const n = pct ?? value ?? null
  const isUp = n != null && n > 0
  const isDown = n != null && n < 0
  const color = isUp ? 'text-terminal-green' : isDown ? 'text-terminal-red' : 'text-terminal-muted'
  const arrow = isUp ? '▲' : isDown ? '▼' : '▶'

  const parts = []
  if (value != null) parts.push(fmt.change(value))
  if (pct != null) parts.push(value != null ? `(${fmt.pct(pct)})` : fmt.pct(pct))

  return (
    <span className={`inline-flex items-center gap-1 font-mono font-semibold ${size} ${color} ${className}`}>
      {showArrow && <span aria-hidden="true">{arrow}</span>}
      <span>{parts.length ? parts.join(' ') : '—'}</span>
    </span>
  )
}
