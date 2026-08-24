import { getMockFMPRow, getMockFMPHistory } from './mockData'

const ALERTS_KEY = 'maddex_alerts_engine_v1'
const PORTFOLIO_KEY = 'madden_portfolio_v2'

export const ALERT_TYPES = [
  { key: 'PRICE',           label: 'Price above/below',    unit: '$',  needsSymbol: true,  needsCondition: true },
  { key: 'SESSION_MOVE',    label: '% move in session',    unit: '%',  needsSymbol: 'optional', needsCondition: false },
  { key: 'VOLUME_SPIKE',    label: 'Volume spike',         unit: 'x',  needsSymbol: true,  needsCondition: false },
  { key: 'RSI_EXTREME',     label: 'RSI extreme',          unit: '',   needsSymbol: true,  needsCondition: 'rsi' },
  { key: 'NEWS_MENTION',    label: 'News mention',         unit: '',   needsSymbol: true,  needsCondition: false },
  { key: 'ECONOMIC_EVENT',  label: 'Economic event',       unit: 'hr', needsSymbol: false, needsCondition: false },
  { key: 'PORTFOLIO_PNL',   label: 'Portfolio P&L',        unit: '%',  needsSymbol: false, needsCondition: false },
]

// Near-term AU economic events an ECONOMIC_EVENT alert can fire ahead of —
// same illustrative-calendar pattern as morningBriefService's keyEvents,
// not a live feed.
export const UPCOMING_EVENTS = [
  { label: 'RBA Cash Rate Decision', date: '2026-09-16', time: '14:30' },
  { label: 'AU CPI Monthly',         date: '2026-09-25', time: '11:30' },
  { label: 'AU Retail Sales',        date: '2026-09-10', time: '11:30' },
  { label: 'US Core PCE',            date: '2026-08-29', time: '22:30' },
]

export function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY) ?? '[]') } catch { return [] }
}

function saveAlerts(alerts) {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)) } catch { /* best-effort */ }
  return alerts
}

// condition: 'above' | 'below' | 'crosses' (PRICE); ignored for other types.
export function createAlert({ type, symbol, condition, value, label }) {
  const alert = {
    id: Date.now() + Math.random(),
    type, symbol: symbol ? symbol.toUpperCase() : null,
    condition: condition ?? null,
    value: value != null ? Number(value) : null,
    label: label ?? null,
    createdAt: new Date().toISOString(),
    triggered: false,
    triggeredAt: null,
    lastFiredDate: null, // yyyy-mm-dd — so a triggered alert can re-fire on a new day
  }
  return saveAlerts([...loadAlerts(), alert])
}

export function deleteAlert(id) {
  return saveAlerts(loadAlerts().filter((a) => a.id !== id))
}

export function markTriggered(id) {
  const today = new Date().toISOString().slice(0, 10)
  return saveAlerts(loadAlerts().map((a) => (
    a.id === id ? { ...a, triggered: true, triggeredAt: new Date().toISOString(), lastFiredDate: today } : a
  )))
}

// 14-period RSI over the mock history's closes — a standard, reproducible
// calculation, but run against this app's synthetic mock price history
// rather than real market data (same caveat as every other "illustrative"
// series in this app).
function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff; else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function readPortfolioHoldings() {
  try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) ?? '[]') } catch { return [] }
}

function portfolioPnlPct() {
  const holdings = readPortfolioHoldings()
  let cost = 0, val = 0
  for (const h of holdings) {
    if (h.type === 'crypto') continue // no mock quote source wired for crypto here
    const row = getMockFMPRow(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol)
    if (!row) continue
    cost += h.avgCost * h.shares
    val  += row.regularMarketPrice * h.shares
  }
  if (cost === 0) return null
  return ((val - cost) / cost) * 100
}

// symbols: list of tickers to sweep for SESSION_MOVE when an alert has no
// specific symbol ("any watchlist stock >X%"). newsHeadlines: array of
// strings for NEWS_MENTION. Returns [{ alert, fired, message }] for every
// alert that should notify right now (already-triggered-today ones are
// skipped so they don't re-fire every 60s).
export function checkAlerts(alerts, { symbols = [], newsHeadlines = [] } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const results = []

  for (const alert of alerts) {
    if (alert.lastFiredDate === today) continue // already fired today

    let fired = false
    let message = ''

    if (alert.type === 'PRICE' && alert.symbol) {
      const row = getMockFMPRow(alert.symbol)
      if (row) {
        const p = row.regularMarketPrice
        if (alert.condition === 'above' && p > alert.value) { fired = true; message = `${alert.symbol} is now A$${p.toFixed(2)}, above your A$${alert.value.toFixed(2)} alert` }
        if (alert.condition === 'below' && p < alert.value) { fired = true; message = `${alert.symbol} is now A$${p.toFixed(2)}, below your A$${alert.value.toFixed(2)} alert` }
      }
    }

    if (alert.type === 'SESSION_MOVE') {
      const watchSyms = alert.symbol ? [alert.symbol] : symbols
      for (const sym of watchSyms) {
        const row = getMockFMPRow(sym)
        if (row && Math.abs(row.regularMarketChangePercent) >= alert.value) {
          fired = true
          message = `${sym} moved ${row.regularMarketChangePercent >= 0 ? '+' : ''}${row.regularMarketChangePercent.toFixed(1)}% today`
          break
        }
      }
    }

    if (alert.type === 'VOLUME_SPIKE' && alert.symbol) {
      const row = getMockFMPRow(alert.symbol)
      if (row?.regularMarketVolume && row?.averageVolume) {
        const ratio = row.regularMarketVolume / row.averageVolume
        if (ratio >= (alert.value || 2)) { fired = true; message = `${alert.symbol} volume is ${ratio.toFixed(1)}x its average` }
      }
    }

    if (alert.type === 'RSI_EXTREME' && alert.symbol) {
      const hist = getMockFMPHistory(alert.symbol, 30)
      const rsi = computeRSI(hist.map((h) => h.close))
      if (rsi != null) {
        if (alert.condition === 'below' && rsi < alert.value) { fired = true; message = `${alert.symbol} RSI is ${rsi.toFixed(0)} (oversold, below ${alert.value})` }
        if (alert.condition === 'above' && rsi > alert.value) { fired = true; message = `${alert.symbol} RSI is ${rsi.toFixed(0)} (overbought, above ${alert.value})` }
      }
    }

    if (alert.type === 'NEWS_MENTION' && alert.symbol) {
      const needle = alert.symbol.replace(/\.AX$/, '').toLowerCase()
      const hit = newsHeadlines.find((h) => h.toLowerCase().includes(needle))
      if (hit) { fired = true; message = `${alert.symbol} mentioned in news: "${hit.slice(0, 80)}"` }
    }

    if (alert.type === 'ECONOMIC_EVENT') {
      const now = new Date()
      for (const ev of UPCOMING_EVENTS) {
        const evTime = new Date(`${ev.date}T${ev.time}:00+10:00`)
        const hoursUntil = (evTime - now) / 3_600_000
        if (hoursUntil > 0 && hoursUntil <= (alert.value || 1)) {
          fired = true
          message = `${ev.label} in ${hoursUntil < 1 ? `${Math.round(hoursUntil * 60)} min` : `${hoursUntil.toFixed(1)}h`}`
          break
        }
      }
    }

    if (alert.type === 'PORTFOLIO_PNL') {
      const pnl = portfolioPnlPct()
      if (pnl != null && pnl <= -(alert.value || 5)) {
        fired = true
        message = `Portfolio down ${pnl.toFixed(1)}% overall`
      }
    }

    if (fired) results.push({ alert, message })
  }

  return results
}
