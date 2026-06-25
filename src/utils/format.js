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
