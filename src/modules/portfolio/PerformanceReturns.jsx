import { useState } from 'react'
import Tooltip from '../../components/ui/Tooltip'
import { TAX_RATES, MEDICARE_LEVY, MIN_ANNUALISE_DAYS } from '../../services/performanceMath'
import { basisOf, taxNoteFor } from './performanceModel'

// ─── Performance summary, returns by holding, tax controls ─────────────────
//
// Reads the model from performanceModel.js. Every figure here is arithmetic
// on what the user entered (units, cost, dates, dividends) and the current
// price — which is DEMO data in this build, as the rest of the module says.

const fmtPct = (v, dp = 1) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(dp)}%`)
const tone = (v) => (v == null ? '#8BA3C4' : v >= 0 ? '#2D8A50' : '#CC4444')
const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

function Annualised({ value, days }) {
  if (days < MIN_ANNUALISE_DAYS) {
    return <span className="text-terminal-text-dim/60">{Math.round(days)} day{Math.round(days) === 1 ? '' : 's'} held — too short to annualise</span>
  }
  return <span style={{ color: tone(value) }}>{fmtPct(value)} annualised</span>
}

function Stat({ label, title, value, sub, colour }) {
  return (
    <div className="px-3 py-2.5 min-w-0">
      <div className="font-mono text-[8px] tracking-[0.18em] text-terminal-text-dim mb-1">{label}</div>
      {title && <div className="font-mono text-[11px] font-bold text-terminal-text-bright truncate">{title}</div>}
      <div className="font-mono text-lg font-bold tabular-nums" style={{ color: colour }}>{value}</div>
      <div className="font-mono text-[9px] mt-0.5">{sub}</div>
    </div>
  )
}

export function TaxControls({ afterTax, setAfterTax, rate, setRate, medicare, setMedicare }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex border border-terminal-border rounded-full overflow-hidden">
        {[[false, 'PRE-TAX'], [true, 'AFTER-TAX (EST.)']].map(([v, l]) => (
          <button key={l} onClick={() => setAfterTax(v)}
            className={`text-2xs px-2.5 py-0.5 font-bold transition-colors ${afterTax === v ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
          >{l}</button>
        ))}
      </div>
      {afterTax && (
        <>
          <label className="flex items-center gap-1 text-2xs text-terminal-text-dim">
            Marginal rate
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))}
              className="bg-terminal-surface border border-terminal-border text-terminal-text-bright text-2xs px-1 py-0.5">
              {TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-2xs text-terminal-text-dim cursor-pointer">
            <input type="checkbox" checked={medicare} onChange={(e) => setMedicare(e.target.checked)} />
            +{MEDICARE_LEVY}% Medicare levy
          </label>
        </>
      )}
    </div>
  )
}

export function PerformanceSummary({ model, afterTax, fmtCur, taxRate }) {
  const p = model.portfolio
  const b = basisOf(afterTax)
  const ranked = [...model.positions].sort((x, y) => y[b.ret] - x[b.ret])
  const best = ranked[0]
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null
  const divNote = p.divRecorded > 0 && p.divEstimated > 0
    ? `includes ${fmtCur(p.divRecorded)} recorded + ${fmtCur(p.divEstimated)} estimated dividends`
    : p.divRecorded > 0 ? `includes ${fmtCur(p.divRecorded)} recorded dividends`
      : p.divEstimated > 0 ? `includes ${fmtCur(p.divEstimated)} estimated dividends` : 'no dividend income'

  return (
    <div className="border-b border-terminal-border">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-terminal-border/60">
        <Stat label="BEST PERFORMER" title={best.label} value={fmtPct(best[b.ret])} colour={tone(best[b.ret])}
          sub={<Annualised value={best[b.ann]} days={best.days} />} />
        {worst ? (
          <Stat label="WORST PERFORMER" title={worst.label} value={fmtPct(worst[b.ret])} colour={tone(worst[b.ret])}
            sub={<Annualised value={worst[b.ann]} days={worst.days} />} />
        ) : (
          <Stat label="WORST PERFORMER" value="—" colour="#4A6080" sub={<span className="text-terminal-text-dim/60">One position — nothing to rank</span>} />
        )}
        <Stat label={`PORTFOLIO RETURN (${b.label.toUpperCase()})`} value={fmtPct(p[b.ret])} colour={tone(p[b.ret])}
          sub={<Annualised value={p[b.ann]} days={p.days} />} />
      </div>
      <div className="px-3 pb-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[9px] text-terminal-text-dim">
        <span>Since {fmtDay(p.firstDate)}</span>
        <span>Price return <b className="tabular-nums" style={{ color: tone(p.priceRet) }}>{fmtPct(p.priceRet)}</b></span>
        <span>Total return <b className="tabular-nums" style={{ color: tone(p.totalRet) }}>{fmtPct(p.totalRet)}</b> <span className="text-terminal-text-dim/60">({divNote})</span></span>
        {afterTax && <span>Est. CGT if sold today <b className="text-terminal-text-bright tabular-nums">{fmtCur(p.cgt.tax)}</b> at {taxRate}%</span>}
        <span>
          Same purchases in cash <b className="tabular-nums" style={{ color: tone(p.cashRet) }}>{fmtPct(p.cashRet, 2)}</b>
          {p.bondRet != null && <> · in 10Y bonds <b className="tabular-nums" style={{ color: tone(p.bondRet) }}>{fmtPct(p.bondRet, 2)}</b></>}
        </span>
      </div>
      {p.divEstimated > 0 && (
        <div className="px-3 pb-2 font-mono text-[8px] text-terminal-text-dim/50 leading-snug">
          Total return includes estimated dividends based on current yields where no dividend has been recorded.
          Actual dividends depend on ex-dividend dates — record them in Transactions to replace the estimate.
        </div>
      )}
      {afterTax && (
        <div className="px-3 pb-2 font-mono text-[8px] text-terminal-text-dim/50 leading-snug">{taxNoteFor(taxRate)}</div>
      )}
    </div>
  )
}

function LotTip({ position, fmtCur }) {
  return (
    <div className="font-mono text-[10px] leading-relaxed">
      {position.lots.map((l, i) => (
        <div key={i}>
          LOT {i + 1}: {l.units} units @ {l.currency === 'USD' ? 'US$' : 'A$'}{Number(l.price).toFixed(2)} ({fmtDay(l.date)})
          {l.longTerm ? ' · CGT discount' : ''}
        </div>
      ))}
      {position.lots.length > 1 && (
        <div className="mt-1 pt-1 border-t border-terminal-border/50">
          Combined: {position.units} units @ {fmtCur(position.avgCostAud)} avg
        </div>
      )}
    </div>
  )
}

export function ReturnsTable({ model, afterTax, fmtCur }) {
  const [sortKey, setSortKey] = useState(null)
  const b = basisOf(afterTax)
  const rows = [...model.positions].sort((x, y) => (sortKey ? y[sortKey] - x[sortKey] : y.value - x.value))
  const th = (label, key, cls = 'text-right') => (
    <th className={`px-2 py-1 font-normal ${cls} ${key ? 'cursor-pointer hover:text-terminal-gold' : ''}`}
      onClick={key ? () => setSortKey((k) => (k === key ? null : key)) : undefined}>
      {label}{sortKey === key ? ' ▾' : ''}
    </th>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[10px]">
        <thead>
          <tr className="text-terminal-text-dim border-b border-terminal-border/60 text-[9px] tracking-wider">
            {th('HOLDING', null, 'text-left')}
            {th('SINCE', null, 'text-left')}
            {th('COST', 'cost')}
            {th('VALUE', 'value')}
            {th('PRICE', 'priceRet')}
            {th('DIVIDENDS', 'divs')}
            {th(afterTax ? 'AFTER-TAX' : 'TOTAL', b.ret)}
            {th('ANNUALISED', null, 'text-left')}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.key} className="border-b border-terminal-border/25 hover:bg-terminal-accent/10">
              <td className="px-2 py-1 text-left">
                <Tooltip content={<LotTip position={p} fmtCur={fmtCur} />}>
                  <span className="text-terminal-text-bright font-bold cursor-help">{p.label}</span>
                </Tooltip>
                {p.lots.length > 1 && <span className="ml-1.5 text-[8px] text-terminal-gold/70 border border-terminal-gold/30 px-1">{p.lots.length} LOTS</span>}
              </td>
              <td className="px-2 py-1 text-left text-terminal-text-dim">{fmtDay(p.firstDate)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{fmtCur(p.cost)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{fmtCur(p.value)}</td>
              <td className="px-2 py-1 text-right tabular-nums" style={{ color: tone(p.priceRet) }}>{fmtPct(p.priceRet)}</td>
              <td className="px-2 py-1 text-right tabular-nums text-terminal-text-dim">
                {p.divs > 0 ? fmtCur(p.divs) : '—'}
                {p.divs > 0 && <span className="ml-1 text-[8px] text-terminal-text-dim/60">{p.divRecorded > 0 ? 'REC' : 'EST'}</span>}
              </td>
              <td className="px-2 py-1 text-right tabular-nums font-bold" style={{ color: tone(p[b.ret]) }}>{fmtPct(p[b.ret])}</td>
              <td className="px-2 py-1 text-left text-[9px]"><Annualised value={p[b.ann]} days={p.days} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-2 pt-1.5 font-mono text-[8px] text-terminal-text-dim/50 leading-snug">
        Hover a ticker for its lots. Cost is the units-weighted average across all lots; days held is cost-weighted, so a
        large recent purchase counts for more than a small old one. Annualised = (1 + return)^(365 ÷ days) − 1, shown from
        {` ${MIN_ANNUALISE_DAYS}`} days. DIVIDENDS: REC = recorded in Transactions, EST = current yield accrued since purchase.
      </div>
    </div>
  )
}
