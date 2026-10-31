// When an edge's figure is too old to lean on.
//
// The date that matters is the date the figure describes, not the date of the
// document that repeats it. CBA's 2026 annual report prints BlackRock at 6%,
// but that is BlackRock's 2020 notice: the edge's asAt is March 2020. Edges
// carry `asAt` where the two differ; otherwise the source date stands.
//
// Dependency-free so the tests can import it.

export const STALE_DAYS = 365
const DAY = 86_400_000

export const edgeAsAt = (e) => e?.asAt ?? e?.source?.date ?? null

export function ageDays(e, now = Date.now()) {
  const d = edgeAsAt(e)
  if (!d) return null
  const t = Date.parse(`${d}T00:00:00Z`)
  return Number.isFinite(t) ? Math.floor((now - t) / DAY) : null
}

export function isStale(e, now = Date.now()) {
  const a = ageDays(e, now)
  return a != null && a > STALE_DAYS
}
