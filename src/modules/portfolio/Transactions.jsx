import { useMemo, useState } from 'react'
import {
  TX_TYPES, TX_TONE, getTransactions, addTransaction, deleteTransaction,
  syncTransactionsFromHoldings, realisedByTx, summarise, txValueAud,
  transactionsToCsv,
} from '../../services/transactionService'
import { useAudRates } from '../../hooks/useAudRates'

const RANGES = [
  { key: '30d', label: 'Last 30D', days: 30 },
  { key: '90d', label: 'Last 90D', days: 90 },
  { key: '1y', label: 'Last 1Y', days: 365 },
  { key: 'all', label: 'All time', days: null },
]

const FILTERS = [
  { key: 'ALL', label: 'ALL' },
  { key: 'BUY', label: 'BUYS' },
  { key: 'SELL', label: 'SELLS' },
  { key: 'DIVIDEND', label: 'DIVIDENDS' },
]

const aud = (n) => `A$${Math.abs(Math.round(n)).toLocaleString()}`
const today = () => new Date().toISOString().slice(0, 10)

function SummaryStat({ label, value, sub, tone }) {
  return (
    <div className="border border-terminal-border p-2.5 min-w-0">
      <div className="text-2xs text-terminal-text-dim tracking-widest truncate">{label}</div>
      <div className={`text-base font-bold tabular-nums mt-0.5 ${tone ?? 'text-terminal-text-bright'}`}>{value}</div>
      {sub && <div className="text-2xs text-terminal-text-dim/60 truncate">{sub}</div>}
    </div>
  )
}

// The add form. Fields shown depend on type, because a dividend has no unit
// count and a split has no price — rendering them anyway invites entries that
// look complete and compute to nothing.
function AddTransactionForm({ symbols, onSave, onCancel }) {
  const [type, setType] = useState('BUY')
  const [date, setDate] = useState(today)
  const [symbol, setSymbol] = useState(symbols[0] ?? '')
  const [units, setUnits] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)

  const needsUnits = type === 'BUY' || type === 'SELL'
  const priceLabel = type === 'DIVIDEND' ? 'Amount (A$)' : type === 'SPLIT' ? 'Ratio (2 = 2-for-1)' : 'Price per unit'

  const save = () => {
    const u = parseFloat(units)
    const p = parseFloat(price)
    if (!symbol.trim()) return setErr('Pick a ticker')
    if (!date) return setErr('Pick a date')
    if (needsUnits && (!u || u <= 0)) return setErr('Enter a unit count above zero')
    if (!p || p <= 0) return setErr(`Enter a valid ${priceLabel.toLowerCase()}`)
    onSave({
      date, type,
      symbol: symbol.trim().toUpperCase(),
      units: needsUnits ? u : null,
      price: p,
      currency: 'AUD',
      note: note.trim() || null,
    })
  }

  const field = 'w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono'

  return (
    <div className="border border-terminal-gold bg-terminal-panel p-3 space-y-2.5">
      <div className="text-2xs font-bold text-terminal-gold tracking-widest">ADD TRANSACTION</div>

      <div className="flex gap-1">
        {TX_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => { setType(t); setErr(null) }}
            className={`flex-1 py-1 text-2xs font-bold border transition-colors ${
              type === t
                ? 'bg-terminal-gold text-terminal-bg border-terminal-gold'
                : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
            }`}
          >{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-2xs text-terminal-text-dim mb-0.5">Date</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div>
          <div className="text-2xs text-terminal-text-dim mb-0.5">Ticker</div>
          {symbols.length ? (
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={field}>
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BHP.AX" className={field} />
          )}
        </div>
        {needsUnits && (
          <div>
            <div className="text-2xs text-terminal-text-dim mb-0.5">Units</div>
            <input type="number" min="0" step="any" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="0" className={field} />
          </div>
        )}
        <div className={needsUnits ? '' : 'col-span-2'}>
          <div className="text-2xs text-terminal-text-dim mb-0.5">{priceLabel}</div>
          <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={field} />
        </div>
        <div className="col-span-2">
          <div className="text-2xs text-terminal-text-dim mb-0.5">Note (optional)</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you made this trade" className={field} />
        </div>
      </div>

      {type === 'SELL' && (
        <div className="text-2xs text-terminal-text-dim/70 leading-snug">
          Realised P&amp;L is calculated from your earlier buys on an average-cost
          basis — you do not enter it. General record-keeping, not tax advice.
        </div>
      )}
      {err && <div className="text-2xs text-terminal-red">{err}</div>}

      <div className="flex gap-2">
        <button onClick={save} className="flex-1 btn-primary btn-sm">SAVE</button>
        <button onClick={onCancel} className="flex-1 btn-secondary btn-sm">CANCEL</button>
      </div>
    </div>
  )
}

export default function Transactions({ holdings = [] }) {
  // Seed opening BUYs for holdings that have none. Idempotent in the service
  // by holding id, so re-mounting cannot double the ledger.
  const [txs, setTxs] = useState(() => syncTransactionsFromHoldings(holdings).list)
  const [filter, setFilter] = useState('ALL')
  const [range, setRange] = useState('all')
  const [ticker, setTicker] = useState('ALL')
  const [adding, setAdding] = useState(false)

  // NO SYNC EFFECT, DELIBERATELY.
  //
  // The obvious shape is an effect that re-seeds whenever `holdings` changes.
  // It is wrong twice over: `holdings` is rebuilt on every parent render, so
  // the effect fires constantly, and it drives setState, so the two push each
  // other round. It only looked harmless because the service is idempotent and
  // every extra pass wrote nothing.
  //
  // It is also unnecessary. PortfolioModule renders this tab conditionally, so
  // the component unmounts when the user switches tabs and the initialiser
  // above re-runs — and a holding can only be added from the HOLDINGS tab, so
  // by the time this is on screen again the backfill has happened.

  const refresh = () => setTxs(getTransactions())

  const realised = useMemo(() => realisedByTx(txs), [txs])

  const tickers = useMemo(
    () => [...new Set(txs.map((t) => t.symbol).filter(Boolean))].sort(),
    [txs],
  )

  // The clock is read once, not during every filter pass. Reading it in the
  // memo body makes the component non-idempotent: two renders in the same
  // session could disagree about which rows fall inside "last 30 days".
  const [mountedAt] = useState(() => Date.now())

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days
    const cutoff = days ? new Date(mountedAt - days * 86400000).toISOString().slice(0, 10) : null
    return txs.filter((t) => {
      if (filter !== 'ALL' && t.type !== filter) return false
      if (ticker !== 'ALL' && t.symbol !== ticker) return false
      if (cutoff && t.date < cutoff) return false
      return true
    })
  }, [txs, filter, ticker, range, mountedAt])

  // The summary describes what is ON SCREEN, not the whole ledger. A total
  // that ignores the active filters would contradict the rows beneath it.
  // Same converter the holdings table and the dashboard widget use, so the
  // three cannot report different totals for the same book.
  const { usdToAud } = useAudRates()
  const stats = useMemo(() => summarise(filtered, usdToAud), [filtered, usdToAud])

  const handleSave = (tx) => {
    addTransaction(tx)
    setAdding(false)
    refresh()
  }

  const exportCsv = () => {
    const blob = new Blob([transactionsToCsv(filtered)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `maddex-transactions-${today()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const holdingSymbols = useMemo(
    () => [...new Set([...holdings.map((h) => h.symbol), ...tickers].filter(Boolean))].sort(),
    [holdings, tickers],
  )

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs font-bold text-terminal-gold tracking-widest">TRANSACTION HISTORY</div>
          <div className="text-2xs text-terminal-text-dim">
            Every buy, sell, dividend and split you have recorded.
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-2xs px-3 py-1.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold"
          >+ ADD TRANSACTION</button>
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="text-2xs px-3 py-1.5 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors font-bold disabled:opacity-40"
          >⤓ EXPORT CSV</button>
        </div>
      </div>

      {adding && (
        <AddTransactionForm symbols={holdingSymbols} onSave={handleSave} onCancel={() => setAdding(false)} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <SummaryStat
          label="TOTAL INVESTED"
          value={aud(stats.invested)}
          sub={stats.unconverted
            ? 'mixed currency — FX unavailable'
            : `${filtered.filter((t) => t.type === 'BUY').length} buys`}
          tone={stats.unconverted ? 'text-terminal-gold' : undefined}
        />
        <SummaryStat
          label="DIVIDENDS RECEIVED"
          value={aud(stats.dividends)}
          sub={`${filtered.filter((t) => t.type === 'DIVIDEND').length} payments`}
          tone={stats.dividends > 0 ? 'text-terminal-gold' : undefined}
        />
        <SummaryStat
          label="REALISED P&L"
          value={stats.realised == null ? '—' : `${stats.realised >= 0 ? '▲' : '▼'} ${aud(stats.realised)}`}
          sub={stats.realised == null ? 'no closed positions' : 'average-cost basis'}
          tone={stats.realised == null ? undefined : stats.realised >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
        />
        <SummaryStat
          label="AVG HOLDING PERIOD"
          value={stats.avgHoldMonths == null ? '—' : `${stats.avgHoldMonths.toFixed(1)}mo`}
          sub={stats.avgHoldMonths == null ? 'nothing closed yet' : `across ${stats.closedPositions} closed`}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border border-terminal-border">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 text-2xs font-bold border-r border-terminal-border last:border-r-0 transition-colors ${
                filter === f.key ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
            >{f.label}</button>
          ))}
        </div>

        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
        >
          {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>

        <select
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
        >
          <option value="ALL">All tickers</option>
          {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <span className="text-2xs text-terminal-text-dim ml-auto">
          {filtered.length} of {txs.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-terminal-border py-14 flex flex-col items-center justify-center gap-2 text-center px-6">
          <div className="text-terminal-text-bright text-xs font-semibold tracking-wide">
            {txs.length === 0 ? 'NO TRANSACTIONS YET' : 'NOTHING MATCHES THESE FILTERS'}
          </div>
          <div className="text-2xs text-terminal-text-dim max-w-sm leading-relaxed">
            {txs.length === 0
              ? 'Adding a holding records its opening buy automatically. Sells, dividends and splits are added here.'
              : 'Try a wider date range or a different type.'}
          </div>
        </div>
      ) : (
        <div className="border border-terminal-border overflow-x-auto">
          <table className="w-full text-2xs">
            <thead className="sticky top-0 bg-terminal-header z-10">
              <tr className="text-terminal-text-dim">
                <th className="text-left px-3 py-1.5 font-normal">Date</th>
                <th className="text-left px-3 py-1.5 font-normal">Type</th>
                <th className="text-left px-3 py-1.5 font-normal">Ticker</th>
                <th className="text-right px-3 py-1.5 font-normal">Units</th>
                <th className="text-right px-3 py-1.5 font-normal">Price</th>
                <th className="text-right px-3 py-1.5 font-normal">Value</th>
                <th className="text-right px-3 py-1.5 font-normal whitespace-nowrap">Realised P&L</th>
                <th className="text-left px-3 py-1.5 font-normal">Notes</th>
                <th className="px-3 py-1.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const tone = TX_TONE[t.type] ?? TX_TONE.BUY
                const r = t.type === 'SELL' ? realised.get(t.id) : null
                return (
                  <tr key={t.id} className="group border-t border-terminal-border/40 hover:bg-terminal-accent/10">
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ borderLeft: `3px solid ${tone.border}` }}>
                      <span className="text-terminal-text">{t.date}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="font-bold" style={{ color: tone.border }}>{tone.label}</span>
                    </td>
                    <td className="px-3 py-1.5 font-bold text-terminal-gold">{t.symbol}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-terminal-text">
                      {t.type === 'DIVIDEND' ? '—' : t.type === 'SPLIT' ? `${t.price}:1` : (t.units ?? '—')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-terminal-text">
                      {t.type === 'SPLIT'
                        ? '—'
                        : `${(t.currency ?? 'AUD') === 'AUD' ? 'A$' : 'US$'}${Number(t.price).toFixed(2)}`}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-terminal-text-bright">
                      {t.type === 'SPLIT' ? '—' : aud(txValueAud(t, usdToAud))}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r == null ? (
                        <span className="text-terminal-text-dim/40">—</span>
                      ) : (
                        <span className={r >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
                          {r >= 0 ? '+' : '−'}{aud(r)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-terminal-text-dim truncate max-w-[180px]">{t.note ?? ''}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => { deleteTransaction(t.id); refresh() }}
                        title="Delete this entry"
                        className="opacity-0 group-hover:opacity-100 text-terminal-text-dim hover:text-terminal-red transition-opacity"
                      >🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-2xs text-terminal-text-dim/50 leading-relaxed">
        Realised P&amp;L uses an average-cost basis across this ledger, matching the
        average cost shown on each holding. Australian CGT has parcel-level rules
        this does not model — general record-keeping, not tax advice.
      </div>
    </div>
  )
}
