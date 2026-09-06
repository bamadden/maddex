// A rolling record of what the portfolio has actually been worth.
//
// WHY THIS EXISTS RATHER THAN A GENERATED SERIES
//
// The dashboard wants a 7-day sparkline. Nothing in the app stores portfolio
// history, and the obvious shortcuts are all lies: walking the current value
// backwards through each holding's daily percentage move gives a curve that
// looks like history but assumes today's holdings were held all week, and a
// smoothed random walk is simply invented. Either would put a shape in front
// of someone that says "this is how your money moved" when it is not.
//
// So it records instead. One value per market day, written whenever the
// dashboard prices the portfolio, and the sparkline draws only the points that
// have actually been observed. That means a new user sees "collecting" for a
// day or two rather than a full week of fiction, which is the correct trade.
//
// Keyed to the Australian market day for the same reason the morning brief is:
// a UTC day key rolls over mid-morning in Sydney and would record two points
// for one trading day. Brisbane has no daylight saving, so it is a stable
// UTC+10 boundary all year.

const KEY = 'maddex_portfolio_history'
const DAYS_KEPT = 30
const AU_MARKET_TZ = 'Australia/Brisbane'

export const marketDayKey = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: AU_MARKET_TZ })

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

// Records today's value, overwriting any earlier reading for the same market
// day — the last observation of a day is the one closest to its close.
//
// Silent on failure throughout. A portfolio widget must not fail to render
// because a history write did not land.
export function recordPortfolioValue(value) {
  if (!Number.isFinite(value) || value <= 0) return
  try {
    const data = read()
    data[marketDayKey()] = Math.round(value)

    const cutoff = marketDayKey(new Date(Date.now() - DAYS_KEPT * 86400000))
    for (const k of Object.keys(data)) if (k < cutoff) delete data[k]

    localStorage.setItem(KEY, JSON.stringify(data))
  } catch { /* storage unavailable or full */ }
}

// The last `days` observations, oldest first. Sparse by design: a week the
// terminal was not opened has no points, and the sparkline should show a
// short line rather than a straight one interpolated across the gap.
export function getPortfolioHistory(days = 7) {
  const data = read()
  const from = marketDayKey(new Date(Date.now() - (days - 1) * 86400000))
  return Object.keys(data)
    .filter((k) => k >= from)
    .sort()
    .map((day) => ({ day, value: data[day] }))
}

export function clearPortfolioHistory() {
  try { localStorage.removeItem(KEY) } catch { /* best effort */ }
}
