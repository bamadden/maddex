// Deterministic-ish mock OHLCV generator for the TradingChart component.
// Not cryptographically seeded — good enough for a demo chart, matches the
// shape lightweight-charts expects (unix seconds `time`, numeric OHLCV).

export function generateOHLCV(basePrice, days, volatility = 0.02) {
  const data = []
  let price = basePrice * (0.85 + Math.random() * 0.1)
  const now = new Date()

  for (let i = days; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    if (date.getDay() === 0 || date.getDay() === 6) continue

    const change = (Math.random() - 0.48) * volatility
    const open = price
    const close = price * (1 + change)
    const high = Math.max(open, close) * (1 + Math.random() * 0.005)
    const low = Math.min(open, close) * (1 - Math.random() * 0.005)
    const volume = Math.floor(Math.random() * 5000000 + 500000)

    data.push({
      time: Math.floor(date.getTime() / 1000),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    })
    price = close
  }
  return data
}

// Period -> trading-day count fed into generateOHLCV.
export const PERIOD_DAYS = {
  '1D': 2, '5D': 7, '1M': 30, '3M': 90, '6M': 182, '1Y': 365, '5Y': 1825,
}

export function sma(data, period) {
  const out = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    out.push({ time: data[i].time, value: parseFloat((sum / period).toFixed(2)) })
  }
  return out
}

export function ema(data, period) {
  const out = []
  const k = 2 / (period + 1)
  let prev = null
  for (let i = 0; i < data.length; i++) {
    const close = data[i].close
    prev = prev == null ? close : close * k + prev * (1 - k)
    if (i >= period - 1) out.push({ time: data[i].time, value: parseFloat(prev.toFixed(2)) })
  }
  return out
}

export function bollingerBands(data, period = 20, mult = 2) {
  const upper = [], middle = [], lower = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const mean = slice.reduce((s, d) => s + d.close, 0) / period
    const variance = slice.reduce((s, d) => s + (d.close - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    const t = data[i].time
    middle.push({ time: t, value: parseFloat(mean.toFixed(2)) })
    upper.push({ time: t, value: parseFloat((mean + mult * sd).toFixed(2)) })
    lower.push({ time: t, value: parseFloat((mean - mult * sd).toFixed(2)) })
  }
  return { upper, middle, lower }
}

export function rsi(data, period = 14) {
  const out = []
  let gainSum = 0, lossSum = 0
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close
    const gain = Math.max(change, 0)
    const loss = Math.max(-change, 0)
    if (i <= period) {
      gainSum += gain; lossSum += loss
      if (i === period) {
        const avgGain = gainSum / period, avgLoss = lossSum / period
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        out.push({ time: data[i].time, value: parseFloat((100 - 100 / (1 + rs)).toFixed(2)) })
      }
      continue
    }
    // Wilder's smoothing from here
    const prevAvgGain = gainSum / period, prevAvgLoss = lossSum / period
    const avgGain = (prevAvgGain * (period - 1) + gain) / period
    const avgLoss = (prevAvgLoss * (period - 1) + loss) / period
    gainSum = avgGain * period
    lossSum = avgLoss * period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    out.push({ time: data[i].time, value: parseFloat((100 - 100 / (1 + rs)).toFixed(2)) })
  }
  return out
}

export function macd(data, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(data, fast)
  const emaSlow = ema(data, slow)
  const slowByTime = new Map(emaSlow.map((d) => [d.time, d.value]))
  const macdLine = emaFast
    .filter((d) => slowByTime.has(d.time))
    .map((d) => ({ time: d.time, value: parseFloat((d.value - slowByTime.get(d.time)).toFixed(3)) }))

  // Signal = EMA of the MACD line itself
  const k = 2 / (signalPeriod + 1)
  let prev = null
  const signal = []
  macdLine.forEach((d, i) => {
    prev = prev == null ? d.value : d.value * k + prev * (1 - k)
    if (i >= signalPeriod - 1) signal.push({ time: d.time, value: parseFloat(prev.toFixed(3)) })
  })

  const signalByTime = new Map(signal.map((d) => [d.time, d.value]))
  const histogram = macdLine
    .filter((d) => signalByTime.has(d.time))
    .map((d) => ({ time: d.time, value: parseFloat((d.value - signalByTime.get(d.time)).toFixed(3)) }))

  return { macdLine, signal, histogram }
}
