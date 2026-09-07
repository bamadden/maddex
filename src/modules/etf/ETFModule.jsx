import { useMemo, useState } from 'react'
import { ETF_CATEGORIES, feeDrag, isComplex } from '../../data/etfData'
import { useEtfPrices } from './useEtfPrices'
import ModuleHeader from '../../components/ui/ModuleHeader'
import Tooltip from '../../components/ui/Tooltip'
import { useStore } from '../../store/useStore'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'

// ─── ETF Explorer ───────────────────────────────────────────────────────────
//
// Twenty-one Australian ETFs, filterable and sortable, with a fee-drag
// calculator and a comparison tool.
//
// The module's real job is the two things a provider's own page never puts
// next to each other: what the fee costs over a holding period, and what a
// complex product actually does to the person holding it.

const money = (v, dp = 2) => (v == null || !Number.isFinite(v) ? '—'
  : `A$${v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`)

const aum = (m) => (m >= 1000 ? `A$${(m / 1000).toFixed(1)}B` : `A$${m}M`)

const pct = (v, dp = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`)

const catTone = (key) => ETF_CATEGORIES.find((c) => c.key === key)?.tone ?? '#8BA3C4'

// MER banding. Cheap is a fact about the fee, not a recommendation — but a
// reader scanning twenty-one funds should be able to see the 0.04% and the
// 1.38% without reading every row.
const merTone = (m) => (m < 0.10 ? '#2D8A50' : m <= 0.30 ? '#C9A84C' : m <= 0.60 ? '#D69E2E' : '#CC4444')
const yieldTone = (y) => (y > 4 ? '#2D8A50' : y >= 2 ? '#C9A84C' : '#637899')
const retTone = (v) => (v == null ? '#637899' : v >= 0 ? '#2D8A50' : '#CC4444')

const COLUMNS = [
  { key: 'ticker',   label: 'TICKER',  width: 74,   align: 'left' },
  { key: 'name',     label: 'NAME & PROVIDER', width: null, align: 'left' },
  { key: 'category', label: 'CATEGORY', width: 118, align: 'left' },
  { key: 'aum',      label: 'AUM',     width: 82,  align: 'right' },
  { key: 'mer',      label: 'MER',     width: 66,  align: 'right' },
  { key: 'yield',    label: 'YIELD',   width: 66,  align: 'right' },
  { key: 'oneYear',  label: '1Y',      width: 66,  align: 'right' },
  { key: 'threeYear', label: '3Y',     width: 66,  align: 'right' },
  { key: 'livePrice', label: 'PRICE',  width: 84,  align: 'right' },
  { key: 'dayPct',   label: 'DAY ±',   width: 76,  align: 'right' },
]

// ─── Detail panel ───────────────────────────────────────────────────────────

function DetailPanel({ etf, onClose, onWatch, inWatchlist }) {
  const [amount, setAmount] = useState('10000')
  const amt = parseFloat(amount) || 0
  const drag = useMemo(() => feeDrag(amt, etf.mer, 20), [amt, etf.mer])
  const at = (y) => drag.series.find((s) => s.year === y)

  return (
    <div className="border-l border-terminal-border flex-shrink-0 overflow-y-auto"
      style={{ width: 300, background: 'rgba(201,168,76,0.02)' }}>
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="font-mono font-bold text-terminal-gold" style={{ fontSize: 20 }}>{etf.ticker}</div>
            <div className="text-terminal-text-bright leading-snug" style={{ fontSize: 12 }}>{etf.name}</div>
            <div className="font-mono text-terminal-text-dim/60" style={{ fontSize: 10 }}>{etf.provider}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold flex-shrink-0">✕</button>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-mono font-bold text-terminal-text-bright tabular-nums" style={{ fontSize: 18 }}>
            {money(etf.livePrice)}
          </span>
          <span className="font-mono font-bold px-1.5 py-0.5" style={{
            fontSize: 9, borderRadius: 2,
            color: retTone(etf.dayPct),
            background: `${retTone(etf.dayPct)}22`,
          }}>{pct(etf.dayPct, 2)}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[['AUM', aum(etf.aum), null], ['MER', `${etf.mer.toFixed(2)}%`, merTone(etf.mer)], ['YIELD', `${etf.yield.toFixed(1)}%`, yieldTone(etf.yield)],
            ['1Y', pct(etf.oneYear), retTone(etf.oneYear)], ['3Y', pct(etf.threeYear), retTone(etf.threeYear)], ['5Y', pct(etf.fiveYear), retTone(etf.fiveYear)]].map(([l, v, tone]) => (
            <div key={l}>
              <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.12em' }}>{l}</div>
              <div className="font-mono font-bold tabular-nums" style={{ fontSize: 12, color: tone ?? '#E6EDF6' }}>{v}</div>
            </div>
          ))}
        </div>

        {etf.description && (
          <div className="text-terminal-text-dim mb-3" style={{ fontSize: 11, lineHeight: 1.6 }}>{etf.description}</div>
        )}

        <div className="mb-3">
          <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.12em' }}>TRACKS</div>
          <div className="text-terminal-text" style={{ fontSize: 11 }}>{etf.benchmark ?? '—'}</div>
          <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.12em', marginTop: 6 }}>HOLDINGS</div>
          <div className="text-terminal-text" style={{ fontSize: 11 }}>{etf.holdings ?? '—'}</div>
        </div>

        {etf.warning && (
          <div className="mb-3 px-2 py-2" style={{ background: 'rgba(204,68,68,0.1)', border: '1px solid rgba(204,68,68,0.4)' }}>
            <div className="font-mono font-bold text-terminal-red mb-1" style={{ fontSize: 9, letterSpacing: '0.1em' }}>⚠ RISK</div>
            <div className="text-terminal-text-dim leading-relaxed" style={{ fontSize: 10 }}>{etf.warning}</div>
          </div>
        )}

        {/* THE FEE PANEL IS THE POINT OF THIS MODULE.
            Fees are charged on the balance, so they compound against you as
            returns compound for you. "MER × amount × years" understates a
            twenty-year holding materially, and this does the real arithmetic. */}
        <div className="border-t border-terminal-border/40 pt-2 mb-3">
          <div className="font-mono text-terminal-gold/70 mb-1.5" style={{ fontSize: 8, letterSpacing: '0.14em' }}>
            WHAT THE FEE COSTS YOU
          </div>
          <label className="block mb-2">
            <span className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8 }}>INVESTMENT AMOUNT</span>
            <input
              type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-terminal-text-bright outline-none focus:border-terminal-gold tabular-nums mt-0.5"
              style={{ fontSize: 12 }}
            />
          </label>
          {[1, 10, 20].map((y) => {
            const row = at(y)
            return (
              <div key={y} className="flex items-baseline justify-between py-0.5">
                <span className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>Year {y} · fees paid</span>
                <span className="font-mono font-bold text-terminal-red tabular-nums" style={{ fontSize: 11 }}>{money(row?.feesPaid ?? 0)}</span>
              </div>
            )
          })}
          <div className="flex items-baseline justify-between py-0.5 mt-1 pt-1" style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
            <Tooltip content="The gap between what the investment would be worth with no fee at all and what it is worth after fees — larger than the fees paid, because every dollar taken in fees also stops compounding.">
              <span className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>20-year cost incl. lost growth</span>
            </Tooltip>
            <span className="font-mono font-bold text-terminal-red tabular-nums" style={{ fontSize: 11 }}>{money(drag.lost)}</span>
          </div>
          <div className="font-mono text-terminal-text-dim/40 mt-1 leading-snug" style={{ fontSize: 8 }}>
            Assumes 8% annual growth before fees. Fees are charged on the balance, so they compound.
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onWatch(etf.ticker)}
            className={`text-2xs font-bold tracking-wide border rounded-full px-3 py-1.5 transition-colors ${
              inWatchlist
                ? 'border-terminal-green/40 text-terminal-green'
                : 'border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg'
            }`}
          >{inWatchlist ? '✓ IN WATCHLIST' : '+ ADD TO WATCHLIST'}</button>
          <button
            onClick={() => dispatchAskAI({
              name: `${etf.ticker} — ${etf.name}`, sector: etf.category, date: todayAEST(),
              instruction: `Explain the ${etf.ticker} ETF (${etf.name}, ${etf.provider}) and whether it suits an Australian long-term investor. It tracks ${etf.benchmark ?? 'its stated index'}, charges ${etf.mer}% MER and yields ${etf.yield}%.${etf.complex ? ' It is a leveraged or inverse product — explain that risk plainly.' : ''} Do not state any figure I have not given you.`,
            })}
            className="text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/40 rounded-full hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-3 py-1.5"
          >ASK MADDENAI ▶</button>
        </div>
      </div>
    </div>
  )
}

// ─── Comparison ─────────────────────────────────────────────────────────────

const COMPARE_ROWS = [
  { key: 'mer',       label: 'MER',        fmt: (e) => `${e.mer.toFixed(2)}%`,  best: 'min' },
  { key: 'yield',     label: 'YIELD',      fmt: (e) => `${e.yield.toFixed(1)}%`, best: 'max' },
  { key: 'oneYear',   label: '1Y RETURN',  fmt: (e) => pct(e.oneYear),  best: 'max' },
  { key: 'threeYear', label: '3Y RETURN',  fmt: (e) => pct(e.threeYear), best: 'max' },
  { key: 'fiveYear',  label: '5Y RETURN',  fmt: (e) => pct(e.fiveYear), best: 'max' },
  { key: 'aum',       label: 'FUND SIZE',  fmt: (e) => aum(e.aum),      best: 'max' },
  { key: 'holdings',  label: 'HOLDINGS',   fmt: (e) => e.holdings ?? '—', best: 'max' },
]

function ComparePanel({ etfs, onClose, onRemove }) {
  if (!etfs.length) return null
  const bestFor = (row) => {
    const vals = etfs.map((e) => e[row.key]).filter((v) => Number.isFinite(v))
    if (!vals.length) return null
    return row.best === 'min' ? Math.min(...vals) : Math.max(...vals)
  }

  return (
    <div className="border-b border-terminal-border" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <div className="panel-header flex items-center gap-2">
        <span>COMPARE · {etfs.length} SELECTED</span>
        <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">gold marks the best value in each row</span>
        <button onClick={onClose} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold">✕ CLOSE</button>
      </div>
      <div className="p-3 overflow-x-auto">
        <table className="w-full" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th className="text-left font-normal px-2 py-1" style={{ fontSize: 8, width: 120 }} />
              {etfs.map((e) => (
                <th key={e.ticker} className="text-right px-2 py-1">
                  <div className="font-mono font-bold text-terminal-gold" style={{ fontSize: 12 }}>{e.ticker}</div>
                  <div className="font-mono text-terminal-text-dim/50 font-normal normal-case" style={{ fontSize: 8 }}>{e.provider}</div>
                  <button onClick={() => onRemove(e.ticker)} className="text-2xs text-terminal-text-dim/40 hover:text-terminal-red font-normal">remove</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const best = bestFor(row)
              return (
                <tr key={row.key} className="border-b border-terminal-border/25">
                  <td className="px-2 py-1 font-mono text-terminal-text-dim/60" style={{ fontSize: 9, letterSpacing: '0.1em' }}>{row.label}</td>
                  {etfs.map((e) => {
                    const isBest = best != null && e[row.key] === best && etfs.length > 1
                    return (
                      <td key={e.ticker} className="px-2 py-1 text-right font-mono tabular-nums"
                        style={{ fontSize: 11, color: isBest ? '#C9A84C' : '#8BA3C4', fontWeight: isBest ? 700 : 400 }}>
                        {row.fmt(e)}{isBest && ' ★'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr>
              <td className="px-2 py-1 font-mono text-terminal-text-dim/60" style={{ fontSize: 9, letterSpacing: '0.1em' }}>20Y FEE COST · A$10K</td>
              {etfs.map((e) => (
                <td key={e.ticker} className="px-2 py-1 text-right font-mono tabular-nums text-terminal-red" style={{ fontSize: 11 }}>
                  {money(feeDrag(10000, e.mer, 20).lost, 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <button
          onClick={() => dispatchAskAI({
            name: etfs.map((e) => e.ticker).join(' vs '), sector: 'ETFs', date: todayAEST(),
            instruction: `Compare these ETFs for an Australian long-term investor: ${etfs.map((e) => `${e.ticker} (${e.name}, ${e.mer}% MER, ${e.yield}% yield, tracks ${e.benchmark ?? 'its index'})`).join('; ')}. Consider fees, diversification and risk. Do not state any figure I have not given you.`,
          })}
          className="mt-3 text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/40 rounded-full hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-3 py-1"
        >ASK MADDENAI TO COMPARE ▶</button>
      </div>
    </div>
  )
}

// ─── Module ─────────────────────────────────────────────────────────────────

export default function ETFModule() {
  const rows = useEtfPrices()
  const { watchlist, addToWatchlist } = useStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [sort, setSort] = useState({ key: 'aum', dir: 'desc' })
  const [selected, setSelected] = useState(null)
  const [compare, setCompare] = useState([])
  const [compareMode, setCompareMode] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    let out = rows
    if (category === 'COMPLEX') out = out.filter(isComplex)
    else if (category !== 'ALL') out = out.filter((e) => e.category === category)
    if (q) {
      out = out.filter((e) =>
        e.ticker.includes(q) || e.name.toUpperCase().includes(q) || e.provider.toUpperCase().includes(q))
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return typeof av === 'string' ? av.localeCompare(bv) * dir : (av - bv) * dir
    })
  }, [rows, search, category, sort])

  const featured = useMemo(() => {
    const eligible = rows.filter((e) => !e.complex)
    return {
      cheapest: [...eligible].sort((a, b) => a.mer - b.mer)[0],
      largest: [...eligible].sort((a, b) => b.aum - a.aum)[0],
      highestYield: [...rows].sort((a, b) => b.yield - a.yield)[0],
    }
  }, [rows])

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  const toggleCompare = (ticker) =>
    setCompare((prev) => prev.includes(ticker) ? prev.filter((t) => t !== ticker) : prev.length >= 4 ? prev : [...prev, ticker])

  const compareEtfs = compare.map((t) => rows.find((e) => e.ticker === t)).filter(Boolean)
  const selectedEtf = selected ? rows.find((e) => e.ticker === selected) : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="ETF EXPLORER"
        subtitle="21 Australian ETFs · fees, returns and what they actually cost"
        moduleId="etf"
        right={<span className="text-terminal-gold text-2xs font-normal normal-case">● LIVE (SIMULATED)</span>}
      />

      <div className="px-3 py-1.5 border-b border-terminal-border flex items-center gap-2 flex-wrap flex-shrink-0"
        style={{ background: 'rgba(214,158,46,0.06)' }}>
        <span className="font-mono font-bold tracking-widest" style={{ fontSize: 8, color: '#D69E2E' }}>INDICATIVE DATA</span>
        <span className="font-mono text-terminal-text-dim/70" style={{ fontSize: 9 }}>
          AUM, yields and returns are illustrative. Verify with the provider&apos;s PDS before investing.
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border flex-wrap flex-shrink-0">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticker, name or provider…"
          className="bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold"
          style={{ width: 240 }}
        />
        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          {ETF_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className="font-mono uppercase tracking-wider transition-colors flex-shrink-0"
              style={{
                fontSize: 8, padding: '3px 8px', borderRadius: 2,
                border: `1px solid ${category === c.key ? c.tone : 'rgba(201,168,76,0.12)'}`,
                background: category === c.key ? `${c.tone}26` : 'transparent',
                color: category === c.key ? c.tone : '#4A6080',
              }}
            >{c.label}</button>
          ))}
        </div>
        <button
          onClick={() => { setCompareMode((v) => !v); if (compareMode) setCompare([]) }}
          className="font-mono uppercase tracking-wider transition-colors flex-shrink-0"
          style={{
            fontSize: 9, padding: '3px 10px', borderRadius: 2,
            border: `1px solid ${compareMode ? '#C9A84C' : 'rgba(201,168,76,0.12)'}`,
            background: compareMode ? 'rgba(201,168,76,0.15)' : 'transparent',
            color: compareMode ? '#C9A84C' : '#4A6080',
          }}
        >⊞ COMPARE{compare.length ? ` (${compare.length}/4)` : ''}</button>
      </div>

      {category === 'COMPLEX' && (
        <div className="px-3 py-2 border-b flex-shrink-0"
          style={{ background: 'rgba(204,68,68,0.1)', borderColor: 'rgba(204,68,68,0.4)' }}>
          <span className="font-mono font-bold text-terminal-red" style={{ fontSize: 9, letterSpacing: '0.1em' }}>⚠ COMPLEX PRODUCTS</span>
          <span className="text-terminal-text-dim ml-2" style={{ fontSize: 10 }}>
            These funds use leverage or inverse strategies and rebalance daily, so over any period longer than a
            day their return is not simply a multiple of the index. They are designed for short-term tactical use,
            not for holding.
          </span>
        </div>
      )}

      {compareMode && compareEtfs.length > 0 && (
        <ComparePanel etfs={compareEtfs} onClose={() => { setCompareMode(false); setCompare([]) }} onRemove={toggleCompare} />
      )}

      {category === 'ALL' && !search && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3 py-2 border-b border-terminal-border flex-shrink-0">
          {[
            { label: 'LOWEST COST', e: featured.cheapest, value: `${featured.cheapest?.mer.toFixed(2)}% MER`, tone: '#2D8A50' },
            { label: 'LARGEST FUND', e: featured.largest, value: aum(featured.largest?.aum ?? 0), tone: '#C9A84C' },
            { label: 'HIGHEST YIELD', e: featured.highestYield, value: `${featured.highestYield?.yield.toFixed(1)}%`, tone: '#D69E2E' },
          ].map((f) => f.e && (
            <button key={f.label} onClick={() => setSelected(f.e.ticker)}
              className="border border-terminal-border px-3 py-2 text-left hover:bg-terminal-accent/10 transition-colors">
              <div className="font-mono tracking-widest" style={{ fontSize: 8, color: f.tone }}>{f.label}</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-mono font-bold text-terminal-gold" style={{ fontSize: 15 }}>{f.e.ticker}</span>
                <span className="font-mono font-bold tabular-nums" style={{ fontSize: 12, color: f.tone }}>{f.value}</span>
                {f.e.warning && (
                  <Tooltip content={f.e.warning}>
                    <span className="text-terminal-red" style={{ fontSize: 11 }}>⚠</span>
                  </Tooltip>
                )}
              </div>
              <div className="text-terminal-text-dim/60 truncate" style={{ fontSize: 9 }}>{f.e.name}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="terminal-table table-zebra w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {compareMode && <col style={{ width: 34 }} />}
              {COLUMNS.map((c) => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}
            </colgroup>
            <thead className="sticky top-0 bg-terminal-header z-10">
              <tr>
                {compareMode && <th className="px-2" />}
                {COLUMNS.map((c) => (
                  <th key={c.key}
                    onClick={() => toggleSort(c.key === 'name' ? 'name' : c.key)}
                    className={`px-2 cursor-pointer hover:text-terminal-gold transition-colors select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.label}{sort.key === c.key && <span className="text-terminal-gold ml-0.5">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.ticker}
                  onClick={() => setSelected(e.ticker)}
                  className="cursor-pointer hover:bg-terminal-accent/15 transition-colors border-b border-terminal-border/30"
                  style={{
                    ...(selected === e.ticker ? { background: 'rgba(201,168,76,0.08)' } : null),
                    ...(e.complex ? { borderLeft: '2px solid rgba(204,68,68,0.5)' } : null),
                  }}
                >
                  {compareMode && (
                    <td className="px-2 py-1.5" onClick={(ev) => { ev.stopPropagation(); toggleCompare(e.ticker) }}>
                      <span className={compare.includes(e.ticker) ? 'text-terminal-gold' : 'text-terminal-text-dim/30'}>
                        {compare.includes(e.ticker) ? '☑' : '☐'}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-1.5 font-mono font-bold text-terminal-gold" style={{ fontSize: 12 }}>
                    {e.ticker}
                    {e.complex && (
                      <Tooltip content={e.warning}><span className="text-terminal-red ml-1" style={{ fontSize: 9 }}>⚠</span></Tooltip>
                    )}
                  </td>
                  <td className="px-2 py-1.5 truncate">
                    <div className="text-terminal-text-bright truncate" style={{ fontSize: 12 }}>{e.name}</div>
                    <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 9 }}>{e.provider}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-mono font-bold" style={{
                      fontSize: 8, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 2,
                      color: catTone(e.category), background: `${catTone(e.category)}22`,
                    }}>{e.category.toUpperCase()}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>{aum(e.aum)}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums" style={{ fontSize: 11, color: merTone(e.mer) }}>{e.mer.toFixed(2)}%</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 11, color: yieldTone(e.yield) }}>{e.yield.toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 11, color: retTone(e.oneYear) }}>{pct(e.oneYear)}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 11, color: retTone(e.threeYear) }}>{pct(e.threeYear)}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 11 }}>{money(e.livePrice)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="font-mono font-bold tabular-nums px-1.5 py-0.5" style={{
                      fontSize: 10, borderRadius: 2,
                      color: retTone(e.dayPct), background: `${retTone(e.dayPct)}1F`,
                    }}>{pct(e.dayPct, 2)}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={COLUMNS.length + (compareMode ? 1 : 0)} className="px-3 py-6 text-center text-2xs text-terminal-text-dim/60">
                  No ETFs match that filter.
                </td></tr>
              )}
            </tbody>
          </table>

          <div className="px-3 py-2 text-terminal-text-dim/50 leading-relaxed border-t border-terminal-border/40" style={{ fontSize: 9 }}>
            ETF data shown is indicative and for educational purposes. AUM, yields and returns are approximate and
            move constantly. Verify current data directly with the provider before making any investment decision.
            Not financial advice.
          </div>
        </div>

        {selectedEtf && (
          <DetailPanel
            etf={selectedEtf}
            onClose={() => setSelected(null)}
            onWatch={(t) => addToWatchlist(`${t}.AX`)}
            inWatchlist={watchlist?.includes(`${selectedEtf.ticker}.AX`)}
          />
        )}
      </div>
    </div>
  )
}
