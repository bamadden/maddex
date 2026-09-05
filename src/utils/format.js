export const fmt = {
  // Plain number with commas — used for rates, index points, share counts
  price: (n, decimals = 2) => {
    if (n == null || isNaN(n)) return '—'
    return new Intl.NumberFormat('en-AU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n)
  },

  // AUD currency — default shows $, clarify=true shows A$
  aud: (n, { decimals = 2, clarify = false } = {}) => {
    if (n == null || isNaN(n)) return '—'
    const abs = new Intl.NumberFormat('en-AU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Math.abs(n))
    return `${n < 0 ? '-' : ''}${clarify ? 'A$' : '$'}${abs}`
  },

  // Backwards-compat alias → AUD
  currency: (n, _unused) => fmt.aud(n),

  pct: (n, showSign = true) => {
    if (n == null || isNaN(n)) return '—'
    const sign = showSign && n > 0 ? '+' : ''
    return `${sign}${n.toFixed(2)}%`
  },

  large: (n) => {
    if (n == null || isNaN(n)) return '—'
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n.toString()
  },

  change: (n) => {
    if (n == null || isNaN(n)) return '—'
    const sign = n > 0 ? '+' : ''
    return `${sign}${n.toFixed(2)}`
  },

  // Volume — coarser than `large`, since a share count doesn't earn two
  // decimals. Kept separate rather than changing `large`, which is used for
  // market caps where the precision does matter.
  volume: (n) => {
    if (n == null || isNaN(n) || n === 0) return '—'
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return String(n)
  },

  // Year is included only when it isn't the current one — a date in this year
  // reads faster without it, and one outside it is ambiguous without.
  date: (d) => {
    if (!d) return '—'
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return '—'
    const sameYear = dt.getFullYear() === new Date().getFullYear()
    return dt.toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
    })
  },

  relativeTime: (d) => {
    if (!d) return '—'
    const ms = Date.now() - new Date(d).getTime()
    if (isNaN(ms)) return '—'
    const mins = Math.floor(ms / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  },

  countdown: (target) => {
    const diff = new Date(target).getTime() - Date.now()
    if (isNaN(diff)) return '—'
    if (diff < 0) return 'PASSED'
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (d > 0) return `${d}D ${h}H ${m}M`
    if (h > 0) return `${h}H ${m}M`
    return `${m}M`
  },
}

export function formatMarketCap(value, currency = 'AUD') {
  if (!value || isNaN(value)) return '—'
  const sym = currency === 'AUD' ? 'A$' : 'US$'
  if (value >= 1_000_000_000_000) return `${sym}${(value / 1_000_000_000_000).toFixed(2)}T`
  if (value >= 1_000_000_000)     return `${sym}${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000)         return `${sym}${(value / 1_000_000).toFixed(0)}M`
  return `${sym}${value.toLocaleString()}`
}

// Four-level change tone. A ±0.3% day and a ±6% day are not the same event,
// and a single green/red pair flattens that distinction away. Strong moves
// get the full-strength colour; mild ones get a dimmer shade so the eye is
// drawn to what actually moved.
//
// Separate from colorClass, which keeps its two-level contract for the three
// files already using it.
export const changeTone = (n) => {
  if (n == null || isNaN(n)) return 'flat'
  if (n >  2) return 'pos-strong'
  if (n >  0) return 'pos-mild'
  if (n < -2) return 'neg-strong'
  if (n <  0) return 'neg-mild'
  return 'flat'
}

export const colorClass = (n) => {
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return 'flat'
}

export const heatColor = (pct) => {
  if (pct >  2)   return 'rgba(46,160,90,0.45)'
  if (pct >  0.5) return 'rgba(46,160,90,0.25)'
  if (pct >= -0.5) return 'rgba(201,168,76,0.20)'
  if (pct >= -2)  return 'rgba(180,60,60,0.25)'
  return 'rgba(180,60,60,0.45)'
}
