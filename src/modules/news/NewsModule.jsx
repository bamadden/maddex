import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews, NEWS_CATEGORIES, TICKER_WHITELIST, askClaude } from '../../services/api'
import { BREAKING_NEWS_THRESHOLD_MINUTES } from '../../data/placeholders'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Panel'
import { DataUnavailable } from '../../components/ui/DataUnavailable'

const READ_KEY = 'madden_news_read_v1'

function loadReadSet() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')) } catch { return new Set() }
}
function saveReadSet(set) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-500))) } catch {}
}

function timeAgo(pubDate) {
  if (!pubDate) return '—'
  const mins = Math.floor((Date.now() - new Date(pubDate).getTime()) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const SENTIMENT_CLASS = {
  BULLISH: 'text-terminal-green border-terminal-green/40',
  BEARISH: 'text-terminal-red border-terminal-red/40',
  NEUTRAL: 'text-terminal-text-dim border-terminal-border',
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'have', 'after',
  'says', 'over', 'into', 'more', 'than', 'their', 'about', 'what', 'when',
  'where', 'which', 'while', 'been', 'being', 'were', 'they', 'them', 'your',
  'also', 'could', 'would', 'should', 'still', 'amid', 'some', 'most', 'first',
  'last', 'next', 'years', 'year', 'week', 'said', 'just', 'such', 'each',
])

function extractTrending(items) {
  const counts = {}
  for (const item of items) {
    const words = item.headline.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    for (const w of words) counts[w] = (counts[w] ?? 0) + 1
  }
  return Object.entries(counts).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 8)
}

function extractTopTickers(items) {
  const counts = {}
  for (const item of items) {
    for (const t of (item.tickers ?? [])) {
      // Only count if on whitelist (api.js already filters, but belt-and-suspenders)
      if (TICKER_WHITELIST.has(t)) counts[t] = (counts[t] ?? 0) + 1
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
}

function overallSentiment(items) {
  const bull = items.filter((i) => i.sentiment === 'BULLISH').length
  const bear = items.filter((i) => i.sentiment === 'BEARISH').length
  if (bull === 0 && bear === 0) return { label: 'NEUTRAL', bull, bear }
  const ratio = bull / (bull + bear)
  if (ratio > 0.6) return { label: 'RISK ON', bull, bear }
  if (ratio < 0.4) return { label: 'RISK OFF', bull, bear }
  return { label: 'NEUTRAL', bull, bear }
}

const BREAKING_CONTENT_RE = /rate (hike|cut|change)|market crash|emergency (meeting|rate)|central bank (surprise|shock)|fed (cuts|hikes|raises|lowers)|rba (cuts|hikes|raises)/i

function isBreakingNews(item) {
  if (!item?.pubDate) return false
  const ageMs = Date.now() - new Date(item.pubDate).getTime()
  const isRecent = ageMs <= BREAKING_NEWS_THRESHOLD_MINUTES * 60 * 1000
  const isHighImpact = BREAKING_CONTENT_RE.test(item.headline)
  return isRecent || isHighImpact
}

const TAG_VARIANTS = {
  MACRO: 'gold', AU: 'gold', EQUITY: 'blue', ENERGY: 'red', FX: 'default',
  CRYPTO: 'green', RATES: 'default', 'M&A': 'gold', INTL: 'blue', EARNINGS: 'red',
  TECH: 'blue',
}

// ─── AI Key Themes panel ──────────────────────────────────────────────────────

const THEMES_CACHE_MS = 15 * 60 * 1000

function KeyThemesPanel({ headlines }) {
  const themesCache = useRef({ text: null, ts: 0 })
  const [themes, setThemes] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchThemes = useCallback(async () => {
    const now = Date.now()
    if (themesCache.current.text && now - themesCache.current.ts < THEMES_CACHE_MS) {
      setThemes(themesCache.current.text)
      return
    }
    setLoading(true)
    try {
      const headlineList = headlines.slice(0, 10).join('\n')
      let result = ''
      await askClaude([{
        role: 'user',
        content: `In exactly 3 bullet points using ◆ symbol, what are the dominant themes in today's financial news? Be specific, mention actual companies, rates, or market moves. Under 60 words total.\n\nHeadlines:\n${headlineList}`,
      }], (_, full) => { result = full })
      themesCache.current = { text: result, ts: Date.now() }
      setThemes(result)
    } catch {
      setThemes('◆ Unable to generate themes at this time')
    } finally {
      setLoading(false)
    }
  }, [headlines.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (headlines.length > 0) fetchThemes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest">TODAY'S KEY THEMES</div>
        <span className="text-2xs text-terminal-text-dim/50 border border-terminal-border/30 px-1">AI</span>
      </div>
      {loading && (
        <div className="text-2xs text-terminal-gold/60 animate-pulse">Analysing headlines...</div>
      )}
      {themes && !loading && (
        <div className="space-y-1">
          {themes.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-2xs text-terminal-text leading-relaxed">{line}</p>
          ))}
        </div>
      )}
      {!themes && !loading && (
        <div className="text-2xs text-terminal-text-dim/40 italic">Loading themes...</div>
      )}
      <div className="text-2xs text-terminal-text-dim/30 mt-2 tracking-widest">◆</div>
    </div>
  )
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ item, isExpanded, isUnread, onToggle, onAskAI }) {
  const breaking = isBreakingNews(item)
  return (
    <div
      className={`border-b border-terminal-border/50 px-3 py-2 cursor-pointer transition-colors ${
        breaking ? 'border-l-2 border-l-terminal-red/60' : ''
      } hover:bg-terminal-accent/15`}
      onClick={() => onToggle(item)}
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />}
        <span className="text-2xs font-bold text-terminal-text-bright">{item.source}</span>
        <span className="text-2xs text-terminal-text-dim">— {timeAgo(item.pubDate)}</span>
        <Badge variant={TAG_VARIANTS[item.tag] || 'default'}>{item.tag}</Badge>
        <span className={`text-2xs px-1 py-0 border ${SENTIMENT_CLASS[item.sentiment]}`}>{item.sentiment}</span>
        {breaking && <span className="text-2xs text-terminal-red font-bold animate-pulse">● BREAKING</span>}
      </div>
      <p className="text-xs font-bold text-terminal-text-bright leading-snug">{item.headline}</p>
      {!isExpanded && item.summary && (
        <p className="text-2xs text-terminal-text-dim leading-relaxed mt-0.5 line-clamp-2">{item.summary}</p>
      )}
      <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
        <div className="flex gap-1.5 flex-wrap">
          {item.tickers?.slice(0, 4).map((t) => (
            <span key={t} className="text-2xs text-terminal-blue-bright">${t}</span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAskAI(item) }}
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors px-1"
          title="Ask AI about this article"
        >
          ▲ ASK AI
        </button>
      </div>
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-terminal-border/30">
          {item.summary && <p className="text-2xs text-terminal-text leading-relaxed mb-2">{item.summary}</p>}
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
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

// ─── Main module ──────────────────────────────────────────────────────────────

export default function NewsModule() {
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [searchTerm, setSearchTerm]   = useState('')
  const [expandedId, setExpandedId]   = useState(null)
  const [readIds, setReadIds]         = useState(loadReadSet)
  const { addChatMessage, setChatOpen, newsFilter, setNewsFilter } = useStore()

  useEffect(() => {
    if (newsFilter) {
      setSearchTerm(newsFilter)
      setNewsFilter('')
    }
  }, [newsFilter, setNewsFilter])

  const { data: liveNews, isError, isFetching, refetch } = useQuery({
    queryKey: ['news'],
    queryFn:  fetchNews,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

  const rawFeed = useMemo(() => (liveNews && liveNews.length > 0 ? liveNews : []), [liveNews])
  const isLive  = !!liveNews && !isError && liveNews.length > 0

  const searchFiltered = searchTerm
    ? rawFeed.filter((n) =>
        n.headline.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.summary?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : rawFeed

  const byCategory = activeCategory === 'ALL'
    ? searchFiltered
    : searchFiltered.filter((n) => n.categories?.includes(activeCategory))

  const unreadCountFor = (cat) => {
    const pool = cat === 'ALL' ? rawFeed : rawFeed.filter((n) => n.categories?.includes(cat))
    return pool.filter((n) => !readIds.has(n.id) && !readIds.has(n.headline)).length
  }

  const latestBreaking = rawFeed.find(isBreakingNews)
  const trending   = useMemo(() => extractTrending(rawFeed), [rawFeed])
  const topTickers = useMemo(() => extractTopTickers(rawFeed), [rawFeed])
  const sentiment  = useMemo(() => overallSentiment(rawFeed), [rawFeed])
  const topHeadlines = useMemo(() => rawFeed.slice(0, 10).map(n => n.headline), [rawFeed])

  const askAI = (item) => {
    setChatOpen(true)
    const tickerLine = item.tickers?.length ? `\nRelated tickers: ${item.tickers.join(', ')}` : ''
    addChatMessage({
      role: 'user',
      content: `Analyse this news from an Australian investor perspective: "${item.headline}"${tickerLine}\n\nWhat is the likely market impact for ASX and AUD?`,
    })
  }

  const handleToggle = (item) => {
    setExpandedId((prev) => (prev === item.id ? null : item.id))
    if (!readIds.has(item.id)) {
      const next = new Set(readIds); next.add(item.id); next.add(item.headline)
      setReadIds(next)
      saveReadSet(next)
    }
  }

  if (isError && rawFeed.length === 0) {
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

  const sourcesActive = [...new Set(rawFeed.map(n => n.source))].slice(0, 5).join(', ')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Breaking news banner */}
      {latestBreaking && (
        <div className="flex items-center gap-3 px-3 py-1 bg-terminal-red/10 border-b border-terminal-red/40 flex-shrink-0 animate-pulse">
          <span className="text-terminal-red text-2xs font-bold tracking-widest flex-shrink-0">● BREAKING</span>
          <span className="text-2xs text-terminal-text truncate">{latestBreaking.headline}</span>
          <span className="text-2xs text-terminal-text-dim flex-shrink-0">{timeAgo(latestBreaking.pubDate)}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: main feed — 70% */}
        <div className="flex flex-col overflow-hidden" style={{ flex: '7 1 0%' }}>
          <div className="panel-header flex items-center gap-2 flex-shrink-0">
            LIVE NEWS FEED
            {isFetching  && <span className="text-terminal-text-dim text-2xs font-normal ml-auto">LOADING...</span>}
            {isLive && !isFetching && <span className="text-terminal-green text-2xs font-normal normal-case ml-auto">● LIVE · {rawFeed.length} articles · auto-refresh 5m</span>}
            {isError     && <span className="text-terminal-red text-2xs font-normal ml-auto">⚠ ERROR</span>}
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-terminal-border flex-shrink-0">
            <span className="text-terminal-text-dim text-2xs">⌕</span>
            <input
              className="cmd-input flex-1 text-2xs py-0"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setExpandedId(null) }}
              placeholder="Filter headlines... (CMD: NEWS {keyword})"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-terminal-text-dim/40 hover:text-terminal-text-dim text-xs">✕</button>
            )}
          </div>

          {/* Category tabs with unread counts */}
          <div className="flex flex-wrap gap-1 p-1.5 border-b border-terminal-border flex-shrink-0">
            {NEWS_CATEGORIES.map((cat) => {
              const unread = unreadCountFor(cat)
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-2xs px-2 py-0.5 transition-colors flex items-center gap-1 ${
                    activeCategory === cat
                      ? 'bg-terminal-gold text-terminal-bg font-bold'
                      : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                  }`}
                >
                  {cat}
                  {unread > 0 && (
                    <span className={`text-2xs px-1 rounded-full ${activeCategory === cat ? 'bg-terminal-bg/20' : 'bg-terminal-gold/20 text-terminal-gold'}`}>
                      {unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Articles */}
          <div className="flex-1 overflow-auto">
            {!isFetching && rawFeed.length === 0 ? (
              <div className="p-4 text-2xs text-terminal-text-dim text-center">No articles available</div>
            ) : byCategory.length === 0 ? (
              <div className="p-4 text-2xs text-terminal-text-dim text-center">No articles in this category</div>
            ) : (
              byCategory.map((item) => (
                <ArticleCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  isUnread={!readIds.has(item.id) && !readIds.has(item.headline)}
                  onToggle={handleToggle}
                  onAskAI={askAI}
                />
              ))
            )}
          </div>

          <div className="border-t border-terminal-border p-2 flex-shrink-0">
            <div className="text-2xs text-terminal-text-dim truncate">
              {byCategory.length} articles · {sourcesActive || 'Reuters, CNBC, MarketWatch, AFR, BBC, Guardian, RBA'}
            </div>
          </div>
        </div>

        {/* Right: trending + sentiment — 30% */}
        <div className="flex flex-col overflow-hidden border-l border-terminal-border" style={{ flex: '3 1 0%' }}>
          <div className="panel-header flex-shrink-0">MARKET PULSE</div>

          <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0">
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">SENTIMENT SUMMARY</div>
            <div className={`text-sm font-bold ${
              sentiment.label === 'RISK ON' ? 'text-terminal-green' : sentiment.label === 'RISK OFF' ? 'text-terminal-red' : 'text-terminal-text-dim'
            }`}>
              {sentiment.label}
            </div>
            <div className="text-2xs text-terminal-text-dim mt-0.5">
              {sentiment.bull} bullish · {sentiment.bear} bearish · {rawFeed.length - sentiment.bull - sentiment.bear} neutral
            </div>
          </div>

          <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0">
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">TRENDING TOPICS</div>
            {trending.length === 0 ? (
              <div className="text-2xs text-terminal-text-dim/50 italic">Not enough data yet</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {trending.map(([word, count]) => (
                  <span key={word} className="text-2xs px-1.5 py-0.5 border border-terminal-border text-terminal-text-dim">
                    {word} <span className="text-terminal-gold">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2 flex-shrink-0 overflow-y-auto flex-1">
            {topTickers.length >= 3 ? (
              <>
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">MOST MENTIONED</div>
                <div className="space-y-1">
                  {topTickers.map(([ticker, count]) => (
                    <div key={ticker} className="flex items-center justify-between text-2xs">
                      <span className="text-terminal-blue-bright font-semibold">${ticker}</span>
                      <span className="text-terminal-text-dim">{count}×</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              topHeadlines.length > 0 && <KeyThemesPanel headlines={topHeadlines} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
