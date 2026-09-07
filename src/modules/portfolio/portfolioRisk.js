import { getMockFMPHistory } from '../../services/mockData'
import { SECTOR_BY_SYMBOL } from './sectorMap'

// ─── Portfolio risk maths ───────────────────────────────────────────────────
//
// Beta, volatility, Sharpe and max drawdown, in one place.
//
// This lived inside PortfolioAnalytics' render body, alongside its own private
// copy of SECTOR_BY_SYMBOL — which sectorMap.js already exported — and its own
// copy of BETA_BY_SECTOR, which StressTest.jsx also has. The Performance tab
// needs the same four numbers, and a second copy of a Sharpe calculation is a
// second Sharpe calculation to keep in step. One home, two callers.
//
// WHAT THESE NUMBERS ARE. Beta is a sector-weighted book value, not a
// regression against an index — this app has no index return series to regress
// against. Volatility and drawdown come from each holding's own demo price
// history, so they are as real as the prices underneath them, which are
// labelled DEMO everywhere they appear. The cards that render these say so.

// Illustrative betas by sector. Keys match mockData.js's sector strings.
export const BETA_BY_SECTOR = {
  Materials: 1.35, Financials: 1.10, Health: 0.75, 'Cons Disc': 1.25, Comms: 0.95,
  Industrials: 1.05, Staples: 0.55, Energy: 1.30, 'Real Est': 0.90, Utilities: 0.60, IT: 1.45,
}

// Reference annualised volatility for the ASX 200, for the "vs market" line.
export const ASX_VOL = 0.142

const histFor = (h, days) => getMockFMPHistory(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol, days)

export function computeRisk(holdings, mktTotal) {
  if (!holdings?.length || !mktTotal) return null

  // ── Beta: sector betas, weighted by position size ────────────────────────
  const weighted = holdings.map((h) => {
    const weight = (h.mktVal ?? 0) / mktTotal
    const beta = BETA_BY_SECTOR[SECTOR_BY_SYMBOL[h.symbol]] ?? (h.type === 'crypto' ? 1.8 : 1.0)
    return { symbol: h.symbol, weight, beta, contribution: weight * beta }
  })
  const portfolioBeta = weighted.reduce((s, w) => s + w.contribution, 0)
  const topDrivers = [...weighted].sort((a, b) => b.contribution - a.contribution).slice(0, 3)

  // ── Volatility: annualised stdev of daily returns, position-weighted ─────
  const portfolioVol = holdings.reduce((sum, h) => {
    const weight = (h.mktVal ?? 0) / mktTotal
    const closes = histFor(h, 90).map((d) => d.close)
    if (closes.length < 2) return sum + weight * 0.18
    const rets = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
    const mean = rets.reduce((s, r) => s + r, 0) / rets.length
    const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length
    return sum + weight * Math.sqrt(variance) * Math.sqrt(252)
  }, 0)

  // ── Sharpe: weighted since-purchase return over volatility ───────────────
  //
  // Rough and illustrative, and not risk-adjusted in the textbook sense: the
  // numerator is a since-purchase return over an unknown holding period, not
  // an annualised excess return over the risk-free rate. It is directionally
  // useful and the card says what it is rather than dressing it as the real
  // ratio.
  const avgReturnPct = holdings.reduce((s, h) => s + ((h.mktVal ?? 0) / mktTotal) * ((h.pnlPct ?? 0) / 100), 0)
  const sharpe = portfolioVol > 0 ? avgReturnPct / portfolioVol : 0

  // ── Max drawdown: peak-to-trough on a synthetic book value series ────────
  const days = 90
  const series = Array.from({ length: days }, () => 0)
  for (const h of holdings) {
    histFor(h, days).forEach((d, i) => { series[i] += d.close * h.shares })
  }
  let peak = series[0] ?? 0, peakIdx = 0, maxDD = 0, troughIdx = 0
  series.forEach((v, i) => {
    if (v > peak) { peak = v; peakIdx = i }
    const dd = peak > 0 ? (v - peak) / peak : 0
    if (dd < maxDD) { maxDD = dd; troughIdx = i }
  })

  const dayOffset = (idx) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - idx))
    return d
  }

  return {
    portfolioBeta,
    topDrivers,
    portfolioVol,
    asxVol: ASX_VOL,
    sharpe,
    maxDD,
    peakDate: dayOffset(peakIdx),
    troughDate: dayOffset(troughIdx),
    troughIdx,
    chartData: series.map((v, i) => ({ i, value: parseFloat(v.toFixed(0)) })),
  }
}
