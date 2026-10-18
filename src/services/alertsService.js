import { markMilestone } from './gettingStarted'
import { requireFeature, limitFor, showLimitPrompt, nextTier, getCurrentTier } from './plans'
import { recordAlertCreated } from './usageService'
import { getMockFMPRow, getMockFMPHistory } from './mockData'
import { offerPrompt } from './browserNotify'
import { sydneyOffset } from '../utils/dateUtils'

const ALERTS_KEY = 'maddex_alerts_engine_v1'
const PORTFOLIO_KEY = 'madden_portfolio_v2'

export const ALERT_TYPES = [
  { key: 'PRICE',           label: 'Price above/below',    unit: '$',  needsSymbol: true,  needsCondition: true },
  { key: 'SESSION_MOVE',    label: '% move in a day',      unit: '%',  needsSymbol: 'optional', needsCondition: 'move' },
  { key: 'VOLUME_SPIKE',    label: 'Volume vs 20-day avg', unit: 'x',  needsSymbol: true,  needsCondition: false },
  { key: 'RANGE_52W',       label: '52-week high/low',     unit: '',   needsSymbol: true,  needsCondition: 'range', noValue: true },
  { key: 'RSI_EXTREME',     label: 'RSI extreme',          unit: '',   needsSymbol: true,  needsCondition: 'rsi' },
  { key: 'NEWS_MENTION',    label: 'News mention',         unit: '',   needsSymbol: true,  needsCondition: false },
  { key: 'ECONOMIC_EVENT',  label: 'Economic event',       unit: 'hr', needsSymbol: false, needsCondition: false },
  { key: 'PORTFOLIO_PNL',   label: 'Portfolio P&L',        unit: '%',  needsSymbol: false, needsCondition: false },
]

// Near-term AU economic events an ECONOMIC_EVENT alert can fire ahead of —
// same illustrative-calendar pattern as morningBriefService's keyEvents,
// not a live feed.
export const UPCOMING_EVENTS = [
  { label: 'AU CPI',                 date: '2026-10-28', time: '11:30' },
  { label: 'FOMC Rate Decision',     date: '2026-10-29', time: '05:00' },
  { label: 'RBA Cash Rate Decision', date: '2026-11-03', time: '14:30' },
  { label: 'AU Labour Force',        date: '2026-11-19', time: '11:30' },
]

export function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY) ?? '[]') } catch { return [] }
}

// Anything showing alerts (the alert centre, the bell) listens for this to
// re-read, since both alert stores are written from several places.
export const ALERTS_CHANGED = 'maddex:alerts-changed'
const changed = () => { try { window.dispatchEvent(new CustomEvent(ALERTS_CHANGED)) } catch { /* no window in scripts */ } }

function saveAlerts(alerts) {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)) } catch { /* best-effort */ }
  changed()
  return alerts
}

// Local calendar date, so "once a day" resets at the user's midnight — the
// UTC date rolled over at 10–11am in Sydney, mid-session.
export const localDay = (d = new Date()) => d.toLocaleDateString('en-CA')

// ── Trigger history ──────────────────────────────────────────────────────────
// The last 20 alerts that fired, from either store, so you can compare what
// you set with what happened. Price is the price at the moment it fired.
const HISTORY_KEY = 'maddex_alert_history'
const HISTORY_MAX = 20

export function loadAlertHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

export function recordAlertHistory({ symbol, type, level, price }) {
  const entry = { at: new Date().toISOString(), symbol: symbol ?? null, type, level: level ?? null, price: price ?? null }
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...loadAlertHistory()].slice(0, HISTORY_MAX))) } catch { /* quota */ }
  changed()
}

export function clearAlertHistory() {
  try { localStorage.removeItem(HISTORY_KEY) } catch { /* private mode */ }
  changed()
}

// Smart suggestions ("Set an alert for BHP.AX?" after a watchlist add) can be
// switched off in Settings → Alerts.
const SUGGEST_KEY = 'maddex_alert_suggestions'
export const alertSuggestionsEnabled = () => { try { return localStorage.getItem(SUGGEST_KEY) !== 'off' } catch { return true } }
export const setAlertSuggestionsEnabled = (on) => { try { localStorage.setItem(SUGGEST_KEY, on ? 'on' : 'off') } catch { /* private mode */ } }

// ── Proximity ────────────────────────────────────────────────────────────────
// How close a level alert is to firing, as a percentage where 100 = at the
// target. Above: price / target. Below: target / price. null without a price.
export function proximity(direction, target, price) {
  if (!(price > 0) || !(target > 0)) return null
  return direction === 'below' ? (target / price) * 100 : (price / target) * 100
}

// grey far away · gold getting close · amber very close · green fired
export function proximityTone(p) {
  if (p == null) return 'none'
  if (p >= 100) return 'fired'
  if (p >= 90) return 'near'
  if (p >= 70) return 'close'
  return 'far'
}

// Signed distance from price to target, as a % of price: "+11% away".
export const distancePct = (target, price) => (price > 0 && target > 0 ? ((target - price) / price) * 100 : null)

// Active alerts across both alert stores: the simple price alerts kept by
// the app store ('madden_alerts') and the custom alerts here. The plan's
// "N active alerts" limit counts both.
export function activeAlertCount() {
  let simple = 0
  try { simple = (JSON.parse(localStorage.getItem('madden_alerts') ?? '[]') ?? []).length } catch { /* unreadable */ }
  return simple + loadAlerts().filter((a) => !a.triggered).length
}

// Gate for creating an alert of either kind. Raises the right prompt and
// returns false when the plan does not allow another one.
export function canCreateAlert() {
  const tier = getCurrentTier()
  if (!requireFeature('alerts', tier)) return false
  const limit = limitFor('alerts', tier)
  if (activeAlertCount() >= limit) {
    showLimitPrompt('alerts', `You have ${limit} active alerts — the most your plan allows`, nextTier(tier))
    return false
  }
  return true
}

// condition: 'above' | 'below' | 'crosses' (PRICE); ignored for other types.
// Returns the updated list, or null when the plan blocked it.
export function createAlert({ type, symbol, condition, value, label }) {
  if (!canCreateAlert()) return null
  recordAlertCreated()
  offerPrompt()
  markMilestone('alert')
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
    paused: false,
  }
  return saveAlerts([...loadAlerts(), alert])
}

export function deleteAlert(id) {
  return saveAlerts(loadAlerts().filter((a) => a.id !== id))
}

// patch: { value } to edit the level, { paused } to pause without deleting.
export function updateAlert(id, patch) {
  return saveAlerts(loadAlerts().map((a) => (a.id === id ? { ...a, ...patch } : a)))
}

// Removes every alert that has fired. History keeps the record of them.
export function clearTriggered() {
  return saveAlerts(loadAlerts().filter((a) => !a.triggered))
}

export function markTriggered(id) {
  const today = localDay()
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

// Average daily volume over the 20 sessions before today.
export function avgVolume20(symbol) {
  const hist = getMockFMPHistory(symbol, 21).slice(0, -1).map((h) => h.volume).filter((v) => v > 0)
  return hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : null
}

// 52-week range: the quote's own figures, widened by the year of daily
// history in case today's price has already pushed past them.
function range52w(symbol, row) {
  const hist = getMockFMPHistory(symbol, 252)
  const highs = hist.map((h) => h.high), lows = hist.map((h) => h.low)
  const high = Math.max(...[row?.fiftyTwoWeekHigh, ...highs.slice(0, -1)].filter((v) => v > 0))
  const low = Math.min(...[row?.fiftyTwoWeekLow, ...lows.slice(0, -1)].filter((v) => v > 0))
  return { high: Number.isFinite(high) ? high : null, low: Number.isFinite(low) ? low : null }
}
export const get52WeekRange = (symbol) => range52w(symbol, getMockFMPRow(symbol))

// Words that identify a company in a headline: the ticker code as a whole
// word, plus its name with corporate suffixes dropped ("BHP Group Limited" →
// "BHP"). Substring matching made RIO fire on "period" and WES on "west".
const SUFFIX = /\b(group|limited|ltd|holdings?|corporation|corp|inc|plc|co|company|the)\b\.?/gi
export function newsMatchers(symbol) {
  const code = symbol.replace(/\.AX$/i, '').replace(/[^A-Z0-9]/gi, '')
  const out = [new RegExp(`\\b${code}\\b`, 'i')]
  const name = getMockFMPRow(symbol)?.shortName?.replace(SUFFIX, '').replace(/\s+/g, ' ').trim()
  if (name && name.length >= 4 && name.toUpperCase() !== code.toUpperCase()) {
    out.push(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
  }
  return out
}
export const headlineMentions = (headline, symbol) => newsMatchers(symbol).some((re) => re.test(headline))

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
  const today = localDay()
  const results = []

  for (const alert of alerts) {
    if (alert.paused) continue
    if (alert.lastFiredDate === today) continue // already fired today — resets at local midnight

    let fired = false
    let message = ''
    let price = null

    if (alert.type === 'PRICE' && alert.symbol) {
      const row = getMockFMPRow(alert.symbol)
      if (row) {
        const p = row.regularMarketPrice
        price = p
        if (alert.condition === 'above' && p > alert.value) { fired = true; message = `${alert.symbol} is now A$${p.toFixed(2)}, above your A$${alert.value.toFixed(2)} alert` }
        if (alert.condition === 'below' && p < alert.value) { fired = true; message = `${alert.symbol} is now A$${p.toFixed(2)}, below your A$${alert.value.toFixed(2)} alert` }
      }
    }

    if (alert.type === 'SESSION_MOVE') {
      const watchSyms = alert.symbol ? [alert.symbol] : symbols
      // condition: 'up' | 'down' | 'either' (alerts made before directions
      // existed have none, and meant either).
      const dir = alert.condition ?? 'either'
      for (const sym of watchSyms) {
        const row = getMockFMPRow(sym)
        const chg = row?.regularMarketChangePercent
        if (chg == null) continue
        const hit = dir === 'up' ? chg >= alert.value : dir === 'down' ? chg <= -alert.value : Math.abs(chg) >= alert.value
        if (hit) {
          fired = true
          price = row.regularMarketPrice
          message = `${sym} ${chg >= 0 ? 'up' : 'down'} ${Math.abs(chg).toFixed(1)}% today — past your ${dir === 'either' ? '±' : dir === 'up' ? '+' : '−'}${alert.value}% alert`
          break
        }
      }
    }

    if (alert.type === 'VOLUME_SPIKE' && alert.symbol) {
      const row = getMockFMPRow(alert.symbol)
      const avg = avgVolume20(alert.symbol) ?? row?.averageVolume
      if (row?.regularMarketVolume && avg) {
        const ratio = row.regularMarketVolume / avg
        if (ratio >= (alert.value || 2)) { fired = true; price = row.regularMarketPrice; message = `${alert.symbol} volume is ${ratio.toFixed(1)}× its 20-day average` }
      }
    }

    if (alert.type === 'RANGE_52W' && alert.symbol) {
      const row = getMockFMPRow(alert.symbol)
      const p = row?.regularMarketPrice
      const { high, low } = range52w(alert.symbol, row)
      if (p != null && alert.condition !== 'low' && high != null && p >= high) { fired = true; price = p; message = `${alert.symbol} hit a 52-week high at A$${p.toFixed(2)}` }
      if (p != null && alert.condition === 'low' && low != null && p <= low) { fired = true; price = p; message = `${alert.symbol} hit a 52-week low at A$${p.toFixed(2)}` }
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
      const hit = newsHeadlines.find((h) => headlineMentions(h, alert.symbol))
      if (hit) { fired = true; message = `${alert.symbol} mentioned in news: "${hit.slice(0, 80)}"` }
    }

    if (alert.type === 'ECONOMIC_EVENT') {
      const now = new Date()
      for (const ev of UPCOMING_EVENTS) {
        const evTime = new Date(`${ev.date}T${ev.time}:00${sydneyOffset(ev.date)}`)
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

    if (fired) results.push({ alert, message, price })
  }

  return results
}
