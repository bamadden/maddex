import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews, NEWS_CATEGORIES, NEWS_SOURCES, TICKER_WHITELIST, askClaude } from '../../services/api'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Panel'
import { DataUnavailable } from '../../components/ui/DataUnavailable'

// ─── Constants ────────────────────────────────────────────────────────────────

const READ_KEY     = 'madden_news_read_v1'
const CAT_KEY      = 'madden_news_category_v1'
const MAX_ARTICLES = 500
const REFRESH_MS   = 3 * 60_000

const BREAKING_RE = /rate (cut|hike)|crash|collapse|record (high|low)|emergency|crisis|\bwar\b|sanction|default|bankruptcy|merger|acquisition|\bIPO\b|surge/i

const TAG_VARIANTS = {
  MACRO: 'gold', AU: 'gold', EQUITY: 'blue', ENERGY: 'red', FX: 'default',
  CRYPTO: 'green', RATES: 'default', 'M&A': 'gold', INTL: 'blue', EARNINGS: 'red', TECH: 'blue',
}

const SENTIMENT_STYLE = {
  BULLISH: { color: 'var(--color-gain, #2d8a50)',    border: 'rgba(45,138,80,0.4)'   },
  BEARISH: { color: 'var(--color-loss, #a83232)',    border: 'rgba(168,50,50,0.4)'   },
  NEUTRAL: { color: 'var(--color-neutral, #c9a84c)', border: 'rgba(201,168,76,0.3)' },
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

function timeAgo(pubDate) {
  if (!pubDate) return '—'
  const mins = Math.floor((Date.now() - new Date(pubDate).getTime()) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

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

const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','will','have','after','says','over',
  'into','more','than','their','about','what','when','where','which','while','been',
  'being','were','they','them','your','also','could','would','should','still','amid',
  'some','most','first','last','next','years','year','week','said','just','such','each',
])

function extractTrending(items) {
  const counts = {}
  for (const item of items) {
    const words = item.headline.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w))
    for (const w of words) counts[w] = (counts[w] ?? 0) + 1
  }
  return Object.entries(counts).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 8)
}

function overallSentiment(items) {
  const bull = items.filter(i => i.sentiment === 'BULLISH').length
  const bear = items.filter(i => i.sentiment === 'BEARISH').length
  const total = bull + bear
  const score = total === 0 ? 50 : Math.round((bull / total) * 100)
  let label = 'NEUTRAL'
  if (score > 60) label = 'RISK ON'
  else if (score < 40) label = 'RISK OFF'
  return { label, score, bull, bear, neutral: items.length - bull - bear }
}

// ─── AI Key Themes ────────────────────────────────────────────────────────────

const THEMES_CACHE_MS = 15 * 60_000

function KeyThemesPanel({ headlines }) {
  const themesCache = useRef({ text: null, ts: 0 })
  const [themes, setThemes]   = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchThemes = useCallback(async () => {
    const now = Date.now()
    if (themesCache.current.text && now - themesCache.current.ts < THEMES_CACHE_MS) {
      setThemes(themesCache.current.text); return
    }
    setLoading(true)
    try {
      let result = ''
      await askClaude([{ role: 'user', content: `In exactly 3 bullet points using ◆ symbol, what are the dominant themes in today's financial news? Be specific. Under 60 words total.\n\nHeadlines:\n${headlines.slice(0,10).join('\n')}` }], (_, full) => { result = full })
      themesCache.current = { text: result, ts: Date.now() }
      setThemes(result)
    } catch {
      setThemes('◆ Unable to generate themes at this time')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlines.join('|')])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (headlines.length > 0) fetchThemes() }, [])

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest">TODAY'S KEY THEMES</div>
        <span className="text-2xs text-terminal-text-dim/50 border border-terminal-border/30 px-1">AI</span>
        <button onClick={fetchThemes} className="text-2xs text-terminal-text-dim/40 hover:text-terminal-gold ml-auto" title="Refresh">↺</button>
      </div>
      {loading && <div className="text-2xs text-terminal-gold/60 animate-pulse">Analysing headlines...</div>}
      {themes && !loading && (
        <div className="space-y-1">
          {themes.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-2xs text-terminal-text leading-relaxed">{line}</p>
          ))}
        </div>
      )}
      {!themes && !loading && <div className="text-2xs text-terminal-text-dim/40 italic">Loading themes...</div>}
    </div>
  )
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ item, isExpanded, isUnread, searchTerm, onToggle, onAskAI }) {
  const isNew      = isNewArticle(item)
  const isBreaking = isBreakingArticle(item)

  return (
    <div
      className={`border-b border-terminal-border/50 px-3 py-2 cursor-pointer transition-colors hover:bg-terminal-accent/15 ${
        isBreaking ? 'border-l-2 border-l-[rgba(168,50,50,0.7)]' : isNew ? 'border-l-2 border-l-terminal-gold/60' : ''
      }`}
      onClick={() => onToggle(item)}
    >
      {/* Row 1: source / tag / time / badge */}
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />}
        <span className="text-2xs font-bold text-terminal-gold">{item.source}</span>
        <Badge variant={TAG_VARIANTS[item.tag] || 'default'}>{item.tag}</Badge>
        <span className="text-2xs text-terminal-text-dim/60">{timeAgo(item.pubDate)}</span>
        {isBreaking && <span className="text-2xs text-[#a83232] font-bold animate-pulse ml-1">● BREAKING</span>}
        {isNew && !isBreaking && <span className="text-2xs text-terminal-gold font-bold ml-1">NEW</span>}
      </div>

      {/* Row 2: headline */}
      <p className="text-xs font-bold text-terminal-text-bright leading-snug line-clamp-2">
        <HighlightText text={item.headline} term={searchTerm} />
      </p>

      {/* Row 3: summary when collapsed */}
      {!isExpanded && item.summary && (
        <p className="text-2xs text-terminal-text-dim leading-relaxed mt-0.5 line-clamp-2">{item.summary}</p>
      )}

      {/* Row 4: sentiment / tickers / ask AI */}
      <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          {item.sentiment && (
            <span className="text-2xs px-1 border" style={{
              color: SENTIMENT_STYLE[item.sentiment]?.color,
              borderColor: SENTIMENT_STYLE[item.sentiment]?.border,
            }}>
              {item.sentiment}
            </span>
          )}
          {item.tickers?.slice(0, 3).map(t => (
            <span key={t} className="text-2xs text-terminal-blue-bright">${t}</span>
          ))}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onAskAI(item) }}
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors px-1 border border-terminal-border/30 hover:border-terminal-gold/50"
        >
          ▲ ASK AI
        </button>
      </div>

      {/* Expanded: full summary + read link */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-terminal-border/30">
          {item.summary && <p className="text-2xs text-terminal-text leading-relaxed mb-2">{item.summary}</p>}
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-2xs text-terminal-blue-bright hover:text-terminal-gold transition-colors"
            >
              READ FULL ARTICLE →
            </a>
          )}
        </div>
      )}
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
        .nticker-track{animation:nticker 70s linear infinite;white-space:nowrap;display:inline-block;}
        .nticker-track:hover{animation-play-state:paused;}
      `}</style>
      <div className="nticker-track px-3" style={{ fontSize: 9, color: 'var(--mt-gold,#C9A84C)', lineHeight: '22px' }}>
        {content}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{content}
      </div>
    </div>
  )
}

// ─── Source health grid ───────────────────────────────────────────────────────

function SourceHealthGrid({ sourceHealth }) {
  const sources = NEWS_SOURCES.map(s => ({ name: s.name, ok: sourceHealth[s.name] === 'ok' }))
  const live    = sources.filter(s => s.ok).length
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest">SOURCE HEALTH</div>
        <span className="text-2xs text-terminal-text-dim">{live}/{sources.length} LIVE</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {sources.map(s => (
          <div key={s.name} className="flex items-center gap-0.5" title={`${s.name}: ${s.ok ? 'Live' : 'Failed'}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.ok ? 'bg-green-400' : 'bg-red-600/70'}`} />
            <span style={{ fontSize: 9 }} className="text-terminal-text-dim/60">{s.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sentiment gauge ──────────────────────────────────────────────────────────

function SentimentGauge({ score, label, bull, bear, neutral }) {
  const color = score > 60 ? '#2d8a50' : score < 40 ? '#a83232' : '#c9a84c'
  return (
    <div>
      <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">SENTIMENT SUMMARY</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1.5 rounded bg-terminal-border/40 overflow-hidden">
          <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.5s' }} />
        </div>
        <span className="text-2xs font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="text-sm font-bold mb-0.5" style={{ color }}>{label}</div>
      <div className="text-2xs text-terminal-text-dim/60">{bull} bull · {bear} bear · {neutral} neutral</div>
    </div>
  )
}

// ─── Main module ──────────────────────────────────────────────────────────────

export default function NewsModule() {
  const [activeCategory, setActiveCategory] = useState(loadCategory)
  const [searchTerm, setSearchTerm]   = useState('')
  const [expandedId, setExpandedId]   = useState(null)
  const [readIds, setReadIds]         = useState(loadReadSet)
  const [allArticles, setAllArticles] = useState([])
  const [newIds, setNewIds]           = useState(new Set())
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [isFlashing, setIsFlashing]   = useState(false)
  const [nowTs, setNowTs]             = useState(Date.now())
  const prevHeadlines                 = useRef(new Set())

  const { addChatMessage, setChatOpen, newsFilter, setNewsFilter, clearNewsBadge } = useStore()

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
      const freshIds = new Set(brandNew.filter(a => !prevHeadlines.current.has(a.headline)).map(a => a.id))
      if (freshIds.size > 0) setNewIds(freshIds)

      const merged = [
        ...brandNew,
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
    if (activeCategory === 'ALL') return searchFiltered
    return searchFiltered.filter(n => n.categories?.includes(activeCategory))
  }, [searchFiltered, activeCategory])

  const catCount = useCallback(cat => {
    if (cat === 'ALL') return searchFiltered.length
    return searchFiltered.filter(n => n.categories?.includes(cat)).length
  }, [searchFiltered])

  const breakingItems = useMemo(() =>
    allArticles.filter(a => isBreakingArticle(a) || isNewArticle(a)).slice(0, 10)
  , [allArticles, nowTs])

  const trending   = useMemo(() => extractTrending(allArticles), [allArticles])
  const topTickers = useMemo(() => {
    const counts = {}
    for (const item of allArticles) {
      for (const t of (item.tickers ?? [])) {
        if (TICKER_WHITELIST.has(t)) counts[t] = (counts[t] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [allArticles])

  const sentiment    = useMemo(() => overallSentiment(allArticles), [allArticles])
  const topHeadlines = useMemo(() => allArticles.slice(0, 10).map(n => n.headline), [allArticles])

  const askAI = useCallback((item) => {
    setChatOpen(true)
    const tickerLine = item.tickers?.length ? `\nRelated tickers: ${item.tickers.join(', ')}` : ''
    addChatMessage({
      role: 'user',
      content: `Analyse this news from an Australian investor perspective: "${item.headline}"${tickerLine}\n\nWhat is the likely market impact for ASX and AUD?`,
    })
  }, [setChatOpen, addChatMessage])

  const handleToggle = useCallback((item) => {
    setExpandedId(prev => prev === item.id ? null : item.id)
    if (!readIds.has(item.id)) {
      const next = new Set(readIds); next.add(item.id); next.add(item.headline)
      setReadIds(next); saveReadSet(next)
    }
  }, [readIds])

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat); saveCategory(cat); setExpandedId(null)
  }, [])

  if (isError && allArticles.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="panel-header flex items-center gap-2 flex-shrink-0">
          LIVE NEWS FEED
          <span className="text-terminal-red text-2xs font-normal ml-auto">⚠ ERROR</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <DataUnavailable label="NEWS FEED UNAVAILABLE" onRetry={refetch} />
        </div>
      </div>
    )
  }

  const lastUpdatedDisplay = lastUpdatedAt ? sinceMs(lastUpdatedAt) : null
  const nextRefreshSecs    = lastUpdatedAt
    ? Math.max(0, Math.round((REFRESH_MS - (nowTs - lastUpdatedAt)) / 1000))
    : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left: main feed (70%) ─────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden" style={{ flex: '7 1 0%' }}>

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

          {/* New articles banner */}
          {newIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-terminal-gold/10 border-b border-terminal-gold/30 flex-shrink-0">
              <span className="text-2xs text-terminal-gold font-bold">↑ {newIds.size} NEW ARTICLES</span>
              <button
                onClick={() => setNewIds(new Set())}
                className="text-2xs text-terminal-text-dim/50 hover:text-terminal-text-dim ml-auto"
              >
                dismiss
              </button>
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-terminal-border flex-shrink-0">
            <span className="text-terminal-text-dim text-2xs">⌕</span>
            <input
              className="cmd-input flex-1 text-2xs py-0"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setExpandedId(null) }}
              placeholder="Filter headlines... (CMD: NEWS {keyword})"
            />
            {searchTerm && (
              <>
                <span className="text-2xs text-terminal-text-dim/50">{byCategory.length} results</span>
                <button onClick={() => setSearchTerm('')} className="text-terminal-text-dim/40 hover:text-terminal-text-dim text-xs ml-1">✕</button>
              </>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex flex-nowrap overflow-x-auto gap-1 p-1 border-b border-terminal-border flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
            {NEWS_CATEGORIES.map(cat => {
              const count = catCount(cat)
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`text-2xs px-2 py-0.5 flex-shrink-0 transition-colors flex items-center gap-1 ${
                    activeCategory === cat
                      ? 'bg-terminal-gold text-terminal-bg font-bold'
                      : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                  }`}
                >
                  {cat}
                  {count > 0 && (
                    <span className={`text-2xs px-0.5 ${activeCategory === cat ? 'opacity-70' : 'text-terminal-gold/70'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Articles */}
          <div className="flex-1 overflow-auto">
            {isFetching && allArticles.length === 0 ? (
              <div className="p-4 text-2xs text-terminal-text-dim text-center animate-pulse">
                Loading from {NEWS_SOURCES.length} sources...
              </div>
            ) : byCategory.length === 0 ? (
              <div className="p-4 text-2xs text-terminal-text-dim text-center">
                {searchTerm ? `No articles matching "${searchTerm}"` : 'No articles in this category'}
              </div>
            ) : (
              byCategory.map(item => (
                <ArticleCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  isUnread={!readIds.has(item.id) && !readIds.has(item.headline)}
                  searchTerm={searchTerm}
                  onToggle={handleToggle}
                  onAskAI={askAI}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-terminal-border px-3 py-1 flex-shrink-0">
            <span className="text-2xs text-terminal-text-dim/40">
              {byCategory.length} articles · auto-refresh 3min · {NEWS_SOURCES.length} sources
            </span>
          </div>
        </div>

        {/* ── Right: market pulse (30%) ─────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden border-l border-terminal-border" style={{ flex: '3 1 0%' }}>
          <div className="panel-header flex-shrink-0">MARKET PULSE</div>

          {/* Scrolling breaking/NEW ticker */}
          <BreakingTicker items={breakingItems} />

          {/* Sentiment gauge */}
          <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0">
            <SentimentGauge {...sentiment} />
          </div>

          {/* Trending topics */}
          {trending.length > 0 && (
            <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">TRENDING TOPICS</div>
              <div className="flex flex-wrap gap-1">
                {trending.map(([word, count]) => (
                  <span key={word} className="text-2xs px-1.5 py-0.5 border border-terminal-border text-terminal-text-dim">
                    {word} <span className="text-terminal-gold">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source health */}
          {Object.keys(sourceHealth).length > 0 && (
            <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0">
              <SourceHealthGrid sourceHealth={sourceHealth} />
            </div>
          )}

          {/* Most mentioned + AI themes */}
          <div className="px-3 py-2 flex-1 overflow-y-auto">
            {topTickers.length >= 3 && (
              <>
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">MOST MENTIONED</div>
                <div className="space-y-1 mb-4">
                  {topTickers.map(([ticker, count]) => (
                    <div key={ticker} className="flex items-center justify-between text-2xs">
                      <span className="text-terminal-blue-bright font-semibold">${ticker}</span>
                      <span className="text-terminal-text-dim">{count}×</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {topHeadlines.length > 0 && <KeyThemesPanel headlines={topHeadlines} />}
          </div>
        </div>
      </div>
    </div>
  )
}
