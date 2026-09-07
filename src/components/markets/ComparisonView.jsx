import { useEffect, useState, Fragment } from 'react'
import { useQueries } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { fetchYFQuote } from '../../services/api'
import { toYahooSymbol, detectAssetType } from '../../utils/assetUtils'
import { useStore } from '../../store/useStore'
import { fmt } from '../../utils/format'
import { getMockFMPHistory } from '../../services/mockData'
import { dispatchAskAI } from '../../utils/askAI'
import SafeChart from '../ui/SafeChart'

const LINE_COLORS = ['#C9A84C', '#4a9dd9', '#3AAA63', '#9B6BC4']
const MAX_COMPARE = 4

const PERIODS = [
  { key: 'w1', label: '1W', days: 5 },
  { key: 'm1', label: '1M', days: 21 },
  { key: 'm3', label: '3M', days: 63 },
  { key: 'm6', label: '6M', days: 126 },
  { key: 'y1', label: '1Y', days: 252 },
]

// Pearson correlation of two return series.
//
// Computed from the SAME series the chart draws, so the matrix and the lines
// can never tell different stories. On DEMO history the number is a real
// statistic about illustrative data rather than a claim about the market, and
// the panel says exactly that — a correlation is the kind of precise-looking
// figure a reader would size a position against.
function correlation(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 3) return null
  const ra = [], rb = []
  for (let i = 1; i < n; i++) {
    if (!a[i - 1] || !b[i - 1]) continue
    ra.push((a[i] - a[i - 1]) / a[i - 1])
    rb.push((b[i] - b[i - 1]) / b[i - 1])
  }
  if (ra.length < 3) return null
  const mean = (x) => x.reduce((p, c) => p + c, 0) / x.length
  const ma = mean(ra), mb = mean(rb)
  let num = 0, da = 0, db = 0
  for (let i = 0; i < ra.length; i++) {
    const x = ra[i] - ma, y = rb[i] - mb
    num += x * y; da += x * x; db += y * y
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? null : num / den
}

// Blue at +1, neutral at 0, red at -1 — the convention on every correlation
// heatmap, and the one that makes "these two move together" readable at a
// glance rather than requiring the number to be parsed.
function corrColour(v) {
  if (v == null) return 'transparent'
  const t = Math.max(-1, Math.min(1, v))
  return t >= 0
    ? `rgba(74,144,217,${0.10 + 0.5 * t})`
    : `rgba(168,50,50,${0.10 + 0.5 * -t})`
}

// History comes from the app's SHARED mock generator, not a private one.
//
// This file used to build its own seeded random walk. That made it the second
// synthetic history in the terminal, and the two disagreed: the same stock over
// the same window drew one shape here and a different one in the sector deep
// dive or the portfolio chart. Two fabrications that contradict each other are
// worse than one, because the contradiction is visible and reads as a bug.
//
// getMockFMPHistory is what every other chart in the app draws, so a
// comparison now agrees with the modules it was opened from — and when a real
// price feed lands, one function changes and every chart becomes real at once.
function closesFor(symbol, days) {
  const hist = getMockFMPHistory(symbol, days + 1)
  return hist.map((h) => h.close).filter((v) => Number.isFinite(v))
}

// Rebased so every line starts at 100 and the comparison is about relative
// movement rather than about which stock has the bigger share price.
function rebase(closes) {
  if (!closes.length || !closes[0]) return []
  return closes.map((c) => (c / closes[0]) * 100)
}

// `best` says which direction wins for THIS metric, and it has to be stated
// per row rather than assumed: a high dividend yield is good, a high P/E is
// not, and a row that highlighted "largest number" would tell a reader the
// most expensive stock was the best one.
//
// Highlighting is skipped entirely with fewer than two comparable values —
// crowning a winner out of a field of one is noise.
function StatRow({ label, values, fmtFn, cls, best }) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  const canRank = best && nums.length >= 2
  const hi = canRank ? Math.max(...nums) : null
  const lo = canRank ? Math.min(...nums) : null
  const winner = best === 'high' ? hi : lo
  const loser = best === 'high' ? lo : hi

  return (
    <div className="grid border-t border-terminal-border/30" style={{ gridTemplateColumns: `120px repeat(${values.length}, 1fr)` }}>
      <div className="px-3 py-1.5 text-terminal-text-dim">{label}</div>
      {values.map((v, i) => {
        const isWinner = canRank && v === winner
        const isLoser = canRank && v === loser && winner !== loser
        return (
          <div
            key={i}
            title={isWinner ? `Best ${label.toLowerCase()} of those compared` : isLoser ? `Weakest ${label.toLowerCase()} of those compared` : undefined}
            className={`px-3 py-1.5 text-center ${
              cls ? cls(v)
                : isWinner ? 'text-terminal-gold font-bold'
                : isLoser ? 'text-terminal-text-dim/60 italic'
                : 'text-terminal-text-bright font-semibold'
            }`}
          >
            {fmtFn ? fmtFn(v) : (v ?? '—')}
          </div>
        )
      })}
    </div>
  )
}

export default function ComparisonView() {
  const { compareAssets, closeCompare, removeCompareAsset, addCompareAsset } = useStore()
  const [addInput, setAddInput] = useState('')
  const [addError, setAddError] = useState('')
  const [period, setPeriod] = useState('m3')

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
    if (symbols.length >= MAX_COMPARE) { setAddError(`Compare up to ${MAX_COMPARE} assets at once`); return }
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

  const activePeriod = PERIODS.find((p) => p.key === period) ?? PERIODS[2]
  const days = activePeriod.days

  // One pass: raw closes per symbol, rebased for the chart, kept raw for the
  // correlation (which needs returns, not an index).
  const series = symbols.map((a) => {
    const closes = closesFor(a.symbol, days)
    return { symbol: a.symbol, closes, rebased: rebase(closes) }
  })

  const longest = Math.max(0, ...series.map((s2) => s2.rebased.length))
  const chartData = Array.from({ length: longest }, (_, i) => {
    const row = { i }
    series.forEach((s2) => { row[s2.symbol] = s2.rebased[i] ?? null })
    return row
  })

  // Period return per symbol, straight off the rebased series, so the legend
  // and the lines cannot disagree.
  const periodReturn = Object.fromEntries(
    series.map((s2) => [s2.symbol, s2.rebased.length ? s2.rebased[s2.rebased.length - 1] - 100 : null]),
  )

  const chartValues = chartData.flatMap((row) => symbols.map((a) => row[a.symbol]).filter((v) => v != null))
  const yDomain = chartValues.length
    ? [Math.floor(Math.min(...chartValues) - 1), Math.ceil(Math.max(...chartValues) + 1)]
    : [95, 105]

  const corrMatrix = series.map((rowS) =>
    series.map((colS) => (rowS.symbol === colS.symbol ? 1 : correlation(rowS.closes, colS.closes))),
  )

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
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                      <span className="font-bold text-terminal-gold">{a.symbol}</span>
                      <button onClick={() => removeCompareAsset(a.symbol)} className="text-terminal-text-dim/40 hover:text-terminal-red text-2xs">✕</button>
                    </div>
                  </Fragment>
                ))}
              </div>

              <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`text-2xs px-2.5 py-0.5 border transition-colors font-bold ${
                      period === p.key
                        ? 'bg-terminal-gold text-terminal-bg border-terminal-gold'
                        : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                    }`}
                  >{p.label}</button>
                ))}
                <span className="text-2xs text-terminal-text-dim/50 ml-auto">rebased to 100 at period start</span>
              </div>

              {/* Normalised performance chart */}
              <div className="h-48 px-3 pt-1">
                <SafeChart width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#0F1E35" vertical={false} />
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
                      <Line key={a.symbol} type="monotone" dataKey={a.symbol} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </SafeChart>
              </div>
              {/* Legend carries each line's return over the SELECTED period,
                  which is the number a reader is actually comparing. */}
              <div className="flex items-center justify-center gap-4 flex-wrap px-3 pt-2">
                {symbols.map((a, i) => {
                  const r = periodReturn[a.symbol]
                  return (
                    <div key={a.symbol} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                      <span className="text-2xs text-terminal-text-bright font-bold">{a.symbol}</span>
                      <span
                        className="text-2xs font-bold tabular-nums"
                        style={{ color: r == null ? '#637899' : r >= 0 ? '#2D8A50' : '#A83232' }}
                      >{r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`}</span>
                      <button
                        onClick={() => removeCompareAsset(a.symbol)}
                        className="text-terminal-text-dim/40 hover:text-terminal-red text-2xs"
                        aria-label={`Remove ${a.symbol}`}
                      >✕</button>
                    </div>
                  )
                })}
              </div>
              <div className="px-3 pt-1 text-2xs text-terminal-text-dim/50 text-center">
                Demo pricing history — the same series the rest of the terminal draws.
              </div>

              {/* Stats table */}
              <div className="mt-3">
                <StatRow label="PRICE"     values={quotes.map((q) => q ? fmt.aud(q.last) : loading ? '…' : '—')} />
                <StatRow
                  label="CHANGE"
                  values={quotes.map((q) => q?.pct)}
                  fmtFn={(v) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—'}
                  cls={(v) => v == null ? 'text-terminal-text-dim' : v >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
                />
                <StatRow
                  label={`CHANGE ${activePeriod.label}`}
                  values={symbols.map((a) => periodReturn[a.symbol])}
                  fmtFn={(v) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '—'}
                  cls={(v) => v == null ? 'text-terminal-text-dim' : v >= 0 ? 'text-terminal-green font-semibold' : 'text-terminal-red font-semibold'}
                />
                <StatRow label="MKT CAP"   values={quotes.map((q) => q?.marketCap)} fmtFn={(v) => v ? fmt.large(v) : '—'} best="high" />
                {/* Lower is better on a P/E, which is exactly why `best` is
                    per-row: the same "highlight the biggest" rule would call
                    the most expensive stock the winner. */}
                <StatRow label="PE"        values={quotes.map((q) => q?.trailingPE)} fmtFn={(v) => v ? `${v.toFixed(1)}x` : '—'} best="low" />
                <StatRow label="DIV YIELD" values={quotes.map((q) => q?.divYield)} fmtFn={(v) => v != null ? `${v.toFixed(1)}%` : '—'} best="high" />
                <StatRow label="52W HIGH"  values={quotes.map((q) => q?.week52High)} fmtFn={(v) => v ? fmt.aud(v) : '—'} />
                <StatRow label="52W LOW"   values={quotes.map((q) => q?.week52Low)} fmtFn={(v) => v ? fmt.aud(v) : '—'} />
                <StatRow
                  label="52W POSITION"
                  values={quotes.map((q) => {
                    if (!q?.week52High || !q?.week52Low || q.week52High <= q.week52Low || q.last == null) return null
                    return ((q.last - q.week52Low) / (q.week52High - q.week52Low)) * 100
                  })}
                  fmtFn={(v) => v != null ? `${v.toFixed(0)}%` : '—'}
                />
              </div>

              {symbols.length >= 2 && (
                <div className="px-3 pt-4">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="text-2xs text-terminal-gold font-bold tracking-widest">CORRELATION MATRIX</span>
                    <span className="text-2xs text-terminal-text-dim/50">
                      {activePeriod.label} daily returns · DEMO data
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-2xs">
                      <thead>
                        <tr>
                          <th className="w-16" />
                          {symbols.map((a) => (
                            <th key={a.symbol} className="px-2 py-1 text-terminal-text-dim font-normal text-center min-w-[64px]">
                              {a.symbol.replace('.AX', '')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {symbols.map((rowA, ri) => (
                          <tr key={rowA.symbol}>
                            <td className="px-2 py-1 text-terminal-text-dim">{rowA.symbol.replace('.AX', '')}</td>
                            {symbols.map((colA, ci) => {
                              const v = corrMatrix[ri]?.[ci]
                              return (
                                <td
                                  key={colA.symbol}
                                  className="px-2 py-1 text-center tabular-nums text-terminal-text-bright"
                                  style={{ background: ri === ci ? 'rgba(201,168,76,0.12)' : corrColour(v) }}
                                >{v == null ? '—' : v.toFixed(2)}</td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-2xs text-terminal-text-dim/60 mt-1.5 leading-relaxed">
                    1.00 means the two moved together every day; 0 means no relationship. Lower
                    correlation is what diversification buys you. Computed from the demo series
                    drawn above — a real statistic about illustrative prices, not yet a claim
                    about the market.
                  </div>
                </div>
              )}

              <div className="p-3 flex justify-center">
                <button
                  onClick={() => dispatchAskAI({
                    instruction: `Compare ${symbols.map((a) => a.symbol).join(', ')} as investment considerations for an Australian investor. What are the key differences someone should understand — business model, what drives each one, and how they would behave differently in the same conditions? Do not quote prices or valuations; you have not been given them. General information only, not advice.`,
                  }, { rawPrompt: true })}
                  className="text-2xs font-bold text-terminal-gold border border-terminal-gold/40 px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >Compare these stocks with MaddenAI →</button>
              </div>
            </>
          )}

          {/* Add symbol */}
          {symbols.length < MAX_COMPARE && (
            <div className="p-3 border-t border-terminal-border flex items-center gap-2">
              <input
                value={addInput}
                onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError('') }}
                onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
                placeholder="Add symbol to compare — e.g. CBA.AX"
                className="flex-1 bg-terminal-bg border border-terminal-border px-2 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
              />
              <button onClick={addSymbol} className="btn-secondary btn-sm">ADD</button>
              {addError && <span className="text-2xs text-terminal-red">{addError}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
