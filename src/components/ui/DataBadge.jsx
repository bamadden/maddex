import { DATA_CLASSES, badgeText, openDataLegend } from '../../utils/dataClass'

// The one data badge: class · source · time (utils/dataClass). Clicking it
// opens the legend that defines the four classes (DataLegend, mounted once in
// the app shell).
export default function DataBadge({ cls, source, at, compact = false, className = '' }) {
  const def = DATA_CLASSES[cls] ?? DATA_CLASSES.LIVE
  const full = badgeText({ cls, source, at })
  // Phones show the class alone (source and time stay in the tooltip); the
  // full line pushed into module titles at 390px.
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openDataLegend() }}
      data-class={cls}
      title={`${full}\n${def.meaning}\nClick for the data key.`}
      className={`inline-flex items-center gap-1 font-mono font-semibold tracking-wider whitespace-nowrap normal-case px-1.5 py-px rounded-sm ${className}`}
      style={{ fontSize: 11, color: def.colour, border: `1px solid ${def.colour}66`, background: `${def.colour}14`, lineHeight: 1.4 }}
    >
      <span aria-hidden="true">●</span>
      {compact ? cls : <><span className="sm:hidden">{cls}</span><span className="hidden sm:inline">{full}</span></>}
    </button>
  )
}
