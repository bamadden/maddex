import { useState, useRef, useEffect, useMemo, Fragment } from 'react'
import {
  rememberEntryPrice, sinceAdded, metaFor, setNote, watchlistToText, watchlistToCsv,
} from '../../services/watchlistMeta'
import {
  loadSort, saveSort, loadColumns, saveColumns, loadOrder, saveOrder, applyOrder,
} from '../../services/watchlistPrefs'
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
import EarningsPreviewPanel from '../../components/earningsPreview/EarningsPreviewPanel'
import { ModuleError, StaleBadge, DemoBadge } from '../../components/ui/ModuleStates'
import { SkeletonCard } from '../../components/ui/Skeleton'
import ModuleHeader from '../../components/ui/ModuleHeader'
import ShareLinkModal from '../../components/ui/ShareLinkModal'
import { useLivePrice } from '../../hooks/useLivePrice'
import { createShareLink } from '../../services/sharingService'
import { logActivity } from '../../services/activityLogService'
import { soundService } from '../../services/soundService'
import Tooltip from '../../components/ui/Tooltip'
import StockContextMenu from '../../components/ui/StockContextMenu'
import { useStockContextMenu } from '../../hooks/useStockContextMenu'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'

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
    <Tooltip
      className="w-full min-w-0 justify-end"
      content={
        `52-week range\n` +
        `High:    ${fmt.aud(high)}\n` +
        `Current: ${fmt.aud(price)}  (${pct.toFixed(0)}% of range)\n` +
        `Low:     ${fmt.aud(low)}`
      }
    >
      {/* The endpoints are AXIS LABELS, not signals.
          They were red and green, which put a red $52.30 and a green $82.10
          immediately beside a change column where red and green mean today's
          direction — so a stock up 0.7% displayed a red number in the next
          cell. It also asserted that the top of the range is the good end,
          which is a view, not a fact. The dot carries the reading; the
          endpoints just say where the scale starts and stops. */}
      <div className="flex items-center gap-1.5 w-full min-w-0">
        <span className="text-2xs text-terminal-text-dim/70 flex-shrink-0">{fmt.aud(low)}</span>
        <div className="relative flex-1 h-1 bg-terminal-border/40 min-w-[20px]">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-terminal-gold border border-terminal-bg"
            style={{ left: `calc(${pct}% - 3px)` }}
          />
        </div>
        <span className="text-2xs text-terminal-text-dim/70 flex-shrink-0">{fmt.aud(high)}</span>
      </div>
    </Tooltip>
  )
}

// Live-ticking price/change/pct/52W-bar cells for one row — a real hook
// call per row requires its own component (can't call hooks inside the
// .map() body directly). Only ASX symbols get the simulated live stream
// (their mock quote is already AUD-native, no currency-conversion nuance
// to replicate here); US/crypto rows keep their existing static values.

// Crypto occupies the same four column positions as the equity price cells,
// but the columns mean different things: there is no session close, so a
// day-change figure and a 52-week band are the wrong frame. A 24h/7d pair
// plus the USD cross is what actually matters for a 24/7 asset.
//
// Dominance, which the brief also asked for, is deliberately absent: it needs
// total crypto market cap as a denominator and the data layer does not carry
// one. Market cap is shown instead rather than dividing by an invented total,
// which would render a plausible-looking wrong percentage.

// Price-alert control per row.
//
// This used to be a one-click toggle that armed a single alert 5% above the
// current price. That is a reasonable default and a poor tool: the level you
// actually want is almost never +5%, there was no way to set a downside
// alert, and a second alert on the same symbol was impossible. It now opens
// an inline panel on the row instead — no modal, because the row's own price
// is the number you are setting the alert against and it should stay on
// screen while you do it.
//
// Alerts go to the useStore list (`madden_alerts`), which is the one
// NotificationCenter polls against live quotes. alertsService is a second,
// richer engine used by the Alerts module; the two are deliberately not
// merged here — this control writes to the path that actually fires.
function AlertBell({ symbol, price, alerts, isOpen, onToggle }) {
  const mine = (alerts ?? []).filter((a) => a.sym?.toUpperCase() === symbol.toUpperCase())
  const count = mine.length

  if (price == null && count === 0) {
    return <span className="text-terminal-text-dim/20 text-2xs" title="No price yet">⚡</span>
  }

  return (
    <button
      onClick={onToggle}
      aria-expanded={isOpen}
      title={count ? `${count} alert${count > 1 ? 's' : ''} set — click to manage` : 'Set a price alert'}
      className="relative text-2xs transition-colors"
      style={{ color: count ? '#C9A84C' : isOpen ? '#C9A84C' : 'rgba(74,96,128,0.55)' }}
    >
      ⚡
      {count > 0 && (
        <span
          style={{
            position: 'absolute', top: -5, right: -7,
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 7, lineHeight: '11px',
            minWidth: 11, height: 11, padding: '0 2px', borderRadius: 6,
            background: '#C9A84C', color: '#060D1A', fontWeight: 700, textAlign: 'center',
          }}
        >{count}</span>
      )}
    </button>
  )
}

// The inline panel, rendered as a full-width row beneath its stock.
//
// Pre-fills the value a couple of percent the right side of the current price
// so a single click on SET produces a sensible alert, while leaving the field
// editable — the default should be useful, not the only option.
function AlertRow({ symbol, price, alerts, addAlert, removeAlert, onClose, colSpan = 12 }) {
  const mine = (alerts ?? []).filter((a) => a.sym?.toUpperCase() === symbol.toUpperCase())
  const [direction, setDirection] = useState('above')
  const [value, setValue] = useState(() => (price != null ? (price * 1.02).toFixed(2) : ''))

  // Re-seed the field when the direction flips, so ABOVE suggests a level
  // over the price and BELOW suggests one under it.
  const pickDirection = (d) => {
    setDirection(d)
    if (price != null) setValue((price * (d === 'above' ? 1.02 : 0.98)).toFixed(2))
  }

  const numeric = Number(value)
  const valid = Number.isFinite(numeric) && numeric > 0

  const submit = () => {
    if (!valid) return
    addAlert(symbol, numeric, direction)
    onClose()
  }

  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="px-3 py-2 flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xs font-bold text-terminal-gold tracking-widest">SET ALERT</span>
            <span className="text-2xs text-terminal-text-bright font-semibold">{symbol}</span>
            <span className="text-2xs text-terminal-text-dim">{price != null ? fmt.aud(price) : 'no price'}</span>

            <div className="flex items-center border border-terminal-border rounded-sm overflow-hidden">
              {['above', 'below'].map((d) => (
                <button
                  key={d}
                  onClick={() => pickDirection(d)}
                  className={`text-2xs px-2 py-1 font-bold uppercase transition-colors ${
                    direction === d ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
                  }`}
                >{d}</button>
              ))}
            </div>

            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
              aria-label={`Alert price for ${symbol}`}
              className="bg-terminal-bg border border-terminal-border text-terminal-text-bright text-2xs px-2 py-1 w-24 tabular-nums focus:border-terminal-gold focus:outline-none"
            />

            <button
              onClick={submit}
              disabled={!valid}
              className="text-2xs font-bold px-3 py-1 bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-40"
            >SET ⚡</button>

            <button onClick={onClose} className="text-2xs text-terminal-text-dim hover:text-terminal-gold ml-auto">✕</button>
          </div>

          {mine.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-terminal-text-dim tracking-widest">ACTIVE</span>
              {mine.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 text-2xs px-2 py-0.5 rounded-sm"
                  style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}
                >
                  {(a.direction ?? 'above').toUpperCase()} {fmt.aud(a.price)}
                  <button
                    onClick={() => removeAlert(a.id)}
                    title="Remove this alert"
                    className="hover:text-terminal-red"
                  >✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// Both cell components take `show`, the visibility predicate, and render only
// the columns that are on. They stay components rather than becoming four
// separate cell renderers because LivePriceCells subscribes to a live quote —
// a hook cannot be called once per column inside a loop.
function CryptoPriceCells({ price, pct, pct7d, audToUsd, show }) {
  // Crypto quotes arrive in AUD (fetchCryptoMarkets('aud')), so the USD column
  // is a conversion through the rate the app already holds — not a second fetch.
  const usd = price != null ? audToUsd(price) : null
  return (
    <>
      {show('price') && (
        <td className="px-2 py-1.5 text-2xs text-right font-semibold text-terminal-text-bright">
          {price != null ? fmt.aud(price) : '—'}
        </td>
      )}
      {show('change') && (
        <td className="px-2 py-1.5 text-2xs text-right text-terminal-text-dim">
          {usd != null ? `US$${fmt.price(usd)}` : '—'}
        </td>
      )}
      {show('pct') && (
        <td className="px-2 py-1.5 text-right">
          <PriceChange pct={pct} className="justify-end" pill graded />
        </td>
      )}
      {show('week52') && (
        <td className="px-2 py-1.5 text-right">
          <PriceChange pct={pct7d} className="justify-end" size="text-[11px]" graded />
        </td>
      )}
    </>
  )
}

function LivePriceCells({ symbol, price, change, pct, week52Low, week52High, show }) {
  const isAsx = symbol.endsWith('.AX')
  const { quote, flash } = useLivePrice(isAsx ? symbol : null)
  const livePrice = isAsx && quote ? quote.regularMarketPrice : price
  const liveChange = isAsx && quote ? quote.regularMarketChange : change
  const livePct = isAsx && quote ? quote.regularMarketChangePercent : pct
  const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''
  return (
    <>
      {show('price') && (
        <td className={`px-2 py-1.5 text-2xs text-right font-semibold text-terminal-text-bright ${flashClass}`}>
          {livePrice != null ? fmt.aud(livePrice) : '—'}
        </td>
      )}
      {/* CHG$ stays plain and one step smaller; CHG% takes the pill. Two
          equally-loud change columns side by side just compete. */}
      {show('change') && (
        <td className="px-2 py-1.5 text-right">
          <PriceChange value={liveChange} className="justify-end" size="text-[11px]" />
        </td>
      )}
      {show('pct') && (
        <td className="px-2 py-1.5 text-right">
          <PriceChange pct={livePct} className="justify-end" pill graded />
        </td>
      )}
      {show('week52') && (
        <td className="px-2 py-1.5 text-right">
          <Week52Bar price={livePrice} low={week52Low} high={week52High} />
        </td>
      )}
    </>
  )
}


// Starting set for an empty watchlist — four ASX large caps, two US mega
// caps, two majors in crypto. Chosen to span the asset classes the terminal
// actually covers so the first click also demonstrates its scope.

// Search universe, built once from the demo maps. Symbols are stored in the
// form the watchlist expects (.AX suffixed for ASX) so a pick can be added
// verbatim without re-deriving the exchange.
const SEARCH_UNIVERSE = [
  ...Object.entries(MOCK_ASX_STOCKS).map(([sym, v]) => ({
    symbol: sym.endsWith('.AX') ? sym : `${sym}.AX`,
    name: v.name ?? sym, exchange: 'ASX',
  })),
  ...Object.entries(MOCK_US_STOCKS).map(([sym, v]) => ({
    symbol: sym, name: v.name ?? sym, exchange: 'US',
  })),
]

// Ranked so an exact ticker match leads, then ticker prefixes, then name
// matches — typing "CBA" should not surface a company whose description
// happens to contain those letters ahead of the ticker itself.
function searchTickers(query, limit = 6) {
  const q = query.trim().toUpperCase()
  if (q.length < 1) return []
  const scored = []
  for (const item of SEARCH_UNIVERSE) {
    const sym = item.symbol.toUpperCase()
    const bare = sym.replace('.AX', '')
    const name = (item.name ?? '').toUpperCase()
    let score = null
    if (bare === q || sym === q) score = 0
    else if (bare.startsWith(q)) score = 1
    else if (name.startsWith(q)) score = 2
    else if (name.includes(q)) score = 3
    if (score != null) scored.push({ ...item, score })
  }
  return scored.sort((a, b) => a.score - b.score || a.symbol.localeCompare(b.symbol)).slice(0, limit)
}

const SUGGESTED_TICKERS = [
  { symbol: 'BHP.AX', name: 'BHP Group' },
  { symbol: 'CBA.AX', name: 'Commonwealth Bank' },
  { symbol: 'CSL.AX', name: 'CSL Limited' },
  { symbol: 'WES.AX', name: 'Wesfarmers' },
  { symbol: 'AAPL',   name: 'Apple Inc.' },
  { symbol: 'NVDA',   name: 'NVIDIA Corp.' },
  { symbol: 'BTC',    name: 'Bitcoin' },
  { symbol: 'ETH',    name: 'Ethereum' },
]

// ─── Column model ───────────────────────────────────────────────────────────
//
// ONE ARRAY DRIVES THE COLGROUP, THE HEADER AND THE BODY.
//
// The table previously wrote those three by hand: twelve <col> widths, twelve
// <th>, twelve <td> per row, and a crypto sub-header with twelve more. They
// only lined up because nobody had ever hidden one. Column visibility makes
// that fragile arrangement break immediately and invisibly — a hidden column
// shifts every cell after it one place left under a header that did not move,
// so PRICE renders under CHG and the numbers are simply wrong.
//
// So visibility is resolved once, into a list, and everything renders from it.
//
// `always: true` marks the columns that are structure rather than data — the
// drag handle, the ticker, the remove button. Nothing offers to hide those.
const COLUMNS = [
  { key: 'drag',       label: '',            width: 28,   always: true },
  { key: 'ticker',     label: 'TICKER',      width: 150,  always: true, align: 'left' },
  { key: 'name',       label: 'NAME',        width: null, always: true, align: 'left', sort: 'name' },
  { key: 'price',      label: 'PRICE (A$)',  width: 90,   align: 'right', sort: 'price',     menu: 'Price' },
  { key: 'change',     label: 'CHG',         width: 72,   align: 'right',                    menu: 'Day $' },
  { key: 'pct',        label: 'CHG%',        width: 82,   align: 'right', sort: 'pct',       menu: 'Day %' },
  { key: 'week52',     label: '52W RANGE',   width: 132,  align: 'right',                    menu: '52W Range' },
  { key: 'volume',     label: 'VOLUME',      width: 70,   align: 'right',                    menu: 'Volume' },
  { key: 'marketCap',  label: 'MKT CAP',     width: 82,   align: 'right', sort: 'marketCap', menu: 'Mkt Cap' },
  { key: 'pe',         label: 'P/E',         width: 58,   align: 'right', sort: 'pe',        menu: 'P/E' },
  { key: 'divYield',   label: 'DIV YIELD',   width: 76,   align: 'right', sort: 'divYield',  menu: 'Div Yield' },
  { key: 'sinceAdded', label: 'SINCE ADDED', width: 128,  align: 'right',                    menu: 'Since Added' },
  { key: 'alert',      label: '⚡',           width: 40,   align: 'center',                   menu: 'Alert' },
  { key: 'remove',     label: '',            width: 32,   always: true },
]

// All on except SINCE ADDED, which is off until the user asks for it: an entry
// price is only recorded from the first time this browser saw a quote for the
// symbol, so for an existing watchlist the column is a row of dashes.
const DEFAULT_COLUMNS = Object.fromEntries(
  COLUMNS.filter((c) => c.menu).map((c) => [c.key, c.key !== 'sinceAdded']),
)

// Crypto reuses four equity column slots for different measures. The header
// strip that says so has to follow the same visibility, so it reads from the
// same model rather than from a second hardcoded list.
const CRYPTO_LABEL = {
  price: 'Price (A$)', change: 'Price (US$)', pct: '24H%', week52: '7D%',
  volume: 'Volume', marketCap: 'Mkt Cap', pe: '—', divYield: '—',
  sinceAdded: 'Since added', ticker: 'Ticker', name: 'Name',
}

const SORT_VALUE = {
  name:      (r) => r.name ?? r.displaySymbol,
  price:     (r) => r.price,
  pct:       (r) => r.pct,
  marketCap: (r) => r.marketCap,
  pe:        (r) => r.pe,
  divYield:  (r) => r.divYield,
}
const SORT_LABEL = Object.fromEntries(COLUMNS.filter((c) => c.sort).map((c) => [c.sort, c.label]))

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
  const { watchlist, addToWatchlist, removeFromWatchlist, reorderWatchlist, clearWatchlist, openModal, alerts, addAlert, removeAlert } = useStore()
  const { menu, openMenu, closeMenu } = useStockContextMenu()
  const { user, profile } = useAuthStore()
  const [shareLink, setShareLink] = useState(null)
  const { canAccess } = useSubscription()
  const WATCHLIST_LIMIT = 20 // Core tier — Prime+ is unlimited
  const { usdToAud, audToUsd } = useAudRates()

  const [searchInput, setSearchInput] = useState('')
  const [highlight, setHighlight] = useState(0)
  const searchInputRef = useRef(null)
  const [addError, setAddError]       = useState(null)
  const [validating, setValidating]   = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [synced, setSynced]           = useState(false)
  // Sort restored on mount. `null` is a restorable state, not an absence — it
  // means manual order, which is what drag-to-reorder produces.
  const [sortKey, setSortKey] = useState(() => loadSort(Object.keys(SORT_VALUE)).column)
  const [sortDir, setSortDir] = useState(() => loadSort(Object.keys(SORT_VALUE)).direction)
  const [columns, setColumns] = useState(() => loadColumns(DEFAULT_COLUMNS))
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const colMenuRef = useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [earningsPreview, setEarningsPreview] = useState(null)
  // Symbol whose inline alert panel is open. One at a time — two open
  // panels push every row below them down twice and neither is easier to
  // read for it.
  const [alertPanelFor, setAlertPanelFor] = useState(null)
  const dragIndexRef  = useRef(null)
  const clearTimerRef = useRef(null)

  // asc → desc → off. The third click matters: without it, sorting once locks
  // the table out of drag-to-reorder for good, because reordering is only
  // meaningful on an unsorted list and there was no way back to unsorted.
  const toggleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key); setSortDir('asc'); saveSort(key, 'asc'); return
    }
    if (sortDir === 'asc') { setSortDir('desc'); saveSort(key, 'desc'); return }
    setSortKey(null); setSortDir('asc'); saveSort(null, 'asc')
  }

  // Close the column menu on any click outside it. A dropdown that only closes
  // by re-clicking its own trigger stays open behind whatever the user does
  // next, and this one floats over the table.
  useEffect(() => {
    if (!colMenuOpen) return
    const onDown = (e) => {
      if (!colMenuRef.current?.contains(e.target)) setColMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [colMenuOpen])

  const toggleColumn = (key) => {
    setColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      saveColumns(next)
      return next
    })
  }

  // Visible columns, resolved once. Everything below renders from this list.
  const visibleColumns = COLUMNS.filter((c) => c.always || columns[c.key])
  const isOn = (key) => visibleColumns.some((c) => c.key === key)

  // PRICE / CHG / CHG% / 52W are emitted together by one component, because
  // the live-quote hook inside it must be called once per row rather than once
  // per column. The group renders at the first of those four that is VISIBLE —
  // not at 'price' — otherwise hiding Price alone would drop the other three
  // cells while their headers stayed, shifting every row out of its columns.
  const PRICE_GROUP = ['price', 'change', 'pct', 'week52']
  const priceAnchor = PRICE_GROUP.find((k) => isOn(k)) ?? null

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
      if (!c) return { ...base, name: symbol, price: null, change: null, pct: null, pct7d: null, week52High: null, week52Low: null, volume: null, marketCap: null, isOpen: true, isLive: false }
      return {
        ...base,
        name:        c.name ?? symbol,
        price:       c.price,
        change:      c.price * (c.pct24h / 100),
        pct:         c.pct24h,
        // 7-day change and the USD cross are crypto-only columns; equities
        // use those same positions for CHG$ and the 52-week bar.
        pct7d:       c.pct7d ?? null,
        week52High:  null,
        week52Low:   null,
        volume:      c.volume,
        marketCap:   c.marketCap,
        pe:          null,
        divYield:    null,
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
      // Ratios carry through unconverted — a P/E divided by unconverted
      // earnings would move with the exchange rate, and a yield is already a
      // percentage of price.
      pe:          q.trailingPE ?? null,
      divYield:    q.divYield ?? null,
      isOpen:      q.isOpen,
      isLive:      true,
      nativePrice: isAsx ? null : q.price,
      currency:    q.currency,
    }
  })

  // Entry prices are captured the first time a symbol is seen WITH a price.
  // Recording at add-time would store a null — the quote has not arrived yet —
  // and permanently blank the SINCE ADDED column for that stock with nothing
  // to tell the user why. Written in an effect, not during render.
  useEffect(() => {
    for (const r of rows) {
      if (r.price != null) rememberEntryPrice(r.symbol, r.price)
    }
  }, [rows])

  const overview = useMemo(() => {
    const priced = rows.filter((r) => r.pct != null)
    if (!priced.length) return null
    const up = priced.filter((r) => r.pct > 0)
    const down = priced.filter((r) => r.pct < 0)
    const sorted = [...priced].sort((a, b) => b.pct - a.pct)
    return {
      advancing: up.length,
      declining: down.length,
      flat: priced.length - up.length - down.length,
      avg: priced.reduce((s2, r) => s2 + r.pct, 0) / priced.length,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      total: priced.length,
    }
  }, [rows])

  // Manual order per group, applied when nothing is sorted. The store already
  // persists the flat watchlist array, so a drag survives a reload on its own;
  // this keeps the stock block and the crypto block arranged independently.
  const orderedSymbols = useMemo(() => {
    if (sortKey) return null
    const stocks = watchlist.filter((sym) => toYahoo(sym).type !== 'crypto')
    const cryptos = watchlist.filter((sym) => toYahoo(sym).type === 'crypto')
    return new Map([
      ...applyOrder(stocks, loadOrder('stocks')).map((sym, i) => [sym, i]),
      ...applyOrder(cryptos, loadOrder('crypto')).map((sym, i) => [sym, i]),
    ])
  }, [watchlist, sortKey])

  const [copied, setCopied] = useState(false)
  const [noteFor, setNoteFor] = useState(null)   // symbol whose note is open
  const [noteDraft, setNoteDraft] = useState('')
  const [noteVersion, bumpNotes] = useState(0)

  // noteVersion is read here purely so every note lookup below re-runs after a
  // save or delete. localStorage is not reactive; without a dependency on it
  // the 📝 marker would not appear until something unrelated re-rendered.
  const noteOf = (symbol) => (noteVersion, metaFor(symbol)?.note ?? '')

  const openNote = (symbol) => {
    setNoteDraft(metaFor(symbol)?.note ?? '')
    setNoteFor((cur) => (cur === symbol ? null : symbol))
  }
  const saveNote = (symbol) => {
    setNote(symbol, noteDraft)
    setNoteFor(null)
    bumpNotes((n) => n + 1)
  }
  const deleteNote = (symbol) => {
    setNote(symbol, '')
    setNoteDraft('')
    setNoteFor(null)
    bumpNotes((n) => n + 1)
  }

  const exportRows = () => rows.map((r) => {
    const since = sinceAdded(r.symbol, r.price)
    return {
      symbol: r.displaySymbol, name: r.name, price: r.price, pct: r.pct,
      sincePct: since?.pct ?? null, note: metaFor(r.symbol)?.note ?? '',
      groupName: '',
    }
  })

  const copyWatchlist = async () => {
    try {
      await navigator.clipboard.writeText(watchlistToText(exportRows()))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  const exportWatchlistCsv = () => {
    const url = URL.createObjectURL(new Blob([watchlistToCsv(exportRows())], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `maddex-watchlist-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Manual order is applied only when nothing is sorted — a saved arrangement
  // and an active sort are two answers to the same question, and the sort is
  // the one the user just asked for.
  const orderedRows = orderedSymbols
    ? [...rows].sort((a, b) => (orderedSymbols.get(a.symbol) ?? 0) - (orderedSymbols.get(b.symbol) ?? 0))
    : rows
  const sortedRows = sortRows(orderedRows, sortKey, sortDir)
  // Stock rows first, crypto rows grouped at the end (stable sort — each
  // group keeps sortedRows' existing relative order) so the table can
  // render two visually separated sections while `i` still indexes into
  // `sortedRows` for onDragStart/onDrop, which reorder the underlying
  // watchlist array by that position.
  const groupedRows = sortedRows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (a.row.type === 'crypto' ? 1 : 0) - (b.row.type === 'crypto' ? 1 : 0))
  const firstCryptoIdx = groupedRows.findIndex(({ row }) => row.type === 'crypto')

  // Instant results as the user types — no Enter needed to see candidates.
  const matches = searchTickers(searchInput)

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
      soundService.actionSuccess()
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
    if (from != null && from !== i) {
      reorderWatchlist(from, i)
      // Record the resulting arrangement per group. The store persists the
      // flat array on its own, so this is what keeps the stock block and the
      // crypto block independently arranged rather than sharing one sequence.
      const next = [...sortedRows]
      const [moved] = next.splice(from, 1)
      next.splice(i, 0, moved)
      saveOrder('stocks', next.filter((r) => r.type !== 'crypto').map((r) => r.symbol))
      saveOrder('crypto', next.filter((r) => r.type === 'crypto').map((r) => r.symbol))
    }
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
        <form onSubmit={handleAdd} className="flex flex-1 items-center relative">
          <span className="px-2 text-2xs text-terminal-gold flex-shrink-0">+</span>
          <input
            ref={searchInputRef}
            className="cmd-input flex-1 py-1.5 text-2xs"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value.toUpperCase()); setAddError(null); setHighlight(0) }}
            onKeyDown={(e) => {
              if (!matches.length) return
              // Arrow keys move the highlight; Enter takes the highlighted
              // match rather than the raw text, so a partial name resolves to
              // the right ticker instead of failing validation.
              if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % matches.length) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length) }
              else if (e.key === 'Enter') {
                const pick = matches[highlight]
                if (pick && !watchlist.includes(pick.symbol)) {
                  e.preventDefault()
                  addToWatchlist(pick.symbol)
                  setSearchInput('')
                  setHighlight(0)
                }
              } else if (e.key === 'Escape') { setSearchInput('') }
            }}
            placeholder="ADD TICKER — ASX (BHP.AX) or US (AAPL) — press Enter"
          />

          {/* Instant results — no Enter needed to see them. */}
          {matches.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full bg-terminal-panel border border-terminal-border-gold shadow-2xl"
              style={{ zIndex: 100 }}
            >
              {matches.map((m, i) => {
                const owned = watchlist.includes(m.symbol)
                return (
                  <button
                    key={m.symbol}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => { if (!owned) { addToWatchlist(m.symbol); setSearchInput('') } }}
                    disabled={owned}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-2xs text-left transition-colors ${
                      i === highlight ? 'bg-terminal-surface2' : ''
                    } ${owned ? 'opacity-50' : 'hover:bg-terminal-surface2'}`}
                  >
                    <span className="font-bold text-terminal-gold w-16 flex-shrink-0">{m.symbol}</span>
                    <span className="text-terminal-text-dim truncate flex-1 min-w-0">{m.name}</span>
                    <span className="text-[9px] font-mono text-terminal-muted/70 flex-shrink-0">{m.exchange}</span>
                    <span className={`w-3 text-center flex-shrink-0 ${owned ? 'text-terminal-green' : 'text-terminal-gold'}`}>
                      {owned ? '✓' : '+'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
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

      {/* Analytics bar — one line, live off the same quotes the table sorts
          by, so the summary and the rows it sits above can never disagree.
          ASX rows also carry a per-row live tick that can run a few seconds
          ahead of this; the batch is what both the bar and the sort use. */}
      {overview && (
        <div
          className="flex items-center gap-3 flex-shrink-0 flex-wrap"
          style={{
            height: 32, padding: '0 16px', background: '#030912',
            borderBottom: '1px solid rgba(201,168,76,0.08)',
          }}
        >
          {/* One proportional bar. A count alone ("18 advancing") does not show
              the balance; the bar does, at a glance. */}
          <div className="flex h-1.5 w-20 overflow-hidden rounded-sm flex-shrink-0">
            <div style={{ width: `${(overview.advancing / overview.total) * 100}%`, background: '#2D8A50' }} />
            <div style={{ width: `${(overview.flat / overview.total) * 100}%`, background: '#4A6080' }} />
            <div style={{ width: `${(overview.declining / overview.total) * 100}%`, background: '#A83232' }} />
          </div>

          <span className="text-2xs whitespace-nowrap">
            <span className="text-terminal-green font-bold">▲ {overview.advancing}</span>
            <span className="text-terminal-text-dim"> advancing</span>
          </span>
          <span className="text-2xs whitespace-nowrap">
            <span className="text-terminal-red font-bold">▼ {overview.declining}</span>
            <span className="text-terminal-text-dim"> declining</span>
          </span>
          <span className="text-2xs whitespace-nowrap">
            <span className="text-terminal-text-dim/70 font-bold">— {overview.flat}</span>
            <span className="text-terminal-text-dim"> flat</span>
          </span>

          <span className="text-terminal-text-dim/25">|</span>

          <span className="text-2xs text-terminal-text-dim whitespace-nowrap">
            Avg:{' '}
            <span className="tabular-nums font-bold" style={{ color: overview.avg >= 0 ? '#2D8A50' : '#A83232' }}>
              {overview.avg >= 0 ? '+' : ''}{overview.avg.toFixed(2)}%
            </span>
          </span>

          {overview.best && (
            <>
              <span className="text-terminal-text-dim/25">|</span>
              <span className="text-2xs text-terminal-text-dim whitespace-nowrap">
                Best: <span className="text-terminal-text-bright font-bold">{overview.best.displaySymbol}</span>{' '}
                <span className="text-terminal-green tabular-nums">
                  {overview.best.pct >= 0 ? '+' : ''}{overview.best.pct.toFixed(2)}%
                </span>
              </span>
            </>
          )}
          {overview.worst && overview.worst !== overview.best && (
            <span className="text-2xs text-terminal-text-dim whitespace-nowrap">
              Worst: <span className="text-terminal-text-bright font-bold">{overview.worst.displaySymbol}</span>{' '}
              <span className="text-terminal-red tabular-nums">{overview.worst.pct.toFixed(2)}%</span>
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={copyWatchlist}
              className="text-2xs px-2 py-0.5 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors"
            >{copied ? '✓ COPIED' : '⧉ COPY'}</button>
            <button
              onClick={exportWatchlistCsv}
              className="text-2xs px-2 py-0.5 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors"
            >⤓ CSV</button>

            {/* Column visibility. */}
            <div className="relative" ref={colMenuRef}>
              <button
                onClick={() => setColMenuOpen((v) => !v)}
                title="Show or hide columns"
                aria-expanded={colMenuOpen}
                className={`text-xs px-1.5 py-0.5 border transition-colors ${
                  colMenuOpen
                    ? 'border-terminal-gold text-terminal-gold'
                    : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                }`}
              >⚙</button>
              {colMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 bg-terminal-panel border border-terminal-border-gold shadow-2xl"
                  style={{ zIndex: 120, minWidth: 190 }}
                >
                  <div className="px-3 py-1.5 text-[9px] font-mono tracking-widest text-terminal-gold border-b border-terminal-border">
                    COLUMNS
                  </div>
                  {COLUMNS.filter((c) => c.menu).map((c) => (
                    <button
                      key={c.key}
                      onClick={() => toggleColumn(c.key)}
                      className="w-full flex items-center gap-2 px-3 py-1 text-2xs text-left hover:bg-terminal-surface2 transition-colors"
                    >
                      <span className={columns[c.key] ? 'text-terminal-gold' : 'text-terminal-text-dim/40'}>
                        {columns[c.key] ? '☑' : '☐'}
                      </span>
                      <span className={columns[c.key] ? 'text-terminal-text-bright' : 'text-terminal-text-dim'}>
                        {c.menu}
                      </span>
                    </button>
                  ))}
                  <div className="px-3 py-1.5 text-[9px] text-terminal-text-dim/50 border-t border-terminal-border leading-snug">
                    Saved to this browser. SINCE ADDED is off by default — it needs
                    a price recorded when the ticker was added.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {watchlist.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center overflow-y-auto py-8">
            <span className="w-10 h-10 rounded-full border border-terminal-gold/40 text-terminal-gold flex items-center justify-center">
              <Bookmark size={18} strokeWidth={1.75} />
            </span>
            <div className="text-terminal-text-bright text-sm font-semibold mt-1 tracking-wide">YOUR WATCHLIST IS EMPTY</div>
            <div className="text-terminal-text-dim text-2xs max-w-xs leading-relaxed">
              Start tracking what matters to you
            </div>

            {/* An empty watchlist is the one screen with nothing to look at,
                so it offers a starting set rather than only a search box —
                the fastest path out of empty is one click, not typing. */}
            <div className="mt-5 w-full max-w-[560px]">
              <div className="text-[9px] font-mono tracking-widest text-terminal-muted/70 uppercase mb-2 text-left">
                Popular on Maddex
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUGGESTED_TICKERS.map((sug) => (
                  <button
                    key={sug.symbol}
                    onClick={() => addToWatchlist(sug.symbol)}
                    className="suggest-card text-left p-2"
                  >
                    <span className="block text-2xs font-bold text-terminal-gold">{sug.symbol}</span>
                    <span className="block text-[10px] text-terminal-text-dim truncate">{sug.name}</span>
                    <span className="block mt-1 text-[9px] font-mono text-terminal-muted/70">+ ADD</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => searchInputRef.current?.focus()}
              className="mt-4 text-2xs font-bold text-terminal-gold border border-terminal-gold/40 rounded-full px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >
              or search for a ticker
            </button>
          </div>
        ) : isError && !batchQuotes && !Object.keys(cryptoQuotes).length ? (
          <ModuleError module="Watchlist prices" lastUpdated={dataUpdatedAt} onRetry={refetchAll} />
        ) : anyFetching && !batchQuotes && !Object.keys(cryptoQuotes).length ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} rows={1} className="p-2" />)}
          </div>
        ) : (
          <table className="terminal-table table-zebra w-full" style={{ tableLayout: 'fixed' }}>
            {/* table-layout:fixed + a colgroup pins every column to a known
                width. Without it the browser sizes columns from content, so a
                long company name or a wide market cap shifts the numeric
                columns and the row loses its scannable grid. NAME is the only
                auto column — it absorbs the slack.

                Both this and the header below are generated from
                visibleColumns, so hiding a column cannot leave the header and
                the body one cell out of step. */}
            <colgroup>
              {visibleColumns.map((c) => (
                <col key={c.key} style={c.width ? { width: c.width } : undefined} />
              ))}
            </colgroup>
            <thead className="sticky top-0 bg-terminal-header z-10">
              <tr>
                {visibleColumns.map((c) => {
                  const alignClass = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  const sortable = !!c.sort
                  return (
                    <th
                      key={c.key}
                      onClick={sortable ? () => toggleSort(c.sort) : undefined}
                      title={sortable ? 'Sort — click again to reverse, a third time to return to manual order' : undefined}
                      className={`px-2 ${alignClass} ${sortable ? 'cursor-pointer hover:text-terminal-gold transition-colors select-none' : ''}`}
                    >
                      {c.label}
                      {sortable && sortKey === c.sort && (
                        <span className="text-terminal-gold ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {firstCryptoIdx > 0 && (
                <tr className="pointer-events-none">
                  <td colSpan={visibleColumns.length} className="px-2 py-1 text-2xs font-bold text-terminal-gold tracking-widest bg-terminal-header/60">STOCK WATCHLIST</td>
                </tr>
              )}
              {groupedRows.map(({ row, i }, idx) => (
                <Fragment key={row.symbol}>
                  {idx === firstCryptoIdx && (
                    <tr className="pointer-events-none">
                      <td
                        colSpan={visibleColumns.length}
                        className="px-2 py-1.5 text-2xs font-bold text-terminal-gold tracking-widest"
                        style={{
                          background: 'rgba(201,168,76,0.03)',
                          borderTop: '2px solid rgba(201,168,76,0.15)',
                        }}
                      >
                        CRYPTO WATCHLIST
                        <span className="ml-2 font-normal text-terminal-muted/70 tracking-normal">
                          24/7 · no session close
                        </span>
                      </td>
                    </tr>
                  )}
                  {idx === firstCryptoIdx && (
                    /* Crypto reuses the equity column slots for different
                       measures, so it gets its own header strip — a column
                       that changes meaning without saying so is a trap. */
                    <tr className="pointer-events-none">
                      {visibleColumns.map((c) => (
                        <td
                          key={c.key}
                          className={`px-2 py-1 text-[8px] font-mono tracking-wider text-terminal-muted uppercase bg-terminal-header/40 whitespace-nowrap ${
                            c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
                          }`}
                        >{CRYPTO_LABEL[c.key] ?? ''}</td>
                      ))}
                    </tr>
                  )}
                <tr
                  style={{
                    height: 48,
                    // Dragging row fades; drop target takes a gold top edge.
                    // Without either, an HTML5 drag on a dense table gives no
                    // indication of what is moving or where it will land.
                    opacity: draggingIdx === i ? 0.5 : 1,
                    borderTop: dragOverIdx === i && draggingIdx !== i ? '2px solid #C9A84C' : undefined,
                  }}
                  draggable={!sortKey}
                  onDragStart={() => { onDragStart(i); setDraggingIdx(i) }}
                  onDragOver={(e) => { onDragOver(e); if (dragOverIdx !== i) setDragOverIdx(i) }}
                  onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null) }}
                  onDrop={() => { onDrop(i); setDraggingIdx(null); setDragOverIdx(null) }}
                  className="group cursor-pointer hover:bg-terminal-accent/20 transition-colors border-b border-terminal-border/40"
                  onClick={() => handleRowClick(row)}
                  onContextMenu={(e) => openMenu(e, { symbol: row.displaySymbol, name: row.name, price: row.price })}
                >
                  {/* Cells are emitted in visibleColumns order, so a hidden
                      column removes its cell from every row and the header
                      above it at the same time. */}
                  {visibleColumns.map((c) => {
                    switch (c.key) {
                      case 'drag':
                        return (
                          <td
                            key={c.key}
                            className={`px-2 py-1.5 select-none transition-opacity ${
                              sortKey
                                ? 'text-terminal-text-dim/15'
                                : 'cursor-grab opacity-0 group-hover:opacity-100'
                            }`}
                            style={sortKey ? undefined : { color: '#4A6080' }}
                            title={sortKey ? 'Clear sort to reorder — click the sorted header again' : 'Drag to reorder'}
                          >⠿</td>
                        )
                      case 'ticker':
                        return (
                          <td key={c.key} className="px-2 py-1.5 text-xs font-bold text-terminal-text-bright whitespace-nowrap">
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
                              // Earnings date has passed. There is no badge for
                              // this any more: the green "RESULTS: BEAT ✓" that
                              // used to appear here was decided by Math.random()
                              // in simulateEarningsResult, so a coin flip
                              // coloured a watchlist row green or red. We have no
                              // results feed, so we say nothing.
                              if (d <= 0 || d > 45) return null
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
                        )
                      case 'name':
                        return (
                          <td key={c.key} className="px-2 py-1.5 text-2xs text-terminal-text-dim truncate max-w-[200px]">
                            {row.name}
                            {noteOf(row.symbol) && (
                              <Tooltip content={noteOf(row.symbol)}>
                                <span className="ml-1.5 opacity-60" style={{ fontSize: 10 }}>📝</span>
                              </Tooltip>
                            )}
                          </td>
                        )
                      // The four price columns are rendered together by one
                      // component, at the position of the first of them, so
                      // the live-quote hook is called once per row.
                      case 'price': case 'change': case 'pct': case 'week52':
                        if (c.key !== priceAnchor) return null
                        return (
                          <Fragment key={c.key}>
                            {row.type === 'crypto'
                              ? <CryptoPriceCells price={row.price} pct={row.pct} pct7d={row.pct7d} audToUsd={audToUsd} show={isOn} />
                              : <LivePriceCells symbol={row.symbol} price={row.price} change={row.change} pct={row.pct} week52Low={row.week52Low} week52High={row.week52High} show={isOn} />}
                          </Fragment>
                        )
                      case 'volume':
                        return (
                          <td key={c.key} className="px-2 py-1.5 text-2xs text-right text-terminal-text-dim">
                            {row.volume != null ? fmt.large(row.volume) : '—'}
                          </td>
                        )
                      case 'marketCap':
                        return (
                          <td key={c.key} className="px-2 py-1.5 text-2xs text-right text-terminal-text-dim">
                            {formatMarketCap(row.marketCap)}
                          </td>
                        )
                      case 'pe':
                        return (
                          <td key={c.key} className="px-2 py-1.5 text-2xs text-right text-terminal-text-dim tabular-nums">
                            {row.pe != null ? row.pe.toFixed(1) : '—'}
                          </td>
                        )
                      case 'divYield':
                        return (
                          <td key={c.key} className="px-2 py-1.5 text-2xs text-right tabular-nums" style={{ color: row.divYield != null ? '#C9A84C' : undefined }}>
                            {row.divYield != null ? `${row.divYield.toFixed(1)}%` : <span className="text-terminal-text-dim">—</span>}
                          </td>
                        )
                      // SINCE ADDED — measured from the first price this
                      // browser saw for the symbol, not from a purchase. It
                      // answers "has watching this been worth it", which is a
                      // different question from portfolio P&L.
                      case 'sinceAdded': {
                        const since = sinceAdded(row.symbol, row.price)
                        return (
                          <td key={c.key} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                            {since ? (
                              <span
                                title={`From A$${since.entryPrice.toFixed(2)}${since.entryAt ? ` on ${new Date(since.entryAt).toLocaleDateString('en-AU')}` : ''}`}
                                style={{ color: since.pct >= 0 ? '#2D8A50' : '#A83232', fontSize: 10 }}
                              >
                                {since.pct >= 0 ? '▲ +' : '▼ '}{Math.abs(since.pct).toFixed(2)}%
                                {since.entryAt && (
                                  <span className="text-terminal-text-dim/50 ml-1">
                                    since {new Date(since.entryAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <Tooltip content="Price not recorded when this was added. Remove and add again to start tracking it.">
                                <span className="text-terminal-text-dim/40">—</span>
                              </Tooltip>
                            )}
                          </td>
                        )
                      }
                      case 'alert':
                        return (
                          <td key={c.key} className="px-1 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <AlertBell
                              symbol={row.displaySymbol}
                              price={row.price}
                              alerts={alerts}
                              isOpen={alertPanelFor === row.displaySymbol}
                              onToggle={() => setAlertPanelFor((cur) => (cur === row.displaySymbol ? null : row.displaySymbol))}
                            />
                          </td>
                        )
                      case 'remove':
                        return (
                          <td key={c.key} className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openNote(row.symbol)}
                              title={noteOf(row.symbol) ? 'Edit note' : 'Add note'}
                              className={`text-2xs px-0.5 transition-opacity ${
                                noteOf(row.symbol) ? 'text-terminal-gold opacity-100' : 'text-terminal-text-dim opacity-0 group-hover:opacity-60 hover:!opacity-100'
                              }`}
                            >✎</button>
                            <button
                              onClick={() => handleRemove(row.symbol)}
                              className="text-terminal-text-dim hover:text-terminal-red text-xs px-0.5"
                              title="Remove from watchlist"
                            >✕</button>
                          </td>
                        )
                      default:
                        return <td key={c.key} />
                    }
                  })}
                </tr>
                {/* Note editor. Always mounted for the open row so the
                    0fr → 1fr grid transition has something to animate in both
                    directions; a panel that unmounts on the first frame of the
                    close reads as a snap, not a collapse. */}
                {noteFor === row.symbol && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-3 py-0 bg-terminal-header/40 border-b border-terminal-border/40">
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateRows: '1fr',
                          transition: 'grid-template-rows 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        <div style={{ overflow: 'hidden' }} className="py-2">
                          <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">
                            NOTE · {row.displaySymbol}
                          </div>
                          <textarea
                            autoFocus
                            value={noteDraft}
                            maxLength={200}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder={`Your notes about ${row.displaySymbol}…`}
                            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono resize-none"
                            style={{ height: 72 }}
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <button onClick={() => saveNote(row.symbol)} className="btn-primary btn-sm">SAVE NOTE</button>
                            <button onClick={() => setNoteFor(null)} className="btn-secondary btn-sm">CANCEL</button>
                            {noteOf(row.symbol) && (
                              <button
                                onClick={() => deleteNote(row.symbol)}
                                className="text-2xs px-2 py-0.5 border border-terminal-red/40 text-terminal-red hover:bg-terminal-red hover:text-terminal-bg transition-colors"
                              >DELETE</button>
                            )}
                            <span
                              className="text-2xs ml-auto tabular-nums"
                              style={{ color: noteDraft.length >= 190 ? '#C9A84C' : 'rgba(139,163,196,0.5)' }}
                            >{noteDraft.length}/200</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {alertPanelFor === row.displaySymbol && (
                  <AlertRow
                    colSpan={visibleColumns.length}
                    symbol={row.displaySymbol}
                    price={row.price}
                    alerts={alerts}
                    addAlert={addAlert}
                    removeAlert={removeAlert}
                    onClose={() => setAlertPanelFor(null)}
                  />
                )}
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
      {shareLink && (
        <ShareLinkModal
          title="SHARE WATCHLIST"
          brandedUrl={shareLink.brandedUrl}
          resolvableUrl={shareLink.resolvableUrl}
          onClose={() => setShareLink(null)}
        />
      )}
      <StockContextMenu menu={menu} onClose={closeMenu} />
    </div>
  )
}
