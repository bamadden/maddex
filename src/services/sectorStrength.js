// The sector strength composite (data/methodology 'sector-strength'): how one
// representative stock per sector is trading today, 0–100. Built only from
// what the quote carries. It used to weight "volume conviction" at 30% with
// a fixed 50 (no volume average was fetched), score a missing quote as 50,
// and draw a "previous close" series that was 70% fixed 50s.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function sectorStrength(q) {
  const day = Number.isFinite(q?.dayChangePct) ? clamp(50 + q.dayChangePct * 10, 0, 100) : null
  const { price, week52High: hi, week52Low: lo } = q ?? {}
  const range = [price, hi, lo].every(Number.isFinite) && hi > lo ? clamp(((price - lo) / (hi - lo)) * 100, 0, 100) : null
  if (day == null && range == null) return null
  if (day == null) return Math.round(range)
  if (range == null) return Math.round(day)
  return Math.round((4 * day + 3 * range) / 7)
}
