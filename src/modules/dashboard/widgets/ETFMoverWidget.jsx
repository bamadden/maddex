import { useMemo } from 'react'
import { useEtfPrices } from '../../etf/useEtfPrices'
import { WidgetBody, WidgetRows, WidgetRow } from './_shared'
import { goModule } from './navigate'

// The three ETFs that have moved most today, either direction. Prices run on
// the ETF module's simulated tick, and the tile says so.
export default function ETFMoverWidget() {
  const etfs = useEtfPrices()
  const top = useMemo(
    () => [...etfs].sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct)).slice(0, 3),
    [etfs],
  )

  return (
    <WidgetBody>
      <WidgetRows>
        {top.map((e) => (
          <WidgetRow
            key={e.ticker}
            label={e.ticker}
            value={`A$${e.livePrice.toFixed(2)}`}
            change={e.dayPct}
            onClick={() => goModule('etf')}
          />
        ))}
      </WidgetRows>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[8px]" style={{ color: '#4A6080' }}>DEMO · simulated tick</span>
        <button onClick={() => goModule('etf')} className="font-mono text-[9px] tracking-widest" style={{ color: '#4A6080' }}>
          ETFs →
        </button>
      </div>
    </WidgetBody>
  )
}
