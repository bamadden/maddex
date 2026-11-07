// ─── MaddenAI scoring engine ──────────────────────────────────────────────────
// Ported from the original Maddex app (maddenAI_scoring.js). Every score is
// anchored at 50 = neutral; it moves up/down as weighted live-data factors
// diverge from neutral. The labels describe what the data did — mostly up or
// mostly down — in plain words; "bullish/bearish" read as a market call and
// were replaced (legal-risk pass, 1 Nov 2026).

import { CREDIT } from '../data/credits.js'
export function scoreToLabel(score) {
  if (score >= 80) return 'Strongly positive'
  if (score >= 65) return 'Positive'
  if (score >= 55) return 'Mildly positive'
  if (score >= 45) return 'Balanced'
  if (score >= 35) return 'Mildly negative'
  if (score >= 20) return 'Negative'
  return 'Strongly negative'
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
  const known = changes.filter((c) => typeof c === 'number' && Number.isFinite(c))
  if (!known.length) return null
  return known.filter((c) => c > 0).length / known.length
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
//   simulated:     string[]                — input keys that are DEMO data
//                                            ('asx', 'spx'); their factors are
//                                            marked demo: true
// }
// A missing change is left out, never counted as 0%. With no inputs at all
// there is no score: null, not 50.
export function calculateMarketSentimentScore(data) {
  const factors = []
  const sim = new Set(data.simulated ?? [])

  if (typeof data.fearGreed?.value === 'number') {
    factors.push({ name: 'Crypto Fear & Greed', score: data.fearGreed.value, weight: 12 })
  }

  const asxBreadth = gainerRatio(data.asxChanges)
  if (asxBreadth !== null) {
    factors.push({ name: 'ASX Market Breadth', score: asxBreadth * 100, weight: 20, demo: sim.has('asx') })
  }

  const asxKnown = (data.asxChanges ?? []).filter((c) => typeof c === 'number' && Number.isFinite(c))
  if (asxKnown.length) {
    const avgChange = asxKnown.reduce((s, c) => s + c, 0) / asxKnown.length
    factors.push({ name: 'ASX Price Momentum', score: momentumToScore(avgChange), weight: 15, demo: sim.has('asx') })
  }

  if (data.spxChange !== undefined && data.spxChange !== null) {
    factors.push({ name: 'S&P 500 Momentum', score: momentumToScore(data.spxChange), weight: 15, demo: sim.has('spx') })
  }

  if (data.btcChange !== undefined && data.btcChange !== null) {
    factors.push({ name: 'BTC Risk Appetite', score: momentumToScore(data.btcChange), weight: 12 })
  }

  const cryptoBreadth = gainerRatio(data.cryptoChanges)
  if (cryptoBreadth !== null) {
    factors.push({ name: 'Crypto Market Breadth', score: cryptoBreadth * 100, weight: 8 })
  }

  if (factors.length === 0) return null

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const weightedSum = factors.reduce((s, f) => s + f.score * f.weight, 0)
  const finalScore = Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight)))
  const confidence = Math.round((factors.length / 6) * 100)
  const demoWeight = factors.filter((f) => f.demo).reduce((s, f) => s + f.weight, 0)

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    confidence,
    // Share of the weight resting on DEMO inputs (0–100). Above 0 the score
    // is a demo composite and every screen badges it DEMO.
    demoShare: Math.round((demoWeight / totalWeight) * 100),
    factors: factors.map((f) => ({
      ...f,
      score: Math.round(f.score),
      contribution: Math.round((f.score - 50) * (f.weight / totalWeight)),
    })),
  }
}

// ── CRYPTO MOMENTUM INDEX ─────────────────────────────────────────────────────
// Multi-factor summary of recent crypto price moves: market-cap-weighted
// 24h/7d change, breadth, Fear & Greed, and BTC's 24h volume against its
// market cap. A missing input is left out, never scored as neutral (50) or as
// a 0% move; with no inputs there is no score (null). The published method is
// data/methodology.js 'crypto-momentum'; keep the two in step.
//
// coins: [{ symbol, change24h, change7d, volume24h, marketCap }]
// fearGreed: { value } | null
export const CRYPTO_MOMENTUM_WEIGHTS = { day: 25, week: 20, breadth: 20, fearGreed: 20, btcVolume: 15 }
const CRYPTO_FACTOR_COUNT = Object.keys(CRYPTO_MOMENTUM_WEIGHTS).length
const known = (v) => typeof v === 'number' && Number.isFinite(v)

export function calculateCryptoMomentumIndex({ coins, fearGreed }) {
  const W = CRYPTO_MOMENTUM_WEIGHTS
  const factors = []
  const mcapWeights = { BTC: 5, ETH: 3, BNB: 2, SOL: 2, XRP: 1, ADA: 1 }
  const weighted = (key, toScore) => {
    let sum = 0, total = 0
    for (const c of coins ?? []) {
      if (!known(c[key])) continue
      const w = mcapWeights[c.symbol] || 1
      sum += toScore(c[key]) * w
      total += w
    }
    return total > 0 ? sum / total : null
  }

  const day = weighted('change24h', momentumToScore)
  if (day != null) factors.push({ name: '24h Momentum (mcap-weighted)', score: day, weight: W.day })

  const week = weighted('change7d', weeklyMomentumToScore)
  if (week != null) factors.push({ name: '7-Day Trend', score: week, weight: W.week })

  const breadth = gainerRatio((coins ?? []).map((c) => c.change24h))
  if (breadth !== null) factors.push({ name: 'Market Breadth', score: breadth * 100, weight: W.breadth })

  if (typeof fearGreed?.value === 'number') {
    factors.push({ name: 'Fear & Greed Index', score: fearGreed.value, weight: W.fearGreed })
  }

  // BTC's 24h volume over its market cap, signed by the day's direction: a
  // heavy-volume day reads further from 50 than a light one.
  const btc = (coins ?? []).find((c) => c.symbol === 'BTC')
  if (known(btc?.volume24h) && known(btc?.marketCap) && btc.marketCap > 0 && known(btc?.change24h)) {
    const ratio = btc.volume24h / btc.marketCap
    const up = btc.change24h >= 0
    const score = ratio > 0.07 ? (up ? 75 : 25) : ratio > 0.04 ? (up ? 62 : 38) : 50
    factors.push({ name: 'BTC volume / market cap', score, weight: W.btcVolume })
  }

  if (factors.length === 0) return null

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const weightedSum = factors.reduce((s, f) => s + f.score * f.weight, 0)
  const finalScore = Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight)))

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    confidence: Math.round((factors.length / CRYPTO_FACTOR_COUNT) * 100),
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
export function generateShortSummary({ marketSentimentScore, asxChanges, fearGreed, demo = false }) {
  const score = marketSentimentScore?.score
  const fgVal = fearGreed?.value ?? null
  const fgLbl = fearGreed?.label ?? null
  const asxKnown = (asxChanges ?? []).filter((c) => typeof c === 'number' && Number.isFinite(c))
  const asxAvg = asxKnown.length ? asxKnown.reduce((s, c) => s + c, 0) / asxKnown.length : null
  const tag = demo ? ' (DEMO)' : ''

  let parts = []
  if (asxAvg !== null) {
    if (Math.abs(asxAvg) < 0.3) parts.push(`ASX flat${tag}`)
    else if (asxAvg > 0) parts.push(`ASX +${asxAvg.toFixed(1)}%${tag}`)
    else parts.push(`ASX ${asxAvg.toFixed(1)}%${tag}`)
  }
  // Named for what it is: the crypto index, not a market-wide fear reading.
  // alternative.me's licence: the credit sits right next to the figure.
  if (fgVal !== null && fgLbl) parts.push(`Crypto Fear & Greed ${fgVal} (${fgLbl} · ${CREDIT.alternativeme.text})`)
  if (parts.length === 0 && score != null) {
    if (score >= 65) parts.push('Broad gains across markets')
    else if (score >= 55) parts.push('Mildly positive conditions')
    else if (score >= 45) parts.push('Mixed moves')
    else if (score >= 35) parts.push('Mild declines across markets')
    else parts.push('Broad declines across markets')
  }
  return parts.join(' — ')
}
