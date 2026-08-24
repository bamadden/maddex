import { useState, useEffect, useMemo } from 'react'
import { MOCK_ASX_STOCKS, getMockFMPRow } from '../../services/mockData'
import { dispatchAskAI } from '../../utils/askAI'

// getMockFMPRow's own regularMarketVolume/averageVolume always land at a
// fixed ~1.09x ratio (averageVolume is a flat 0.92x of regularMarketVolume
// for every symbol — see mockData.js), which would never cross any of this
// tracker's 2.0/2.5/3.0x thresholds. So volume ratio here is its own
// date-seeded generator (skewed so a realistic minority of stocks spike),
// while price change still comes from the real, per-stock-jittered
// regularMarketChangePercent — a deliberate mock-design choice, not an
// oversight.
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function seededVolumeRatio(symbol, refreshTick) {
  const rng = mulberry32(hashStr(`${symbol}_volratio_${refreshTick}`))
  const r = rng()
  if (r < 0.15) return 3.0 + rng() * 2.5  // unusual volume band
  if (r < 0.35) return 2.0 + rng() * 1.5  // accumulation / high-conviction band
  return 0.5 + rng() * 1.3                 // normal
}

const ASX_TOP_20 = Object.keys(MOCK_ASX_STOCKS).slice(0, 20)

// Priority mirrors the brief's own examples: a >3.0x ratio is flagged as
// UNUSUAL VOLUME even when it also satisfies the accumulation pattern (the
// interpretation text still calls out accumulation/distribution in that
// case); HIGH CONVICTION and ACCUMULATION/DISTRIBUTION are mutually
// exclusive by their price-change conditions, so there's no real ordering
// conflict between those two.
function classify(volumeRatio, priceChange) {
  const absChange = Math.abs(priceChange)
  if (volumeRatio > 3.0) {
    return {
      type: 'UNUSUAL_VOLUME',
      label: 'UNUSUAL VOLUME',
      icon: '⚡',
      interpretation: absChange < 0.5
        ? `High volume with flat price suggests possible institutional ${priceChange >= 0 ? 'accumulation' : 'distribution'}`
        : 'Unusually high volume — worth watching for follow-through',
    }
  }
  if (volumeRatio > 2.5 && absChange > 2.0) {
    return {
      type: 'HIGH_CONVICTION',
      label: 'HIGH CONVICTION MOVE',
      icon: '📈',
      interpretation: 'Strong volume confirms the move — not a low-liquidity spike',
    }
  }
  if (volumeRatio > 2.0 && absChange < 0.5) {
    return {
      type: 'ACCUMULATION',
      label: priceChange >= 0 ? 'POSSIBLE ACCUMULATION' : 'POSSIBLE DISTRIBUTION',
      icon: '🔍',
      interpretation: `High volume with flat price suggests possible institutional ${priceChange >= 0 ? 'accumulation' : 'distribution'}`,
    }
  }
  return null
}

function timeAgo(ms) {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export default function UnusualActivityTracker() {
  const [refreshTick, setRefreshTick] = useState(0)
  const [detectedAt] = useState(() => Date.now())

  // Auto-refresh every 5 minutes, per the brief.
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  const signals = useMemo(() => {
    const results = []
    for (const symbol of ASX_TOP_20) {
      const q = getMockFMPRow(symbol)
      if (!q) continue
      const volumeRatio = seededVolumeRatio(symbol, refreshTick)
      const priceChange = q.regularMarketChangePercent
      const flag = classify(volumeRatio, priceChange)
      if (!flag) continue
      results.push({ symbol, name: q.shortName, volumeRatio, priceChange, ...flag })
    }
    // Most unusual first.
    return results.sort((a, b) => b.volumeRatio - a.volumeRatio)
  }, [refreshTick])

  return (
    <div className="flex-shrink-0 border-b border-terminal-border">
      <div className="panel-header flex items-center gap-2">
        <span>UNUSUAL ACTIVITY · DARK POOL SIGNALS</span>
        <span className="text-2xs text-terminal-text-dim/50 font-normal normal-case">
          ASX top 20 · volume-vs-average · auto-refresh 5min
        </span>
      </div>

      {signals.length === 0 ? (
        <div className="px-3 py-6 text-2xs text-terminal-text-dim/60 text-center">No unusual activity detected right now</div>
      ) : (
        <div className="divide-y divide-terminal-border/50">
          {signals.map((s) => (
            <div key={s.symbol} className="flex items-start gap-3 px-3 py-2.5">
              <span className="text-base flex-shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xs font-bold text-terminal-gold tracking-widest">{s.label}</span>
                  <span className="text-2xs font-bold text-terminal-text-bright">{s.symbol.replace('.AX', '')}</span>
                  <span className="text-2xs text-terminal-text-dim">{s.name}</span>
                </div>
                <div className="text-2xs text-terminal-text mt-0.5">
                  Volume: {s.volumeRatio.toFixed(1)}x average · Price: {s.priceChange >= 0 ? '+' : ''}{s.priceChange.toFixed(2)}%
                </div>
                <div className="text-2xs text-terminal-text-dim italic mt-0.5">"{s.interpretation}"</div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-2xs text-terminal-text-dim/50">{timeAgo(detectedAt)}</span>
                <button
                  onClick={() => dispatchAskAI({
                    ticker: s.symbol, name: s.name,
                    change: `${s.priceChange >= 0 ? '+' : ''}${s.priceChange.toFixed(2)}%`,
                    instruction: `${s.symbol.replace('.AX', '')} is showing ${s.label.toLowerCase()} — volume is ${s.volumeRatio.toFixed(1)}x its average with price ${s.priceChange >= 0 ? 'up' : 'down'} ${Math.abs(s.priceChange).toFixed(2)}% today. What's the most likely explanation, and is this worth acting on?`,
                  }, { rawPrompt: true })}
                  className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >ANALYSE</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
