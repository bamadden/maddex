import { useState, useMemo } from 'react'
import { formatDate, sydneyClock } from '../../utils/dateUtils'
import { MOCK_ASX_STOCKS, getMockFMPRow, todayVolumeRatio } from '../../services/mockData'
import PriceChange from '../../components/ui/PriceChange'
import { dispatchAskAI } from '../../utils/askAI'
import { DemoBadge } from '../../components/ui/ModuleStates'
import { PAL } from '../../styles/palette.js'

// Volume vs average comes from todayVolumeRatio — the same measure the
// scanner's volume tab uses, read off the daily bars. This panel used to roll
// its own random ratio per refresh (the demo bars had no volume variation for
// it to read), so it and the scanner flagged different stocks at different
// multiples. The demo bars now carry volume that scales with the day's move.
const ASX_TOP_20 = Object.keys(MOCK_ASX_STOCKS).slice(0, 20)

// Each flag names the criterion it matched — a description of the demo
// bars, never an inference about who is trading or what comes next. Until
// 3 Nov 2026 the cards guessed at institutional buying or selling and
// suggested watching for a follow-through.
// Priority: the >3× volume flag wins when a stock matches more than one.
const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
function classify(volumeRatio, priceChange) {
  const absChange = Math.abs(priceChange)
  const fact = `Volume ${volumeRatio.toFixed(1)}× its 20-day average; price ${pct(priceChange)} on the day.`
  if (volumeRatio > 3.0) {
    return { type: 'VOLUME_3X', label: 'VOLUME > 3× 20-DAY AVG', icon: '⚡', interpretation: fact }
  }
  if (volumeRatio > 2.5 && absChange > 2.0) {
    return { type: 'VOLUME_MOVE', label: 'VOLUME > 2.5× AVG, MOVE > 2%', icon: '📈', interpretation: fact }
  }
  if (volumeRatio > 2.0 && absChange < 0.5) {
    return { type: 'VOLUME_FLAT', label: 'VOLUME > 2× AVG, PRICE FLAT', icon: '🔍', interpretation: fact }
  }
  return null
}


// Header-bar colour per signal type. The bar is the loudest element on the
// card, so the type is legible before any of the numbers are read.
const SIGNAL_BAR = {
  VOLUME_3X:   { bg: PAL.gold, fg: PAL.bg },
  VOLUME_MOVE: { bg: PAL.up, fg: PAL.bg },
  VOLUME_FLAT: { bg: '#3E5C7E', fg: PAL.bright },
}


export default function UnusualActivityTracker() {
  const [detectedAt] = useState(() => Date.now())

  // No timed refresh: the demo bars are fixed for the page load, so a re-read
  // every five minutes found the same thing and only reset "detected" times.

  const signals = useMemo(() => {
    const results = []
    for (const symbol of ASX_TOP_20) {
      const q = getMockFMPRow(symbol)
      if (!q) continue
      const volumeRatio = todayVolumeRatio(symbol)
      if (volumeRatio == null) continue
      const priceChange = q.regularMarketChangePercent
      const flag = classify(volumeRatio, priceChange)
      if (!flag) continue
      results.push({ symbol, name: q.shortName, volumeRatio, priceChange, ...flag })
    }
    // Most unusual first.
    return results.sort((a, b) => b.volumeRatio - a.volumeRatio)
  }, [])

  return (
    <div className="flex-shrink-0 border-b border-terminal-border">
      <div className="panel-header flex items-center gap-2">
        {/* Named for what it measures. The old heading claimed dark-pool data; Maddex
            has no dark-pool data — the panel compares today's volume with
            the 20-day average, on the demo daily bars (always: it reads
            mockData directly), so it is badged DEMO unconditionally. */}
        <span>VOLUME VS 20-DAY AVERAGE</span>
        <DemoBadge />
        <span className="text-2xs text-terminal-text-dim/50 font-normal normal-case">
          ASX top 20 · flags volume above 2× its 20-day average
        </span>
      </div>

      {signals.length === 0 ? (
        <div className="px-3 py-6 text-2xs text-terminal-text-dim/60 text-center">No unusual activity detected right now</div>
      ) : (
        <div className="divide-y divide-terminal-border/50">
          {signals.map((s) => {
            const bar = SIGNAL_BAR[s.type] ?? SIGNAL_BAR.VOLUME_FLAT
            return (
            <div key={s.symbol} className="flex flex-col">
              {/* Full-width type bar — the signal is the headline, not a
                  chip competing with the ticker beside it. */}
              <div
                className="flex items-center gap-1.5 px-3 text-[11px] font-mono font-bold tracking-widest"
                style={{ height: 24, backgroundColor: bar.bg, color: bar.fg }}
              >
                <span aria-hidden="true">{s.icon}</span>
                <span>{s.label}</span>
                {/* Every card: what class the data is, and as at when. */}
                <span className="ml-auto flex items-center gap-1.5 font-normal" data-data-date>
                  <DemoBadge />
                  <span className="opacity-80">as at {formatDate(detectedAt, { year: false })} {sydneyClock(detectedAt).text}</span>
                </span>
              </div>

              <div className="px-3 py-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs font-bold text-terminal-gold flex-shrink-0">{s.symbol.replace('.AX', '')}</span>
                  <span className="text-2xs text-terminal-text-dim truncate">{s.name}</span>
                </div>

                {/* Stats row — compact, evenly spaced, labels beneath values */}
                <div className="flex items-center gap-4 mt-1.5">
                  <div>
                    <div className="text-[11px] font-mono tracking-widest text-terminal-muted/70 uppercase">Volume</div>
                    <div className="text-2xs font-mono font-bold text-terminal-text-bright">{s.volumeRatio.toFixed(1)}× avg</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono tracking-widest text-terminal-muted/70 uppercase">Price</div>
                    <PriceChange pct={s.priceChange} size="text-2xs" pill />
                  </div>
                </div>

                <div className="flex items-end gap-3 mt-1.5">
                  <p className="flex-1 min-w-0 text-2xs text-terminal-text-dim leading-snug line-clamp-2">
                    {s.interpretation}
                  </p>
                  <button
                    onClick={() => dispatchAskAI({
                      ticker: s.symbol, name: s.name,
                      change: `${s.priceChange >= 0 ? '+' : ''}${s.priceChange.toFixed(2)}%`,
                      instruction: `${s.symbol.replace('.AX', '')} (DEMO data — simulated prices and volume): volume ${s.volumeRatio.toFixed(1)}x its 20-day average, price ${s.priceChange >= 0 ? 'up' : 'down'} ${Math.abs(s.priceChange).toFixed(2)}% on the day. Describe, in general terms, what volume and price moves of this kind measure. These are demo figures; do not suggest any action.`,
                    }, { rawPrompt: true })}
                    className="btn-secondary btn-sm flex-shrink-0"
                  >ANALYSE</button>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
