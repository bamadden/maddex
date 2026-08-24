import { useMemo, useState } from 'react'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'
import { useStore } from '../../store/useStore'
import { dispatchAskAI } from '../../utils/askAI'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { fmt } from '../../utils/format'

const ALL_STOCKS = [
  ...Object.entries(MOCK_ASX_STOCKS).map(([symbol, s]) => ({ symbol, exchange: 'ASX', ...s })),
  ...Object.entries(MOCK_US_STOCKS).map(([symbol, s]) => ({ symbol, exchange: 'US', ...s })),
]

const PRESETS = [
  { key: 'dividend', label: 'DIVIDEND KINGS', filter: (s) => s.divYield >= 4 },
  { key: 'value',    label: 'VALUE PLAYS',    filter: (s) => s.pe > 0 && s.pe < 15 },
  { key: 'momentum', label: 'MOMENTUM',       filter: (s) => s.changePct >= 2 },
  { key: 'asx200',   label: 'ASX 200 CORE',   filter: (s) => s.exchange === 'ASX' },
  { key: 'smallcap', label: 'SMALL CAPS',     filter: (s) => s.marketCap < 10_000_000_000 },
  { key: 'techgrowth', label: 'TECH GROWTH',  filter: (s) => /^(IT|Tech|Technology)$/i.test(s.sector) && s.changePct > 0 },
]

// Lightweight local NL parser — handles the common patterns without needing
// a live AI call: "PE under 15", "dividend yield over 4%", a sector name,
// "materials sector", "small cap(s)". Returns { filters, understood }.
function parseQuery(q) {
  const text = q.toLowerCase()
  const filters = []
  const notes = []

  const peMatch = text.match(/p\/?e\s*(under|below|less than|<)\s*(\d+(\.\d+)?)/)
  if (peMatch) { const n = parseFloat(peMatch[2]); filters.push((s) => s.pe > 0 && s.pe < n); notes.push(`PE < ${n}`) }
  const peOverMatch = text.match(/p\/?e\s*(over|above|greater than|>)\s*(\d+(\.\d+)?)/)
  if (peOverMatch) { const n = parseFloat(peOverMatch[2]); filters.push((s) => s.pe > n); notes.push(`PE > ${n}`) }

  const divMatch = text.match(/div(idend)?\s*(yield)?\s*(over|above|greater than|>)\s*(\d+(\.\d+)?)/)
  if (divMatch) { const n = parseFloat(divMatch[4]); filters.push((s) => s.divYield >= n); notes.push(`Div yield >= ${n}%`) }
  const divUnderMatch = text.match(/div(idend)?\s*(yield)?\s*(under|below|less than|<)\s*(\d+(\.\d+)?)/)
  if (divUnderMatch) { const n = parseFloat(divUnderMatch[4]); filters.push((s) => s.divYield < n); notes.push(`Div yield < ${n}%`) }

  const upMatch = text.match(/up\s*(more than|over|>)?\s*(\d+(\.\d+)?)\s*%/)
  if (upMatch) { const n = parseFloat(upMatch[2]); filters.push((s) => s.changePct >= n); notes.push(`Up >= ${n}%`) }
  const downMatch = text.match(/down\s*(more than|over|>)?\s*(\d+(\.\d+)?)\s*%/)
  if (downMatch) { const n = parseFloat(downMatch[2]); filters.push((s) => s.changePct <= -n); notes.push(`Down >= ${n}%`) }

  const sectors = [...new Set(ALL_STOCKS.map((s) => s.sector))]
  const sectorHit = sectors.find((sec) => text.includes(sec.toLowerCase()))
  if (sectorHit) { filters.push((s) => s.sector === sectorHit); notes.push(`Sector: ${sectorHit}`) }

  if (/small\s*cap/.test(text)) { filters.push((s) => s.marketCap < 10_000_000_000); notes.push('Small cap') }
  if (/large\s*cap|blue\s*chip/.test(text)) { filters.push((s) => s.marketCap >= 50_000_000_000); notes.push('Large cap') }
  if (/\basx\b/.test(text) && !/\bus\b/.test(text)) { filters.push((s) => s.exchange === 'ASX'); notes.push('ASX only') }
  if (/\bus\b|american|nasdaq|nyse/.test(text)) { filters.push((s) => s.exchange === 'US'); notes.push('US only') }

  return { filters, notes, understood: filters.length > 0 }
}

export default function ScreenerModule() {
  const { openModal } = useStore()
  const [query, setQuery] = useState('')
  const [activePreset, setActivePreset] = useState(null)
  const [parsed, setParsed] = useState(null)

  const runQuery = () => {
    setActivePreset(null)
    if (!query.trim()) { setParsed(null); return }
    setParsed(parseQuery(query))
  }

  const askAIToInterpret = () => {
    dispatchAskAI({
      instruction:
        `You are MaddenAI's stock screener. A user typed this natural-language screen: "${query}"\n\n` +
        'Interpret it and describe, in plain terms, which ASX/US stocks would match and why — ' +
        'covering PE, dividend yield, sector, market cap or momentum criteria as relevant. ' +
        'This is a demo dataset, so speak in general terms about the type of stock rather than pulling live prices. ' +
        'General information only, not advice.',
    }, { rawPrompt: true })
  }

  const results = useMemo(() => {
    let filters = []
    if (activePreset) filters = [PRESETS.find((p) => p.key === activePreset).filter]
    else if (parsed?.filters?.length) filters = parsed.filters
    else return []
    return ALL_STOCKS
      .filter((s) => filters.every((f) => f(s)))
      .map((s) => ({ ...s, matchPct: 100 }))
      .sort((a, b) => (b.divYield + (100 - b.pe)) - (a.divYield + (100 - a.pe)))
  }, [activePreset, parsed])

  const hasSearched = activePreset != null || parsed != null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader title="SCREENER" subtitle="AI-assisted stock screening across ASX + US" />

      <div className="p-3 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runQuery() }}
            placeholder='e.g. "ASX stocks with PE under 15 and dividend yield over 4% in materials"'
            className="cmd-input flex-1 text-xs border border-terminal-border px-3 py-1.5"
          />
          <button
            onClick={runQuery}
            className="text-2xs px-3 py-1.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold"
          >SCREEN ▶</button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setActivePreset(p.key); setParsed(null); setQuery('') }}
              className={`text-2xs px-2.5 py-0.5 rounded-full border transition-colors ${
                activePreset === p.key ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
              }`}
            >{p.label}</button>
          ))}
        </div>

        {parsed && (
          <div className="mt-2 text-2xs text-terminal-text-dim">
            {parsed.understood ? (
              <>Understood: {parsed.notes.join(' · ')}</>
            ) : (
              <span className="text-terminal-red">
                Couldn't parse that locally.{' '}
                <button onClick={askAIToInterpret} className="underline text-terminal-gold hover:text-terminal-gold/70">Ask MaddenAI to interpret →</button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {!hasSearched ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full gap-2 text-terminal-text-dim text-2xs px-8 text-center">
            <div className="text-3xl mb-2">▲</div>
            <div>Type a natural-language screen or pick a preset above.</div>
            <div className="text-terminal-text-dim/60">Demo dataset — {ALL_STOCKS.length} tracked ASX + US stocks.</div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full text-2xs text-terminal-text-dim">No matches in the tracked demo universe.</div>
        ) : (
          <table className="w-full text-2xs">
            <thead className="sticky top-0 bg-terminal-header">
              <tr className="text-terminal-text-dim">
                <th className="text-left px-3 py-1.5">TICKER</th>
                <th className="text-left px-3 py-1.5">NAME</th>
                <th className="text-right px-3 py-1.5">PRICE</th>
                <th className="text-right px-3 py-1.5">PE</th>
                <th className="text-right px-3 py-1.5">DIV YIELD</th>
                <th className="text-left px-3 py-1.5">SECTOR</th>
                <th className="text-right px-3 py-1.5">MATCH %</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {results.map((s) => (
                <tr
                  key={s.symbol}
                  className="border-t border-terminal-border/50 hover:bg-terminal-accent/20 cursor-pointer"
                  onClick={() => openModal?.({
                    symbol: s.symbol, name: s.name, price: s.price, pct: s.changePct,
                    change: s.price * (s.changePct / 100), type: s.exchange === 'ASX' ? 'asx' : 'us',
                  })}
                >
                  <td className="px-3 py-1 font-bold text-terminal-gold">{s.symbol}</td>
                  <td className="px-3 py-1 text-terminal-text-bright truncate max-w-[200px]">{s.name}</td>
                  <td className="px-3 py-1 text-right">{s.exchange === 'ASX' ? 'A$' : 'US$'}{s.price.toFixed(2)}</td>
                  <td className="px-3 py-1 text-right">{s.pe > 0 ? s.pe.toFixed(1) : '—'}</td>
                  <td className="px-3 py-1 text-right">{s.divYield.toFixed(1)}%</td>
                  <td className="px-3 py-1">{s.sector}</td>
                  <td className="px-3 py-1 text-right text-terminal-green font-bold">{s.matchPct}%</td>
                  <td className="px-3 py-1 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        dispatchAskAI({ name: s.name, ticker: s.symbol, price: `${s.exchange === 'ASX' ? 'A$' : 'US$'}${s.price.toFixed(2)}`, change: fmt.pct(s.changePct), sector: s.sector })
                      }}
                      className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border hover:border-terminal-gold px-1.5 py-0.5 rounded"
                    >Ask AI</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
