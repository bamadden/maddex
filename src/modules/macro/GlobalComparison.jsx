import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

// ─── Global economic comparison ─────────────────────────────────────────────
//
// Australia beside the five economies that move its markets. Every figure is
// a dated verifiedConstants reading from the statistics office or central
// bank; nothing is approximated. Growth measures differ by economy — the US
// and Japan headline annualised quarterly growth, the rest year-on-year — and
// the table says which, rather than putting unlike numbers in one column
// unmarked. STANCE is the direction of each bank's LAST decision, not a
// forecast of its next.

const STANCE = {
  HIKE: { label: 'HIKING', colour: '#E8A33D' },
  HOLD: { label: 'HOLDING', colour: '#C9A84C' },
  CUT: { label: 'EASING', colour: '#4A9EDB' },
}

const short = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—')

export default function GlobalComparison() {
  const C = VERIFIED_CONSTANTS
  const { au, us, eu, uk, jp, cn } = C
  const rows = [
    { flag: '🇦🇺', name: 'Australia', key: 'au', growth: au.gdpAnnual, gLabel: `y/y ${au.gdpPeriod.replace(' quarter', '')}`, cpi: au.cpi, cLabel: au.cpiPeriod, bank: C.rba, bankName: 'RBA', src: 'ABS · RBA', home: true },
    { flag: '🇺🇸', name: 'United States', key: 'us', growth: us.gdpQoQAnnualised, gLabel: `q/q ann. ${us.gdpPeriod}`, cpi: us.cpi, cLabel: us.cpiPeriod, bank: C.fed, bankName: 'Fed', src: 'BEA · BLS · Fed' },
    { flag: '🇪🇺', name: 'Euro area', key: 'eu', growth: eu.gdpYoY, gLabel: `y/y ${eu.gdpPeriod}`, cpi: eu.cpi, cLabel: eu.cpiPeriod, bank: C.ecb, bankName: 'ECB', src: 'Eurostat · ECB' },
    { flag: '🇬🇧', name: 'United Kingdom', key: 'uk', growth: uk.gdpYoY, gLabel: `y/y ${uk.gdpPeriod}`, cpi: uk.cpi, cLabel: uk.cpiPeriod, bank: C.boe, bankName: 'BoE', src: 'ONS · BoE' },
    { flag: '🇯🇵', name: 'Japan', key: 'jp', growth: jp.gdpQoQAnnualised, gLabel: `q/q ann. ${jp.gdpPeriod}`, cpi: jp.cpi, cLabel: jp.cpiPeriod, bank: C.boj, bankName: 'BoJ', src: 'Stats Bureau · Cabinet Office · BoJ' },
    { flag: '🇨🇳', name: 'China', key: 'cn', growth: cn.gdpYoY, gLabel: `y/y ${cn.gdpPeriod}`, cpi: cn.cpi, cLabel: cn.cpiPeriod, bank: C.pboc, bankName: 'PBOC 1Y LPR', src: 'NBS · PBOC' },
  ]

  return (
    <div className="border border-terminal-border">
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span className="text-terminal-gold">GLOBAL ECONOMIC COMPARISON</span>
        <VerifiedBadge dataKey="eu" alwaysShow />
        <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case">latest official prints · stance = last decision</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-2xs font-mono">
          <thead>
            <tr className="text-terminal-text-dim text-[9px] tracking-widest border-b border-terminal-border">
              <th className="text-left py-1.5 px-3 font-normal">ECONOMY</th>
              <th className="text-right py-1.5 px-3 font-normal">GROWTH</th>
              <th className="text-right py-1.5 px-3 font-normal">INFLATION</th>
              <th className="text-right py-1.5 px-3 font-normal">POLICY RATE</th>
              <th className="text-left py-1.5 px-3 font-normal">STANCE</th>
              <th className="text-left py-1.5 px-3 font-normal hidden lg:table-cell">SOURCE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = STANCE[(r.bank?.lastDecisionVerb ?? 'HOLD').toUpperCase()] ?? STANCE.HOLD
              return (
                <tr key={r.key} className="border-b border-terminal-border/40" style={r.home ? { background: 'rgba(201,168,76,0.06)' } : undefined}>
                  <td className="py-1.5 px-3">
                    <span className="mr-1.5">{r.flag}</span>
                    <span className={r.home ? 'text-terminal-gold font-bold' : 'text-terminal-text-bright'}>{r.name}</span>
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">
                    <span className="text-terminal-text-bright">{r.growth != null ? `${r.growth.toFixed(1)}%` : '—'}</span>
                    <div className="text-[8px] text-terminal-text-dim/60">{r.gLabel}</div>
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">
                    <span className="text-terminal-text-bright">{r.cpi != null ? `${r.cpi.toFixed(1)}%` : '—'}</span>
                    <div className="text-[8px] text-terminal-text-dim/60">{r.cLabel}</div>
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">
                    <span className="text-terminal-text-bright">{r.bank?.rateRange ?? `${r.bank?.cashRate?.toFixed(2)}%`}</span>
                    <div className="text-[8px] text-terminal-text-dim/60">{r.bankName}</div>
                  </td>
                  <td className="py-1.5 px-3">
                    <span className="font-bold" style={{ color: st.colour, letterSpacing: '0.08em' }}>{st.label}</span>
                    <div className="text-[8px] text-terminal-text-dim/60">{r.bank?.lastDecisionVerb} {short(r.bank?.lastDecision)}</div>
                  </td>
                  <td className="py-1.5 px-3 text-[9px] text-terminal-text-dim/70 hidden lg:table-cell">{r.src}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 text-[9px] text-terminal-text-dim/60 leading-snug">
        Growth: the US and Japan headline annualised quarterly growth; the others year-on-year — not directly comparable. Inflation is each
        economy&apos;s headline CPI (HICP for the euro area). Policy stances are each bank's latest decision, updated as the constants are.
      </div>
    </div>
  )
}
