// Global notification rate limiter — max 3 per type per minute.
//
// Applied inside useStore's addNotification rather than at each call site, so
// every producer (news, price alerts, watchlist moves, earnings, calendar,
// custom alerts, and anything added later) is covered without needing to
// remember to wrap the call.
//
// Buckets are keyed by type + wall-clock minute, so they roll over on their
// own; the map is swept opportunistically to stop it growing unbounded in a
// session that stays open for days.

const MAX_PER_MINUTE = 3

export const notificationRateLimiter = {
  counts: new Map(),

  canShow(type) {
    const minute = Math.floor(Date.now() / 60_000)
    const key = `${type}_${minute}`
    const count = this.counts.get(key) || 0
    if (count >= MAX_PER_MINUTE) return false
    this.counts.set(key, count + 1)
    if (this.counts.size > 64) this.sweep(minute)
    return true
  },

  // Drop buckets from earlier minutes — they can never be hit again.
  sweep(currentMinute) {
    for (const key of this.counts.keys()) {
      const minute = Number(key.slice(key.lastIndexOf('_') + 1))
      if (minute < currentMinute) this.counts.delete(key)
    }
  },

  reset() {
    this.counts.clear()
  },
}
