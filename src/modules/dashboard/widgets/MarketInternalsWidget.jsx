import { useMemo } from 'react'
import { getMockFMPHistory } from '../../../services/mockData'
import { USING_MOCK_DATA } from '../../../services/api'
import { ASX_UNIVERSE, useAsxUniverseQuotes } from '../../markets/useAsxUniverse'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'

// ASX breadth in one tile, from the SAME universe and quotes as the Markets
// module's MARKET INTERNALS panel (useAsxUniverse), so the two counts agree.
// Advance/decline from today's quotes; the share above the 50-day average
// from daily closes — in demo mode only, where those closes are local. Live,
// that needs a year of history per name, which the Markets panel fetches and
// a dashboard tile should not.
export default function MarketInternalsWidget() {
  const { data } = useAsxUniverseQuotes()
  const s = useMemo(() => {
    let adv = 0, dec = 0
    for (const q of Object.values(data?.data ?? {})) {
      const chg = q?.dayChangePct
      if (!Number.isFinite(chg) || Math.abs(chg) < 0.05) continue
      if (chg > 0) adv++
      else dec++
    }
    let above = 0, n50 = 0
    if (USING_MOCK_DATA) {
      for (const sym of ASX_UNIVERSE) {
        const closes = getMockFMPHistory(sym, 60).map((h) => h.close)
        if (closes.length < 50) continue
        n50++
        const ma = closes.slice(-50).reduce((a, b) => a + b, 0) / 50
        if (closes[closes.length - 1] > ma) above++
      }
    }
    return { adv, dec, above50: n50 ? (above / n50) * 100 : null }
  }, [data])
  const total = s.adv + s.dec || 1
  return (
    <WidgetBody>
      <button onClick={() => goModule('markets')} className="text-left flex-1 min-h-0 flex flex-col gap-2 hover:opacity-90 transition-opacity">
        <div className="font-mono" style={{ fontSize: 9, color: '#8BA3C4', letterSpacing: '0.1em' }}>ADVANCE / DECLINE</div>
        <div className="flex items-baseline gap-3 font-mono tabular-nums">
          <span style={{ fontSize: 18, color: '#2D8A50' }}>▲ {s.adv}</span>
          <span style={{ fontSize: 18, color: '#A83232' }}>▼ {s.dec}</span>
          <span style={{ fontSize: 9, color: '#4A6080' }}>A/D {(s.adv / Math.max(1, s.dec)).toFixed(2)}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(74,96,128,0.2)' }}>
          <div style={{ width: `${(s.adv / total) * 100}%`, background: '#2D8A50' }} />
          <div style={{ width: `${(s.dec / total) * 100}%`, background: '#A83232' }} />
        </div>
        {s.above50 != null && (
          <div className="font-mono" style={{ fontSize: 10, color: '#E8EDF5' }}>
            {s.above50.toFixed(0)}% <span style={{ color: '#8BA3C4', fontSize: 9 }}>above their 50-day average</span>
          </div>
        )}
      </button>
      <span className="font-mono text-[8px] flex-shrink-0" style={{ color: '#4A6080' }}>{USING_MOCK_DATA ? 'DEMO · ' : ''}{ASX_UNIVERSE.length} tracked ASX names · same as Markets</span>
    </WidgetBody>
  )
}
