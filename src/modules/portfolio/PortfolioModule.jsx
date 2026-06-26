import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchYahooBatch, fetchYFQuote } from '../../services/api'
import { useAudRates } from '../../hooks/useAudRates'
import { useStore } from '../../store/useStore'
import { fmt, colorClass } from '../../utils/format'
import { StatBox } from '../../components/ui/Panel'
import { toYahooSymbol } from '../../utils/assetUtils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const STORAGE_KEY = 'madden_portfolio_v2'

const CRYPTO_SYMS = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','AVAX','DOGE','DOT','MATIC','LINK','LTC','ATOM','OP','ARB','NEAR','APT','SUI'])
const ASX_KNOWN   = new Set(['BHP','CBA','CSL','ANZ','WBC','NAB','WOW','RIO','MQG','TLS','FMG','MIN','PLS','WDS','ORG','REA','WTC','XRO','AGL','IAG','QBE','STO','WPL','ALL','GMG'])

function detectType(sym) {
  const s = sym.toUpperCase().replace(/\.AX$|:ASX$/, '').trim()
  if (CRYPTO_SYMS.has(s)) return 'crypto'
  const raw = sym.toUpperCase()
  if (raw.endsWith('.AX') || raw.endsWith(':ASX') || ASX_KNOWN.has(s)) return 'asx'
  return 'us'
}

function cleanSymbol(sym, type) {
  const s = sym.toUpperCase().trim()
  if (type === 'asx') return s.replace(/\.AX$|:ASX$/, '')
  return s
}

const ASSET_COLORS = {
  'AU Equities': '#c8a84b',
  'US Equities': '#1e5fa8',
  'Crypto':      '#9b59b6',
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <span className="text-terminal-gold">{payload[0].name}: </span>
      <span className="text-terminal-text-bright">{fmt.aud(payload[0].value)}</span>
    </div>
  )
}

// ─── Add Holding Form ─────────────────────────────────────────────────────────

function AddHoldingForm({ onAdd, onCancel }) {
  const [sym,     setSym]     = useState('')
  const [shares,  setShares]  = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [ccy,     setCcy]     = useState('AUD')
  const [vstatus, setVstatus] = useState('idle') // idle | validating | error | ready
  const [verr,    setVerr]    = useState('')
  const [vdata,   setVdata]   = useState(null)

  const handleValidate = async () => {
    const s = sym.toUpperCase().trim()
    if (!s) { setVerr('Enter a ticker symbol'); setVstatus('error'); return }
    setVstatus('validating'); setVerr(''); setVdata(null)

    const type = detectType(s)
    if (type === 'crypto') {
      setVdata({ name: s, type: 'crypto', last: null })
      setVstatus('ready')
      return
    }

    const yfSym = toYahooSymbol(s, type)
    try {
      const q = await fetchYFQuote(yfSym)
      setVdata({ name: q.name || s, type, yfSym, last: q.last })
      setVstatus('ready')
    } catch (e) {
      // If US lookup failed, try as ASX
      if (type === 'us') {
        try {
          const axSym = s + '.AX'
          const q2    = await fetchYFQuote(axSym)
          setVdata({ name: q2.name || s, type: 'asx', yfSym: axSym, last: q2.last })
          setVstatus('ready')
          return
        } catch {}
      }
      const msg      = (e.message ?? '').toLowerCase()
      const notFound = msg.includes('no data') || msg.includes('404') || msg.includes('error')
      setVerr(notFound ? 'TICKER NOT FOUND — check symbol and try again' : (e.message || 'DATA SOURCE ERROR'))
      setVstatus('error')
    }
  }

  const handleAdd = () => {
    if (vstatus !== 'ready' || !vdata) return
    const sharesN = parseFloat(shares)
    const costN   = parseFloat(avgCost)
    if (!sharesN || sharesN <= 0 || !costN || costN <= 0) {
      setVerr('Enter valid shares and average buy price'); setVstatus('error'); return
    }
    onAdd({
      id:           Date.now().toString(),
      symbol:       cleanSymbol(sym, vdata.type),
      yfSym:        vdata.yfSym,
      name:         vdata.name,
      shares:       sharesN,
      avgCost:      costN,
      costCurrency: ccy,
      type:         vdata.type,
      addedAt:      new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <div className="border border-terminal-border bg-terminal-panel p-3 space-y-2 max-w-xl">
      <div className="text-2xs font-bold text-terminal-gold tracking-widest">ADD HOLDING</div>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-terminal-bg border border-terminal-border px-2 py-1 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono uppercase"
          placeholder="TICKER — e.g. AAPL, BHP.AX, BTC"
          value={sym}
          onChange={(e) => { setSym(e.target.value.toUpperCase()); setVstatus('idle'); setVdata(null) }}
          onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
        />
        <button
          onClick={handleValidate}
          disabled={vstatus === 'validating'}
          className={`px-3 py-1 text-2xs font-bold border transition-colors ${
            vstatus === 'validating' ? 'border-terminal-border text-terminal-text-dim animate-pulse cursor-not-allowed'
            : vstatus === 'ready'   ? 'border-terminal-green text-terminal-green hover:bg-terminal-green/10'
            : 'border-terminal-gold text-terminal-gold hover:bg-terminal-gold/10'
          }`}
        >
          {vstatus === 'validating' ? 'CHECKING...' : vstatus === 'ready' ? '✓ VALIDATED' : 'VALIDATE'}
        </button>
      </div>

      {vstatus === 'ready' && vdata && (
        <div className="text-2xs text-terminal-green px-1">
          ✓ {vdata.name}
          {vdata.type === 'asx'    && ' · ASX'}
          {vdata.type === 'us'     && ' · US EQUITY'}
          {vdata.type === 'crypto' && ' · CRYPTO (use CRYPTO MODULE for live price)'}
          {vdata.last != null && ` · Last: ${vdata.last.toFixed(2)}`}
        </div>
      )}
      {vstatus === 'error' && <div className="text-2xs text-terminal-red px-1">⚠ {verr}</div>}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-2xs text-terminal-text-dim mb-1">SHARES / UNITS</div>
          <input type="number" min="0" step="any" placeholder="0.00" value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold"
          />
        </div>
        <div>
          <div className="text-2xs text-terminal-text-dim mb-1">AVG BUY PRICE</div>
          <input type="number" min="0" step="any" placeholder="0.00" value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold"
          />
        </div>
        <div>
          <div className="text-2xs text-terminal-text-dim mb-1">COST CURRENCY</div>
          <div className="flex border border-terminal-border h-[30px]">
            {['AUD', 'USD'].map((c) => (
              <button key={c} onClick={() => setCcy(c)}
                className={`flex-1 text-2xs font-bold transition-colors ${
                  ccy === c ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleAdd}
          disabled={vstatus !== 'ready'}
          className={`flex-1 py-1.5 text-2xs font-bold border transition-colors ${
            vstatus === 'ready'
              ? 'border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg'
              : 'border-terminal-border/30 text-terminal-text-dim/40 cursor-not-allowed'
          }`}
        >
          ADD TO PORTFOLIO
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-2xs border border-terminal-border text-terminal-text-dim hover:text-terminal-text-bright transition-colors">
          CANCEL
        </button>
      </div>
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export default function PortfolioModule() {
  const { openModal, currency } = useStore()
  const { usdToAud, audUsd }   = useAudRates()
  const displayMul = currency === 'USD' ? audUsd : 1
  const prefix     = currency === 'USD' ? 'US$' : 'A$'

  const fmtCur = (audVal) => {
    if (audVal == null || isNaN(audVal)) return '—'
    const v   = audVal * displayMul
    const abs = Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${v < 0 ? '-' : ''}${prefix}${abs}`
  }

  const [holdings, setHoldings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
  }, [holdings])

  const addHolding = (h) => {
    setHoldings((prev) => {
      const idx = prev.findIndex((p) => p.symbol === h.symbol && p.type === h.type)
      if (idx >= 0) { const u = [...prev]; u[idx] = h; return u }
      return [...prev, h]
    })
    setShowAddForm(false)
  }

  const deleteHolding = (id) => setHoldings((prev) => prev.filter((h) => h.id !== id))

  // Batch fetch for equity holdings
  const equityHoldings = holdings.filter((h) => h.type !== 'crypto')
  const yfSymbols = [...new Set(equityHoldings.map((h) => h.yfSym ?? toYahooSymbol(h.symbol, h.type)))]

  const { data: batchQuotes, isFetching, isError, refetch } = useQuery({
    queryKey:  ['yfPortfolio', ...yfSymbols],
    queryFn:   () => fetchYahooBatch(yfSymbols),
    staleTime: 60_000,
    retry: 1,
    enabled:   yfSymbols.length > 0,
  })

  const computed = holdings.map((h) => {
    const isCrypto = h.type === 'crypto'
    const isAsx    = h.type === 'asx'
    const yfSym    = h.yfSym ?? toYahooSymbol(h.symbol, h.type)
    const q        = isCrypto ? null : (batchQuotes?.[yfSym] ?? null)

    let last = null, dayPct = 0, loadState = 'pending', nativePrice = null, currency = isAsx ? 'AUD' : 'USD'
    if (q) {
      last        = isAsx ? q.last : usdToAud(q.last)
      nativePrice = isAsx ? null : q.last
      currency    = q.currency ?? currency
      dayPct      = q.pct ?? 0
      loadState   = 'live'
    } else if (!isCrypto && isError) {
      loadState = 'error'
    } else if (isCrypto) {
      loadState = 'crypto'
    }

    const avgCostAud = h.costCurrency === 'USD' ? usdToAud(h.avgCost) : h.avgCost
    const mktVal     = last != null ? last * h.shares : null
    const totalCost  = avgCostAud * h.shares
    const pnl        = mktVal != null ? mktVal - totalCost : null
    const pnlPct     = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null
    const assetClass = isAsx ? 'AU Equities' : isCrypto ? 'Crypto' : 'US Equities'

    return { ...h, last, dayPct, mktVal, totalCost, pnl, pnlPct, assetClass, loadState, isOpen: q?.isOpen, nativePrice, currency }
  })

  const live      = computed.filter((h) => h.mktVal != null)
  const mktTotal  = live.reduce((s, h) => s + h.mktVal, 0)
  const liveCost  = live.reduce((s, h) => s + h.totalCost, 0)
  const costTotal = computed.reduce((s, h) => s + h.totalCost, 0)
  const totalPnl  = mktTotal - liveCost
  const pnlPct    = liveCost > 0 ? (totalPnl / liveCost) * 100 : 0
  const dayPnl    = live.reduce((s, h) => s + h.mktVal * (h.dayPct / 100), 0)

  const allocMap = {}
  for (const h of live) allocMap[h.assetClass] = (allocMap[h.assetClass] ?? 0) + h.mktVal
  const allocData = Object.entries(allocMap).map(([name, value]) => ({
    name, value, pct: mktTotal ? ((value / mktTotal) * 100).toFixed(1) : '0.0',
  }))

  const pnlData  = live.filter((h) => h.pnl != null).map((h) => ({
    symbol: h.symbol, pnl: parseFloat((h.pnl * displayMul).toFixed(0)),
  }))
  const updatedAt = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  // ─── EMPTY STATE ───────────────────────────────────────────────────────────

  if (holdings.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-8 bg-terminal-bg">
        {showAddForm
          ? <div className="w-full max-w-sm">
              <AddHoldingForm onAdd={addHolding} onCancel={() => setShowAddForm(false)} />
            </div>
          : <>
              <div className="text-terminal-gold text-base font-bold tracking-[0.2em]">▲ PORTFOLIO TRACKER</div>
              <div className="text-terminal-text-dim text-sm text-center max-w-sm leading-relaxed">
                Track your investments with live pricing from Stooq.
                Holdings are stored locally — nothing leaves your device.
              </div>
              <button onClick={() => setShowAddForm(true)}
                className="px-6 py-2.5 text-sm font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors tracking-widest">
                + ADD YOUR FIRST HOLDING
              </button>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="text-2xs text-terminal-text-dim/60">QUICK ADD:</span>
                {['BHP.AX', 'CBA.AX', 'AAPL', 'MSFT', 'BTC', 'ETH'].map((s) => (
                  <button key={s} onClick={() => setShowAddForm(true)}
                    className="px-2 py-0.5 text-2xs border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors">
                    {s}
                  </button>
                ))}
              </div>
              <div className="text-2xs text-terminal-text-dim/40">Supports ASX (BHP.AX), US equities, and major crypto</div>
            </>
        }
      </div>
    )
  }

  // ─── MAIN VIEW ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full grid grid-rows-[auto_auto_1fr] overflow-hidden">

      {/* Stats bar */}
      <div className="grid grid-cols-4 xl:grid-cols-8 border-b border-terminal-border flex-shrink-0">
        <StatBox label="PORTFOLIO VALUE" value={mktTotal > 0 ? fmtCur(mktTotal) : '—'} color="text-terminal-text-bright" />
        <StatBox label="TOTAL COST"      value={fmtCur(costTotal)} color="text-terminal-text-dim" />
        <StatBox
          label="UNREALIZED P&L"
          value={live.length ? fmtCur(totalPnl) : '—'}
          sub={live.length ? fmt.pct(pnlPct) : ''}
          color={totalPnl >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
        />
        <StatBox
          label="TODAY'S P&L"
          value={live.length ? fmtCur(dayPnl) : '—'}
          color={dayPnl >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
        />
        <StatBox label="POSITIONS"   value={holdings.length} color="text-terminal-text-bright" />
        <StatBox label="LIVE PRICES" value={`${live.length}/${equityHoldings.length}`} color={isFetching ? 'text-terminal-gold' : 'text-terminal-text-dim'} />
        <StatBox label="DISPLAY CCY" value={currency}  color="text-terminal-gold" />
        <StatBox label="UPDATED"     value={updatedAt} color="text-terminal-text-dim" />
      </div>

      {/* Add form inline */}
      {showAddForm && (
        <div className="border-b border-terminal-border px-3 py-2 bg-terminal-panel flex-shrink-0">
          <AddHoldingForm onAdd={addHolding} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {/* Holdings table + allocation */}
      <div className="grid grid-cols-[1fr_220px] min-h-0 overflow-hidden">
        <div className="flex flex-col border-r border-terminal-border overflow-hidden">
          <div className="panel-header flex items-center gap-2 flex-shrink-0">
            POSITIONS
            <span className="text-2xs text-terminal-gold font-normal normal-case">ALL VALUES {currency}</span>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="ml-2 px-2 py-0.5 text-2xs border border-terminal-gold/50 text-terminal-gold/70 hover:border-terminal-gold hover:text-terminal-gold transition-colors"
            >
              + ADD
            </button>
            {isFetching
              ? <span className="text-2xs text-terminal-text-dim font-normal animate-pulse ml-auto">FETCHING PRICES...</span>
              : isError
                ? <span className="text-2xs text-terminal-red font-normal ml-auto">
                    ⚠ PRICE ERROR
                    <button onClick={refetch} className="underline ml-1 hover:text-terminal-gold">RETRY</button>
                  </span>
                : <span className="text-2xs text-terminal-text-dim font-normal ml-auto">Stooq · {updatedAt} AEST</span>
            }
          </div>
          <div className="overflow-auto flex-1">
            <table className="terminal-table w-full">
              <thead className="sticky top-0 bg-terminal-header">
                <tr>
                  <th className="px-2 text-left">SYMBOL</th>
                  <th className="px-1 text-left hidden md:table-cell">TYPE</th>
                  <th className="px-1 text-right">SHARES</th>
                  <th className="px-1 text-right">AVG COST</th>
                  <th className="px-1 text-right">LAST</th>
                  <th className="px-1 text-right">MKT VAL</th>
                  <th className="px-1 text-right">P&amp;L</th>
                  <th className="px-1 text-right">P&amp;L%</th>
                  <th className="px-1 text-right">DAY%</th>
                  <th className="px-1 text-right hidden xl:table-cell">WT%</th>
                  <th className="px-1 text-center">✕</th>
                </tr>
              </thead>
              <tbody>
                {computed.map((h) => {
                  const pnlCls = h.pnl != null ? (h.pnl >= 0 ? 'pos' : 'neg') : ''
                  const dayCls = colorClass(h.dayPct)
                  const dispSym = h.type === 'asx' ? h.symbol + '.AX' : h.symbol
                  return (
                    <tr key={h.id}
                      className="hover:bg-terminal-accent/20 cursor-pointer"
                      onClick={() => h.last && openModal?.({
                        symbol: h.symbol, name: h.name || h.symbol,
                        price:  h.last * displayMul,
                        pct:    h.dayPct,
                        change: (h.last * (h.dayPct / 100)) * displayMul,
                        type:   h.type,
                        extra:  { nativePrice: h.nativePrice, currency: h.currency },
                      })}
                    >
                      <td className="px-2 py-0.5 text-xs font-bold text-terminal-text-bright">{dispSym}</td>
                      <td className="px-1 py-0.5 text-2xs hidden md:table-cell">
                        <span className={h.type === 'asx' ? 'text-terminal-gold' : h.type === 'crypto' ? 'text-purple-400' : 'text-terminal-blue-bright'}>
                          {h.type === 'asx' ? 'ASX' : h.type === 'crypto' ? 'CRYPTO' : 'US'}
                        </span>
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right">{h.shares}</td>
                      <td className="px-1 py-0.5 text-2xs text-right text-terminal-text-dim">
                        {h.costCurrency === 'USD' ? 'US$' : 'A$'}{h.avgCost.toFixed(2)}
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right font-semibold">
                        {h.loadState === 'pending' && isFetching
                          ? <span className="animate-pulse text-terminal-text-dim">...</span>
                          : h.loadState === 'crypto'
                            ? <span className="text-purple-400/60 text-2xs">→ F3</span>
                            : h.loadState === 'error'
                              ? <span className="text-terminal-red text-2xs">ERR</span>
                              : h.last != null
                                ? fmtCur(h.last)
                                : <span className="text-terminal-text-dim">—</span>
                        }
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right">{h.mktVal ? fmtCur(h.mktVal) : '—'}</td>
                      <td className={`px-1 py-0.5 text-2xs text-right font-semibold ${pnlCls}`}>
                        {h.pnl != null ? fmtCur(h.pnl) : '—'}
                      </td>
                      <td className={`px-1 py-0.5 text-2xs text-right font-semibold ${pnlCls}`}>
                        {h.pnlPct != null ? fmt.pct(h.pnlPct) : '—'}
                      </td>
                      <td className={`px-1 py-0.5 text-2xs text-right ${dayCls}`}>
                        {h.dayPct ? fmt.pct(h.dayPct) : '—'}
                      </td>
                      <td className="px-1 py-0.5 text-2xs text-right text-terminal-text-dim hidden xl:table-cell">
                        {h.mktVal && mktTotal ? ((h.mktVal / mktTotal) * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-1 py-0.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => deleteHolding(h.id)}
                          className="text-terminal-text-dim/40 hover:text-terminal-red transition-colors px-1 text-2xs"
                          title="Remove position"
                        >✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col overflow-hidden">
          <div className="panel-header flex-shrink-0">ALLOCATION</div>
          {allocData.length > 0 ? (
            <>
              <div className="h-40 p-2 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocData} cx="50%" cy="50%" innerRadius={30} outerRadius={58}
                      dataKey="value" isAnimationActive={false}>
                      {allocData.map((d) => (
                        <Cell key={d.name} fill={ASSET_COLORS[d.name] ?? '#4a90d9'} stroke="#040d1a" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-auto px-2 pb-1">
                {allocData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: ASSET_COLORS[d.name] ?? '#4a90d9' }} />
                      <span className="text-2xs">{d.name}</span>
                    </div>
                    <span className="text-2xs text-terminal-text-dim">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-2xs text-terminal-text-dim animate-pulse">
              LOADING PRICES...
            </div>
          )}

          {pnlData.length > 0 && (
            <>
              <div className="panel-header border-t border-terminal-border flex-shrink-0">P&amp;L BY POSITION</div>
              <div className="h-36 p-1 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="#0d2244" vertical={false} />
                    <XAxis dataKey="symbol" tick={{ fontSize: 7 }} />
                    <YAxis tick={{ fontSize: 7 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                            <span className="text-terminal-gold">{payload[0].payload.symbol}: </span>
                            <span className={payload[0].value >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
                              {prefix}{Math.abs(payload[0].value).toLocaleString()}
                            </span>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="pnl" isAnimationActive={false}>
                      {pnlData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {holdings.some((h) => h.type === 'crypto') && (
            <div className="border-t border-terminal-border p-2 text-2xs text-terminal-text-dim/60 flex-shrink-0">
              ⚠ Crypto live prices in CRYPTO MODULE (F3)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
