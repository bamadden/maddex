import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { dispatchAskAI } from '../../utils/askAI'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'

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

const STOCK_PALETTE = ['#c8a84b', '#1e5fa8', '#9b59b6', '#2ea05a', '#e0685a', '#4ac9c9', '#d4a72c', '#7986cb', '#f06292', '#81c784']

function DonutMini({ data, title }) {
  return (
    <div className="flex-1 min-w-[160px]">
      <div className="text-2xs text-terminal-text-dim text-center mb-1">{title}</div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
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
        </ResponsiveContainer>
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
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setScenarioKey(s.key); setCustomOpen(false) }}
              className={`text-2xs px-2.5 py-1 border transition-colors ${
                !customOpen && scenarioKey === s.key ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold' : `${s.borderColor} text-terminal-text-dim hover:text-terminal-text-bright`
              }`}
            >{s.label}</button>
          ))}
          <button
            onClick={() => { setCustomOpen((v) => !v); setScenarioKey(null) }}
            className={`text-2xs px-2.5 py-1 border transition-colors ${
              customOpen ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold' : 'border-terminal-gold/50 text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
            }`}
          >CUSTOM ↕</button>
        </div>
        {activeScenario && <div className="text-2xs text-terminal-text-dim mt-1.5">{activeScenario.describe}</div>}
      </div>

      {customOpen && (
        <div className="border border-terminal-border p-3 space-y-3">
          <div className="text-2xs text-terminal-gold font-bold tracking-widest">CUSTOM SHOCK</div>
          {CUSTOM_FACTORS.map((f) => (
            <div key={f.key} className="space-y-1">
              <div className="flex justify-between text-2xs">
                <span className="text-terminal-text-dim">{f.label}</span>
                <span className="text-terminal-text-bright font-bold">{factors[f.key] >= 0 ? '+' : ''}{factors[f.key]}%</span>
              </div>
              <input
                type="range" min="-50" max="50" value={factors[f.key]}
                onChange={(e) => setFactors((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                className="w-full accent-terminal-gold"
              />
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
              <button onClick={askAboutScenario} className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">ASK MADDENAI →</button>
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
