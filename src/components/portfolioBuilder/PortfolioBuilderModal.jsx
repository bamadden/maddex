import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { generatePortfolio } from '../../services/portfolioBuilderService'
import { fmt } from '../../utils/format'

const PLACEHOLDER = 'e.g. Build me a diversified ASX portfolio with exposure to materials and financials, under A$10,000, with dividend yield over 3%'

const PALETTE = ['#C9A84C', '#1e5fa8', '#9b59b6', '#2ea05a', '#e0685a', '#4ac9c9', '#d4a72c', '#7986cb', '#f06292', '#81c784']

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <span className="text-terminal-gold">{payload[0].name}: </span>
      <span className="text-terminal-text-bright">{(payload[0].value * 100).toFixed(1)}%</span>
    </div>
  )
}

export default function PortfolioBuilderModal({ onImport, onClose }) {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle') // idle | generating | ready | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [imported, setImported] = useState(false)

  const generate = async () => {
    if (!input.trim()) return
    setStatus('generating')
    setError(null)
    setImported(false)
    try {
      const data = await generatePortfolio(input.trim())
      setResult(data)
      setStatus('ready')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const handleImport = () => {
    if (!result?.holdings?.length) return
    const shaped = result.holdings.map((h, i) => {
      const bareSymbol = h.symbol.replace(/\.AX$/i, '').toUpperCase()
      const units = h.suggestedUnits > 0 ? h.suggestedUnits : 1
      return {
        id: `${Date.now()}_${i}`,
        symbol: bareSymbol,
        yfSym: `${bareSymbol}.AX`,
        name: h.name ?? bareSymbol,
        shares: units,
        avgCost: h.estimatedCost != null ? h.estimatedCost / units : 0,
        costCurrency: 'AUD',
        type: 'asx',
        addedAt: new Date().toISOString().slice(0, 10),
      }
    })
    onImport(shaped)
    setImported(true)
  }

  const donutData = result?.holdings?.map((h) => ({ name: h.symbol.replace('.AX', ''), value: h.allocation ?? 0 })) ?? []

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">BUILD PORTFOLIO WITH MADDENAI</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-2xs text-terminal-text-dim mb-1.5">Describe your ideal portfolio...</div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={3}
              disabled={status === 'generating'}
              className="w-full bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2.5 py-2 resize-none disabled:opacity-50"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={generate}
                disabled={!input.trim() || status === 'generating'}
                className="text-2xs text-terminal-gold border border-terminal-gold px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-widest disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-terminal-gold"
              >{status === 'generating' ? 'GENERATING...' : 'GENERATE PORTFOLIO'}</button>
            </div>
          </div>

          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="text-terminal-gold text-2xs tracking-widest animate-pulse">MADDENAI · BUILDING YOUR PORTFOLIO...</div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <span className="text-terminal-red text-lg">⚠</span>
              <div className="text-2xs text-terminal-red">{error}</div>
            </div>
          )}

          {status === 'ready' && result && (
            <div className="space-y-4 border-t border-terminal-border pt-4">
              <div className="text-2xs text-terminal-text leading-relaxed">{result.summary}</div>

              <div className="grid grid-cols-3 gap-3">
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">BUDGET</div>
                  <div className="text-sm font-bold text-terminal-text-bright">{fmt.aud(result.totalBudget, { clarify: true })}</div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">EXPECTED YIELD</div>
                  <div className="text-sm font-bold text-terminal-gold">{result.expectedYield}%</div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">RISK PROFILE</div>
                  <div className="text-sm font-bold text-terminal-text-bright">{result.riskProfile}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex-shrink-0">
                  <PieChart width={160} height={160}>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={1} isAnimationActive={false}>
                      {donutData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                  </PieChart>
                </div>
                <div className="flex-1 w-full">
                  <table className="w-full text-2xs">
                    <thead>
                      <tr className="border-b border-terminal-border text-left text-terminal-text-dim">
                        <th className="py-1 font-normal">Symbol</th>
                        <th className="py-1 font-normal text-right">Alloc</th>
                        <th className="py-1 font-normal text-right">Units</th>
                        <th className="py-1 font-normal text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.holdings.map((h, i) => (
                        <tr key={h.symbol} className="border-b border-terminal-border/40">
                          <td className="py-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                            <span className="font-bold text-terminal-text-bright">{h.symbol.replace('.AX', '')}</span>
                          </td>
                          <td className="py-1 text-right text-terminal-text">{((h.allocation ?? 0) * 100).toFixed(0)}%</td>
                          <td className="py-1 text-right text-terminal-text">{h.suggestedUnits}</td>
                          <td className="py-1 text-right text-terminal-text">{fmt.aud(h.estimatedCost, { clarify: true })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1.5">
                {result.holdings.map((h) => (
                  <div key={h.symbol} className="border border-terminal-border/50 px-2.5 py-1.5">
                    <span className="text-2xs font-bold text-terminal-gold">{h.symbol.replace('.AX', '')}</span>
                    <span className="text-2xs text-terminal-text-dim"> — {h.rationale}</span>
                  </div>
                ))}
              </div>

              <div className="border border-terminal-gold/30 px-3 py-2 text-2xs text-terminal-text-dim italic">{result.disclaimer}</div>

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={generate}
                  className="text-2xs text-terminal-text border border-terminal-border px-3 py-1.5 hover:border-terminal-gold hover:text-terminal-gold transition-colors"
                >REGENERATE</button>
                <button
                  onClick={handleImport}
                  disabled={imported}
                  className="text-2xs text-terminal-bg bg-terminal-gold border border-terminal-gold px-3 py-1.5 hover:bg-terminal-gold-bright transition-colors font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >{imported ? '✓ IMPORTED' : 'IMPORT TO PORTFOLIO'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
