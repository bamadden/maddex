import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews, NEWS_SOURCES, TICKER_WHITELIST, FINANCIAL_KEYWORDS, ASX_STOCKS, US_STOCKS, askClaude } from '../../services/api'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Panel'
import { ModuleLoader, ModuleError } from '../../components/ui/ModuleStates'

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

function fullDateTooltip(pubDate) {
  if (!pubDate) return ''
  return `Published: ${new Date(pubDate).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })}`
}

// tick increments every 60s so relative times stay fresh
function useTimeTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])
  return tick
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

// ─── MaddenAI relevance scoring — simple keyword match, not a model call ─────

function buildBoundaryRegex(words) {
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i')
}
const RELEVANCE_HIGH_RE = buildBoundaryRegex([
  'ASX', 'RBA', 'AUD', 'Australia', 'Australian', 'S&P 500', 'Fed', 'interest rate', 'inflation', 'GDP',
])
const RELEVANCE_MEDIUM_RE = buildBoundaryRegex([
  'China', 'US', 'UK', 'EUR', 'oil', 'gold', 'trade', 'tariff', 'crypto',
])

function relevanceScore(item) {
  const text = `${item.headline} ${item.summary ?? ''}`
  if (RELEVANCE_HIGH_RE.test(text))   return 80 + Math.min(20, (text.match(new RegExp(RELEVANCE_HIGH_RE, 'gi')) ?? []).length * 4)
  if (RELEVANCE_MEDIUM_RE.test(text)) return 50 + Math.min(29, (text.match(new RegExp(RELEVANCE_MEDIUM_RE, 'gi')) ?? []).length * 6)
  return 15 + Math.min(34, text.length % 35) // varies a little within LOW band instead of a flat number
}
function relevanceTier(score) {
  if (score >= 80) return 'HIGH'
  if (score >= 50) return 'MEDIUM'
  return 'LOW'
}
const RELEVANCE_DOT = { HIGH: '🟢', MEDIUM: '🟡', LOW: '⚫' }

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

const THEME_SENTIMENT_COLOR = {
  BULLISH: '#2d8a50',
  BEARISH: '#a83232',
  NEUTRAL: '#c9a84c',
}

function KeyThemesPanel({ headlines }) {
  const themesCache = useRef({ themes: null, ts: 0 })
  const [themes, setThemes]   = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchThemes = useCallback(async () => {
    const now = Date.now()
    if (themesCache.current.themes && now - themesCache.current.ts < THEMES_CACHE_MS) {
      setThemes(themesCache.current.themes); return
    }
    setLoading(true)
    try {
      let result = ''
      await askClaude([{
        role: 'user',
        content: `Analyse these financial news headlines and return ONLY a JSON array of exactly 3 objects. Each object must have these exact keys: "theme" (max 10 words), "sentiment" (one of: BULLISH, BEARISH, NEUTRAL), "category" (one of: AU, US, CRYPTO, COMMODITIES, MACRO, FX, GEOPOLITICAL, TECH, EARNINGS, ASIA), "impact" (max 8 words describing market impact). Return raw JSON only — no markdown, no explanation.\n\nHeadlines:\n${headlines.slice(0, 15).join('\n')}`,
      }], (_, full) => { result = full })
      const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed) && parsed.length > 0) {
        themesCache.current = { themes: parsed, ts: Date.now() }
        setThemes(parsed)
      }
    } catch {
      setThemes([{ theme: 'Unable to generate themes', sentiment: 'NEUTRAL', category: 'MACRO', impact: 'AI analysis unavailable' }])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlines.join('|')])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (headlines.length > 0) fetchThemes() }, [])

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest">TODAY'S KEY THEMES</div>
        <span className="text-2xs text-terminal-text-dim/50 border border-terminal-border/30 px-1">AI</span>
        <button onClick={fetchThemes} className="text-2xs text-terminal-text-dim/40 hover:text-terminal-gold ml-auto" title="Refresh themes">↺</button>
      </div>
      {loading && <div className="text-2xs text-terminal-gold/60 animate-pulse">Analysing headlines...</div>}
      {themes && !loading && (
        <div className="space-y-2">
          {themes.map((t, i) => {
            const color = THEME_SENTIMENT_COLOR[t.sentiment] ?? '#c9a84c'
            return (
              <div
                key={i}
                className="border border-terminal-border/40 px-2 py-1.5"
                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
              >
                <p className="text-2xs font-bold text-terminal-text-bright leading-snug mb-1">{t.theme}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-2xs px-1 font-bold leading-none py-0.5"
                    style={{ color, background: `${color}22` }}
                  >{t.sentiment}</span>
                  <span className="text-2xs text-terminal-blue-bright/80 font-semibold">{t.category}</span>
                  <span className="text-2xs text-terminal-text-dim/60 italic">{t.impact}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {!themes && !loading && <div className="text-2xs text-terminal-text-dim/40 italic">Loading themes...</div>}
    </div>
  )
}

// ─── Article card ─────────────────────────────────────────────────────────────

function primaryDisplayCategory(item) {
  const match = DISPLAY_CATEGORIES.find(c => c.key !== 'ALL' && c.test(item))
  return match?.label ?? item.tag
}

function RelevanceDot({ item }) {
  const tier = relevanceTier(relevanceScore(item))
  return (
    <span title={`MaddenAI relevance: ${tier}`} className="text-2xs leading-none flex-shrink-0">
      {RELEVANCE_DOT[tier]}
    </span>
  )
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
  const score      = relevanceScore(item)
  const tier       = relevanceTier(score)

  return (
    <div
      className={`news-top-story ${isPulsing ? 'news-pulse' : ''} border-b border-terminal-border px-4 py-3 cursor-pointer hover:bg-terminal-accent/10 transition-colors ${
        isBreaking ? 'border-l-2 border-l-[rgba(168,50,50,0.7)]' : isNew ? 'border-l-2 border-l-terminal-gold/60' : ''
      }`}
      onClick={() => onToggle(item)}
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />}
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">TOP STORY</span>
        <Badge variant={TAG_VARIANTS[item.tag] || 'default'}>{primaryDisplayCategory(item)}</Badge>
        <span className="text-2xs font-bold text-terminal-text-dim">{item.source}</span>
        <span className="text-2xs text-terminal-text-dim/60" title={fullDateTooltip(item.pubDate)}>{timeAgo(item.pubDate)}</span>
        {isBreaking && <span className="text-2xs text-[#a83232] font-bold animate-pulse ml-1">● BREAKING</span>}
        {isNew && !isBreaking && <span className="text-2xs text-terminal-gold font-bold ml-1">NEW</span>}
      </div>

      <p className="text-base font-bold text-terminal-text-bright leading-snug mb-1.5">
        <HighlightText text={item.headline} term={searchTerm} />
      </p>

      {item.summary && (
        <p className="text-xs text-terminal-text-dim leading-relaxed mb-2 line-clamp-3">{item.summary}</p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <RelevanceDot item={item} />
          <span className="text-2xs text-terminal-text-dim">
            MaddenAI relevance <span className="text-terminal-text-bright font-bold">{score}/100</span> ({tier})
          </span>
          {item.sentiment && (
            <span className="text-2xs px-1 border" style={{ color: SENTIMENT_STYLE[item.sentiment]?.color, borderColor: SENTIMENT_STYLE[item.sentiment]?.border }}>
              {item.sentiment}
            </span>
          )}
          <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onAskAI(item) }}
          className="text-2xs text-terminal-gold border border-terminal-gold/40 hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-1.5 py-0.5"
        >
          ▲ ASK AI
        </button>
      </div>

      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="inline-block mt-2 text-2xs text-terminal-blue-bright hover:text-terminal-gold transition-colors"
        >
          READ FULL ARTICLE →
        </a>
      )}
    </div>
  )
}

// ─── SECONDARY STORIES — 3-column grid ───────────────────────────────────────

function SecondaryStoryCard({ item, isUnread, isPulsing, onToggle, onAskAI, onOpenTicker }) {
  const isNew      = isNewArticle(item)
  const isBreaking = isBreakingArticle(item)

  return (
    <div
      className={`news-secondary-story ${isPulsing ? 'news-pulse' : ''} border border-terminal-border/50 p-2 cursor-pointer hover:bg-terminal-accent/10 transition-colors flex flex-col ${
        isBreaking ? 'border-l-2 border-l-[rgba(168,50,50,0.7)]' : isNew ? 'border-l-2 border-l-terminal-gold/60' : ''
      }`}
      onClick={() => onToggle(item)}
    >
      <div className="flex items-center gap-1 mb-1 flex-wrap">
        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />}
        <RelevanceDot item={item} />
        <Badge variant={TAG_VARIANTS[item.tag] || 'default'}>{primaryDisplayCategory(item)}</Badge>
        <span className="text-2xs text-terminal-text-dim/60 ml-auto" title={fullDateTooltip(item.pubDate)}>{timeAgo(item.pubDate)}</span>
      </div>
      <p className="text-2xs font-bold text-terminal-text-bright leading-snug line-clamp-3 mb-1">{item.headline}</p>
      {item.summary && <p className="text-2xs text-terminal-text-dim/80 leading-snug line-clamp-1 mb-1.5">{item.summary}</p>}
      <div className="flex items-center justify-between mt-auto gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-2xs text-terminal-text-dim truncate">{item.source}</span>
          <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onAskAI(item) }}
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors flex-shrink-0"
        >
          ▲ AI
        </button>
      </div>
    </div>
  )
}

// ─── BELOW THE FOLD — compact list row ───────────────────────────────────────

function CompactStoryRow({ item, isUnread, isPulsing, onToggle, onOpenTicker }) {
  return (
    <div
      className={`news-compact-row ${isPulsing ? 'news-pulse' : ''} flex items-center gap-2 px-3 py-1 border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-accent/10 transition-colors`}
      onClick={() => onToggle(item)}
    >
      {isUnread && <span className="w-1 h-1 rounded-full bg-terminal-gold flex-shrink-0" />}
      <RelevanceDot item={item} />
      <p className="text-2xs text-terminal-text flex-1 truncate">{item.headline}</p>
      <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />
      <span className="text-2xs text-terminal-text-dim flex-shrink-0">{item.source}</span>
      <span className="text-2xs text-terminal-text-dim/60 flex-shrink-0" title={fullDateTooltip(item.pubDate)}>{timeAgo(item.pubDate)}</span>
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

// ─── Sentiment gauge — horizontal dial ───────────────────────────────────────

function SentimentGauge({ score, bull, bear, neutral }) {
  const color     = score > 60 ? '#2d8a50' : score < 40 ? '#a83232' : '#c9a84c'
  const labelText = score > 60 ? 'RISK ON' : score < 40 ? 'RISK OFF' : 'NEUTRAL'
  return (
    <div>
      <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">MARKET SENTIMENT</div>
      <div className="flex items-center gap-1.5 text-2xs mb-1.5">
        <span className="text-terminal-red/70 flex-shrink-0" style={{ fontSize: 9 }}>RISK OFF</span>
        <div className="flex-1 relative h-4 flex items-center">
          <div className="w-full h-px bg-terminal-border/60" />
          <div
            className="absolute w-3 h-3 rounded-full transition-all duration-500"
            style={{
              left:        `calc(${Math.max(6, Math.min(94, score))}% - 6px)`,
              background:  color,
              boxShadow:   `0 0 8px ${color}88`,
              border:      `2px solid ${color}`,
            }}
          />
        </div>
        <span className="text-terminal-green/70 flex-shrink-0" style={{ fontSize: 9 }}>RISK ON</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color }}>{labelText}</span>
        <span className="text-2xs text-terminal-text-dim/50">{bull}▲ {bear}▼ {neutral}–</span>
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
                onClick={() => setNewIds(new Map())}
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

          {/* Category tabs — gold underline on the active tab */}
          <div className="flex flex-nowrap overflow-x-auto gap-3 px-2 border-b border-terminal-border flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
            {DISPLAY_CATEGORIES.map(({ key, label }) => {
              const count = catCount(key)
              const isActive = activeCategory === key
              return (
                <button
                  key={key}
                  onClick={() => handleCategoryChange(key)}
                  className={`text-2xs px-0.5 py-1.5 flex-shrink-0 transition-colors flex items-center gap-1 border-b-2 ${
                    isActive
                      ? 'border-terminal-gold text-terminal-gold font-bold'
                      : 'border-transparent text-terminal-text-dim hover:text-terminal-text'
                  }`}
                >
                  {label}
                  {count > 0 && <span className={isActive ? 'text-terminal-gold/70' : 'text-terminal-text-dim/50'}>{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Articles — tiered TOP STORY / SECONDARY grid / BELOW THE FOLD */}
          <div className="flex-1 overflow-auto">
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

                {byCategory.length > 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-2 border-b border-terminal-border">
                    {byCategory.slice(1, 7).map(item => (
                      <SecondaryStoryCard
                        key={item.id}
                        item={item}
                        isUnread={!readIds.has(item.id) && !readIds.has(item.headline)}
                        isPulsing={newIds.has(item.headline) && (nowTs - newIds.get(item.headline) < PULSE_MS)}
                        onToggle={handleToggle}
                        onAskAI={askAI}
                        onOpenTicker={handleOpenTicker}
                      />
                    ))}
                  </div>
                )}

                {byCategory.length > 7 && (
                  <div>
                    <div className="text-2xs text-terminal-text-dim/50 tracking-widest px-3 py-1 border-b border-terminal-border/30">MORE HEADLINES</div>
                    {byCategory.slice(7).map(item => (
                      <CompactStoryRow
                        key={item.id}
                        item={item}
                        isUnread={!readIds.has(item.id) && !readIds.has(item.headline)}
                        isPulsing={newIds.has(item.headline) && (nowTs - newIds.get(item.headline) < PULSE_MS)}
                        onToggle={handleToggle}
                        onOpenTicker={handleOpenTicker}
                      />
                    ))}
                  </div>
                )}
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

        {/* ── Right: market pulse (30%) ─────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden border-l border-terminal-border" style={{ flex: '3 1 0%' }}>
          <div className="panel-header flex-shrink-0">MARKET PULSE</div>

          {/* Scrolling breaking/NEW ticker */}
          <BreakingTicker items={breakingItems} />

          {/* Sentiment gauge */}
          <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0">
            <SentimentGauge {...sentiment} />
          </div>

          {/* Trending topics — clickable tags that filter feed */}
          {trending.length > 0 && (
            <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">TRENDING TOPICS</div>
              <div className="flex flex-wrap gap-1">
                {trending.map(([word, count]) => {
                  const isActive = searchTerm.toLowerCase() === word.toLowerCase()
                  return (
                    <button
                      key={word}
                      onClick={() => setSearchTerm(isActive ? '' : word)}
                      className={`text-2xs px-1.5 py-0.5 border transition-colors ${
                        isActive
                          ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10'
                          : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold/50 hover:text-terminal-text'
                      }`}
                    >
                      {word} <span className={isActive ? 'text-terminal-bg' : 'text-terminal-gold/70'}>{count}</span>
                    </button>
                  )
                })}
              </div>
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
