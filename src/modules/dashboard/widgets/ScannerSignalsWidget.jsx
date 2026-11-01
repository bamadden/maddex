import { useMemo } from 'react'
import { scanBreakouts, scanOversold, scanOverbought, scanVolume } from '../../../services/scannerService'
import { setModuleIntent } from '../../../services/moduleIntent'
import { WidgetBody, WidgetEmpty } from './_shared'
import { goModule } from './navigate'
import { PAL } from '../../../styles/palette.js'

// The scanner's strongest current signals — the same scan functions the
// Scanner module runs, on the same DEMO price series, so a signal here is one
// the scanner shows. Volume and breakouts first, then RSI extremes.
const TYPES = [
  ['BREAKOUT', PAL.up, scanBreakouts, 'breakouts'],
  ['VOLUME', PAL.gold, scanVolume, 'volume'],
  ['OVERSOLD', '#4A7BDB', scanOversold, 'oversold'],
  ['OVERBOUGHT', PAL.down, scanOverbought, 'overbought'],
]

export default function ScannerSignalsWidget() {
  // Up to two per signal type, one row per stock — a name that is both a
  // breakout and a volume spike shows once, under the first.
  const rows = useMemo(() => {
    const seen = new Set()
    return TYPES.flatMap(([type, colour, scan, tab]) => scan()
      .filter((r) => !seen.has(r.symbol))
      .slice(0, 2)
      .map((r) => { seen.add(r.symbol); return { ...r, type, colour, tab } }))
      .slice(0, 6)
  }, [])
  if (!rows.length) return <WidgetEmpty action="OPEN SCANNER" onAction={() => goModule('scanner')}>No signals right now</WidgetEmpty>
  const open = (tab) => { setModuleIntent('scanner', { tab }); goModule('scanner') }
  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 flex flex-col justify-start gap-[5px]">
        {rows.map((r) => (
          <button key={`${r.type}-${r.symbol}`} onClick={() => open(r.tab)} className="flex items-center gap-2 w-full min-w-0 hover:opacity-80 transition-opacity font-mono" style={{ fontSize: 11 }}>
            <span className="font-bold flex-shrink-0" style={{ color: r.colour, fontSize: 11, letterSpacing: '0.1em', width: 64 }}>{r.type}</span>
            <span className="font-bold truncate" style={{ color: PAL.bright }}>{String(r.symbol).replace(/\.AX$/i, '')}</span>
            <span className="ml-auto tabular-nums flex-shrink-0" style={{ color: r.changePct >= 0 ? PAL.up : PAL.down }}>
              {r.changePct >= 0 ? '▲' : '▼'}{Math.abs(r.changePct).toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
      <span className="font-mono text-[11px] flex-shrink-0" style={{ color: PAL.muted }}>DEMO · scanner signals from simulated prices</span>
    </WidgetBody>
  )
}
