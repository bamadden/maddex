import { useState } from 'react'
import { compound } from '../../calculators/calcMath'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'
import { sendModuleIntent } from '../../../services/moduleIntent'
import { PAL } from '../../../styles/palette.js'

// A lump sum compounding annually — the calculator people reach for most,
// small enough to live on the dashboard. Arithmetic only; nothing is fetched.
function Field({ label, value, onChange, prefix, suffix, width = 64 }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="font-mono text-[11px]" style={{ color: PAL.muted, letterSpacing: '0.1em' }}>{label}</span>
      <span className="flex items-center gap-0.5 font-mono text-[11px]" style={{ color: PAL.dim }}>
        {prefix}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          inputMode="decimal"
          className="bg-transparent text-right tabular-nums outline-none border-b focus:border-terminal-gold"
          style={{ width, color: PAL.bright, borderColor: 'rgba(99,120,153,0.3)' }}
        />
        {suffix}
      </span>
    </label>
  )
}

export default function CalcQuickWidget() {
  const [initial, setInitial] = useState('10000')
  const [rate, setRate] = useState('8')
  const [years, setYears] = useState('10')

  const p = Number(initial), r = Number(rate), y = Math.min(100, Math.round(Number(years)))
  const valid = p > 0 && r >= 0 && y > 0
  const result = valid
    ? compound({ initial: p, contribution: 0, contributionsPerYear: 1, annualRate: r, years: y, compoundsPerYear: 1 }).final
    : null

  return (
    <WidgetBody>
      <div className="flex flex-col gap-1.5">
        <Field label="INITIAL" value={initial} onChange={setInitial} prefix="A$" width={72} />
        <Field label="RETURN" value={rate} onChange={setRate} suffix="% p.a." width={36} />
        <Field label="YEARS" value={years} onChange={setYears} width={36} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1">
        <div className="font-mono tabular-nums leading-none" style={{ fontSize: 20, color: PAL.gold }}>
          {result != null ? `A$${Math.round(result).toLocaleString('en-AU')}` : '—'}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px]" style={{ color: PAL.muted }}>compounded annually · before tax & fees</span>
          <button
            onClick={() => { sendModuleIntent('calculators', { tab: 'investment' }); goModule('calculators') }}
            className="font-mono text-[11px] tracking-widest flex-shrink-0"
            style={{ color: PAL.muted }}
          >CALC →</button>
        </div>
      </div>
    </WidgetBody>
  )
}
