import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchYahooBatch, fetchYFHistory, transformYFHistory } from '../../services/api'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt, colorClass } from '../../utils/format'
import { useStore } from '../../store/useStore'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function exportCSV(holdings) {
  const headers = ['Symbol', 'Last', 'Open', 'High', 'Low', 'Volume', '% Change']
  const rows    = holdings.map((h) => [
    h.displaySymbol,
    h.last   ? fmt.price(h.last)  : '',
    h.open   ? fmt.price(h.open)  : '',
    h.high   ? fmt.price(h.high)  : '',
    h.low    ? fmt.price(h.low)   : '',
    h.vol    ?? '',
    h.pct    ? fmt.pct(h.pct)     : '',
  ])
  const csv  = [headers, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `watchlist_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function WatchlistModule() {
  const { watchlist, addToWatchlist, removeFromWatchlist, watchlistFocus, setWatchlistFocus, openModal } = useStore()
  const [selected, setSelected]   = useState(watchlist[0] || 'BHP.AX')
  const [newTicker, setNewTicker] = useState('')
  const { usdToAud } = useAudRates()

  useEffect(() => {
    if (!watchlistFocus) return
    setSelected(watchlistFocus)
    setWatchlistFocus(null)
  }, [watchlistFocus, setWatchlistFocus])

  // Split: equity symbols go to Yahoo Finance; crypto shown as unavailable
  const equitySymbols = watchlist.filter((s) => {
    const t = detectAssetType(s)
    return t !== 'crypto' && t !== 'fx'
  })
  const yahooSymbols = equitySymbols.map((s) => toYahooSymbol(s, detectAssetType(s)))

  const { data: batchQuotes, isFetching: batchFetching, isError: batchError, refetch: refetchBatch } = useQuery({
    queryKey:  ['yfWatchlistBatch', ...yahooSymbols],
    queryFn:   () => fetchYahooBatch(yahooSymbols),
    enabled:   yahooSymbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  // History for selected equity symbol
  const selectedType    = detectAssetType(selected)
  const selectedYFSym   = selectedType !== 'crypto' && selectedType !== 'fx'
    ? toYahooSymbol(selected, selectedType)
    : null

  const { data: rawHistory, isFetching: historyLoading, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey:  ['yfHistory', selectedYFSym],
    queryFn:   () => fetchYFHistory(selectedYFSym, { range: '3mo', interval: '1d' }),
    enabled:   !!selectedYFSym,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rawChartData = rawHistory ? transformYFHistory(rawHistory) : null

  // Resolve holdings for display
  const resolvedHoldings = watchlist.map((symbol) => {
    const type      = detectAssetType(symbol)
    const isCrypto  = type === 'crypto'
    const yfSym     = isCrypto ? null : toYahooSymbol(symbol, type)
    const q         = yfSym && batchQuotes ? batchQuotes[yfSym] : null
    const isAsx     = type === 'asx'

    if (!q) {
      return { symbol, displaySymbol: symbol.replace(/\.AX$/, ''), last: null, open: null, high: null, low: null, pct: 0, vol: '—', isLive: false, isCrypto, week52High: null, week52Low: null }
    }

    const conv = isAsx ? (v) => v : usdToAud
    return {
      symbol,
      displaySymbol: symbol.replace(/\.AX$/, ''),
      last:         conv(q.last),
      open:         conv(q.open),
      high:         conv(q.high),
      low:          conv(q.low),
      pct:          q.pct,
      change:       conv(q.change),
      vol:          q.vol,
      week52High:   q.week52High != null ? conv(q.week52High) : null,
      week52Low:    q.week52Low  != null ? conv(q.week52Low)  : null,
      isLive:       true,
      isOpen:       q.isOpen,
      timestamp:    q.timestamp,
    }
  })

  const selectedData = resolvedHoldings.find((h) => h.symbol === selected) ?? resolvedHoldings[0]

  // Convert USD chart data to AUD for non-ASX symbols
  const displayChartData = rawChartData
    ? (selectedType === 'asx'
        ? rawChartData
        : rawChartData.map((d) => ({ ...d, price: usdToAud(d.price), close: usdToAud(d.close ?? d.price) }))
      )
    : null

  const handleAdd = (e) => {
    e.preventDefault()
    const sym = newTicker.trim().toUpperCase()
    if (sym) { addToWatchlist(sym); setSelected(sym); setNewTicker('') }
  }

  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="h-full grid grid-cols-[260px_1fr] overflow-hidden">
      {/* Left: watchlist sidebar */}
      <div className="flex flex-col border-r border-terminal-border overflow-hidden">
        <div className="panel-header flex items-center gap-2">
          WATCHLIST
          {batchFetching
            ? <span className="text-terminal-text-dim text-2xs font-normal normal-case ml-auto animate-pulse">FETCHING...</span>
            : <span className="text-terminal-green text-2xs font-normal normal-case ml-auto">● LIVE</span>}
        </div>

        <div className="flex border-b border-terminal-border flex-shrink-0">
          <form onSubmit={handleAdd} className="flex flex-1">
            <span className="px-2 py-1.5 text-2xs text-terminal-gold flex-shrink-0">+</span>
            <input
              className="cmd-input flex-1 py-1.5 text-2xs"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="ADD TICKER (e.g. BHP.AX)"
            />
            <button type="submit" className="px-2 py-1.5 text-2xs text-terminal-gold hover:bg-terminal-accent transition-colors">
              ADD
            </button>
          </form>
          <button
            onClick={() => exportCSV(resolvedHoldings)}
            className="px-2 py-1.5 text-2xs text-terminal-text-dim hover:text-terminal-gold border-l border-terminal-border transition-colors"
            title="Export CSV"
          >
            CSV
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {resolvedHoldings.length === 0 ? (
            <div className="p-4 text-2xs text-terminal-text-dim text-center">No tickers.<br />Add tickers above.</div>
          ) : resolvedHoldings.map((h) => {
            const cls      = colorClass(h.pct)
            const isActive = selected === h.symbol
            return (
              <div
                key={h.symbol}
                className={`flex items-center justify-between px-2 py-2 border-b border-terminal-border/50 cursor-pointer transition-colors ${
                  isActive ? 'bg-terminal-accent border-l-2 border-l-terminal-gold' : 'hover:bg-terminal-accent/20'
                }`}
                onClick={() => {
                  setSelected(h.symbol)
                  if (h.last) openModal?.({
                    symbol: h.symbol, name: h.displaySymbol ?? h.symbol,
                    price: h.last, pct: h.pct, change: h.change ?? null,
                    type: detectAssetType(h.symbol),
                  })
                }}
              >
                <div>
                  <span className="text-xs font-bold text-terminal-text-bright block">
                    {h.displaySymbol ?? h.symbol}
                    {h.isLive
                      ? <span className="text-2xs text-terminal-green ml-1">●</span>
                      : h.isCrypto
                        ? <span className="text-2xs text-terminal-text-dim ml-1">CG</span>
                        : batchFetching
                          ? <span className="text-2xs text-terminal-text-dim ml-1">…</span>
                          : null
                    }
                  </span>
                  <span className={`text-xs font-semibold block ${h.last ? cls : 'text-terminal-text-dim'}`}>
                    {batchFetching && !h.isLive ? '...' : h.last ? fmt.aud(h.last) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xs font-semibold ${cls}`}>
                    {h.pct ? fmt.pct(h.pct) : '—'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFromWatchlist(h.symbol)
                      const remaining = watchlist.filter((s) => s !== h.symbol)
                      if (selected === h.symbol && remaining.length) setSelected(remaining[0])
                    }}
                    className="text-terminal-text-dim hover:text-terminal-red text-2xs ml-1"
                  >✕</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex flex-col overflow-hidden">
        {selectedData ? (
          <>
            <div className="panel-header flex items-center gap-3">
              <span className="text-terminal-gold text-sm font-bold">{selectedData.displaySymbol ?? selectedData.symbol}</span>
              <span className="text-terminal-text text-xs">
                {selectedData.last ? fmt.aud(selectedData.last) : '—'}
              </span>
              <span className={`text-xs font-semibold ${colorClass(selectedData.pct)}`}>
                {selectedData.pct ? fmt.pct(selectedData.pct) : '—'}
              </span>
              {selectedData.isLive
                ? <span className="text-2xs text-terminal-green ml-1">● {selectedData.isOpen ? 'LIVE' : 'DELAYED'}</span>
                : selectedData.isCrypto
                  ? <span className="text-2xs text-terminal-text-dim ml-1">USE CRYPTO MODULE</span>
                  : batchFetching
                    ? <span className="text-2xs text-terminal-text-dim ml-1">LOADING...</span>
                    : batchError
                      ? <span className="text-2xs text-terminal-red ml-1">DATA UNAVAILABLE</span>
                      : <span className="text-2xs text-terminal-text-dim ml-1">—</span>
              }
              <span className="text-2xs text-terminal-text-dim ml-auto">{updatedTime} AEST · Stooq</span>
              <button
                className="text-2xs text-terminal-gold border border-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                onClick={() => openModal?.({
                  symbol: selectedData.symbol, name: selectedData.displaySymbol ?? selectedData.symbol,
                  price: selectedData.last, pct: selectedData.pct, change: selectedData.change ?? null,
                  type: detectAssetType(selectedData.symbol),
                })}
              >
                ↗ DETAIL
              </button>
            </div>

            <div className="grid grid-cols-4 xl:grid-cols-8 border-b border-terminal-border flex-shrink-0">
              {[
                { label: 'OPEN',     value: selectedData.open       ? fmt.aud(selectedData.open)       : '—' },
                { label: 'HIGH',     value: selectedData.high       ? fmt.aud(selectedData.high)       : '—', color: 'text-terminal-green' },
                { label: 'LOW',      value: selectedData.low        ? fmt.aud(selectedData.low)        : '—', color: 'text-terminal-red'   },
                { label: 'LAST',     value: selectedData.last       ? fmt.aud(selectedData.last)       : '—' },
                { label: '52W HIGH', value: selectedData.week52High ? fmt.aud(selectedData.week52High) : '—', color: 'text-terminal-green' },
                { label: '52W LOW',  value: selectedData.week52Low  ? fmt.aud(selectedData.week52Low)  : '—', color: 'text-terminal-red'   },
                { label: 'VOLUME',   value: selectedData.vol        ?? '—' },
                { label: 'DAY CHG%', value: selectedData.pct        ? fmt.pct(selectedData.pct)        : '—', color: colorClass(selectedData.pct) },
              ].map((s) => (
                <div key={s.label} className="border-r border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">{s.label}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${s.color || 'text-terminal-text-bright'}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="flex-1 p-3 min-h-0">
              <div className="panel-header -mx-3 -mt-3 mb-3">
                PRICE CHART (90D) — {selectedData.displaySymbol ?? selectedData.symbol}
                {historyLoading && <span className="ml-2 text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>}
              </div>
              {selectedData.isCrypto ? (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim">
                  Switch to CRYPTO module to view chart history
                </div>
              ) : historyLoading ? (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">
                  LOADING CHART...
                </div>
              ) : historyError || !displayChartData ? (
                <DataUnavailable label="CHART UNAVAILABLE" onRetry={refetchHistory} className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="watchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#0d2244" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                            <div className="text-terminal-text-dim">{label}</div>
                            <div className="text-terminal-gold font-semibold">{fmt.aud(payload[0].value)}</div>
                          </div>
                        )
                      }}
                    />
                    <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={1.5}
                      fill="url(#watchGrad)" dot={false} isAnimationActive={false} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-terminal-text-dim text-2xs">
            SELECT A TICKER FROM YOUR WATCHLIST
          </div>
        )}
      </div>
    </div>
  )
}
