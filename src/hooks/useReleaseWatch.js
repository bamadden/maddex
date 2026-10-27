import { useEffect, useState } from 'react'
import { releasedEvents, newDataFor, subscribeReleaseWatch } from '../services/releaseWatch'

// Released-but-not-absorbed events, each with what the agency API now shows.
// Re-reads on every release-watch tick and every official check.
export function useReleaseWatch() {
  const [, bump] = useState(0)
  useEffect(() => subscribeReleaseWatch(() => bump((n) => n + 1)), [])
  return releasedEvents().map((e) => ({ ...e, newData: newDataFor(e) }))
}
