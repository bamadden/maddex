import { sydneyOffset } from '../../utils/dateUtils'

const SHOW_AFTER_MS = 72 * 3600_000

// Shown from the QUARTERLY release (au.cpiQuarterReleased) until the next RBA
// decision, or 72 hours. It keyed on cpiLastRelease until 26 Nov 2026, so the
// October MONTHLY release reopened it with the passed decision's empty
// market fields, and the Macro module crashed.
export function cpiResultShown(a, nd, now) {
  if (a?.cpiQuarterTrimmedQoQ == null || !a.cpiQuarterReleased) return false
  const released = new Date(`${a.cpiQuarterReleased}T11:30:00${sydneyOffset(a.cpiQuarterReleased)}`).getTime()
  const decision = nd?.date ? new Date(`${nd.date}T${nd.time}:00${sydneyOffset(nd.date)}`).getTime() : null
  const until = decision && decision > released ? decision : released + SHOW_AFTER_MS
  return now >= released && now < until
}
