import { useState, useRef, useEffect, Fragment } from 'react'
import { Bookmark } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchYahooQuote, USING_MOCK_DATA, fetchCryptoMarkets, transformCryptoMarkets } from '../../services/api'
import { fetchEquityQuotes } from '../../services/dataService'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt, formatMarketCap } from '../../utils/format'
import PriceChange from '../../components/ui/PriceChange'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useSubscription } from '../../hooks/useSubscription'
import { supabase } from '../../lib/supabase'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { earningsFor, daysUntil } from '../../services/earningsCalendar'
import { getEarningsResult } from '../../services/earningsAnalystService'
import EarningsPreviewPanel from '../../components/earningsPreview/EarningsPreviewPanel'
import EarningsResultPanel from '../../components/earningsPreview/EarningsResultPanel'
import { ModuleError, StaleBadge, DemoBadge } from '../../components/ui/ModuleStates'
import { SkeletonCard } from '../../components/ui/Skeleton'
import ModuleHeader from '../../components/ui/ModuleHeader'
import ShareLinkModal from '../../components/ui/ShareLinkModal'
import { useLivePrice } from '../../hooks/useLivePrice'
import { createShareLink } from '../../services/sharingService'
import { logActivity } from '../../services/activityLogService'

function displaySymbol(symbol) {
  return symbol.replace(/\.AX$/, '').replace(/-USD$/, '')
}

// Compact 52-week range bar — shows low/high plus a dot marking where the
// current price sits between them, instead of two bare numeric columns.
function Week52Bar({ price, low, high }) {
  if (price == null || low == null || high == null || high <= low) {
    return <span className="text-terminal-text-dim">—</span>
  }
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100))
  return (
    <div className="flex items-center gap-1.5 min-w-[120px]">
      <span className="text-2xs text-terminal-red flex-shrink-0">{fmt.aud(low)}</span>
      <div className="relative flex-1 h-1 bg-terminal-border/40 min-w-[40px]">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-terminal-gold border border-terminal-bg"
          style={{ left: `calc(${pct}% - 3px)` }}
          title={`${pct.toFixed(0)}% of 52W range`}
        />
      </div>
      <span className="text-2xs text-terminal-green flex-shrink-0">{fmt.aud(high)}</span>
    </div>
  )
}

// Live-ticking price/change/pct/52W-bar cells for one row — a real hook
// call per row requires its own component (can't call hooks inside the
// .map() body directly). Only ASX symbols get the simulated live stream
// (their mock quote is already AUD-native, no currency-conversion nuance
// to replicate here); US/crypto rows keep their existing static values.
function LivePriceCells({ symbol, price, change, pct, week52Low, week52High }) {
  const isAsx = symbol.endsWith('.AX')
  const { quote, flash } = useLivePrice(isAsx ? symbol : null)
  const livePrice = isAsx && quote ? quote.regularMarketPrice : price
  const liveChange = isAsx && quote ? quote.regularMarketChange : change
  const livePct = isAsx && quote ? quote.regularMarketChangePercent : pct
  const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''
  return (
    <>
      <td className={`px-2 py-1.5 text-2xs text-right font-semibold text-terminal-text-bright ${flashClass}`}>
        {livePrice != null ? fmt.aud(livePrice) : '—'}
      </td>
      <td className="px-2 py-1.5 text-right">
        <PriceChange value={liveChange} className="justify-end" />
      </td>
      <td className="px-2 py-1.5 text-right">
        <PriceChange pct={livePct} className="justify-end" />
      </td>
      <td className="px-2 py-1.5 text-right">
        <Week52Bar price={livePrice} low={week52Low} high={week52High} />
      </td>
    </>
  )
}

const SORT_VALUE = {
  name:      (r) => r.name ?? r.displaySymbol,
  price:     (r) => r.price,
  pct:       (r) => r.pct,
  marketCap: (r) => r.marketCap,
}
const SORT_LABEL = { name: 'NAME', price: 'PRICE (A$)', pct: 'CHG%', marketCap: 'MKT CAP' }

function sortRows(rows, sortKey, sortDir) {
  if (!sortKey) return rows
  const getVal = SORT_VALUE[sortKey]
  return [...rows].sort((a, b) => {
    const av = getVal(a), bv = getVal(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortDir === 'asc' ? cmp : -cmp
  })
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
  const { user, profile } = useAuthStore()
  const [shareLink, setShareLink] = useState(null)
  const { canAccess } = useSubscription()
  const WATCHLIST_LIMIT = 20 // Core tier — Prime+ is unlimited
  const { usdToAud } = useAudRates()

  const [searchInput, setSearchInput] = useState('')
  const searchInputRef = useRef(null)
  const [addError, setAddError]       = useState(null)
  const [validating, setValidating]   = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [synced, setSynced]           = useState(false)
  const [sortKey, setSortKey]         = useState(null)
  const [sortDir, setSortDir]         = useState('asc')
  const [earningsPreview, setEarningsPreview] = useState(null)
  const [earningsResult, setEarningsResult] = useState(null)
  const dragIndexRef  = useRef(null)
  const clearTimerRef = useRef(null)

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

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

  // Equities/indices go through the existing Yahoo batch quote path; crypto
  // symbols (BTC, ETH, ...) resolve to Yahoo's "-USD" format but that batch
  // endpoint only serves equities, so they were silently coming back with
  // no quote at all. Crypto gets its own CoinGecko-backed lookup instead,
  // keyed by the plain ticker rather than the Yahoo symbol.
  const equitySymbols = watchlist.filter((s) => toYahoo(s).type !== 'crypto')
  const cryptoSymbols = watchlist.filter((s) => toYahoo(s).type === 'crypto')
  const yahooSymbols  = equitySymbols.map((s) => toYahoo(s).yfSym)

  const { data: batchResult, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey:  ['watchlistBatch', ...yahooSymbols],
    queryFn:   () => fetchEquityQuotes(yahooSymbols),
    enabled:   yahooSymbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  })
  const batchQuotes = batchResult?.data
  const isDelayed   = batchResult?.stale === true

  const { data: cryptoResult, isFetching: isFetchingCrypto, refetch: refetchCrypto } = useQuery({
    queryKey:  ['watchlistCrypto', ...cryptoSymbols],
    queryFn:   () => fetchCryptoMarkets('aud'),
    enabled:   cryptoSymbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  })
  const cryptoQuotes = cryptoResult
    ? Object.fromEntries(transformCryptoMarkets(cryptoResult.data, cryptoResult.currency).map((c) => [c.symbol, c]))
    : {}

  const anyFetching = isFetching || isFetchingCrypto
  const refetchAll = () => { refetch(); refetchCrypto() }

  const rows = watchlist.map((symbol) => {
    const { type, yfSym } = toYahoo(symbol)
    const base   = { symbol, displaySymbol: displaySymbol(symbol), type }

    if (type === 'crypto') {
      const c = cryptoQuotes[displaySymbol(symbol)] ?? null
      if (!c) return { ...base, name: symbol, price: null, change: null, pct: null, week52High: null, week52Low: null, volume: null, marketCap: null, isOpen: true, isLive: false }
      return {
        ...base,
        name:        c.name ?? symbol,
        price:       c.price,
        change:      c.price * (c.pct24h / 100),
        pct:         c.pct24h,
        week52High:  null,
        week52Low:   null,
        volume:      c.volume,
        marketCap:   c.marketCap,
        isOpen:      true,
        isLive:      true,
        nativePrice: null,
        currency:    'AUD',
      }
    }

    const q      = batchQuotes?.[yfSym] ?? null
    const isAsx  = type === 'asx'
    const conv   = isAsx ? (v) => v : usdToAud
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

  const sortedRows = sortRows(rows, sortKey, sortDir)
  // Stock rows first, crypto rows grouped at the end (stable sort — each
  // group keeps sortedRows' existing relative order) so the table can
  // render two visually separated sections while `i` still indexes into
  // `sortedRows` for onDragStart/onDrop, which reorder the underlying
  // watchlist array by that position.
  const groupedRows = sortedRows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (a.row.type === 'crypto' ? 1 : 0) - (b.row.type === 'crypto' ? 1 : 0))
  const firstCryptoIdx = groupedRows.findIndex(({ row }) => row.type === 'crypto')

  const handleAdd = async (e) => {
    e.preventDefault()
    const raw = searchInput.trim().toUpperCase()
    if (!raw) return
    if (watchlist.includes(raw)) { setAddError('ALREADY IN WATCHLIST'); return }
    if (!canAccess('prime') && watchlist.length >= WATCHLIST_LIMIT) {
      setAddError(`WATCHLIST LIMIT REACHED (${WATCHLIST_LIMIT}) — upgrade to Prime for unlimited`)
      return
    }
    setAddError(null)
    setValidating(true)
    try {
      const { yfSym } = toYahoo(raw)
      const q = await fetchYahooQuote(yfSym)
      if (!q) { setAddError('TICKER NOT FOUND — check symbol and try again'); return }
      addToWatchlist(raw)
      logActivity('watchlist', `Added ${raw} to watchlist`)
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

  const handleShare = () => {
    const ownerName = profile?.first_name || user?.email?.split('@')[0] || 'A Maddex user'
    const stocks = sortedRows
      .filter((r) => r.price != null)
      .map((r) => ({ symbol: r.symbol, name: r.name, price: r.price, changePct: r.pct }))
    setShareLink(createShareLink('watchlist', { ownerName, stocks }))
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
        subtitle={sortKey ? `${watchlist.length} tickers · sorted by ${SORT_LABEL[sortKey]}` : `${watchlist.length} tickers · drag ⠿ to reorder`}
        moduleId="watchlist"
        isFetching={anyFetching}
        lastUpdated={dataUpdatedAt}
        onRefresh={refetchAll}
        right={
          !anyFetching && (USING_MOCK_DATA
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
            ref={searchInputRef}
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
          onClick={() => exportCSV(sortedRows)}
          className="px-2 py-1.5 text-2xs text-terminal-text-dim hover:text-terminal-gold border-l border-terminal-border transition-colors flex-shrink-0"
        >
          EXPORT CSV
        </button>
        <button
          onClick={handleShare}
          disabled={sortedRows.length === 0}
          className="px-2 py-1.5 text-2xs text-terminal-text-dim hover:text-terminal-gold border-l border-terminal-border transition-colors flex-shrink-0 disabled:opacity-30"
        >
          SHARE
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
            <span className="w-10 h-10 rounded-full border border-terminal-gold/40 text-terminal-gold flex items-center justify-center">
              <Bookmark size={18} strokeWidth={1.75} />
            </span>
            <div className="text-terminal-text-bright text-sm font-semibold mt-1 tracking-wide">YOUR WATCHLIST IS EMPTY</div>
            <div className="text-terminal-text-dim text-2xs max-w-xs leading-relaxed">
              Search for stocks to add — press / to start
            </div>
            <button
              onClick={() => searchInputRef.current?.focus()}
              className="mt-2 text-2xs font-bold text-terminal-gold border border-terminal-gold/40 rounded-full px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >
              + ADD STOCK
            </button>
          </div>
        ) : isError && !batchQuotes && !Object.keys(cryptoQuotes).length ? (
          <ModuleError module="Watchlist prices" lastUpdated={dataUpdatedAt} onRetry={refetchAll} />
        ) : anyFetching && !batchQuotes && !Object.keys(cryptoQuotes).length ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} rows={1} className="p-2" />)}
          </div>
        ) : (
          <table className="terminal-table w-full">
            <thead className="sticky top-0 bg-terminal-header z-10">
              <tr>
                <th className="px-2 w-6"></th>
                <th className="px-2 text-left">TICKER</th>
                <th
                  onClick={() => toggleSort('name')}
                  className="px-2 text-left cursor-pointer hover:text-terminal-gold transition-colors select-none"
                >
                  NAME{sortKey === 'name' && <span className="text-terminal-gold ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th
                  onClick={() => toggleSort('price')}
                  className="px-2 text-right cursor-pointer hover:text-terminal-gold transition-colors select-none"
                >
                  PRICE (A$){sortKey === 'price' && <span className="text-terminal-gold ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="px-2 text-right">CHG</th>
                <th
                  onClick={() => toggleSort('pct')}
                  className="px-2 text-right cursor-pointer hover:text-terminal-gold transition-colors select-none"
                >
                  CHG%{sortKey === 'pct' && <span className="text-terminal-gold ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="px-2 text-right">52W RANGE</th>
                <th className="px-2 text-right">VOLUME</th>
                <th
                  onClick={() => toggleSort('marketCap')}
                  className="px-2 text-right cursor-pointer hover:text-terminal-gold transition-colors select-none"
                >
                  MKT CAP{sortKey === 'marketCap' && <span className="text-terminal-gold ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="px-2 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {firstCryptoIdx > 0 && (
                <tr className="pointer-events-none">
                  <td colSpan={10} className="px-2 py-1 text-2xs font-bold text-terminal-gold tracking-widest bg-terminal-header/60">STOCK WATCHLIST</td>
                </tr>
              )}
              {groupedRows.map(({ row, i }, idx) => (
                <Fragment key={row.symbol}>
                  {idx === firstCryptoIdx && (
                    <tr className="pointer-events-none">
                      <td colSpan={10} className="px-2 py-1 text-2xs font-bold text-terminal-gold tracking-widest bg-terminal-header/60">CRYPTO WATCHLIST</td>
                    </tr>
                  )}
                <tr
                  draggable={!sortKey}
                  onDragStart={() => onDragStart(i)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(i)}
                  className="cursor-pointer hover:bg-terminal-accent/20 transition-colors border-b border-terminal-border/40"
                  onClick={() => handleRowClick(row)}
                >
                  <td
                    className={`px-2 py-1.5 select-none ${sortKey ? 'text-terminal-text-dim/15' : 'text-terminal-text-dim/40 cursor-grab'}`}
                    title={sortKey ? 'Clear sort to reorder' : 'Drag to reorder'}
                  >⠿</td>
                  <td className="px-2 py-1.5 text-xs font-bold text-terminal-text-bright whitespace-nowrap">
                    {row.displaySymbol}
                    {row.isLive
                      ? <span className="text-2xs text-terminal-green ml-1">●</span>
                      : anyFetching
                        ? <span className="text-2xs text-terminal-text-dim ml-1">…</span>
                        : null}
                    {(() => {
                      const e = earningsFor(row.symbol)
                      if (!e) return null
                      const d = daysUntil(e.date)

                      // Earnings date has passed: swap to the auto-generated result
                      // badge (AI Earnings Analyst) once one exists — the analysis
                      // itself is triggered centrally by NotificationCenter's poll,
                      // not from here.
                      if (d <= 0) {
                        const result = getEarningsResult(e.ticker)
                        if (!result?.reportData) return null
                        const beat = result.reportData.actualEPS > result.reportData.consensusEPS
                        return (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); setEarningsResult({ ticker: e.ticker, companyName: e.company }) }}
                            title={`${e.company} reported — click for MaddenAI analysis`}
                            className={`text-2xs ml-1 border px-1 transition-colors ${
                              beat
                                ? 'text-terminal-green border-terminal-green/40 hover:bg-terminal-green hover:text-terminal-bg'
                                : 'text-terminal-red border-terminal-red/40 hover:bg-terminal-red hover:text-terminal-bg'
                            }`}
                          >RESULTS: {beat ? 'BEAT ✓' : 'MISS ✗'}</button>
                        )
                      }

                      if (d > 45) return null
                      // Within 7 days: a clickable "EARNINGS IN Xd" badge that opens the
                      // MaddenAI preview panel. Outside that window: just the existing
                      // hover-tooltip calendar icon, unchanged.
                      if (d <= 7) {
                        return (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); setEarningsPreview({ ticker: e.ticker, earningsDate: e.date, companyName: e.company }) }}
                            title={`${e.company} ${e.type} results — click for MaddenAI preview`}
                            className="text-2xs text-terminal-gold ml-1 border border-terminal-gold/40 px-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                          >EARNINGS IN {d}D</button>
                        )
                      }
                      return (
                        <span
                          title={`${e.company} ${e.type} results — ${new Date(`${e.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} (${d}d)`}
                          className="text-2xs text-terminal-gold ml-1"
                        >📅</span>
                      )
                    })()}
                  </td>
                  <td className="px-2 py-1.5 text-2xs text-terminal-text-dim truncate max-w-[200px]">{row.name}</td>
                  <LivePriceCells symbol={row.symbol} price={row.price} change={row.change} pct={row.pct} week52Low={row.week52Low} week52High={row.week52High} />
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
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {earningsPreview && (
        <EarningsPreviewPanel
          ticker={earningsPreview.ticker}
          earningsDate={earningsPreview.earningsDate}
          companyName={earningsPreview.companyName}
          onClose={() => setEarningsPreview(null)}
        />
      )}
      {earningsResult && (
        <EarningsResultPanel
          ticker={earningsResult.ticker}
          companyName={earningsResult.companyName}
          onClose={() => setEarningsResult(null)}
        />
      )}
      {shareLink && (
        <ShareLinkModal
          title="SHARE WATCHLIST"
          brandedUrl={shareLink.brandedUrl}
          resolvableUrl={shareLink.resolvableUrl}
          onClose={() => setShareLink(null)}
        />
      )}
    </div>
  )
}
