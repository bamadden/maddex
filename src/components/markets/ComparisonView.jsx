import { useEffect, useState, Fragment } from 'react'
import { useQueries } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchYFQuote } from '../../services/api'
import { toYahooSymbol, detectAssetType } from '../../utils/assetUtils'
import { useStore } from '../../store/useStore'
import { fmt } from '../../utils/format'
import { dispatchAskAI } from '../../utils/askAI'

const LINE_COLORS = ['#C9A84C', '#4a9dd9', '#2ea05a']

// Same seeded-walk pattern used by Portfolio's performance chart — this app
// has no historical-price feed wired in (FMP key missing, see console), so
// the shape is illustrative while the endpoint (today's real day-change%)
// isn't. Normalised so every line starts at 100, per the spec's "all start
// at 100" comparison chart.
function seededRng(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
function buildNormSeries(days, endPct, seed) {
  const rng = seededRng(seed)
  const points = []
  for (let i = 0; i < days; i++) {
    const t = days > 1 ? i / (days - 1) : 1
    const target = 100 + endPct * t
    const wobble = (rng() - 0.5) * 1.5 * (1 - t * 0.6)
    points.push(target + wobble)
  }
  points[points.length - 1] = 100 + endPct
  return points
}

function StatRow({ label, values, fmtFn, cls }) {
  return (
    <div className="grid border-t border-terminal-border/30" style={{ gridTemplateColumns: `120px repeat(${values.length}, 1fr)` }}>
      <div className="px-3 py-1.5 text-terminal-text-dim">{label}</div>
      {values.map((v, i) => (
        <div key={i} className={`px-3 py-1.5 text-center font-semibold ${cls ? cls(v) : 'text-terminal-text-bright'}`}>
          {fmtFn ? fmtFn(v) : (v ?? '—')}
        </div>
      ))}
    </div>
  )
}

export default function ComparisonView() {
  const { compareAssets, closeCompare, removeCompareAsset, addCompareAsset } = useStore()
  const [addInput, setAddInput] = useState('')
  const [addError, setAddError] = useState('')

  const symbols = compareAssets ?? []

  const results = useQueries({
    queries: symbols.map((a) => ({
      queryKey: ['compareQuote', a.symbol],
      queryFn:  () => fetchYFQuote(toYahooSymbol(a.symbol, a.type ?? detectAssetType(a.symbol))),
      staleTime: 60_000,
      retry: 1,
    })),
  })

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeCompare() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeCompare])

  if (compareAssets == null) return null

  const quotes = results.map((r) => r.data ?? null)
  const loading = results.some((r) => r.isLoading)

  const addSymbol = async () => {
    const sym = addInput.trim().toUpperCase()
    if (!sym) return
    if (symbols.length >= 3) { setAddError('Compare up to 3 assets at once'); return }
    if (symbols.some((a) => a.symbol === sym)) { setAddError('Already comparing this symbol'); return }
    setAddError('')
    const type = detectAssetType(sym)
    try {
      await fetchYFQuote(toYahooSymbol(sym, type))
      addCompareAsset({ symbol: sym, type })
      setAddInput('')
    } catch {
      setAddError('TICKER NOT FOUND')
    }
  }

  const days = 30
  const chartData = Array.from({ length: days }, (_, i) => {
    const row = { i }
    symbols.forEach((a, idx) => {
      const q = quotes[idx]
      const series = q ? buildNormSeries(days, q.pct ?? 0, 1000 + idx * 777) : null
      row[a.symbol] = series ? series[i] : null
    })
    return row
  })
  const chartValues = chartData.flatMap((row) => symbols.map((a) => row[a.symbol]).filter((v) => v != null))
  const yDomain = chartValues.length
    ? [Math.floor(Math.min(...chartValues) - 1), Math.ceil(Math.max(...chartValues) + 1)]
    : [95, 105]

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={closeCompare}>
      <div
        className="bg-terminal-panel border border-terminal-gold/40 w-full max-w-4xl mx-4 shadow-2xl font-mono max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">COMPARE ASSETS</span>
          <button onClick={closeCompare} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-auto">
          {symbols.length === 0 ? (
            <div className="p-8 text-center text-2xs text-terminal-text-dim">Add a symbol below to start comparing.</div>
          ) : (
            <>
              {/* Ticker header row with vs separators */}
              <div className="flex items-center justify-center gap-3 px-4 py-3 border-b border-terminal-border/50">
                {symbols.map((a, i) => (
                  <Fragment key={a.symbol}>
                    {i > 0 && <span className="text-terminal-text-dim/50 text-xs">vs</span>}
                    <div className="flex items-center gap-2 border border-terminal-border px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LINE_COLORS[i % 3] }} />
                      <span className="font-bold text-terminal-gold">{a.symbol}</span>
                      <button onClick={() => removeCompareAsset(a.symbol)} className="text-terminal-text-dim/40 hover:text-terminal-red text-2xs">✕</button>
                    </div>
                  </Fragment>
                ))}
              </div>

              {/* Normalised performance chart */}
              <div className="h-48 px-3 pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#0d2244" vertical={false} />
                    <XAxis dataKey="i" tick={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 8 }} width={36} domain={yDomain} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs space-y-0.5">
                            {payload.map((p) => (
                              <div key={p.dataKey}><span style={{ color: p.stroke }}>{p.dataKey}: </span><span className="text-terminal-text-bright">{p.value.toFixed(1)}</span></div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    {symbols.map((a, i) => (
                      <Line key={a.symbol} type="monotone" dataKey={a.symbol} stroke={LINE_COLORS[i % 3]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="px-3 text-2xs text-terminal-text-dim/50 text-center">Normalised to 100 · illustrative — demo pricing history</div>

              {/* Stats table */}
              <div className="mt-3">
                <StatRow label="PRICE"     values={quotes.map((q) => q ? fmt.aud(q.last) : loading ? '…' : '—')} />
                <StatRow
                  label="CHANGE"
                  values={quotes.map((q) => q?.pct)}
                  fmtFn={(v) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—'}
                  cls={(v) => v == null ? 'text-terminal-text-dim' : v >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
                />
                <StatRow label="MKT CAP"   values={quotes.map((q) => q?.marketCap)} fmtFn={(v) => v ? fmt.large(v) : '—'} />
                <StatRow label="PE"        values={quotes.map((q) => q?.trailingPE)} fmtFn={(v) => v ? v.toFixed(1) : '—'} />
                <StatRow label="DIV YIELD" values={quotes.map((q) => q?.divYield)} fmtFn={(v) => v != null ? `${v.toFixed(1)}%` : '—'} />
                <StatRow label="52W HIGH"  values={quotes.map((q) => q?.week52High)} fmtFn={(v) => v ? fmt.aud(v) : '—'} />
                <StatRow label="52W LOW"   values={quotes.map((q) => q?.week52Low)} fmtFn={(v) => v ? fmt.aud(v) : '—'} />
              </div>

              <div className="p-3 flex justify-center">
                <button
                  onClick={() => dispatchAskAI({
                    instruction: `Compare these assets for an Australian investor: ${symbols.map((a) => a.symbol).join(', ')}. Cover relative valuation, momentum, and risk. General information only, not advice.`,
                  }, { rawPrompt: true })}
                  className="text-2xs font-bold text-terminal-gold border border-terminal-gold/40 px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >Compare these stocks with MaddenAI →</button>
              </div>
            </>
          )}

          {/* Add symbol */}
          {symbols.length < 3 && (
            <div className="p-3 border-t border-terminal-border flex items-center gap-2">
              <input
                value={addInput}
                onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError('') }}
                onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
                placeholder="Add symbol to compare — e.g. CBA.AX"
                className="flex-1 bg-terminal-bg border border-terminal-border px-2 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
              />
              <button onClick={addSymbol} className="px-3 py-1.5 text-2xs font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors">ADD</button>
              {addError && <span className="text-2xs text-terminal-red">{addError}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
