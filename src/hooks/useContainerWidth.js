import { useEffect, useRef, useState } from 'react'

// Measures a container's width and reports it, plus coarse size bands.
//
// MEASURED, NOT A MEDIA QUERY. Modules in this app render in three different
// contexts: full width, inside a split pane, and inside a popped-out window.
// The viewport width says nothing useful about how much room a module has in
// two of those three, so `md:` and `lg:` classes are wrong for module-level
// layout decisions here — a split pane on a 1440px screen gives a module about
// 700px, and a viewport breakpoint would happily lay it out as if it had 1440.
//
// Returns { ref, width, isNarrow, isCompact }:
//   isNarrow  — phone-sized, roughly 560px and under: one column, stack
//               everything, hide anything that needs precision pointing.
//   isCompact — tablet or split-pane, under 900px: two columns, tighter chrome.
//
// width is null until the first measurement. Callers should treat null as
// "assume the roomy layout" rather than flashing the narrow one for a frame.
// narrowAt / compactAt are overridable because the right threshold depends on
// what is being measured. 560px is the module-level default — phone-sized.
// A widget cell inside a dashboard grid is ~340px even on a large desktop,
// so a widget passing the module default would permanently believe it was on
// a phone. Callers measuring something smaller than a module should say so.
export function useContainerWidth({ narrowAt = 560, compactAt = 900 } = {}) {
  const ref = useRef(null)
  const [width, setWidth] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  return {
    ref,
    width,
    isNarrow: width != null && width <= narrowAt,
    isCompact: width != null && width < compactAt,
  }
}
