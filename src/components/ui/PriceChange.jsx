import { fmt, changeTone } from '../../utils/format'

// Consistent price/percent-change formatting + colour + arrow, for every
// place the app shows a change value. Positive → green ▲, negative → red ▼,
// zero/null → dim ▶. Pass either `pct` (percentage) or `value` (absolute
// change) — or both, to show "▲ 2.15 (+1.23%)" in one line.
//
// `pill` wraps the value in a tinted background rather than colouring the
// text alone. A change is the thing the eye hunts for on a dense board, and
// a filled chip is findable in peripheral vision in a way bare text is not.
// `graded` opts into the four-level tone scale, where a move under 2% gets a
// quieter shade than one over it. Off by default so existing call sites keep
// their current two-level appearance until they choose otherwise.
export default function PriceChange({ pct, value, showArrow = true, className = '', size = 'text-2xs', pill = false, graded = false }) {
  const n = pct ?? value ?? null
  const isUp = n != null && n > 0
  const isDown = n != null && n < 0
  const color = graded
    ? changeTone(n)
    : isUp ? 'text-terminal-green' : isDown ? 'text-terminal-red' : 'text-terminal-muted'
  const arrow = isUp ? '▲' : isDown ? '▼' : '▶'

  const parts = []
  if (value != null) parts.push(fmt.change(value))
  if (pct != null) parts.push(value != null ? `(${fmt.pct(pct)})` : fmt.pct(pct))

  // Tints are deliberately low-alpha: they must read as a chip behind the
  // number, never as a solid badge competing with the value itself.
  const pillStyle = pill
    ? {
        backgroundColor: isUp
          ? 'rgba(45,138,80,0.15)'
          : isDown
            ? 'rgba(168,50,50,0.15)'
            : 'rgba(99,120,153,0.12)',
        borderRadius: 2,
        padding: '1px 5px',
      }
    : undefined

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-semibold ${size} ${color} ${className}`}
      style={pillStyle}
    >
      {showArrow && <span aria-hidden="true">{arrow}</span>}
      <span>{parts.length ? parts.join(' ') : '—'}</span>
    </span>
  )
}
