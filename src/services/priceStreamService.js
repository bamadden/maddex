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
  }

  start() {
    if (this.running) return
    this.running = true
    this.intervalId = setInterval(() => this.updatePrices(), 3000)
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
