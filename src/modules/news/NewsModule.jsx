import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews, NEWS_SOURCES, FINANCIAL_KEYWORDS, ASX_STOCKS, US_STOCKS } from '../../services/api'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Panel'
import { ModuleLoader, ModuleError } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'

// ─── Constants ────────────────────────────────────────────────────────────────

const READ_KEY     = 'madden_news_read_v1'
const CAT_KEY      = 'madden_news_category_v1'
const MAX_ARTICLES = 500
const REFRESH_MS   = 5 * 60_000
const PULSE_MS      = 30_000

const BREAKING_RE = /rate (cut|hike)|crash|collapse|record (high|low)|emergency|crisis|\bwar\b|sanction|default|bankruptcy|merger|acquisition|\bIPO\b|surge/i

const TAG_VARIANTS = {
  MACRO: 'gold', AU: 'gold', EQUITY: 'blue', ENERGY: 'red', FX: 'default',
  CRYPTO: 'green', RATES: 'default', 'M&A': 'gold', INTL: 'blue', EARNINGS: 'red', TECH: 'blue',
}
// Hex equivalents of the same variants, for the tiny inline category pills
// in the list rows (those use inline background-tint styling rather than
// the <Badge> component's Tailwind classes).
const TAG_COLOR = {
  MACRO: '#c8a84b', AU: '#c8a84b', EQUITY: '#3b82f6', ENERGY: '#a83232', FX: '#8a94a6',
  CRYPTO: '#22c55e', RATES: '#8a94a6', 'M&A': '#c8a84b', INTL: '#3b82f6', EARNINGS: '#a83232', TECH: '#3b82f6',
}

// ─── Persistence helpers ───────────────────────────────────────────────────────

function loadReadSet() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')) } catch { return new Set() }
}
function saveReadSet(set) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-500))) } catch {}
}
function loadCategory() {
  try { return localStorage.getItem(CAT_KEY) ?? 'ALL' } catch { return 'ALL' }
}
function saveCategory(cat) {
  try { localStorage.setItem(CAT_KEY, cat) } catch {}
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function getRelativeTime(pubDate) {
  if (!pubDate) return '—'
  const now = new Date()
  const published = new Date(pubDate)
  const diffMs   = now - published
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays  = Math.floor(diffMs / 86400000)
  if (diffMins < 1)   return 'just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7)   return `${diffDays}d ago`
  return published.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function timeAgo(pubDate) { return getRelativeTime(pubDate) }

function sinceMs(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ─── Article classification helpers ───────────────────────────────────────────

function isNewArticle(item) {
  if (!item?.pubDate) return false
  return Date.now() - new Date(item.pubDate).getTime() <= 5 * 60_000
}

function isBreakingArticle(item) {
  if (!item?.pubDate) return false
  const ageMs = Date.now() - new Date(item.pubDate).getTime()
  return ageMs <= 30 * 60_000 && BREAKING_RE.test(item.headline)
}

// ─── Category filter tabs (display subset — distinct from the full
// NEWS_CATEGORIES taxonomy used for classification in api.js) ────────────────

const DISPLAY_CATEGORIES = [
  { key: 'ALL',          label: 'ALL',          test: () => true },
  { key: 'ASX',          label: 'ASX',          test: (n) => n.categories?.includes('AU') },
  { key: 'CRYPTO',       label: 'CRYPTO',       test: (n) => n.categories?.includes('CRYPTO') },
  { key: 'MACRO',        label: 'MACRO',        test: (n) => n.categories?.includes('MACRO') },
  { key: 'COMMODITIES',  label: 'COMMODITIES',  test: (n) => n.categories?.includes('COMMODITIES') },
  { key: 'RATES',        label: 'RATES',        test: (n) => n.tag === 'RATES' || n.categories?.includes('FX') },
  { key: 'GEOPOLITICAL', label: 'GEOPOLITICAL', test: (n) => n.categories?.includes('GEOPOLITICAL') },
  { key: 'TECH',         label: 'TECH',         test: (n) => n.categories?.includes('TECH') },
]

// ─── Ticker badges — only for symbols in the app's tracked stock lists,
// clicking one opens that stock's DetailModal ────────────────────────────────

const ASX_BASE_SYMBOLS = new Set(ASX_STOCKS.map(s => s.replace('.AX', '')))
const US_SYMBOL_SET    = new Set(US_STOCKS)

function knownTickerBadges(tickers) {
  return (tickers ?? []).map(t => {
    if (ASX_BASE_SYMBOLS.has(t)) return { symbol: `${t}.AX`, label: `${t}.AX`, type: 'asx' }
    if (US_SYMBOL_SET.has(t))    return { symbol: t, label: t, type: 'us' }
    return null
  }).filter(Boolean).slice(0, 2)
}

// ─── Source circle — colour derived from the source name, deterministic ─────

const SOURCE_PALETTE = ['#c8a84b', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#e84142', '#0ea5e9']
// Named-source brand colours per spec — hash palette is only a fallback for
// the long tail of RSS sources that aren't one of these six.
const SOURCE_COLORS = {
  Reuters: '#3b82f6', AFR: '#c8a84b', Bloomberg: '#a855f7',
  ABC: '#22c55e', FT: '#ec4899', WSJ: '#8a94a6',
}
function sourceHash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function sourceColor(source) {
  if (!source) return SOURCE_PALETTE[0]
  const key = Object.keys(SOURCE_COLORS).find(k => source.includes(k))
  return key ? SOURCE_COLORS[key] : SOURCE_PALETTE[sourceHash(source) % SOURCE_PALETTE.length]
}
function SourceCircle({ source, size = 16 }) {
  const color = sourceColor(source)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `${color}26`, border: `1px solid ${color}66`, color, fontSize: size * 0.5 }}
    >
      {source?.[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

// ─── Search highlighting ──────────────────────────────────────────────────────

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function HighlightText({ text, term }) {
  if (!term || !text) return <>{text}</>
  const parts = text.split(new RegExp(`(${escRe(term)})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <mark key={i} style={{ background: 'rgba(201,168,76,0.3)', color: 'var(--mt-gold,#C9A84C)', borderRadius: 2 }}>{p}</mark>
          : p
      )}
    </>
  )
}

// ─── Overall stats ────────────────────────────────────────────────────────────

// Trending: count which financial keywords appear most across current articles
const TREND_DISPLAY = {
  'interest rate': 'INTEREST RATES', 'rate cut': 'RATE CUT', 'rate hike': 'RATE HIKE',
  'iron ore': 'IRON ORE', 'federal reserve': 'FED', 'central bank': 'CENTRAL BANK',
  'reserve bank': 'RBA', 'trade war': 'TRADE WAR', 'real estate': 'PROPERTY',
  'monetary policy': 'MONETARY POLICY', 'jobs data': 'JOBS',
}

function extractTrending(items) {
  const counts = {}
  for (const item of items) {
    const text = `${item.headline} ${item.summary ?? ''}`.toLowerCase()
    for (const kw of FINANCIAL_KEYWORDS) {
      if (text.includes(kw)) {
        const display = TREND_DISPLAY[kw] ?? kw.toUpperCase()
        counts[display] = (counts[display] ?? 0) + 1
      }
    }
  }
  return Object.entries(counts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12)
}

// ─── Article card ─────────────────────────────────────────────────────────────

function primaryDisplayCategory(item) {
  const match = DISPLAY_CATEGORIES.find(c => c.key !== 'ALL' && c.test(item))
  return match?.label ?? item.tag
}

function TickerBadgeRow({ tickers, onOpenTicker }) {
  const badges = knownTickerBadges(tickers)
  if (badges.length === 0) return null
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {badges.map(b => (
        <button
          key={b.symbol}
          onClick={e => { e.stopPropagation(); onOpenTicker(b) }}
          className="text-2xs px-1 border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

// ─── TOP STORY — full-width card ─────────────────────────────────────────────

function TopStoryCard({ item, isUnread, searchTerm, isPulsing, onToggle, onAskAI, onOpenTicker }) {
  const isNew      = isNewArticle(item)
  const isBreaking = isBreakingArticle(item)

  return (
    <div
      className={`news-top-story ${isPulsing ? 'news-pulse' : ''} bg-terminal-surface hover:border-terminal-border-gold transition-colors cursor-pointer px-4 py-3`}
      style={{ borderLeft: `3px solid ${isBreaking ? '#a83232' : '#c8a84b'}` }}
      onClick={() => onToggle(item)}
    >
      <p className="font-semibold text-terminal-text-bright leading-snug mb-1" style={{ fontSize: 15 }}>
        {isUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-gold mr-1.5" />}
        {isBreaking && <span className="text-[#a83232] font-bold mr-1.5">● BREAKING</span>}
        <HighlightText text={item.headline} term={searchTerm} />
      </p>

      <div className="flex items-center gap-1.5 text-[10px] font-mono text-terminal-text-dim mb-1.5">
        <SourceCircle source={item.source} size={12} />
        <span>{item.source}</span>
        <span>· {timeAgo(item.pubDate)}</span>
        {isNew && !isBreaking && <span className="text-terminal-gold font-bold ml-1">NEW</span>}
      </div>

      {item.summary && (
        <p className="text-xs text-terminal-text-dim leading-snug mb-2 truncate">{item.summary}</p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant={TAG_VARIANTS[item.tag] || 'default'}>{primaryDisplayCategory(item)}</Badge>
          <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />
        </div>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-2xs text-terminal-blue-bright hover:text-terminal-gold transition-colors ml-auto"
          >
            Read →
          </a>
        )}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onAskAI(item) }}
        className="mt-2 w-full text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/40 rounded-full hover:bg-terminal-gold hover:text-terminal-bg transition-colors py-1.5"
      >
        ASK MADDENAI ▶
      </button>
    </div>
  )
}

// ─── STORY ROW — plain list row, no card background, thin bottom border only.
// Replaces both the old 3-col grid cards and the below-the-fold compact rows
// with a single treatment — the brief wants "a proper news feed, not a card
// grid" for everything below the top story. ───────────────────────────────

function StoryRow({ item, isUnread, isPulsing, onToggle, onOpenTicker }) {
  const isNew      = isNewArticle(item)
  const isBreaking = isBreakingArticle(item)

  return (
    <div
      className={`news-row ${isPulsing ? 'news-pulse' : ''} flex items-start gap-2.5 px-3 py-2 border-b border-terminal-border cursor-pointer hover:bg-terminal-surface2 transition-colors`}
      style={{ maxHeight: 64 }}
      onClick={() => onToggle(item)}
    >
      <SourceCircle source={item.source} size={12} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-terminal-text-bright leading-snug line-clamp-2">
          {isUnread && <span className="inline-block w-1 h-1 rounded-full bg-terminal-gold mr-1.5 align-middle" />}
          {isBreaking && <span className="text-[#a83232] font-bold mr-1">●</span>}
          {item.headline}
          {isNew && !isBreaking && <span className="text-terminal-gold font-bold ml-1.5 text-[9px]">NEW</span>}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-mono text-terminal-text-dim">{item.source} · {timeAgo(item.pubDate)}</span>
          <span
            className="px-1 rounded-full leading-none py-0.5"
            style={{ fontSize: 8, background: `${TAG_COLOR[item.tag] ?? '#8a94a6'}22`, color: TAG_COLOR[item.tag] ?? '#8a94a6' }}
          >
            {primaryDisplayCategory(item)}
          </span>
          <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />
        </div>
      </div>
    </div>
  )
}

// ─── Breaking ticker (horizontal marquee) ────────────────────────────────────

function BreakingTicker({ items }) {
  if (!items.length) return null
  const content = items.map(i => `● ${i.headline}`).join('   ·   ')
  return (
    <div className="overflow-hidden border-b border-terminal-border flex-shrink-0" style={{ height: 22 }}>
      <style>{`
        @keyframes nticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .nticker-track{animation:nticker 70s linear infinite;white-space:nowrap;display:inline-block;animation-play-state:running !important;}
      `}</style>
      <div className="nticker-track px-3" style={{ fontSize: 9, color: 'var(--mt-gold,#C9A84C)', lineHeight: '22px' }}>
        {content}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{content}
      </div>
    </div>
  )
}

// ─── Main module ──────────────────────────────────────────────────────────────

export default function NewsModule() {
  const [activeCategory, setActiveCategory] = useState(() => {
    const saved = loadCategory()
    return DISPLAY_CATEGORIES.some(c => c.key === saved) ? saved : 'ALL'
  })
  const [searchTerm, setSearchTerm]   = useState('')
  const [readIds, setReadIds]         = useState(loadReadSet)
  const [allArticles, setAllArticles] = useState([])
  // headline -> arrivedAt ms, drives the 30s pulse fade. Keyed by headline
  // (not item.id) because fetchNews() restarts its id counter from 1 on
  // every call, so ids aren't stable across refetches — headline is.
  const [newIds, setNewIds]           = useState(new Map())
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [isFlashing, setIsFlashing]   = useState(false)
  const [nowTs, setNowTs]             = useState(Date.now())
  const prevHeadlines                 = useRef(new Set())
  const listTopRef                    = useRef(null)

  const { newsFilter, setNewsFilter, clearNewsBadge, openModal } = useStore()

  // Clear nav badge and tick clock
  useEffect(() => { clearNewsBadge() }, [clearNewsBadge])
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Sync CMD: NEWS filter
  useEffect(() => {
    if (newsFilter) { setSearchTerm(newsFilter); setNewsFilter('') }
  }, [newsFilter, setNewsFilter])

  const { data: queryData, isError, isFetching, refetch } = useQuery({
    queryKey:        ['news'],
    queryFn:         fetchNews,
    staleTime:       REFRESH_MS,
    refetchInterval: REFRESH_MS,
    retry: 1,
  })

  // Merge new articles into running list
  useEffect(() => {
    const incoming = queryData?.articles
    if (!incoming?.length) return

    setAllArticles(prev => {
      const prevKeys = new Set(prev.map(a => a.headline))
      const brandNew = incoming.filter(a => !prevKeys.has(a.headline))
      const freshOnes = brandNew.filter(a => !prevHeadlines.current.has(a.headline))
      // Skip tagging as "new" on the very first load (nothing to compare
      // against yet) — otherwise every article on first render would pulse.
      if (freshOnes.length > 0 && prevHeadlines.current.size > 0) {
        const arrivedAt = Date.now()
        setNewIds(m => {
          const next = new Map(m)
          for (const a of freshOnes) next.set(a.headline, arrivedAt)
          return next
        })
      }

      // `incoming` always wins for any headline it contains (freshest copy —
      // matters since re-classification/tag fields can shift between polls);
      // anything from `prev` NOT in this batch is kept too, so a refetch that
      // happens to return the same headlines as last time (common with
      // slower-moving RSS sources) doesn't wipe the feed to empty.
      const merged = [
        ...incoming,
        ...prev.filter(a => !incoming.some(b => b.headline === a.headline)),
      ].sort((a, b) => b.pubDate - a.pubDate).slice(0, MAX_ARTICLES)

      prevHeadlines.current = new Set(merged.map(a => a.headline))
      return merged
    })

    setLastUpdatedAt(Date.now())
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 800)
  }, [queryData])

  const sourceHealth = queryData?.sourceHealth ?? {}
  const isLive = allArticles.length > 0 && !isError

  // Filtering
  const searchFiltered = useMemo(() => {
    if (!searchTerm) return allArticles
    const lc = searchTerm.toLowerCase()
    return allArticles.filter(n =>
      n.headline.toLowerCase().includes(lc) || n.summary?.toLowerCase().includes(lc)
    )
  }, [allArticles, searchTerm])

  const byCategory = useMemo(() => {
    const def = DISPLAY_CATEGORIES.find(c => c.key === activeCategory)
    if (!def || def.key === 'ALL') return searchFiltered
    return searchFiltered.filter(def.test)
  }, [searchFiltered, activeCategory])

  const catCount = useCallback(cat => {
    const def = DISPLAY_CATEGORIES.find(c => c.key === cat)
    if (!def || def.key === 'ALL') return searchFiltered.length
    return searchFiltered.filter(def.test).length
  }, [searchFiltered])

  const breakingItems = useMemo(() =>
    allArticles.filter(a => isBreakingArticle(a) || isNewArticle(a)).slice(0, 10)
  , [allArticles, nowTs])

  const trending   = useMemo(() => extractTrending(allArticles), [allArticles])

  const askAI = useCallback((item) => {
    dispatchAskAI({
      name:        item.headline,
      ticker:      item.tickers?.length ? item.tickers.join(', ') : null,
      sector:      'News',
      date:        todayAEST(),
      instruction: 'Analyse this news from an Australian investor perspective. What is the likely market impact for ASX and AUD?',
    })
  }, [])

  // Clicking a card marks it read and opens the source article — there's no
  // inline expand any more now the feed is split into top/secondary/compact
  // tiers, so "click the headline" and "open the story" are the same action.
  const handleToggle = useCallback((item) => {
    if (!readIds.has(item.id)) {
      const next = new Set(readIds); next.add(item.id); next.add(item.headline)
      setReadIds(next); saveReadSet(next)
    }
    if (item.link) window.open(item.link, '_blank', 'noopener,noreferrer')
  }, [readIds])

  const handleOpenTicker = useCallback((badge) => {
    openModal({ symbol: badge.symbol, name: badge.symbol, type: badge.type })
  }, [openModal])

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat); saveCategory(cat)
  }, [])

  if (isError && allArticles.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="panel-header flex items-center gap-2 flex-shrink-0">
          LIVE NEWS FEED
          <span className="text-terminal-red text-2xs font-normal ml-auto">⚠ ERROR</span>
        </div>
        <div className="flex-1">
          <ModuleError module="News feed" lastUpdated={lastUpdatedAt} onRetry={refetch} />
        </div>
      </div>
    )
  }

  if (isFetching && allArticles.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="panel-header flex-shrink-0">LIVE NEWS FEED</div>
        <div className="flex-1"><ModuleLoader name="NEWS" /></div>
      </div>
    )
  }

  const lastUpdatedDisplay = lastUpdatedAt ? sinceMs(lastUpdatedAt) : null
  const nextRefreshSecs    = lastUpdatedAt
    ? Math.max(0, Math.round((REFRESH_MS - (nowTs - lastUpdatedAt)) / 1000))
    : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader title="NEWS" subtitle="AFR · Reuters · CNBC · 30+ sources" />

      {/* Header */}
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        <span>LIVE NEWS FEED</span>
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: isLive ? (isFlashing ? '#fff' : '#2d8a50') : '#a83232',
            boxShadow: isLive ? '0 0 4px #2d8a50' : 'none',
            transition: 'background 0.2s',
          }}
        />
        <span className="text-2xs text-terminal-text-dim/70 font-normal normal-case">
          {isLive ? 'LIVE' : isFetching ? 'LOADING...' : 'OFFLINE'}
        </span>

        {isLive && (
          <span className="text-2xs text-terminal-text-dim/40 font-normal normal-case">
            · {allArticles.length} articles · {Object.values(sourceHealth).filter(v => v === 'ok').length}/{NEWS_SOURCES.length} sources
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {lastUpdatedDisplay && (
            <span className="text-2xs text-terminal-text-dim/40 font-normal normal-case">
              {lastUpdatedDisplay}
              {nextRefreshSecs !== null && ` · ↺ ${nextRefreshSecs}s`}
            </span>
          )}
          {isFetching && (
            <span className="text-2xs text-terminal-text-dim font-normal animate-pulse">REFRESHING...</span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-terminal-border flex-shrink-0">
        <span className="text-terminal-text-dim text-2xs">⌕</span>
        <input
          className="cmd-input flex-1 text-2xs py-0"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filter headlines... (CMD: NEWS {keyword})"
        />
        {searchTerm && (
          <>
            <span className="text-2xs text-terminal-text-dim/50">{byCategory.length} results</span>
            <button onClick={() => setSearchTerm('')} className="text-terminal-text-dim/40 hover:text-terminal-text-dim text-xs ml-1">✕</button>
          </>
        )}
      </div>

      {/* Category pills — compact, gold fill when active */}
      <div className="flex flex-nowrap items-center overflow-x-auto gap-1.5 px-2 py-1.5 border-b border-terminal-border flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        {DISPLAY_CATEGORIES.map(({ key, label }) => {
          const count = catCount(key)
          const isActive = activeCategory === key
          return (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className={`font-mono uppercase flex-shrink-0 transition-colors flex items-center gap-1 border rounded-full ${
                isActive
                  ? 'bg-terminal-gold border-terminal-gold text-terminal-bg font-bold'
                  : 'border-terminal-border text-terminal-muted hover:border-terminal-gold hover:text-terminal-gold'
              }`}
              style={{ fontSize: 9, height: 24, padding: '0 12px' }}
            >
              {label}
              {count > 0 && <span className="opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Trending topics — a single compact strip, not its own dedicated
          block, so it doesn't reintroduce the density the redesign removed */}
      {trending.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-terminal-border/50 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[9px] font-mono text-terminal-text-dim/50 flex-shrink-0">TRENDING</span>
          {trending.slice(0, 8).map(([word, count]) => {
            const isActive = searchTerm.toLowerCase() === word.toLowerCase()
            return (
              <button
                key={word}
                onClick={() => setSearchTerm(isActive ? '' : word)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border flex-shrink-0 transition-colors ${
                  isActive
                    ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10'
                    : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold/50 hover:text-terminal-text'
                }`}
              >
                {word} {count}
              </button>
            )
          })}
        </div>
      )}

      <BreakingTicker items={breakingItems} />

      {/* Articles — full-width top story, then a plain list of rows */}
      <div className="flex-1 overflow-auto" ref={listTopRef}>
        {/* New stories banner — click scrolls back to the top of the list */}
        {newIds.size > 0 && (
          <button
            onClick={() => { setNewIds(new Map()); listTopRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="w-full flex items-center gap-2 px-3 py-1 bg-terminal-gold/10 border-b border-terminal-gold/30 text-left hover:bg-terminal-gold/15 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />
            <span className="text-2xs text-terminal-gold font-bold">● {newIds.size} new {newIds.size === 1 ? 'story' : 'stories'}</span>
          </button>
        )}

        {byCategory.length === 0 ? (
          <div className="p-4 text-2xs text-terminal-text-dim text-center">
            {searchTerm ? `No articles matching "${searchTerm}"` : 'No articles in this category'}
          </div>
        ) : (
          <>
            <TopStoryCard
              item={byCategory[0]}
              isUnread={!readIds.has(byCategory[0].id) && !readIds.has(byCategory[0].headline)}
              searchTerm={searchTerm}
              isPulsing={newIds.has(byCategory[0].headline) && (nowTs - newIds.get(byCategory[0].headline) < PULSE_MS)}
              onToggle={handleToggle}
              onAskAI={askAI}
              onOpenTicker={handleOpenTicker}
            />

            {byCategory.slice(1).map(item => (
              <StoryRow
                key={item.id}
                item={item}
                isUnread={!readIds.has(item.id) && !readIds.has(item.headline)}
                isPulsing={newIds.has(item.headline) && (nowTs - newIds.get(item.headline) < PULSE_MS)}
                onToggle={handleToggle}
                onOpenTicker={handleOpenTicker}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-terminal-border px-3 py-1 flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim/40">
          {byCategory.length} articles · auto-refresh 5min · {NEWS_SOURCES.length} sources
        </span>
      </div>
    </div>
  )
}
