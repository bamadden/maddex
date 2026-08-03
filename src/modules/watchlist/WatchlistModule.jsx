import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchYahooQuote, USING_MOCK_DATA } from '../../services/api'
import { fetchEquityQuotes } from '../../services/dataService'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt, formatMarketCap } from '../../utils/format'
import PriceChange from '../../components/ui/PriceChange'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabase'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { ModuleLoader, ModuleError, StaleBadge, DemoBadge } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'

function displaySymbol(symbol) {
  return symbol.replace(/\.AX$/, '').replace(/-USD$/, '')
}

function toYahoo(raw) {
  const type = detectAssetType(raw)
  return { type, yfSym: toYahooSymbol(raw, type) }
}

function exportCSV(rows) {
  const headers = ['Ticker', 'Name', 'Price (AUD)', 'Day Change', 'Day Change %', '52W High', '52W Low', 'Volume', 'Market Cap']
  const csvRows = rows.map((r) => [
    r.displaySymbol,
    r.name ?? '',
    r.price != null ? r.price.toFixed(2) : '',
    r.change != null ? r.change.toFixed(2) : '',
    r.pct != null ? r.pct.toFixed(2) : '',
    r.week52High != null ? r.week52High.toFixed(2) : '',
    r.week52Low != null ? r.week52Low.toFixed(2) : '',
    r.volume ?? '',
    r.marketCap != null ? Math.round(r.marketCap) : '',
  ])
  const csv  = [headers, ...csvRows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `watchlist_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function WatchlistModule() {
  const { watchlist, addToWatchlist, removeFromWatchlist, reorderWatchlist, clearWatchlist, openModal } = useStore()
  const { user } = useAuthStore()
  const { usdToAud } = useAudRates()

  const [searchInput, setSearchInput] = useState('')
  const [addError, setAddError]       = useState(null)
  const [validating, setValidating]   = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [synced, setSynced]           = useState(false)
  const dragIndexRef  = useRef(null)
  const clearTimerRef = useRef(null)

  // Load watchlist from Supabase on mount when logged in
  useEffect(() => {
    if (!user || synced) return
    supabase.from('watchlist').select('*').order('position').then(({ data }) => {
      if (data && data.length > 0) {
        clearWatchlist()
        data.forEach(row => addToWatchlist(row.symbol))
      }
      setSynced(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const yahooSymbols = watchlist.map((s) => toYahoo(s).yfSym)

  const { data: batchResult, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey:  ['watchlistBatch', ...yahooSymbols],
    queryFn:   () => fetchEquityQuotes(yahooSymbols),
    enabled:   yahooSymbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  })
  const batchQuotes = batchResult?.data
  const isDelayed   = batchResult?.stale === true

  const rows = watchlist.map((symbol) => {
    const { type, yfSym } = toYahoo(symbol)
    const q      = batchQuotes?.[yfSym] ?? null
    const isAsx  = type === 'asx'
    const conv   = isAsx ? (v) => v : usdToAud
    const base   = { symbol, displaySymbol: displaySymbol(symbol), type }
    if (!q) return { ...base, name: symbol, price: null, change: null, pct: null, week52High: null, week52Low: null, volume: null, marketCap: null, isOpen: false, isLive: false }
    return {
      ...base,
      name:        q.name ?? symbol,
      price:       conv(q.price),
      change:      conv(q.dayChange),
      pct:         q.dayChangePct,
      week52High:  q.week52High != null ? conv(q.week52High) : null,
      week52Low:   q.week52Low  != null ? conv(q.week52Low)  : null,
      volume:      q.volume ?? q.vol ?? null,
      marketCap:   q.marketCap != null ? conv(q.marketCap) : null,
      isOpen:      q.isOpen,
      isLive:      true,
      nativePrice: isAsx ? null : q.price,
      currency:    q.currency,
    }
  })

  const handleAdd = async (e) => {
    e.preventDefault()
    const raw = searchInput.trim().toUpperCase()
    if (!raw) return
    if (watchlist.includes(raw)) { setAddError('ALREADY IN WATCHLIST'); return }
    setAddError(null)
    setValidating(true)
    try {
      const { yfSym } = toYahoo(raw)
      const q = await fetchYahooQuote(yfSym)
      if (!q) { setAddError('TICKER NOT FOUND — check symbol and try again'); return }
      addToWatchlist(raw)
      setSearchInput('')
      if (user) {
        await supabase.from('watchlist').upsert({ symbol: raw, name: q.name ?? raw, position: watchlist.length }, { onConflict: 'user_id,symbol' })
      }
    } catch {
      setAddError('TICKER NOT FOUND — check symbol and try again')
    } finally {
      setValidating(false)
    }
  }

  const handleRemove = async (sym) => {
    removeFromWatchlist(sym)
    if (user) {
      await supabase.from('watchlist').delete().eq('symbol', sym)
    }
  }

  const handleRowClick = (row) => {
    if (row.price == null) return
    openModal?.({
      symbol: row.symbol,
      name:   row.displaySymbol,
      price:  row.price,
      pct:    row.pct,
      change: row.change,
      type:   row.type,
      extra:  {
        week52High:  row.week52High,
        week52Low:   row.week52Low,
        isOpen:      row.isOpen,
        marketCap:   row.marketCap,
        nativePrice: row.nativePrice,
        currency:    row.currency,
      },
    })
  }

  const handleClearAll = () => {
    if (confirmClear) {
      clearTimeout(clearTimerRef.current)
      clearWatchlist()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      clearTimerRef.current = setTimeout(() => setConfirmClear(false), 4000)
    }
  }

  const onDragStart = (i) => { dragIndexRef.current = i }
  const onDragOver  = (e) => e.preventDefault()
  const onDrop = (i) => {
    const from = dragIndexRef.current
    if (from != null && from !== i) reorderWatchlist(from, i)
    dragIndexRef.current = null
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="WATCHLIST"
        subtitle={`${watchlist.length} tickers · drag ⠿ to reorder`}
        isFetching={isFetching}
        lastUpdated={dataUpdatedAt}
        onRefresh={refetch}
        right={
          !isFetching && (USING_MOCK_DATA
            ? <DemoBadge />
            : isDelayed
              ? <StaleBadge cachedAt={batchResult?.cachedAt} />
              : <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE</span>)
        }
      />

      {/* Search / add bar */}
      <div className="flex items-center border-b border-terminal-border flex-shrink-0">
        <form onSubmit={handleAdd} className="flex flex-1 items-center">
          <span className="px-2 text-2xs text-terminal-gold flex-shrink-0">+</span>
          <input
            className="cmd-input flex-1 py-1.5 text-2xs"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value.toUpperCase()); setAddError(null) }}
            placeholder="ADD TICKER — ASX (BHP.AX) or US (AAPL) — press Enter"
          />
          <button
            type="submit"
            disabled={validating}
            className="px-3 py-1.5 text-2xs text-terminal-gold hover:bg-terminal-accent transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {validating ? 'CHECKING...' : 'ADD'}
          </button>
        </form>
        <button
          onClick={() => exportCSV(rows)}
          className="px-2 py-1.5 text-2xs text-terminal-text-dim hover:text-terminal-gold border-l border-terminal-border transition-colors flex-shrink-0"
        >
          EXPORT CSV
        </button>
        <button
          onClick={handleClearAll}
          disabled={watchlist.length === 0}
          className={`px-2 py-1.5 text-2xs border-l border-terminal-border transition-colors flex-shrink-0 disabled:opacity-30 ${
            confirmClear ? 'text-terminal-red font-bold' : 'text-terminal-text-dim hover:text-terminal-red'
          }`}
        >
          {confirmClear ? 'CLICK AGAIN TO CONFIRM' : 'CLEAR ALL'}
        </button>
      </div>

      {addError && (
        <div className="px-2 py-1 text-2xs text-terminal-red border-b border-terminal-red/30 bg-terminal-red/5 flex-shrink-0">
          ⚠ {addError}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {watchlist.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-terminal-gold text-xl">☆</span>
            <div className="text-terminal-text-dim text-2xs max-w-xs leading-relaxed">
              No assets tracked yet — search above to add your first asset
            </div>
          </div>
        ) : isError && !batchQuotes ? (
          <ModuleError module="Watchlist prices" lastUpdated={dataUpdatedAt} onRetry={refetch} />
        ) : isFetching && !batchQuotes ? (
          <ModuleLoader name="WATCHLIST" />
        ) : (
          <table className="terminal-table w-full">
            <thead className="sticky top-0 bg-terminal-header z-10">
              <tr>
                <th className="px-2 w-6"></th>
                <th className="px-2 text-left">TICKER</th>
                <th className="px-2 text-left">NAME</th>
                <th className="px-2 text-right">PRICE (A$)</th>
                <th className="px-2 text-right">CHG</th>
                <th className="px-2 text-right">CHG%</th>
                <th className="px-2 text-right">52W HIGH</th>
                <th className="px-2 text-right">52W LOW</th>
                <th className="px-2 text-right">VOLUME</th>
                <th className="px-2 text-right">MKT CAP</th>
                <th className="px-2 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.symbol}
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(i)}
                  className="cursor-pointer hover:bg-terminal-accent/20 transition-colors border-b border-terminal-border/40"
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-2 py-1.5 text-terminal-text-dim/40 cursor-grab select-none" title="Drag to reorder">⠿</td>
                  <td className="px-2 py-1.5 text-xs font-bold text-terminal-text-bright whitespace-nowrap">
                    {row.displaySymbol}
                    {row.isLive
                      ? <span className="text-2xs text-terminal-green ml-1">●</span>
                      : isFetching
                        ? <span className="text-2xs text-terminal-text-dim ml-1">…</span>
                        : null}
                  </td>
                  <td className="px-2 py-1.5 text-2xs text-terminal-text-dim truncate max-w-[200px]">{row.name}</td>
                  <td className="px-2 py-1.5 text-2xs text-right font-semibold text-terminal-text-bright">
                    {row.price != null ? fmt.aud(row.price) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <PriceChange value={row.change} className="justify-end" />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <PriceChange pct={row.pct} className="justify-end" />
                  </td>
                  <td className="px-2 py-1.5 text-2xs text-right text-terminal-green">
                    {row.week52High != null ? fmt.aud(row.week52High) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-2xs text-right text-terminal-red">
                    {row.week52Low != null ? fmt.aud(row.week52Low) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-2xs text-right text-terminal-text-dim">
                    {row.volume != null ? fmt.large(row.volume) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-2xs text-right text-terminal-text-dim">
                    {formatMarketCap(row.marketCap)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(row.symbol) }}
                      className="text-terminal-text-dim hover:text-terminal-red text-xs px-1"
                      title="Remove from watchlist"
                    >
                      ✕
                    </button>
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
