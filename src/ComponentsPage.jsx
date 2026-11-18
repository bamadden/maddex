import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { CHART } from './styles/chartTheme'
import { PAL } from './styles/palette.js'
import { fmt } from './utils/format'
import { formatDate } from './utils/dateUtils'
import { DATA_CLASSES, CLASS_ORDER } from './utils/dataClass'
import DataBadge from './components/ui/DataBadge'
import PriceChange from './components/ui/PriceChange'
import SafeChart from './components/ui/SafeChart'

// The components page (WS3, 19 Nov 2026): every design-system part with
// fixed data, at /?components. tests/ui/visual.ui.mjs screenshots each
// [data-component] and compares it with its baseline in docs/components/;
// docs/DESIGN_SYSTEM.md shows the same images. Nothing here is live, so a
// screenshot changes only when the design does.

const FIXED_AT = '2026-11-16'
const SCALE = [11, 12, 13, 14, 16, 20, 28, 36, 48]
const SERIES = [
  { m: 'Jun', a: 4.35 }, { m: 'Jul', a: 4.35 }, { m: 'Aug', a: 4.35 },
  { m: 'Sep', a: 4.6 }, { m: 'Oct', a: 4.6 }, { m: 'Nov', a: 4.85 },
]

function Section({ id, title, children }) {
  return (
    <section data-component={id} className="border border-terminal-border bg-terminal-panel p-3" style={{ width: 720 }}>
      <h2 className="font-mono font-semibold tracking-widest text-terminal-gold mb-2" style={{ fontSize: 11 }}>{title}</h2>
      {children}
    </section>
  )
}

export default function ComponentsPage() {
  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text p-4 flex flex-col gap-3 font-mono" data-components-page>
      <h1 className="text-terminal-gold tracking-widest" style={{ fontSize: 14 }}>MADDEX DESIGN SYSTEM · COMPONENTS</h1>

      <Section id="tokens" title="COLOUR TOKENS (PAL)">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(PAL).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2" style={{ fontSize: 11 }}>
              <span style={{ width: 18, height: 18, background: v, border: '1px solid rgba(255,255,255,0.15)' }} />
              <span>{k}</span><span className="text-terminal-text-dim">{v}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type-scale" title="TYPE SCALE (11px FLOOR)">
        {SCALE.map((s) => <div key={s} style={{ fontSize: s, lineHeight: 1.2 }}>{s}px · Cash rate 4.85%</div>)}
      </Section>

      <Section id="data-badges" title="DATA CLASS BADGES">
        <div className="flex flex-col gap-1.5 items-start">
          {CLASS_ORDER.map((c) => <DataBadge key={c} cls={c} source={`${c.toLowerCase()} example source`} at={FIXED_AT} />)}
          <DataBadge cls="DELAYED" source="RBA table F6" at={FIXED_AT} manual />
          <div className="text-terminal-text-dim" style={{ fontSize: 11 }}>{CLASS_ORDER.map((c) => `${c}: ${DATA_CLASSES[c].meaning}`).join(' ')}</div>
        </div>
      </Section>

      <Section id="formatting" title="NUMBERS, MONEY AND DATES">
        <table style={{ fontSize: 12 }}>
          <tbody>
            {[
              ['fmt.aud(1234.5)', fmt.aud(1234.5)],
              ['fmt.aud(-2)', fmt.aud(-2)],
              ['fmt.usd(98.1)', fmt.usd(98.1)],
              ['fmt.money(5, "EUR")', fmt.money(5, 'EUR')],
              ['fmt.pct(1.234)', fmt.pct(1.234)],
              ['fmt.price(8829.62)', fmt.price(8829.62)],
              ['formatDate(2026-11-16)', formatDate(FIXED_AT)],
              ['missing value', fmt.aud(null)],
            ].map(([k, v]) => <tr key={k}><td className="text-terminal-text-dim pr-6">{k}</td><td className="tabular-nums">{v}</td></tr>)}
          </tbody>
        </table>
      </Section>

      <Section id="price-change" title="PRICE CHANGE">
        <div className="flex gap-6" style={{ fontSize: 12 }}>
          <PriceChange value={1.25} />
          <PriceChange value={-0.84} />
          <PriceChange value={0} />
        </div>
      </Section>

      <Section id="buttons" title="BUTTONS">
        <div className="flex gap-3 items-center">
          <button type="button" className="text-2xs font-bold border border-terminal-gold/50 text-terminal-gold px-2 py-1 tracking-wide">PRIMARY</button>
          <button type="button" className="text-2xs text-terminal-text-dim px-2 py-1 underline">secondary</button>
          <button type="button" disabled className="text-2xs font-bold border border-terminal-gold/50 text-terminal-gold px-2 py-1 tracking-wide opacity-40">DISABLED</button>
        </div>
      </Section>

      <Section id="chart" title="CHART WITH PROVENANCE">
        <div style={{ height: 180 }}>
          <SafeChart height={180} provenance={{ cls: 'DELAYED', source: 'RBA table A2', at: FIXED_AT }} label="Example: RBA cash rate">
            <LineChart data={SERIES} margin={CHART.margin}>
              <CartesianGrid {...CHART.grid} />
              <XAxis {...CHART.xAxis} dataKey="m" />
              <YAxis {...CHART.yAxis} domain={[4, 5]} tickFormatter={(v) => `${v.toFixed(2)}%`} />
              <Tooltip {...CHART.tooltip} formatter={(v) => [`${v.toFixed(2)}%`, 'Cash rate']} />
              <Line {...CHART.line} type="stepAfter" dataKey="a" stroke={PAL.gold} />
            </LineChart>
          </SafeChart>
        </div>
      </Section>
    </main>
  )
}
