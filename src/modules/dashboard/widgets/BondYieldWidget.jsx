import { useBondYields } from '../../bonds/useBondYields'
import { BOND_CURVES_AS_OF } from '../../../data/bondCurves'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'
import { PAL } from '../../../styles/palette.js'

// AU and US 10Y side by side, with the spread between them — the one number
// that says which way yield is pulling the AUD. Seeds are the sourced closes
// in bondCurves.js; the tick on top is simulated and labelled as such.
function Yield({ label, colour, row }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[11px]" style={{ color: PAL.muted, letterSpacing: '0.14em' }}>{label}</div>
      <div className="font-mono tabular-nums leading-none mt-1" style={{ fontSize: 20, color: colour }}>
        {row ? `${row.yield.toFixed(2)}%` : '—'}
      </div>
      {row && (
        <div className="font-mono text-[11px] tabular-nums mt-1" style={{ color: row.changeBp >= 0 ? PAL.up : PAL.down }}>
          {row.changeBp >= 0 ? '▲' : '▼'}{Math.abs(row.changeBp).toFixed(1)}bp
        </div>
      )}
    </div>
  )
}

export default function BondYieldWidget() {
  const au = useBondYields('AU').find((r) => r.maturity === '10Y')
  const us = useBondYields('US').find((r) => r.maturity === '10Y')
  const spreadBp = au && us ? Math.round((au.yield - us.yield) * 100) : null

  return (
    <WidgetBody>
      <div className="grid grid-cols-2 gap-3">
        <Yield label="AU 10Y" colour={PAL.gold} row={au} />
        <Yield label="US 10Y" colour="#4A7FB5" row={us} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1.5">
        {spreadBp != null && (
          <div className="font-mono text-[11px]" style={{ color: PAL.dim }}>
            AU–US: <span className="tabular-nums" style={{ color: PAL.bright }}>{spreadBp >= 0 ? '+' : ''}{spreadBp}bp</span>
            <span style={{ color: PAL.muted }}> {spreadBp >= 0 ? 'AU premium' : 'US premium'}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] truncate" style={{ color: PAL.muted }}>
            close {BOND_CURVES_AS_OF.AU} · tick simulated
          </span>
          <button onClick={() => goModule('bonds')} className="font-mono text-[11px] tracking-widest flex-shrink-0" style={{ color: PAL.muted }}>
            BONDS →
          </button>
        </div>
      </div>
    </WidgetBody>
  )
}
