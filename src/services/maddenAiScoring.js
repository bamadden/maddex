// ─── MaddenAI scoring engine ──────────────────────────────────────────────────
// Ported from the original Maddex app (maddenAI_scoring.js). Every score is
// anchored at 50 = neutral; it moves up/down as weighted live-data factors
// diverge from neutral. Bands: 80-100 Extremely Bullish, 65-79 Bullish,
// 55-64 Mildly Bullish, 45-54 Neutral, 35-44 Mildly Bearish, 20-34 Bearish,
// 0-19 Extremely Bearish.

export function scoreToLabel(score) {
  if (score >= 80) return 'Extremely Bullish'
  if (score >= 65) return 'Bullish'
  if (score >= 55) return 'Mildly Bullish'
  if (score >= 45) return 'Neutral'
  if (score >= 35) return 'Mildly Bearish'
  if (score >= 20) return 'Bearish'
  return 'Extremely Bearish'
}

// Colours map onto the terminal's existing gain/loss/neutral CSS variables
// (same palette already used by FearGreedGauge / SentimentBadge in CryptoModule).
export function scoreToColor(score) {
  if (score >= 65) return 'var(--color-gain-bright)'
  if (score >= 55) return 'var(--color-gain)'
  if (score >= 45) return 'var(--color-neutral)'
  if (score >= 35) return '#ff8c00'
  return 'var(--color-loss-bright)'
}

// Bull/Neutral/Bear breakdown for the progress-bar UI.
export function scoreToBullBearBreakdown(score) {
  if (score >= 50) {
    const bullish = Math.round(33 + (score - 50) * 1.14)
    const bearish = Math.max(2, Math.round(33 - (score - 50) * 0.62))
    const neutral = Math.max(5, 100 - bullish - bearish)
    return { bullish, neutral, bearish }
  }
  const bearish = Math.round(33 + (50 - score) * 1.14)
  const bullish = Math.max(2, Math.round(33 - (50 - score) * 0.62))
  const neutral = Math.max(5, 100 - bullish - bearish)
  return { bullish, neutral, bearish }
}

// Converts a raw % change into a 0-100 contribution, clamped so extreme
// single-day moves don't dominate the weighted average.
function momentumToScore(changePct) {
  const clamped = Math.max(-10, Math.min(10, changePct))
  return 50 + clamped * 4
}

function weeklyMomentumToScore(changePct) {
  const clamped = Math.max(-20, Math.min(20, changePct))
  return 50 + clamped * 1.65
}

function gainerRatio(changes) {
  if (!changes?.length) return null
  const gainers = changes.filter((c) => (c ?? 0) > 0).length
  return gainers / changes.length
}

// ── OVERALL MARKET SENTIMENT SCORE ────────────────────────────────────────────
// Weighted factors, each anchored at 50 = neutral. Factors with no live data
// are simply omitted — the weighted average renormalises over whatever is
// available, and `confidence` reports how many of the 6 trackable factors fed in.
//
// data: {
//   fearGreed:     { value } | null        — crypto Fear & Greed index (0-100)
//   asxChanges:    number[]                — 24h % change per ASX stock tracked
//   spxChange:     number | null           — S&P 500 (^GSPC) 24h % change
//   btcChange:     number | null           — BTC 24h % change
//   cryptoChanges: number[]                — 24h % change per tracked crypto asset
// }
export function calculateMarketSentimentScore(data) {
  const factors = []

  if (data.fearGreed?.value !== undefined) {
    factors.push({ name: 'Crypto Fear & Greed', score: data.fearGreed.value, weight: 12 })
  }

  const asxBreadth = gainerRatio(data.asxChanges)
  if (asxBreadth !== null) {
    factors.push({ name: 'ASX Market Breadth', score: asxBreadth * 100, weight: 20 })
  }

  if (data.asxChanges?.length) {
    const avgChange = data.asxChanges.reduce((s, c) => s + (c ?? 0), 0) / data.asxChanges.length
    factors.push({ name: 'ASX Price Momentum', score: momentumToScore(avgChange), weight: 15 })
  }

  if (data.spxChange !== undefined && data.spxChange !== null) {
    factors.push({ name: 'S&P 500 Momentum', score: momentumToScore(data.spxChange), weight: 15 })
  }

  if (data.btcChange !== undefined && data.btcChange !== null) {
    factors.push({ name: 'BTC Risk Appetite', score: momentumToScore(data.btcChange), weight: 12 })
  }

  const cryptoBreadth = gainerRatio(data.cryptoChanges)
  if (cryptoBreadth !== null) {
    factors.push({ name: 'Crypto Market Breadth', score: cryptoBreadth * 100, weight: 8 })
  }

  if (factors.length === 0) return { score: 50, label: 'Neutral', confidence: 0, factors: [] }

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const weightedSum = factors.reduce((s, f) => s + f.score * f.weight, 0)
  const finalScore = Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight)))
  const confidence = Math.round((factors.length / 6) * 100)

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    confidence,
    breakdown: scoreToBullBearBreakdown(finalScore),
    factors: factors.map((f) => ({
      ...f,
      score: Math.round(f.score),
      contribution: Math.round((f.score - 50) * (f.weight / totalWeight)),
    })),
  }
}

// ── CRYPTO MOMENTUM INDEX ─────────────────────────────────────────────────────
// Multi-factor crypto sentiment: market-cap-weighted 24h/7d momentum, breadth,
// fear/greed, and a BTC volume/mcap conviction signal — not just "did BTC go up".
//
// coins: [{ symbol, change24h, change7d, volume24h, marketCap }]
// fearGreed: { value } | null
export function calculateCryptoMomentumIndex({ coins, fearGreed }) {
  if (!coins?.length) return { score: 50, label: 'Neutral', confidence: 0 }

  const factors = []
  const mcapWeights = { BTC: 5, ETH: 3, BNB: 2, SOL: 2, XRP: 1, ADA: 1 }

  let weighted24h = 0, total24hW = 0
  coins.forEach((c) => {
    const w = mcapWeights[c.symbol] || 1
    weighted24h += momentumToScore(c.change24h || 0) * w
    total24hW += w
  })
  factors.push({ name: '24h Momentum (mcap-weighted)', score: weighted24h / total24hW, weight: 25 })

  let weighted7d = 0, total7dW = 0
  coins.forEach((c) => {
    if (c.change7d !== undefined && c.change7d !== null) {
      const w = mcapWeights[c.symbol] || 1
      weighted7d += weeklyMomentumToScore(c.change7d) * w
      total7dW += w
    }
  })
  if (total7dW > 0) factors.push({ name: '7-Day Trend', score: weighted7d / total7dW, weight: 20 })

  const breadth = gainerRatio(coins.map((c) => c.change24h))
  if (breadth !== null) factors.push({ name: 'Market Breadth', score: breadth * 100, weight: 20 })

  if (fearGreed?.value !== undefined) {
    factors.push({ name: 'Fear & Greed Index', score: fearGreed.value, weight: 20 })
  }

  let volumeScore = 50
  const btc = coins.find((c) => c.symbol === 'BTC')
  if (btc?.volume24h && btc?.marketCap) {
    const ratio = btc.volume24h / btc.marketCap
    if (ratio > 0.07) volumeScore = btc.change24h >= 0 ? 75 : 25
    else if (ratio > 0.04) volumeScore = btc.change24h >= 0 ? 62 : 38
  }
  factors.push({ name: 'Volume Conviction', score: volumeScore, weight: 15 })

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const weightedSum = factors.reduce((s, f) => s + f.score * f.weight, 0)
  const finalScore = Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight)))

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    confidence: Math.round((factors.length / 5) * 100),
    breakdown: scoreToBullBearBreakdown(finalScore),
    factors: factors.map((f) => ({ ...f, score: Math.round(f.score) })),
  }
}

// ── SCORE EXPLANATION ─────────────────────────────────────────────────────────
// Plain-English breakdown of which factors drove a score — for tooltips.
export function explainScore(scoreObject) {
  if (!scoreObject?.factors?.length) return 'Score calculated from available market data.'

  const topPositive = scoreObject.factors
    .filter((f) => (f.contribution ?? f.score - 50) > 0)
    .sort((a, b) => (b.contribution ?? b.score) - (a.contribution ?? a.score))
    .slice(0, 2)
  const topNegative = scoreObject.factors
    .filter((f) => (f.contribution ?? f.score - 50) < 0)
    .sort((a, b) => (a.contribution ?? a.score) - (b.contribution ?? b.score))
    .slice(0, 2)

  let text = `Score of ${scoreObject.score}/100 (${scoreObject.label}). `
  if (topPositive.length) text += `Positive signals: ${topPositive.map((f) => f.name).join(', ')}. `
  if (topNegative.length) text += `Negative signals: ${topNegative.map((f) => f.name).join(', ')}. `
  text += `Based on ${scoreObject.factors.length} data factors with ${scoreObject.confidence}% data confidence.`
  return text
}

// ── SHORT BANNER SUMMARY — max ~60 chars ─────────────────────────────────────
export function generateShortSummary({ marketSentimentScore, asxChanges, fearGreed }) {
  const score = marketSentimentScore?.score ?? 50
  const fgVal = fearGreed?.value ?? null
  const fgLbl = fearGreed?.label ?? null
  const asxAvg = asxChanges?.length
    ? asxChanges.reduce((s, c) => s + (c ?? 0), 0) / asxChanges.length
    : null

  let parts = []
  if (asxAvg !== null) {
    if (Math.abs(asxAvg) < 0.3) parts.push('ASX flat')
    else if (asxAvg > 0) parts.push(`ASX +${asxAvg.toFixed(1)}%`)
    else parts.push(`ASX ${asxAvg.toFixed(1)}%`)
  }
  if (fgVal !== null && fgLbl) {
    const fgShort = fgLbl.replace('Extreme ', 'Extreme ')
    parts.push(`${fgShort} (${fgVal}/100)`)
  }
  if (parts.length === 0) {
    if (score >= 65) parts.push('Broad bullish momentum')
    else if (score >= 55) parts.push('Mildly positive conditions')
    else if (score >= 45) parts.push('Mixed signals')
    else if (score >= 35) parts.push('Mild caution across markets')
    else parts.push('Broadly bearish conditions')
  }
  return parts.join(' — ')
}

// ── AI SNAPSHOT TEXT ──────────────────────────────────────────────────────────
// Plain-English daily snapshot for a Home/Markets banner.
export function generateSnapshotText({ marketSentimentScore, cryptoMomentumIndex, asxChanges, fearGreed }) {
  const mss = marketSentimentScore?.score ?? 50
  const cmi = cryptoMomentumIndex?.score ?? 50
  const fgVal = fearGreed?.value ?? 50
  const fgLbl = fearGreed?.label ?? 'Neutral'

  const asxAvg = asxChanges?.length
    ? asxChanges.reduce((s, c) => s + (c ?? 0), 0) / asxChanges.length
    : 0
  const asxGainers = asxChanges?.filter((c) => (c ?? 0) > 0).length ?? 0
  const asxLosers = asxChanges?.filter((c) => (c ?? 0) < 0).length ?? 0

  let snapshot
  if (mss >= 65) snapshot = 'MaddenAI detects broad-based bullish momentum. '
  else if (mss >= 55) snapshot = 'MaddenAI detects mildly positive market conditions. '
  else if (mss >= 45) snapshot = 'MaddenAI detects mixed signals across markets. '
  else if (mss >= 35) snapshot = 'MaddenAI detects mild caution across markets. '
  else snapshot = 'MaddenAI detects broadly bearish conditions. '

  if (asxAvg > 0.5) snapshot += `ASX tracking well with ${asxGainers} of ${asxChanges.length} tracked stocks advancing. `
  else if (asxAvg < -0.5) snapshot += `ASX under pressure with ${asxLosers} of ${asxChanges.length} tracked stocks in the red. `
  else if (asxChanges?.length) snapshot += 'ASX broadly flat, with gains and losses evenly distributed. '

  if (cmi >= 65) snapshot += `Crypto momentum is strong (${cmi}/100). `
  else if (cmi <= 35) snapshot += `Crypto momentum is weak (${cmi}/100). `

  if (fearGreed) snapshot += `Market sentiment: ${fgLbl} (Fear & Greed: ${fgVal}/100).`
  return snapshot.trim()
}
