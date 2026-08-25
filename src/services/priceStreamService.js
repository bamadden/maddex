import { getMockFMPRow } from './mockData'

// Simulates a live price feed on top of the static mock quote data — a
// single shared ticker per symbol (not per-subscriber), so every component
// watching the same symbol sees the exact same price at the exact same
// moment, the way a real streaming quote feed would behave.
class PriceStreamService {
  constructor() {
    this.subscribers = new Map() // symbol -> Set<callback>
    this.prices = new Map()      // symbol -> latest quote
    this.running = false
    this.intervalId = null
    this.listeners = new Set()
    this.tickMs = this.loadTickMs()
    this.enabled = this.loadEnabled()
  }

  loadTickMs() {
    try { return parseInt(localStorage.getItem('maddex_tick_speed'), 10) || 3000 } catch { return 3000 }
  }

  loadEnabled() {
    try { return localStorage.getItem('maddex_tick_enabled') !== 'false' } catch { return true }
  }

  subscribeSettings(cb) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  // Settings → Data & Refresh: 5s/3s/1s presets. Restarts the interval at
  // the new speed if currently running.
  setTickMs(ms) {
    this.tickMs = ms
    try { localStorage.setItem('maddex_tick_speed', String(ms)) } catch { /* best-effort */ }
    if (this.running) { this.stop(); this.start() }
    this.listeners.forEach((cb) => cb())
  }

  // Settings → Data & Refresh: toggles the whole simulated feed on/off —
  // disabled means every subscribed quote stays frozen at its last value.
  setEnabled(v) {
    this.enabled = v
    try { localStorage.setItem('maddex_tick_enabled', String(v)) } catch { /* best-effort */ }
    if (!v) this.stop()
    this.listeners.forEach((cb) => cb())
  }

  start() {
    if (!this.enabled) return
    if (this.running) return
    this.running = true
    this.intervalId = setInterval(() => this.updatePrices(), this.tickMs)
  }

  stop() {
    this.running = false
    if (this.intervalId) clearInterval(this.intervalId)
    this.intervalId = null
  }

  updatePrices() {
    this.subscribers.forEach((callbacks, symbol) => {
      if (callbacks.size === 0) return
      const current = this.prices.get(symbol) || getMockFMPRow(symbol)
      if (!current) return

      // Random walk — realistic micro-movement, slightly biased down
      // (0.498 vs 0.5) so a long-running session doesn't drift consistently
      // upward.
      const tick = (Math.random() - 0.498) * current.regularMarketPrice * 0.0008
      const newPrice = parseFloat((current.regularMarketPrice + tick).toFixed(2))
      const changeFromOpen = newPrice - current.regularMarketPreviousClose
      const changePct = current.regularMarketPreviousClose
        ? (changeFromOpen / current.regularMarketPreviousClose) * 100
        : 0

      const updated = {
        ...current,
        regularMarketPrice: newPrice,
        regularMarketChange: parseFloat(changeFromOpen.toFixed(2)),
        regularMarketChangePercent: parseFloat(changePct.toFixed(2)),
        lastTick: tick > 0 ? 'up' : 'down',
        lastUpdate: Date.now(),
      }

      this.prices.set(symbol, updated)
      callbacks.forEach((cb) => cb(updated))
    })
  }

  subscribe(symbol, callback) {
    if (!symbol) return () => {}
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set())
      if (!this.prices.has(symbol)) this.prices.set(symbol, getMockFMPRow(symbol))
    }
    this.subscribers.get(symbol).add(callback)

    return () => {
      const cbs = this.subscribers.get(symbol)
      if (!cbs) return
      cbs.delete(callback)
      if (cbs.size === 0) this.subscribers.delete(symbol)
    }
  }

  getSnapshot(symbol) {
    return this.prices.get(symbol) ?? getMockFMPRow(symbol)
  }
}

export const priceStream = new PriceStreamService()
