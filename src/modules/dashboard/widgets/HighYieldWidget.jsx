import { useMemo } from 'react'
import VERIFIED_CONSTANTS from '../../../data/verifiedConstants'
import { MOCK_ASX_STOCKS } from '../../../services/mockData'
import { WidgetBody, WidgetEmpty } from './_shared'
import { goModule } from './navigate'

// The screener's HIGH YIELD INCOME screen (ASX · yield > 5% · PE < 20), top
// five by yield, against the cash rate — the "is the yield worth the risk"
// question in one tile. Demo fundamentals, as in the screener.
export default function HighYieldWidget() {
  const cash = VERIFIED_CONSTANTS.rba.cashRate
  const rows = useMemo(() => Object.entries(MOCK_ASX_STOCKS)
    .map(([symbol, s]) => ({ symbol, ...s }))
    .filter((s) => s.divYield > 5 && s.pe > 0 && s.pe < 20)
    .sort((a, b) => b.divYield - a.divYield)
    .slice(0, 5), [])
  if (!rows.length) return <WidgetEmpty action="OPEN SCREENER" onAction={() => goModule('screener')}>Nothing passes the screen today</WidgetEmpty>
  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 flex flex-col justify-start gap-[5px]">
        {rows.map((s) => (
          <button key={s.symbol} onClick={() => goModule('screener')} className="flex items-center gap-2 w-full min-w-0 hover:opacity-80 transition-opacity font-mono" style={{ fontSize: 10 }}>
            <span className="font-bold flex-shrink-0" style={{ color: '#E8EDF5', width: 38 }}>{s.symbol.replace(/\.AX$/i, '')}</span>
            <span className="truncate min-w-0" style={{ color: '#8BA3C4', fontSize: 9 }}>PE {s.pe.toFixed(1)}</span>
            <span className="ml-auto tabular-nums flex-shrink-0" style={{ color: '#C9A84C' }}>{s.divYield.toFixed(1)}%</span>
            <span className="tabular-nums flex-shrink-0" style={{ color: s.divYield >= cash ? '#2D8A50' : '#E8A33D', fontSize: 9, width: 44, textAlign: 'right' }}>
              {s.divYield >= cash ? '+' : '−'}{Math.abs(s.divYield - cash).toFixed(1)}pp
            </span>
          </button>
        ))}
      </div>
      <span className="font-mono text-[8px] flex-shrink-0" style={{ color: '#4A6080' }}>vs RBA cash {cash.toFixed(2)}% · before franking · demo yields</span>
    </WidgetBody>
  )
}
