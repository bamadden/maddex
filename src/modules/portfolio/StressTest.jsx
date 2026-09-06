import { useMemo, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { dispatchAskAI } from '../../utils/askAI'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'
import SafeChart from '../../components/ui/SafeChart'

const SECTOR_BY_SYMBOL = Object.fromEntries([
  ...Object.entries(MOCK_ASX_STOCKS).map(([sym, s]) => [sym.replace(/\.AX$/, ''), s.sector]),
  ...Object.entries(MOCK_US_STOCKS).map(([sym, s]) => [sym, s.sector]),
])

// Illustrative beta estimates by sector, used only by the MARKET CRASH
// scenario (a uniform shock scaled by each holding's assumed sensitivity) —
// this app has no real beta feed, so these are simplified, clearly-labelled
// approximations, not sourced betas.
const BETA_BY_SECTOR = {
  IT: 1.35, 'Cons Disc': 1.2, Materials: 1.15, Financials: 1.1, Energy: 1.1,
  Health: 0.9, 'Cons Staples': 0.7, Utilities: 0.65, Comms: 1.0,
}
function betaFor(h) {
  if (h.type === 'crypto') return 1.6
  return BETA_BY_SECTOR[SECTOR_BY_SYMBOL[h.symbol]] ?? 1.0
}

function sectorShockPct(h, table, fallback = 0) {
  const sector = SECTOR_BY_SYMBOL[h.symbol]
  return (table[sector] ?? fallback)
}

// Glyph and severity per scenario. Severity drives the card's border colour
// so the grid ranks itself before any of the labels are read.
const SCENARIO_META = {
  ironOre:       { icon: '⛏',  severity: 'high' },
  audUsd:        { icon: '💱', severity: 'medium' },
  rateHike:      { icon: '📈', severity: 'medium' },
  chinaSlowdown: { icon: '🇨🇳', severity: 'high' },
  globalRecession: { icon: '🌍', severity: 'high' },
  techSelloff:   { icon: '💻', severity: 'medium' },
  creditCrunch:  { icon: '🏦', severity: 'high' },
  oilSpike:      { icon: '🛢', severity: 'medium' },
}
const SEVERITY_BORDER = {
  high:   'rgba(168,50,50,0.45)',
  medium: 'rgba(201,168,76,0.4)',
  low:    'rgba(99,120,153,0.35)',
}

const SCENARIOS = [
  {
    key: 'ironOre', label: 'IRON ORE -20%', borderColor: 'border-red-500/50 hover:border-red-500',
    describe: 'Iron ore -20% — Materials down ~15%, Energy down ~8%, Financials flat.',
    shock: (h) => sectorShockPct(h, { Materials: -0.15, Energy: -0.08, Financials: 0 }, 0),
  },
  {
    key: 'audUsd', label: 'AUD/USD -10%', borderColor: 'border-amber-500/50 hover:border-amber-500',
    describe: 'AUD/USD -10% — USD-denominated assets gain ~10% in AUD terms; ASX importers lose ground.',
    shock: (h) => h.type === 'us' || h.type === 'crypto' ? 0.10 : sectorShockPct(h, { 'Cons Disc': -0.03 }, 0),
  },
  {
    key: 'rateHike', label: 'RATE HIKE +50BP', borderColor: 'border-orange-500/50 hover:border-orange-500',
    describe: 'RBA +50bp — Banks up ~2%, REITs down ~5%, growth/IT down ~8%.',
    shock: (h) => sectorShockPct(h, { Financials: 0.02, IT: -0.08, 'Cons Disc': -0.03 }, 0),
  },
  {
    key: 'chinaSlowdown', label: 'CHINA SLOWDOWN', borderColor: 'border-red-500/50 hover:border-red-500',
    describe: 'China slowdown — Materials down ~20%, Energy down ~12%, Consumer down ~5%.',
    shock: (h) => sectorShockPct(h, { Materials: -0.20, Energy: -0.12, 'Cons Disc': -0.05, 'Cons Staples': -0.02 }, 0),
  },
  {
    key: 'crash', label: 'MARKET CRASH -30%', borderColor: 'border-red-800 hover:border-red-700',
    describe: 'Broad -30% market crash — every holding falls proportional to its estimated beta.',
    shock: (h) => -0.30 * betaFor(h),
  },
]

const CUSTOM_FACTORS = [
  { key: 'equities',   label: 'Equities (all holdings)' },
  { key: 'materials',  label: 'Materials sector' },
  { key: 'financials', label: 'Financials sector' },
  { key: 'currency',   label: 'Currency (AUD/USD)' },
  { key: 'rates',      label: 'Interest rates (bp, ÷100 for %)' },
]

function customShock(h, factors) {
  let pct = (factors.equities ?? 0) / 100
  const sector = SECTOR_BY_SYMBOL[h.symbol]
  if (sector === 'Materials')  pct += (factors.materials ?? 0) / 100
  if (sector === 'Financials') pct += (factors.financials ?? 0) / 100
  if (h.type === 'us' || h.type === 'crypto') pct += -(factors.currency ?? 0) / 100 // AUD/USD -X% -> USD assets +X% in AUD terms
  if (sector === 'Financials') pct += ((factors.rates ?? 0) / 100) * 0.04
  if (sector === 'IT' || sector === 'Cons Disc') pct -= ((factors.rates ?? 0) / 100) * 0.16
  return pct
}

const STOCK_PALETTE = ['#C9A84C', '#1e5fa8', '#9b59b6', '#2ea05a', '#e0685a', '#4ac9c9', '#d4a72c', '#7986cb', '#f06292', '#81c784']

function DonutMini({ data, title }) {
  return (
    <div className="flex-1 min-w-[160px]">
      <div className="text-2xs text-terminal-text-dim text-center mb-1">{title}</div>
      <div style={{ height: 140 }}>
        <SafeChart width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" isAnimationActive={false}>
              {data.map((d, i) => <Cell key={d.name} fill={STOCK_PALETTE[i % STOCK_PALETTE.length]} stroke="#040d1a" strokeWidth={1} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">{payload[0].name}: {payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              }}
            />
          </PieChart>
        </SafeChart>
      </div>
    </div>
  )
}

export default function StressTest({ holdings, fmtCur }) {
  const [scenarioKey, setScenarioKey] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [factors, setFactors] = useState({ equities: 0, materials: 0, financials: 0, currency: 0, rates: 0 })

  const live = holdings.filter((h) => h.mktVal != null)

  const activeShockFn = useMemo(() => {
    if (customOpen) return (h) => customShock(h, factors)
    const s = SCENARIOS.find((s) => s.key === scenarioKey)
    return s?.shock ?? null
  }, [scenarioKey, customOpen, factors])

  const impact = useMemo(() => {
    if (!activeShockFn) return null
    return live.map((h) => {
      const shockPct = activeShockFn(h)
      const stressedVal = h.mktVal * (1 + shockPct)
      return { ...h, shockPct, stressedVal, impactVal: stressedVal - h.mktVal }
    })
  }, [live, activeShockFn])

  const totalCurrent  = live.reduce((s, h) => s + h.mktVal, 0)
  const totalStressed = impact ? impact.reduce((s, h) => s + h.stressedVal, 0) : totalCurrent
  const totalImpact   = totalStressed - totalCurrent
  const totalImpactPct = totalCurrent > 0 ? (totalImpact / totalCurrent) * 100 : 0

  const beforeDonut = live.map((h) => ({ name: h.type === 'asx' ? h.symbol + '.AX' : h.symbol, value: h.mktVal }))
  const afterDonut  = impact ? impact.map((h) => ({ name: h.type === 'asx' ? h.symbol + '.AX' : h.symbol, value: Math.max(h.stressedVal, 0) })) : beforeDonut

  // Per-card impact preview. Runs the scenario's own shock function over the
  // real book, so the number on the card is the same calculation the impact
  // table below shows — not a hardcoded guess that could drift from it.
  const estimateScenario = useCallback((scenario) => {
    if (!live.length || !totalCurrent) return null
    const stressed = live.reduce((sum, h) => sum + h.mktVal * (1 + scenario.shock(h)), 0)
    return ((stressed - totalCurrent) / totalCurrent) * 100
  }, [live, totalCurrent])

  const activeScenario = SCENARIOS.find((s) => s.key === scenarioKey)
  const biggestLoser = impact ? [...impact].sort((a, b) => a.impactVal - b.impactVal)[0] : null

  const askAboutScenario = () => {
    const label = customOpen ? 'a custom shock scenario' : activeScenario?.label ?? 'this scenario'
    dispatchAskAI({
      instruction:
        `You are MaddenAI. A user ran a portfolio stress test for ${label}. ` +
        `Current value A$${totalCurrent.toFixed(0)}, stressed value A$${totalStressed.toFixed(0)} ` +
        `(${totalImpact >= 0 ? '+' : ''}A$${totalImpact.toFixed(0)}, ${totalImpactPct.toFixed(1)}%). ` +
        `Holdings and impact: ${JSON.stringify((impact ?? []).map((h) => ({ symbol: h.symbol, sector: SECTOR_BY_SYMBOL[h.symbol] ?? h.type, impactPct: (h.shockPct * 100).toFixed(1) })))}. ` +
        'Explain what is driving the largest exposures and suggest, in general terms, what the investor might consider. General information only, not advice.',
    }, { rawPrompt: true })
  }

  if (live.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-2xs text-terminal-text-dim p-8 text-center">Add live-priced holdings to run a stress test.</div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      <div>
        <div className="text-2xs text-terminal-text-dim tracking-widest mb-2">PRESET SCENARIOS</div>
        {/* Cards rather than chips: each scenario carries an estimated impact,
            which a one-line chip has nowhere to put. Once one is picked the
            rest drop to 40% so the selection is unambiguous. */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SCENARIOS.map((s) => {
            const meta = SCENARIO_META[s.key] ?? { icon: '⚠', severity: 'low' }
            const isSelected = !customOpen && scenarioKey === s.key
            const anySelected = customOpen || scenarioKey != null
            const est = estimateScenario(s)
            return (
              <button
                key={s.key}
                onClick={() => { setScenarioKey(s.key); setCustomOpen(false) }}
                className="text-left p-2 flex flex-col justify-between transition-all duration-150"
                style={{
                  height: 72,
                  border: `1px solid ${isSelected ? '#C9A84C' : SEVERITY_BORDER[meta.severity]}`,
                  background: isSelected ? 'rgba(201,168,76,0.08)' : 'transparent',
                  opacity: anySelected && !isSelected ? 0.4 : 1,
                }}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span aria-hidden="true" className="text-[13px] leading-none flex-shrink-0">{meta.icon}</span>
                  <span className={`text-2xs font-bold tracking-wide truncate ${isSelected ? 'text-terminal-gold' : 'text-terminal-text-bright'}`}>
                    {s.label}
                  </span>
                </span>
                <span className={`text-2xs font-mono ${est == null ? 'text-terminal-text-dim' : est >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {est == null ? '—' : `${est >= 0 ? '+' : ''}${est.toFixed(1)}% est`}
                </span>
              </button>
            )
          })}
          <button
            onClick={() => { setCustomOpen((v) => !v); setScenarioKey(null) }}
            className="text-left p-2 flex flex-col justify-between transition-all duration-150"
            style={{
              height: 72,
              border: `1px solid ${customOpen ? '#C9A84C' : 'rgba(201,168,76,0.3)'}`,
              background: customOpen ? 'rgba(201,168,76,0.08)' : 'transparent',
              opacity: (customOpen || scenarioKey != null) && !customOpen ? 0.4 : 1,
            }}
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-[13px] leading-none">🎛</span>
              <span className={`text-2xs font-bold tracking-wide ${customOpen ? 'text-terminal-gold' : 'text-terminal-text-bright'}`}>CUSTOM</span>
            </span>
            <span className="text-2xs text-terminal-text-dim font-mono">set your own shock</span>
          </button>
        </div>
        {activeScenario && <div className="text-2xs text-terminal-text-dim mt-2">{activeScenario.describe}</div>}
      </div>

      {customOpen && (
        <div className="border border-terminal-border p-3 space-y-3">
          <div className="text-2xs text-terminal-gold font-bold tracking-widest">CUSTOM SHOCK</div>
          {CUSTOM_FACTORS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="text-2xs text-terminal-text-dim w-28 flex-shrink-0 truncate">{f.label}</span>
              <input
                type="range" min="-50" max="50" value={factors[f.key]}
                onChange={(e) => setFactors((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                className="shock-slider flex-1 min-w-0"
              />
              <span className={`text-2xs font-mono font-bold w-12 text-right flex-shrink-0 ${
                factors[f.key] > 0 ? 'text-terminal-green' : factors[f.key] < 0 ? 'text-terminal-red' : 'text-terminal-text-dim'
              }`}>
                {factors[f.key] >= 0 ? '+' : ''}{factors[f.key]}%
              </span>
            </div>
          ))}
        </div>
      )}

      {impact && (
        <>
          <div className="grid grid-cols-4 border border-terminal-border">
            {[
              ['CURRENT VALUE', fmtCur(totalCurrent), 'text-terminal-text-bright'],
              ['STRESSED VALUE', fmtCur(totalStressed), 'text-terminal-text-bright'],
              ['IMPACT', `${totalImpact >= 0 ? '+' : ''}${fmtCur(totalImpact)}`, totalImpact >= 0 ? 'text-terminal-green' : 'text-terminal-red'],
              ['IMPACT %', `${totalImpactPct >= 0 ? '+' : ''}${totalImpactPct.toFixed(1)}%`, totalImpactPct >= 0 ? 'text-terminal-green' : 'text-terminal-red'],
            ].map(([label, value, cls], i) => (
              <div key={label} className={`p-2.5 ${i > 0 ? 'border-l border-terminal-border' : ''}`}>
                <div className="text-2xs text-terminal-text-dim mb-0.5">{label}</div>
                <div className={`text-sm font-bold ${cls}`}>{value}</div>
              </div>
            ))}
          </div>

          <table className="w-full text-2xs">
            <thead>
              <tr className="text-terminal-text-dim border-b border-terminal-border">
                <th className="text-left px-2 py-1">STOCK</th>
                <th className="text-right px-2 py-1">CURRENT VALUE</th>
                <th className="text-right px-2 py-1">STRESSED VALUE</th>
                <th className="text-right px-2 py-1">IMPACT $</th>
                <th className="text-right px-2 py-1">IMPACT %</th>
              </tr>
            </thead>
            <tbody>
              {impact.map((h) => (
                <tr key={h.id ?? h.symbol} className="border-b border-terminal-border/30">
                  <td className="px-2 py-1 font-bold text-terminal-gold">{h.type === 'asx' ? h.symbol + '.AX' : h.symbol}</td>
                  <td className="px-2 py-1 text-right">{fmtCur(h.mktVal)}</td>
                  <td className="px-2 py-1 text-right">{fmtCur(h.stressedVal)}</td>
                  <td className={`px-2 py-1 text-right font-semibold ${h.impactVal >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {h.impactVal === 0 ? '—' : `${h.impactVal >= 0 ? '+' : ''}${fmtCur(h.impactVal)}`}
                  </td>
                  <td className={`px-2 py-1 text-right font-semibold ${h.shockPct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {h.shockPct === 0 ? '—' : `${h.shockPct >= 0 ? '+' : ''}${(h.shockPct * 100).toFixed(1)}%`}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-terminal-gold/40 bg-terminal-gold/[0.06] font-bold">
                <td className="px-2 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right">{fmtCur(totalCurrent)}</td>
                <td className="px-2 py-1.5 text-right">{fmtCur(totalStressed)}</td>
                <td className={`px-2 py-1.5 text-right ${totalImpact >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>{totalImpact >= 0 ? '+' : ''}{fmtCur(totalImpact)}</td>
                <td className={`px-2 py-1.5 text-right ${totalImpactPct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>{totalImpactPct >= 0 ? '+' : ''}{totalImpactPct.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>

          <div className="flex gap-4 justify-center border border-terminal-border p-2">
            <DonutMini data={beforeDonut} title="BEFORE" />
            <DonutMini data={afterDonut} title="AFTER" />
          </div>

          <div className="border border-terminal-border p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs text-terminal-gold font-bold tracking-widest">MADDENAI COMMENTARY</span>
              <button onClick={askAboutScenario} className="btn-secondary btn-sm">ASK MADDENAI →</button>
            </div>
            <p className="text-2xs text-terminal-text leading-relaxed">
              Under this scenario, your portfolio would {totalImpact >= 0 ? 'gain' : 'decline'} {fmtCur(Math.abs(totalImpact))} ({totalImpactPct >= 0 ? '+' : ''}{totalImpactPct.toFixed(1)}%).
              {biggestLoser && biggestLoser.impactVal < 0 && (
                <> Your largest exposure to this shock is <b className="text-terminal-text-bright">{biggestLoser.symbol}</b> ({SECTOR_BY_SYMBOL[biggestLoser.symbol] ?? biggestLoser.type}), which would be most affected at {(biggestLoser.shockPct * 100).toFixed(1)}%.</>
              )}
              {' '}Consider whether this level of concentration risk is consistent with your risk tolerance — click "Ask MaddenAI" above for a fuller breakdown.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
