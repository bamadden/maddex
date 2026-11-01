// How a crypto price is labelled: its currency prefix, and one line saying
// where it came from — for the fallback, the conversion rate with its date and
// the time it was fetched. Every crypto view uses these, so a price is never
// shown under a currency it is not in.

import { formatDate } from './dateUtils.js'

const PREFIX = { AUD: 'A$', USD: 'US$', NZD: 'NZ$', SGD: 'S$', CAD: 'C$', EUR: '€', GBP: '£', JPY: '¥' }

export const pricePrefix = (ccy) => PREFIX[String(ccy ?? '').toUpperCase()] ?? `${String(ccy ?? '').toUpperCase()} `

export function formatCryptoPrice(value, ccy) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const v = Number(value)
  const dp = v < 1 ? 4 : 2
  return `${pricePrefix(ccy)}${v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
}

const sydneyTime = (ms) => new Date(ms).toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' })
const day = (iso) => (iso ? formatDate(iso) : null)

// result: fetchCryptoMarketsUnified's envelope. `asked`: the currency the view
// wanted. → { text, converted, mismatch } | null
export function describeCryptoSource(result, asked = 'AUD') {
  const meta = result?.meta
  if (!meta) return null
  const parts = [meta.provider]
  const converted = !!meta.fx
  if (converted) {
    const { rate, date, fetchedAt, stale } = meta.fx
    parts.push(`US$ prices converted at ${meta.fx.pair} ${Number(rate).toFixed(4)}${date ? ` (${day(date)} reference rate)` : ''}, fetched ${sydneyTime(fetchedAt)}${stale ? ', cached' : ''}`)
  } else {
    parts.push(`prices in ${meta.currency}`)
  }
  if (result.stale && result.cachedAt) parts.push(`cached copy from ${sydneyTime(result.cachedAt)}`)
  const mismatch = String(meta.currency).toUpperCase() !== String(asked).toUpperCase()
  if (mismatch) parts.push(`no ${String(asked).toUpperCase()} conversion available`)
  return { text: parts.join(' · '), converted, mismatch }
}
