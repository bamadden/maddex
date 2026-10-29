import { useState } from 'react'
import { currentRegime, regimeHistory, TREND_GDP } from '../../services/marketRegime'

// The market-regime label (services/marketRegime classifyRegime) in two sizes:
// a compact badge for the Dashboard and a full panel for the Macro module.

export function RegimeBadge({ onClick }) {
  const [r] = useState(() => currentRegime())
  return (
    <button
      onClick={onClick}
      title={`${r.note}\nRBA: ${r.inputs.rba}\nCPI: ${r.inputs.cpi}\nGDP: ${r.inputs.gdp}\nUnemployment: ${r.inputs.unemployment}`}
      className="font-mono font-bold tracking-widest px-2 py-0.5 whitespace-nowrap"
      style={{ fontSize: 9, color: r.colour, border: `1px solid ${r.colour}80`, background: `${r.colour}14`, borderRadius: 2 }}
    >REGIME · {r.regime}</button>
  )
}

export function RegimePanel() {
  const [{ r, hist }] = useState(() => ({ r: currentRegime(), hist: regimeHistory() }))
  const rows = [
    ['RBA', r.inputs.rba], ['Fed', r.inputs.fed], ['CPI vs 2–3% target', r.inputs.cpi],
    [`GDP vs trend (${TREND_GDP}%)`, r.inputs.gdp], ['Unemployment', r.inputs.unemployment],
  ]
  return (
    <div className="border-b border-terminal-border px-4 py-3" style={{ background: `${r.colour}0A` }}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-terminal-text-dim tracking-widest" style={{ fontSize: 9 }}>MARKET REGIME</span>
        <span className="font-mono font-bold tracking-widest px-2.5 py-1" style={{ fontSize: 14, color: r.colour, border: `1px solid ${r.colour}`, background: `${r.colour}1A` }}>{r.regime}</span>
        <span className="text-xs text-terminal-text leading-snug flex-1 min-w-[220px]">{r.note}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-x-6 gap-y-3 mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 text-2xs border-b border-terminal-border/30 py-0.5">
              <span className="text-terminal-text-dim">{k}</span>
              <span className="text-terminal-text-bright font-mono text-right">{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-mono text-terminal-text-dim tracking-widest mb-1" style={{ fontSize: 8 }}>REGIME HISTORY — SAME RULES, EACH QUARTER&apos;S PUBLISHED DATA</div>
          <div className="flex gap-1">
            {[...hist, { quarter: 'NOW', regime: r.regime, colour: r.colour, note: r.note }].map((h) => (
              <div key={h.quarter} className="flex-1 min-w-0 px-1.5 py-1 text-center" title={h.inputs ? `${h.note}\nRBA: ${h.inputs.rba}\nCPI: ${h.inputs.cpi}\nGDP: ${h.inputs.gdp}${h.gdpProvisional ? ' — latest published, quarter not yet out' : ''}\nUnemployment: ${h.inputs.unemployment}` : h.note}
                style={{ border: `1px solid ${h.colour}66`, background: `${h.colour}14` }}>
                <div className="font-mono text-terminal-text-dim" style={{ fontSize: 8 }}>{h.quarter}{h.gdpProvisional ? '*' : ''}</div>
                <div className="font-mono font-bold leading-tight" style={{ fontSize: 8, color: h.colour }}>{h.regime}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-terminal-text-dim/60 mt-2 leading-snug" style={{ fontSize: 9 }}>
        Policy = direction of the RBA&apos;s last move within nine months. Slowing = GDP below {TREND_GDP}% trend, or unemployment up 0.2pt+ over six months.
        {hist.some((h) => h.gdpProvisional) && ' * Quarter\'s GDP not yet published — the latest figure is used.'} Derived from verified ABS and RBA data; a description, not a forecast.
      </div>
    </div>
  )
}
