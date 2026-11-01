import { DATA_CLASSES, badgeText, openDataLegend } from '../../utils/dataClass'

// The one data badge: class · source · time (utils/dataClass). Clicking it
// opens the legend that defines the four classes (DataLegend, mounted once in
// the app shell).
export default function DataBadge({ cls, source, at, compact = false, className = '' }) {
  const def = DATA_CLASSES[cls] ?? DATA_CLASSES.LIVE
  const text = compact ? cls : badgeText({ cls, source, at })
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openDataLegend() }}
      data-class={cls}
      title={`${badgeText({ cls, source, at })}\n${def.meaning}\nClick for the data key.`}
      className={`inline-flex items-center gap-1 font-mono font-semibold tracking-wider whitespace-nowrap normal-case px-1.5 py-px rounded-sm ${className}`}
      style={{ fontSize: 10, color: def.colour, border: `1px solid ${def.colour}66`, background: `${def.colour}14`, lineHeight: 1.4 }}
    >
      <span aria-hidden="true">●</span>{text}
    </button>
  )
}
