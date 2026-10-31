import { memo, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { timeAgo as sharedTimeAgo } from '../../utils/dateUtils'
import { useQuery } from '@tanstack/react-query'
import { fetchNews, NEWS_SOURCES, ASX_STOCKS, US_STOCKS, askClaude } from '../../services/api'
import { MOCK_ASX_STOCKS, MOCK_CRYPTO, MOCK_INDICES } from '../../services/mockData'
import { dispatchAskAI, askMaddenAI, todayAEST } from '../../utils/askAI'
import { fetchIndexQuotesUnified } from '../../services/dataService'
import { USING_MOCK_DATA } from '../../services/api'
import { getEconomicCalendar, pendingEvents } from '../../services/calendarService'
import { sydneyTzAbbr } from '../../utils/dateUtils'
import { useStore } from '../../store/useStore'
import { ModuleError } from '../../components/ui/ModuleStates'
import { SkeletonNewsCard } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { NewsletterBanner } from '../../components/newsletter/Newsletter'
import { annotateArticles, clusterStories, marketSession, impactOf } from '../../services/newsIntelligence'
import { useSentiment } from '../../hooks/useSentiment'
import { gatherBriefContext, buildNewsBriefPrompt } from '../../services/briefContext'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'
import ContextPrompt from '../../components/ai/ContextPrompt'
import { loadSavedArticles, toggleSavedArticle, removeSavedArticle, savedKey, SAVED_MAX } from '../../services/savedArticles'

// MaddenAI's nudge on a HIGH-impact story that names a watchlist stock. At
// most one NEW story every 30 minutes: the story already being offered stays
// until dismissed, but a fresh one has to wait out the window.
const NEWS_NUDGE_KEY = 'maddex_news_prompt_last'
const NEWS_NUDGE_GAP = 30 * 60_000
const readNudge = () => { try { return JSON.parse(localStorage.getItem(NEWS_NUDGE_KEY) ?? 'null') } catch { return null } }
const nudgeId = (a) => a.id ?? a.headline
function recordNudge(id) {
  try { localStorage.setItem(NEWS_NUDGE_KEY, JSON.stringify({ id, at: Date.now() })) } catch { /* private mode */ }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const READ_KEY     = 'madden_news_read_v1'
const CAT_KEY      = 'madden_news_category_v1'
const MAX_ARTICLES = 500
// 15 minutes, matching the RSS proxy's edge cache (s-maxage=900 in
// api/rss.js). At the previous five minutes, two of every three refetches
// asked eighteen publishers for data the proxy would serve from cache
// unchanged — three times the requests for the same headlines.
const REFRESH_MS   = 15 * 60_000
const PULSE_MS      = 30_000

const BREAKING_RE = /rate (cut|hike)|crash|collapse|record (high|low)|emergency|crisis|\bwar\b|sanction|default|bankruptcy|merger|acquisition|\bIPO\b|surge/i

// Category tint. There used to be a parallel TAG_VARIANTS map of Tailwind
// <Badge> variants for the same categories, used only by the top story card —
// so one category had two colour definitions that had to be kept in step by
// hand. The card now uses these hexes like every other surface in the module.
const TAG_COLOR = {
  MACRO: '#C9A84C', AU: '#C9A84C', EQUITY: '#2D7DD2', ENERGY: '#a83232', FX: '#8BA3C4',
  CRYPTO: '#2D8A50', RATES: '#8BA3C4', 'M&A': '#C9A84C', INTL: '#2D7DD2', EARNINGS: '#a83232', TECH: '#2D7DD2',
}

// ─── Persistence helpers ───────────────────────────────────────────────────────

function loadReadSet() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')) } catch { return new Set() }
}
function saveReadSet(set) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-500))) } catch { /* quota, private mode, or blocked site data — persistence is best-effort */ }
}
function loadCategory() {
  try { return localStorage.getItem(CAT_KEY) ?? 'ALL' } catch { return 'ALL' }
}
function saveCategory(cat) {
  try { localStorage.setItem(CAT_KEY, cat) } catch { /* quota, private mode, or blocked site data — persistence is best-effort */ }
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

// The news feed had its own relative-time function, still live behind a local
// `timeAgo` that shadowed the shared import. It said "yesterday" where every
// other surface in the terminal says "1d ago" — so a story and the
// notification about that same story disagreed about when it happened.
//
// "1d ago" wins over "yesterday" for the same reason the rest of the scale is
// compact: these render in dense rows beside a source name and a headline,
// where a fixed-width "1d ago" scans and a variable-width word does not.
const timeAgo = (pubDate) => sharedTimeAgo(pubDate) ?? '—'

// Synthetic "EARNINGS RESULT" article built from a completed AI Earnings
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

// THERE WAS A SECOND IMPACT SCALE HERE, AND IT DISAGREED WITH THE FIRST.
//
// `storyImpactTier` graded HIGH/MEDIUM/LOW from the tag and ticker count;
// `impactOf` in newsIntelligence grades HIGH/MED/LOW from headline keywords.
// Both rendered on the top story card at once — the dot from one, the pill
// from the other — so the same article could read "● LOW" beside
// "HIGH IMPACT". Deleted in favour of `impactOf`, which is the one the rest of
// the feed already uses and the one whose tooltip explains what it is.

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
  { key: 'COMPANIES',    label: 'COMPANIES',    test: (n) => n.tickers?.length > 0 },
]

// ─── Topics, for TRENDING TOPICS ─────────────────────────────────────────────
//
// Counted as ARTICLES that mention the topic (headline or summary), not word
// occurrences — "RBA · 12" means twelve stories. A fixed list of the subjects
// an Australian investor tracks, plus any company the feed's own matcher
// detected. Clicking one filters the feed by the same pattern that counted it.
const TOPICS = [
  ['RBA',       /\bRBA\b|reserve bank/i],
  ['Rates',     /interest rates?|cash rate|rate (rise|hike|cut)s?/i],
  ['Inflation', /inflation|\bCPI\b/i],
  ['Iron ore',  /iron ore/i],
  ['Banks',     /\bbanks?\b|westpac|\bNAB\b|\bANZ\b|commonwealth bank/i],
  ['Housing',   /housing|property|home loans?|mortgage/i],
  ['Oil',       /\boil\b|crude|brent|opec/i],
  ['China',     /china|beijing|chinese/i],
  ['Fed',       /\bfed\b|federal reserve|powell/i],
  ['Crypto',    /bitcoin|crypto|ethereum/i],
  ['AI',        /\bAI\b|artificial intelligence|nvidia/i],
  ['Gold',      /\bgold\b/i],
  ['Jobs',      /unemployment|jobs|labour market|wages/i],
  ['Tariffs',   /tariffs?|trade war/i],
  ['Earnings',  /\bprofit|earnings|results|guidance/i],
]
const topicText = (a) => `${a.headline} ${a.summary ?? ''}`

function trendingTopics(items) {
  const rows = TOPICS.map(([label, re]) => ({ key: label, label, test: (a) => re.test(topicText(a)) }))
  const companies = new Map()
  for (const a of items) for (const c of a.companies ?? []) companies.set(c.ticker, (companies.get(c.ticker) ?? 0) + 1)
  for (const [ticker] of companies) {
    const bare = ticker.replace(/\.AX$/, '')
    rows.push({ key: `co:${ticker}`, label: bare, test: (a) => (a.companies ?? []).some((c) => c.ticker === ticker) })
  }
  return rows
    .map((r) => ({ ...r, count: items.filter(r.test).length }))
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

// Sydney calendar day of an article, for the TODAY filter.
const sydneyDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const TIME_FILTERS = [['ALL', 'ALL TIME'], ['TODAY', 'TODAY'], ['WEEK', 'THIS WEEK']]

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

const SOURCE_PALETTE = ['#C9A84C', '#2D7DD2', '#2D8A50', '#a855f7', '#f97316', '#14b8a6', '#e84142', '#0ea5e9']
// Named-source brand colours per spec — hash palette is only a fallback for
// the long tail of RSS sources that aren't one of these six.
const SOURCE_COLORS = {
  Reuters: '#2D7DD2', AFR: '#C9A84C', Bloomberg: '#a855f7',
  ABC: '#2D8A50', FT: '#ec4899', WSJ: '#8BA3C4',
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

// ─── Sentiment aggregation ────────────────────────────────────────────────────
//
// Reuses the per-article `.sentiment` set by inferSentiment() in api.js, but
// no longer counts every headline the same. A HIGH-impact story (impactOf)
// weighs 3, MED 2, LOW 1, and each halves in weight every six hours — so this
// morning's RBA story moves the bar and last night's minor wrap barely does.
//
// The trend compares the same calculation as it would have read two hours ago:
// only the articles published by then, aged to then. Both reads come from the
// feed on screen; nothing is stored between sessions.
const IMPACT_WEIGHT = { HIGH: 3, MED: 2, LOW: 1 }
const HALF_LIFE_H = 6
const TREND_LOOKBACK_MS = 2 * 3_600_000

function weightedSentiment(items, at) {
  let bull = 0, bear = 0, neutral = 0, n = 0
  for (const item of items) {
    if (!item.pubDate || item.pubDate > at) continue
    const ageH = (at - item.pubDate) / 3_600_000
    const w = (IMPACT_WEIGHT[impactOf(`${item.headline} ${item.summary ?? ''}`).level] ?? 1) * 0.5 ** (ageH / HALF_LIFE_H)
    if (item.sentiment === 'BULLISH') bull += w
    else if (item.sentiment === 'BEARISH') bear += w
    else neutral += w
    n++
  }
  const total = bull + bear + neutral
  return { bull, bear, neutral, total, n, net: total ? (bull - bear) / total : 0 }
}

function overallSentiment(items, now) {
  const cur = weightedSentiment(items, now)
  const prev = weightedSentiment(items, now - TREND_LOOKBACK_MS)
  const t = cur.total || 1
  const bullPct = Math.round((cur.bull / t) * 100)
  const bearPct = Math.round((cur.bear / t) * 100)
  const neutralPct = Math.max(0, 100 - bullPct - bearPct)
  // A trend needs enough earlier stories to compare against.
  const delta = cur.net - prev.net
  const trend = prev.n < 10 ? null : delta > 0.03 ? 'improving' : delta < -0.03 ? 'declining' : 'steady'
  return {
    bullPct, bearPct, neutralPct,
    total: cur.n,
    trend,
    label: bullPct >= bearPct && bullPct >= neutralPct ? 'BULLISH' : bearPct >= bullPct && bearPct >= neutralPct ? 'BEARISH' : 'NEUTRAL',
  }
}

// ─── Mock sparkline data — deterministic per-symbol synthetic 5D history,
// seeded so it's stable within a page load. mockData.js only carries current
// snapshot fields (price/changePct), not history arrays, so the trend line
// is generated here: it walks from an implied start price to the current
// price (consistent with changePct) with small seeded noise along the way. ──

function strSeed(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}
function seededRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
function generateSparkline(seedKey, currentPrice, changePct, points = 8) {
  const rand = seededRandom(strSeed(seedKey))
  const startPrice = currentPrice / (1 + changePct / 100)
  const vals = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    const trend = startPrice + (currentPrice - startPrice) * t
    const noise = (rand() - 0.5) * Math.abs(currentPrice) * 0.015
    vals.push(trend + noise)
  }
  vals[points - 1] = currentPrice
  return vals
}

function MiniSparkline({ values, up, width = 80, height = 36 }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ')
  const color = up ? '#C9A84C' : '#a83232'
  return (
    <svg width={width} height={height} style={{ flexShrink: 0, display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

// ─── Story → tracked-asset resolver — detects whether a headline mentions a
// symbol the app tracks (BHP/CBA/BTC/XRP/ASX 200 etc.) so the top story and
// market-impact row can show real (mock) price context, not just a badge. ──

const STORY_ASSET_CANDIDATES = [
  { keys: ['BHP'],                        source: 'asx',   symbol: 'BHP.AX', label: 'BHP' },
  { keys: ['CBA'],                        source: 'asx',   symbol: 'CBA.AX', label: 'CBA' },
  { keys: ['CSL'],                        source: 'asx',   symbol: 'CSL.AX', label: 'CSL' },
  { keys: ['RIO'],                        source: 'asx',   symbol: 'RIO.AX', label: 'RIO' },
  { keys: ['FMG', 'FORTESCUE'],           source: 'asx',   symbol: 'FMG.AX', label: 'FMG' },
  { keys: ['NEM', 'NEWCREST'],            source: 'asx',   symbol: 'NEM.AX', label: 'NEM' },
  { keys: ['STO', 'SANTOS'],              source: 'asx',   symbol: 'STO.AX', label: 'STO' },
  { keys: ['WDS', 'WOODSIDE'],            source: 'asx',   symbol: 'WDS.AX', label: 'WDS' },
  { keys: ['BTC', 'BITCOIN'],             source: 'crypto', id: 'bitcoin',  label: 'BTC' },
  { keys: ['ETH', 'ETHEREUM'],            source: 'crypto', id: 'ethereum', label: 'ETH' },
  { keys: ['XRP', 'RIPPLE'],              source: 'crypto', id: 'ripple',   label: 'XRP' },
  { keys: ['SOL', 'SOLANA'],              source: 'crypto', id: 'solana',   label: 'SOL' },
  { keys: ['ASX 200', 'ASX200', '^AXJO'], source: 'index',  symbol: '^AXJO', label: 'ASX 200' },
]

function resolveStoryAsset(item) {
  if (!item) return null
  const tickers = item.tickers ?? []
  const text = `${item.headline} ${item.summary ?? ''}`.toUpperCase()
  for (const cand of STORY_ASSET_CANDIDATES) {
    const hit = cand.keys.some(k => tickers.includes(k) || text.includes(k))
    if (!hit) continue
    let entry, price, changePct
    if (cand.source === 'asx') {
      entry = MOCK_ASX_STOCKS[cand.symbol]
      if (!entry) continue
      price = entry.price; changePct = entry.changePct
    } else if (cand.source === 'index') {
      entry = MOCK_INDICES[cand.symbol]
      if (!entry) continue
      price = entry.price; changePct = entry.changePct
    } else {
      entry = MOCK_CRYPTO.find(c => c.id === cand.id)
      if (!entry) continue
      price = entry.current_price; changePct = entry.price_change_percentage_24h
    }
    return {
      label: cand.label,
      price, changePct,
      up: changePct >= 0,
      values: generateSparkline(cand.label, price, changePct),
    }
  }
  return null
}

// Fixed representative set for the MARKET IMPACT row — mock data per spec
// ("use mock data from mockData.js"), a mix of ASX/index/crypto so the row
// reads as a market snapshot rather than a single-asset callout.
function marketImpactAssets() {
  const picks = [
    { label: 'BHP',     entry: MOCK_ASX_STOCKS['BHP.AX'] },
    { label: 'CBA',     entry: MOCK_ASX_STOCKS['CBA.AX'] },
    { label: 'ASX 200', entry: MOCK_INDICES['^AXJO'] },
    { label: 'BTC',     entry: MOCK_CRYPTO.find(c => c.id === 'bitcoin') },
    { label: 'XRP',     entry: MOCK_CRYPTO.find(c => c.id === 'ripple') },
  ]
  return picks.map(p => {
    const changePct = p.entry.changePct ?? p.entry.price_change_percentage_24h ?? 0
    const price = p.entry.price ?? p.entry.current_price ?? 0
    return { label: p.label, changePct, price }
  })
}

// Best-matching current headline for a given asset label, used by the
// sidebar so each mover shows *why* it's moving, not just the number.
function headlineForAsset(items, label) {
  const needle = label.replace(' 200', '').toUpperCase()
  const hit = items.find(i => (i.tickers ?? []).includes(needle) || i.headline.toUpperCase().includes(needle))
  return hit?.headline ?? null
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

// ─── TOP STORY — full-width card, with a mini sparkline (top-right) when the
// headline mentions a tracked asset ──────────────────────────────────────────

function TopStoryCard({ item, rank = 1, isUnread, searchTerm, isPulsing, onMarkRead, onAskAI, onOpenTicker, isSaved, onToggleSave, onOpen }) {
  const isNew      = isNewArticle(item)
  const isBreaking = isBreakingArticle(item)
  const asset      = useMemo(() => resolveStoryAsset(item), [item])
  const impact     = item.impact ?? { level: 'LOW', colour: '#4A6080' }

  return (
    <div
      className={`news-top-story ${isPulsing ? 'news-pulse' : ''} bg-terminal-surface transition-colors`}
      style={{
        borderLeft: `3px solid ${isBreaking ? '#a83232' : '#C9A84C'}`,
        background: 'rgba(201,168,76,0.04)',
        padding: 16,
        marginBottom: 1,
      }}
    >
      {/* Header row — what this is, where it came from, and when. */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span
          className="font-mono font-bold tracking-widest flex-shrink-0"
          style={{ fontSize: 8, color: '#C9A84C', background: 'rgba(201,168,76,0.12)', padding: '2px 6px', borderRadius: 2 }}
        >{rank === 1 ? 'TOP STORY' : rank}</span>
        <span
          className="font-mono font-bold tracking-wider flex-shrink-0"
          style={{
            fontSize: 8, padding: '2px 6px', borderRadius: 2,
            color: TAG_COLOR[item.tag] ?? '#8BA3C4',
            background: `${TAG_COLOR[item.tag] ?? '#8BA3C4'}22`,
          }}
        >{primaryDisplayCategory(item)}</span>
        <span
          className="rounded-full flex-shrink-0"
          style={{ width: 6, height: 6, background: sourceColor(item.source) }}
          title={item.source}
        />
        <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{item.source}</span>
        {isBreaking && <span className="font-mono font-bold text-[#a83232]" style={{ fontSize: 9 }}>● BREAKING</span>}
        {isNew && !isBreaking && <span className="font-mono font-bold text-terminal-gold" style={{ fontSize: 9 }}>NEW</span>}
        {/* The watchlist marker has to live here too. Stories touching the
            user's holdings are promoted to the top of the feed, which means
            the one story most likely to carry the badge is the one rendered by
            this card rather than by StoryRow. */}
        {item.inWatchlist && (
          <span
            className="font-mono tracking-widest text-terminal-gold flex-shrink-0"
            style={{ fontSize: 8 }}
            title="You hold or track one of the companies in this story"
          >IN YOUR WATCHLIST</span>
        )}
        <span className="font-mono text-terminal-text-dim/60 ml-auto flex-shrink-0" style={{ fontSize: 9 }}>
          {timeAgo(item.pubDate)}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="font-semibold text-terminal-text-bright line-clamp-3 cursor-pointer hover:text-terminal-gold transition-colors"
            style={{ fontSize: 16, lineHeight: 1.35 }}
            onClick={() => onOpen?.(item)}
            title="Open in the article panel"
          >
            {isUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-gold mr-1.5" />}
            <HighlightText text={item.headline} term={searchTerm} />
          </p>
          {item.summary && (
            <p
              className="text-terminal-text-dim line-clamp-3 mt-1.5"
              style={{ fontSize: 11, lineHeight: 1.6, color: '#8BA3C4' }}
            >{item.summary}</p>
          )}
        </div>
        {asset && (
          <div className="flex-shrink-0 text-right">
            <MiniSparkline values={asset.values} up={asset.up} width={60} height={30} />
            <div className={`text-[9px] font-mono ${asset.up ? 'pos' : 'neg'}`}>{asset.label} {asset.up ? '+' : ''}{asset.changePct.toFixed(2)}%</div>
          </div>
        )}
      </div>

      {/* Companies named in the story. */}
      {(item.companies?.length || knownTickerBadges(item.tickers).length > 0) && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {item.companies?.length
            ? <CompanyPills companies={item.companies} onOpenTicker={onOpenTicker} />
            : <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-3 pt-2" style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
        <span
          className="font-mono font-bold flex-shrink-0"
          style={{ fontSize: 8, letterSpacing: '0.08em', color: impact.colour }}
          title={`${impact.level} — estimated from keywords in the headline, not a market forecast`}
        >● {impact.level}</span>

        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onMarkRead(item)}
            className="text-2xs font-bold tracking-wide text-terminal-blue-bright border border-terminal-blue-bright/30 rounded-full hover:bg-terminal-blue-bright hover:text-terminal-bg transition-colors px-3 py-1 ml-auto"
          >READ →</a>
        )}
        <button
          onClick={() => onAskAI(item)}
          className={`text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/40 rounded-full hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-3 py-1 ${item.link ? '' : 'ml-auto'}`}
        >ASK MADDENAI ▶</button>
        <SaveButton saved={isSaved} onClick={() => onToggleSave(item)} />
      </div>
    </div>
  )
}

// ─── STORY ROW — plain list row (48px), click expands an inline accordion
// with the 2-line summary + Read/Ask actions; only one row open at a time. ──

// Impact is a keyword heuristic, and the tooltip says so. A badge that reads
// as a market call rather than as a word-count would be acted on.
function ImpactDot({ impact }) {
  if (!impact) return null
  return (
    <span
      className="flex items-center gap-0.5 flex-shrink-0"
      title={`${impact.level} — estimated from keywords in the headline, not a market forecast`}
      style={{ color: impact.colour }}
    >
      <span style={{ fontSize: 7 }}>●</span>
      <span style={{ fontSize: 8, letterSpacing: '0.08em' }}>{impact.level}</span>
    </span>
  )
}

// Companies named in the story, from newsIntelligence's alias matching. Shows
// what was matched on hover, so a wrong match is diagnosable rather than
// mysterious.
function CompanyPills({ companies, onOpenTicker }) {
  if (!companies?.length) return null
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {companies.slice(0, 3).map((c) => (
        <button
          key={c.ticker}
          onClick={(e) => { e.stopPropagation(); onOpenTicker({ symbol: c.ticker, label: c.ticker.replace('.AX', '') }) }}
          title={`Matched on "${c.matched}" — open ${c.ticker}`}
          className="text-2xs px-1 border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >{c.ticker.replace('.AX', '')}</button>
      ))}
    </div>
  )
}

// A cluster of related stories: the lead rendered in full, the rest collapsed
// behind a count. Single-story clusters render as a bare row, so the feed only
// grows chrome where there is actually something to group.
function StoryCluster({ cluster, savedKeys, onToggleSave, ...rowProps }) {
  const [open, setOpen] = useState(false)
  const row = (it, extra = {}) => (
    <StoryRow item={it} {...rowProps} {...extra} isSaved={savedKeys.has(savedKey(it))} onToggleSave={onToggleSave} />
  )
  if (cluster.count <= 1) return row(cluster.lead)
  const more = cluster.count - 1

  return (
    <div className="border-b border-terminal-border">
      <div className="w-full flex items-center gap-2 px-3 py-1 bg-terminal-gold/5">
        <span className="text-[8px] font-mono tracking-widest text-terminal-gold/80 truncate">
          {cluster.label}
        </span>
        <span className="text-[8px] font-mono text-terminal-text-dim flex-shrink-0">
          ({cluster.count} stories)
        </span>
      </div>
      {row(cluster.lead)}
      {open && cluster.items.slice(1).map((it) => (
        <div key={it.id ?? it.link} className="pl-3 border-l-2 border-terminal-gold/20">
          {row(it)}
        </div>
      ))}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-3 py-1 font-mono text-[9px] tracking-widest text-terminal-gold/80 hover:text-terminal-gold hover:bg-terminal-gold/5 transition-colors"
      >{open ? '− SHOW LESS' : `+${more} MORE`}</button>
    </div>
  )
}

// 🔖 save for later — on the top story, every row and its expanded panel.
function SaveButton({ saved, onClick, compact = false }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      aria-pressed={saved}
      title={saved ? 'Saved — click to remove from your reading list' : `Save to read later (keeps up to ${SAVED_MAX})`}
      className={compact
        ? `text-[11px] leading-none flex-shrink-0 transition-opacity ${saved ? 'opacity-100' : 'opacity-30 hover:opacity-90'}`
        : `text-2xs font-bold tracking-wide border rounded-full px-3 py-1 transition-colors ${saved ? 'border-terminal-gold bg-terminal-gold/15 text-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'}`}
    >{compact ? '🔖' : saved ? '🔖 SAVED' : '🔖 SAVE'}</button>
  )
}

// The SAVED tab: copies of saved stories, newest save first.
function SavedArticles({ items, searchTerm, onRemove, onAskAI }) {
  const lc = searchTerm.toLowerCase()
  const shown = lc ? items.filter((a) => `${a.headline} ${a.summary ?? ''}`.toLowerCase().includes(lc)) : items
  if (!items.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-center p-6">
        <span className="text-2xl" aria-hidden="true">🔖</span>
        <div className="text-xs text-terminal-text-bright font-semibold">Nothing saved yet</div>
        <div className="text-2xs text-terminal-text-dim">Press 🔖 on any story to keep it here for later — up to {SAVED_MAX}.</div>
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-1.5 border-b border-terminal-border text-[9px] font-mono tracking-widest text-terminal-text-dim">
        {items.length} / {SAVED_MAX} SAVED{lc ? ` · ${shown.length} matching` : ''}
      </div>
      {shown.map((a) => (
        <div key={savedKey(a)} className="flex items-start gap-3 px-3 py-2.5 border-b border-terminal-border">
          <SourceCircle source={a.source} size={14} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-terminal-text-bright leading-snug"><HighlightText text={a.headline} term={searchTerm} /></p>
            {a.summary && <p className="text-2xs text-terminal-text-dim mt-1 line-clamp-2"><HighlightText text={a.summary} term={searchTerm} /></p>}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[9px] font-mono text-terminal-text-dim">{a.source} · {timeAgo(a.pubDate)} · saved {timeAgo(a.savedAt)}</span>
              {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-2xs text-terminal-blue-bright hover:text-terminal-gold">READ →</a>}
              <button onClick={() => onAskAI(a)} className="text-2xs text-terminal-gold hover:text-terminal-gold-bright">ASK MADDENAI ▶</button>
              <button onClick={() => onRemove(a)} className="text-2xs font-bold tracking-wide text-terminal-text-dim hover:text-terminal-green ml-auto">✓ MARK AS READ</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// One line per story, 40px: source dot and name, headline, age. Hovering
// reveals the summary and the actions beneath it; clicking opens the article
// panel. Memoised because the module re-renders every second for its clocks,
// and the handlers it receives are stable (useCallback).
const StoryRow = memo(function StoryRow({ item, isUnread, isPulsing, onOpen, onOpenTicker, onAskAI, searchTerm = '', isSaved = false, onToggleSave }) {
  const isBreaking = isBreakingArticle(item)
  const isNew = isNewArticle(item)
  return (
    <div
      className={`news-row group border-b border-terminal-border cursor-pointer hover:bg-terminal-surface2 transition-colors ${isPulsing ? 'news-pulse' : ''}`}
      style={item.inWatchlist ? { borderLeft: '3px solid #C9A84C', background: 'rgba(201,168,76,0.04)' } : { borderLeft: '3px solid transparent' }}
      onClick={() => onOpen(item)}
    >
      <div className="flex items-center gap-2 px-3" style={{ height: 40 }}>
        <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: sourceColor(item.source) }} />
        <span className="font-mono font-bold flex-shrink-0 truncate" style={{ fontSize: 9, width: 92, color: sourceColor(item.source), letterSpacing: '0.04em' }} title={item.source}>
          {item.source.toUpperCase()}
        </span>
        <span className="flex-1 min-w-0 truncate text-terminal-text-bright" style={{ fontSize: 12 }}>
          {isUnread && <span className="inline-block w-1 h-1 rounded-full bg-terminal-gold mr-1.5 align-middle" />}
          {isBreaking && <span className="text-[#a83232] font-bold mr-1">●</span>}
          <HighlightText text={item.headline} term={searchTerm} />
          {isNew && !isBreaking && <span className="text-terminal-gold font-bold ml-1.5 text-[9px]">NEW</span>}
        </span>
        {item.inWatchlist && <span className="font-mono text-terminal-gold flex-shrink-0" style={{ fontSize: 8 }} title="Mentions a stock on your watchlist">★</span>}
        <span className="font-mono text-terminal-text-dim/70 flex-shrink-0 tabular-nums" style={{ fontSize: 9 }}>{timeAgo(item.pubDate)}</span>
      </div>
      {/* Hover reveal — summary and actions. Hidden on touch, where the tap
          opens the article panel instead. */}
      <div className="hidden group-hover:block px-3 pb-2.5" style={{ paddingLeft: 27 }}>
        {item.summary && <p className="text-terminal-text-dim line-clamp-2" style={{ fontSize: 11, lineHeight: 1.55 }}><HighlightText text={item.summary} term={searchTerm} /></p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="px-1 rounded-full leading-none py-0.5" style={{ fontSize: 8, background: `${TAG_COLOR[item.tag] ?? '#8BA3C4'}22`, color: TAG_COLOR[item.tag] ?? '#8BA3C4' }}>{primaryDisplayCategory(item)}</span>
          <ImpactDot impact={item.impact} />
          {item.companies?.length
            ? <CompanyPills companies={item.companies} onOpenTicker={onOpenTicker} />
            : <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />}
          <span className="ml-auto flex items-center gap-2">
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-2xs text-terminal-blue-bright hover:text-terminal-gold transition-colors">READ →</a>
            )}
            <button onClick={(e) => { e.stopPropagation(); onAskAI(item) }} className="text-2xs font-bold text-terminal-gold hover:underline">ASK MADDENAI ▶</button>
            {onToggleSave && <SaveButton compact saved={isSaved} onClick={() => onToggleSave(item)} />}
          </span>
        </div>
      </div>
    </div>
  )
})

// ─── RIGHT SIDEBAR — trending movers, topic word-cloud, breaking feed ───────

function MovingOnNews({ items }) {
  const assets = useMemo(() => marketImpactAssets(), [])
  const maxAbs = Math.max(...assets.map(a => Math.abs(a.changePct)), 0.1)
  return (
    <div className="px-3 py-2 border-b border-terminal-border">
      <div className="text-[9px] font-mono tracking-widest text-terminal-text-dim/60 uppercase mb-1.5">MOVING ON NEWS</div>
      <div className="flex flex-col gap-2">
        {assets.slice(0, 5).map(a => {
          const up = a.changePct >= 0
          const headline = headlineForAsset(items, a.label)
          return (
            <div key={a.label}>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-terminal-gold font-bold">{a.label}</span>
                <span className={up ? 'pos' : 'neg'}>{up ? '+' : ''}{a.changePct.toFixed(2)}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden mt-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${(Math.abs(a.changePct) / maxAbs) * 100}%`, height: '100%', background: up ? '#3aaa63' : '#a83232' }} />
              </div>
              {headline && (
                <div className="text-[9px] text-terminal-text-dim/70 leading-snug truncate mt-0.5">{headline}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Defensive plain-text rendering for the brief. The prompt asks for no
// markdown, but briefs are cached per day in localStorage, so any already
// stored with #/**/--- would keep rendering their syntax literally. Strips
// the syntax and promotes **bold** to <strong> rather than showing asterisks.
function renderBriefParagraphs(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*#{1,6}\s*/, '').trim())
    .filter((line) => line && !/^([-*_]\s*){3,}$/.test(line))
    .map((line, i) => (
      <p key={i} className="mb-2 last:mb-0">
        {line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
          j % 2 === 1
            ? <strong key={j} className="text-terminal-text-bright">{part}</strong>
            : part,
        )}
      </p>
    ))
}

// ─── Morning briefing — MaddenAI-generated, cached once per calendar day ──────

function briefKey(date) { return `maddex_morning_brief_${date}` }

function MorningBriefing() {
  const today = todayAEST()
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(briefKey(today)) ?? '' } catch { return '' }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Collapsed by default since the three-column redesign: open, the brief
  // filled most of the screen and pushed the feed below the fold. The reader's
  // choice is remembered.
  const [expanded, setExpandedRaw] = useState(() => { try { return localStorage.getItem('maddex_news_brief_open') === '1' } catch { return false } })
  const setExpanded = (fn) => setExpandedRaw((v) => {
    const next = typeof fn === 'function' ? fn(v) : fn
    try { localStorage.setItem('maddex_news_brief_open', next ? '1' : '0') } catch { /* private mode */ }
    return next
  })

  // The prompt is built from gathered data, never from the instruction to be
  // "specific" that this used to carry. See services/briefContext.js for why
  // — in short, the previous version supplied no figures at all and the model
  // filled the gap with plausible ones.
  const generate = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const ctx = await gatherBriefContext()
      const { text: result } = await askClaude([{ role: 'user', content: buildNewsBriefPrompt(ctx) }], null, {
        systemPrompt:
          'You are MaddenAI, the financial intelligence analyst embedded in the Maddex terminal. ' +
          'This panel renders plain text only — never use markdown. No #/## headings, no **bold**, ' +
          'no --- rules, no bullet syntax. Write flowing prose paragraphs separated by blank lines. ' +
          'You never state a financial figure that was not supplied to you in the user message. '
          + 'If you have no figure for a market, you omit that market rather than describing it.',
      })
      setText(result)
      try { localStorage.setItem(briefKey(today), result) } catch { /* best-effort cache write */ }
    } catch (e) {
      setError(e.message || 'Failed to generate briefing')
    } finally {
      setLoading(false)
    }
  }, [today])

  // Generated when the panel is opened, not when the News module is: the
  // panel is collapsed by default, and generating a brief nobody expanded was
  // one paid completion per reader per day for nothing.
  useEffect(() => {
    if (expanded && !text && !loading && !error) {
      const t = setTimeout(generate, 0)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v) }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-terminal-accent/10 transition-colors cursor-pointer"
      >
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">MORNING BRIEF</span>
        <span className="text-2xs text-terminal-text-dim">{today}</span>
        {/* Not a LIVE badge. The figures inside are live; the prose around
            them is written by a model, and conflating the two is what let
            invented numbers read as a feed. AIContentBadge already exists for
            exactly this distinction, so it is reused with a label naming both
            halves rather than a fourth badge being added beside it. */}
        <AIContentBadge source="live" label="AI SUMMARY · LIVE DATA" />
        {loading && <span className="text-2xs text-terminal-text-dim animate-pulse">generating…</span>}
        <button
          onClick={(e) => { e.stopPropagation(); generate() }}
          title="Regenerate"
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold ml-1"
        >↻</button>
        {!expanded && text && (
          <span className="text-2xs text-terminal-text-dim truncate min-w-0 flex-1" style={{ maxWidth: '60%' }}>{text.replace(/[#*]/g, '').split(/(?<=\.)\s/).slice(1, 2).join(' ') || text.slice(0, 140)}</span>
        )}
        <span className="ml-auto text-terminal-text-dim text-2xs">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-terminal-text leading-relaxed panel-fade">
          {error ? (
            <div className="text-terminal-red text-2xs">⚠ {error} — <button onClick={generate} className="underline hover:text-terminal-gold">retry</button></div>
          ) : text ? (
            <>
              {renderBriefParagraphs(text)}
              {/* Always rendered with the brief, never conditional. A
                  disclaimer that appears only sometimes teaches the reader to
                  stop looking for it. */}
              <div
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 9,
                  color: '#4A6080',
                  letterSpacing: '0.1em',
                  padding: '8px 0 0',
                  borderTop: '1px solid rgba(201,168,76,0.08)',
                  marginTop: 8,
                }}
              >
                ⓘ AI-GENERATED SUMMARY · FIGURES FROM LIVE DATA ONLY · GENERAL INFORMATION · NOT ADVICE
              </div>
            </>
          ) : (
            <div className="text-terminal-text-dim text-2xs animate-pulse">MaddenAI is drafting today's briefing…</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SESSION CONTEXT — one line on what markets are doing right now ────────
//
// Built from the clock, the ASX 200 quote (DEMO-labelled when it is) and the
// calendar. The after-hours / overnight split follows whether the NYSE is
// actually trading, not a fixed 10pm, so it stays right across both
// daylight-saving changes.
function nyseState(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now).map((x) => [x.type, x.value]))
  const mins = (Number(p.hour) % 24) * 60 + Number(p.minute)
  const wk = !['Sat', 'Sun'].includes(p.weekday)
  const OPEN = 9 * 60 + 30, CLOSE = 16 * 60
  if (wk && mins >= OPEN && mins < CLOSE) return { open: true }
  // Minutes to the next 9:30 ET open.
  const DAY = 1440
  let to = mins < OPEN && wk ? OPEN - mins : DAY - mins + OPEN
  if (p.weekday === 'Fri' && mins >= OPEN) to += 2 * DAY
  if (p.weekday === 'Sat') to += DAY
  return { open: false, minsToOpen: to }
}
const gap = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

function SessionContext({ nowTs, session, watchlistCount }) {
  const { data: idx } = useQuery({ queryKey: ['pulse', 'axjo'], queryFn: () => fetchIndexQuotesUnified(['^AXJO']), staleTime: 60_000, refetchInterval: 60_000, retry: 1 })
  const { data: cal } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 3_600_000 })
  const asx = idx?.data?.['^AXJO']?.pct
  const asxText = asx != null ? `ASX ${asx >= 0 ? '+' : ''}${asx.toFixed(1)}%${USING_MOCK_DATA ? ' (demo)' : ''}` : null
  const now = new Date(nowTs)
  const today = sydneyDay(nowTs)
  const nextToday = pendingEvents(cal?.events ?? [], 1, nowTs).find((e) => e.date === today && e.importance === 'high')
  const ny = nyseState(now)

  let label, parts, colour = session.colour
  if (session.key === 'pre') {
    label = 'PRE-MARKET'; parts = [session.detail, nextToday && `${nextToday.event}${/^\d/.test(nextToday.time ?? '') ? ` ${nextToday.time} ${sydneyTzAbbr(today)}` : ''}`]
  } else if (session.key === 'open') {
    label = '● MARKET OPEN'; parts = [session.detail, asxText]
  } else if (ny.open) {
    label = 'OVERNIGHT'; colour = '#7C6BC4'; parts = ['US markets active', `Next: ASX opens in ${session.detail.replace(/^(ASX )?opens in /i, '')}`]
  } else if (session.key === 'weekend') {
    label = 'WEEKEND'; parts = [session.detail]
  } else {
    label = 'AFTER HOURS'; parts = [asxText ? `ASX closed ${asxText.replace(/^ASX /, '')}` : 'ASX closed', `US markets open in ${gap(ny.minsToOpen)}`]
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 border-b flex-shrink-0" style={{ borderColor: `${colour}44`, background: `${colour}0F` }}>
      <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: colour }}>{label}</span>
      {parts.filter(Boolean).map((t) => (
        <span key={t} className="text-[9px] font-mono text-terminal-text-dim">· {t}</span>
      ))}
      {watchlistCount > 0 && (
        <span className="text-[9px] font-mono text-terminal-gold ml-auto">{watchlistCount} {watchlistCount === 1 ? 'story' : 'stories'} on your watchlist</span>
      )}
    </div>
  )
}

// ─── TOOLBAR — the MaddenAI news brief, and the feed's live status ──────────
//
// "Refreshing in" reports react-query's refetchInterval rather than driving
// it, so the two cannot drift. The "✓ N NEW" flash reads the arrival time the
// merge effect already records.
function NewsToolbar({ isLive, isFetching, articleCount, sourcesOk, sourcesTotal, lastUpdatedAt, nowTs, onRefresh, newCount, lastArrivalAt, onBrief }) {
  const since = lastUpdatedAt == null ? null : nowTs - lastUpdatedAt
  const secsLeft = since == null ? null : Math.max(0, Math.round((REFRESH_MS - since) / 1000))
  const countdown = secsLeft == null ? '—' : secsLeft >= 60 ? `${Math.floor(secsLeft / 60)}m ${String(secsLeft % 60).padStart(2, '0')}s` : `${secsLeft}s`
  const flash = lastArrivalAt != null && nowTs - lastArrivalAt < 5000 && newCount > 0
  return (
    <div className="flex items-center gap-3 px-3 border-b border-terminal-border flex-shrink-0 flex-wrap" style={{ minHeight: 34, background: 'rgba(201,168,76,0.025)' }}>
      <button
        onClick={onBrief}
        className="font-mono font-bold tracking-wider text-terminal-gold border border-terminal-gold/50 hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-2.5 py-1"
        style={{ fontSize: 9 }}
        title="A three-paragraph briefing on today's top stories, from the headlines on screen"
      >ASK MADDENAI ABOUT TODAY&apos;S NEWS ▶</button>
      <span className="group flex items-center gap-2 ml-auto font-mono" style={{ fontSize: 9 }}>
        {isFetching ? (
          <span className="text-terminal-gold animate-pulse">↻ CHECKING FOR NEW ARTICLES…</span>
        ) : flash ? (
          <span className="text-terminal-green font-bold panel-fade">✓ {newCount} NEW ARTICLE{newCount === 1 ? '' : 'S'}</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className={`rounded-full ${isLive ? 'animate-pulse' : ''}`} style={{ width: 6, height: 6, background: isLive ? '#2D8A50' : '#a83232' }} />
              <span className="font-bold tracking-widest" style={{ color: isLive ? '#2D8A50' : '#a83232' }}>{isLive ? 'LIVE' : 'OFFLINE'}</span>
            </span>
            <span className="text-terminal-text-dim">
              · {articleCount} articles · {sourcesOk}/{sourcesTotal} sources{lastUpdatedAt != null && <> · {sharedTimeAgo(lastUpdatedAt) ?? 'just now'}</>}
            </span>
            <span className="text-terminal-text-dim/70 tabular-nums">· refreshing in {countdown}</span>
          </>
        )}
        <button onClick={onRefresh} disabled={isFetching} className="text-terminal-text-dim hover:text-terminal-gold transition-colors disabled:opacity-40" title="Refresh now">
          <span className="group-hover:hidden">↻</span><span className="hidden group-hover:inline">↻ REFRESH NOW</span>
        </button>
      </span>
    </div>
  )
}

// ─── SEARCH + FILTER ────────────────────────────────────────────────────────
function FilterBar({ searchTerm, setSearchTerm, activeCategory, onCategory, catCount, savedCount, sources, source, setSource, time, setTime, topic, setTopic }) {
  const active = [
    searchTerm && { k: 'q', label: `"${searchTerm}"`, clear: () => setSearchTerm('') },
    activeCategory !== 'ALL' && activeCategory !== 'SAVED' && { k: 'c', label: activeCategory, clear: () => onCategory('ALL') },
    source !== 'ALL' && { k: 's', label: source, clear: () => setSource('ALL') },
    time !== 'ALL' && { k: 't', label: time === 'TODAY' ? 'TODAY' : 'THIS WEEK', clear: () => setTime('ALL') },
    topic && { k: 'p', label: `TOPIC: ${topic.label}`, clear: () => setTopic(null) },
  ].filter(Boolean)
  const pill = (isActive) => `font-mono uppercase flex-shrink-0 transition-colors flex items-center gap-1 border rounded-full ${isActive ? 'bg-terminal-gold border-terminal-gold text-terminal-bg font-bold' : 'border-terminal-border text-terminal-muted hover:border-terminal-gold hover:text-terminal-gold'}`
  const select = 'bg-terminal-bg border border-terminal-border text-terminal-text-dim font-mono focus:border-terminal-gold outline-none'
  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="flex items-center gap-2 px-2 pt-1.5 flex-wrap">
        <div className="flex items-center gap-1 border border-terminal-border px-2" style={{ height: 24 }}>
          <span className="text-terminal-text-dim text-2xs">⌕</span>
          <input
            className="bg-transparent outline-none text-2xs font-mono text-terminal-text-bright"
            style={{ width: 180 }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search headlines…"
            aria-label="Search news"
          />
        </div>
        <select className={select} style={{ fontSize: 9, height: 24 }} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="ALL">ALL SOURCES</option>
          {sources.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
        <select className={select} style={{ fontSize: 9, height: 24 }} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time">
          {TIME_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {active.length > 0 && (
          <span className="flex items-center gap-1 flex-wrap">
            {active.map((f) => (
              <button key={f.k} onClick={f.clear} className="font-mono text-terminal-gold border border-terminal-gold/40 rounded-full px-2 hover:bg-terminal-gold/10" style={{ fontSize: 9, height: 20 }} title="Remove filter">{f.label} ✕</button>
            ))}
            <button
              onClick={() => { setSearchTerm(''); onCategory('ALL'); setSource('ALL'); setTime('ALL'); setTopic(null) }}
              className="font-mono text-terminal-text-dim hover:text-terminal-red ml-1" style={{ fontSize: 9 }}
            >CLEAR ALL</button>
          </span>
        )}
      </div>
      <div className="flex flex-nowrap items-center overflow-x-auto gap-1.5 px-2 py-1.5" style={{ scrollbarWidth: 'none' }}>
        {DISPLAY_CATEGORIES.map(({ key, label }) => {
          const count = catCount(key)
          return (
            <button key={key} onClick={() => onCategory(key)} className={pill(activeCategory === key)} style={{ fontSize: 9, height: 22, padding: '0 10px' }}>
              {label}{count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          )
        })}
        <button onClick={() => onCategory('SAVED')} className={pill(activeCategory === 'SAVED')} style={{ fontSize: 9, height: 22, padding: '0 10px' }}>
          🔖 SAVED{savedCount > 0 && <span className="opacity-70">({savedCount})</span>}
        </button>
      </div>
    </div>
  )
}

// ─── INTELLIGENCE — the right column ────────────────────────────────────────
function IntelColumn({ items, annotatedAll, nowTs, topic, setTopic, onOpen, sentiment }) {
  // Recomputed once a minute, not on every one-second tick of nowTs.
  const minute = Math.floor(nowTs / 60_000)
  const s = useMemo(() => overallSentiment(items, minute * 60_000), [items, minute])
  const topics = useMemo(() => trendingTopics(annotatedAll), [annotatedAll])
  const watch = useMemo(() => annotatedAll.filter((a) => a.inWatchlist).sort((a, b) => b.pubDate - a.pubDate).slice(0, 5), [annotatedAll])
  const breaking = items.filter(isBreakingArticle).slice(0, 3)
  const head = (t, extra) => <div className="flex items-center gap-2 mb-1.5"><span className="text-[9px] font-mono tracking-widest text-terminal-text-dim/70 uppercase">{t}</span>{extra}</div>
  const trend = s.trend === 'improving' ? { t: '▲ improving from 2h ago', c: '#2D8A50' } : s.trend === 'declining' ? { t: '▼ weakening from 2h ago', c: '#a83232' } : s.trend === 'steady' ? { t: '— steady vs 2h ago', c: '#8BA3C4' } : null

  return (
    <>
      {breaking.length > 0 && (
        <div className="px-3 py-2 border-b border-[#a83232]/40" style={{ background: 'rgba(168,50,50,0.12)' }}>
          <div className="font-mono font-bold tracking-widest text-[#e05c5c] mb-1" style={{ fontSize: 9 }}>🔴 BREAKING</div>
          {breaking.map((b) => (
            <button key={b.id ?? b.headline} onClick={() => onOpen(b)} className="block text-left text-[11px] leading-snug text-terminal-text-bright hover:text-terminal-gold mb-1">{b.headline}</button>
          ))}
        </div>
      )}

      <div className="px-3 py-2 border-b border-terminal-border">
        {head('Market sentiment', <span className="ml-auto font-mono font-bold" style={{ fontSize: 9, color: s.label === 'BULLISH' ? '#2D8A50' : s.label === 'BEARISH' ? '#a83232' : '#C9A84C' }}>{s.label}</span>)}
        <div className="flex h-2 rounded-sm overflow-hidden" title={`${s.total} articles, keyword-scored, weighted by impact and recency`}>
          <div style={{ width: `${s.bullPct}%`, background: '#2D8A50' }} />
          <div style={{ width: `${s.neutralPct}%`, background: '#C9A84C' }} />
          <div style={{ width: `${s.bearPct}%`, background: '#a83232' }} />
        </div>
        <div className="flex justify-between font-mono mt-1" style={{ fontSize: 8 }}>
          <span style={{ color: '#2D8A50' }}>BULL {s.bullPct}%</span><span style={{ color: '#C9A84C' }}>NEUTRAL {s.neutralPct}%</span><span style={{ color: '#a83232' }}>BEAR {s.bearPct}%</span>
        </div>
        {trend && <div className="font-mono mt-1" style={{ fontSize: 9, color: trend.c }}>{trend.t}</div>}
        {sentiment?.score != null && (
          <div className="font-mono mt-1 text-terminal-text-dim/70" style={{ fontSize: 8 }} title={sentiment.summary}>MaddenAI read: {sentiment.score} · {String(sentiment.label ?? '').toUpperCase()}</div>
        )}
      </div>

      <div className="px-3 py-2 border-b border-terminal-border">
        {head('Trending topics', <span className="ml-auto font-mono text-terminal-text-dim/50" style={{ fontSize: 8 }}>stories</span>)}
        {topics.length === 0 ? <div className="text-[10px] text-terminal-text-dim/60">Not enough stories yet</div> : topics.map((t, i) => {
          const on = topic?.key === t.key
          return (
            <button key={t.key} onClick={() => setTopic(on ? null : t)} className={`w-full flex items-center gap-2 py-0.5 font-mono text-left transition-colors ${on ? 'text-terminal-gold' : 'text-terminal-text-bright hover:text-terminal-gold'}`} style={{ fontSize: 10 }}>
              <span className="text-terminal-text-dim/50 w-3">{i + 1}.</span>
              <span className={on ? 'font-bold' : ''}>{t.label}</span>
              <span className="ml-auto text-terminal-text-dim tabular-nums">{t.count}</span>
            </button>
          )
        })}
      </div>

      <div className="px-3 py-2 border-b border-terminal-border">
        <div className="text-[9px] font-mono tracking-widest text-terminal-gold font-bold mb-1.5">IN YOUR WATCHLIST</div>
        {watch.length === 0 ? (
          <div className="text-[10px] text-terminal-text-dim/60">No watchlist mentions today</div>
        ) : watch.map((a) => (
          <button key={a.id ?? a.headline} onClick={() => onOpen(a)} className="block w-full text-left mb-1.5 hover:text-terminal-gold">
            <div className="text-[11px] leading-snug text-terminal-text-bright line-clamp-2">{a.headline}</div>
            <div className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8 }}>{(a.companies ?? []).map((c) => c.ticker.replace('.AX', '')).join(', ')} · {a.source} · {timeAgo(a.pubDate)}</div>
          </button>
        ))}
      </div>
    </>
  )
}

// ─── ARTICLE PANEL — reading a story without leaving the terminal ───────────
//
// A 400px panel over the right of the module. Esc closes it; ← and → step
// through the stories in the order they are listed on screen.
function ArticlePanel({ item, index, total, onClose, onStep, onAskAI, onOpenTicker, isSaved, onToggleSave }) {
  const [shared, setShared] = useState(false)
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === 'ArrowLeft') onStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onStep])
  const share = async () => {
    const text = `${item.headline} — ${item.source}${item.link ? `\n${item.link}` : ''}`
    try {
      if (navigator.share && item.link) await navigator.share({ title: item.headline, text: item.source, url: item.link })
      else await navigator.clipboard.writeText(text)
      setShared(true); setTimeout(() => setShared(false), 2000)
    } catch { /* cancelled or blocked */ }
  }
  const impact = item.impact ?? { level: 'LOW', colour: '#4A6080' }
  return (
    <div className="absolute top-0 right-0 bottom-0 z-30 flex flex-col border-l border-terminal-border-gold panel-fade" style={{ width: 400, maxWidth: '100%', background: 'rgb(var(--t-panel))', boxShadow: 'var(--shadow-floating)' }} role="dialog" aria-label="Article">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-terminal-border flex-shrink-0">
        <span className="rounded-full" style={{ width: 7, height: 7, background: sourceColor(item.source) }} />
        <span className="font-mono font-bold" style={{ fontSize: 9, color: sourceColor(item.source) }}>{item.source.toUpperCase()}</span>
        <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>· {timeAgo(item.pubDate)}</span>
        <span className="px-1.5 rounded-full leading-none py-0.5" style={{ fontSize: 8, background: `${TAG_COLOR[item.tag] ?? '#8BA3C4'}22`, color: TAG_COLOR[item.tag] ?? '#8BA3C4' }}>{primaryDisplayCategory(item)}</span>
        <span className="ml-auto flex items-center gap-1 font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
          <button onClick={() => onStep(-1)} className="px-1 hover:text-terminal-gold" title="Previous (←)">←</button>
          {index + 1}/{total}
          <button onClick={() => onStep(1)} className="px-1 hover:text-terminal-gold" title="Next (→)">→</button>
          <button onClick={onClose} className="px-1 ml-1 hover:text-terminal-text-bright" title="Close (Esc)" aria-label="Close">✕</button>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="font-bold text-terminal-text-bright" style={{ fontSize: 20, lineHeight: 1.3 }}>{item.headline}</h2>
        {item.author && <div className="font-mono text-terminal-text-dim/70 mt-1" style={{ fontSize: 9 }}>{item.author}</div>}
        <p className="text-terminal-text mt-3" style={{ fontSize: 14, lineHeight: 1.7, color: '#B8C7DC' }}>
          {item.summary || <span className="italic text-terminal-text-dim/60">No summary in the feed — the full story is at {item.source}.</span>}
        </p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="font-mono font-bold" style={{ fontSize: 9, color: impact.colour }} title="Estimated from keywords in the headline, not a market forecast">● {impact.level} IMPACT</span>
          {item.inWatchlist && <span className="font-mono tracking-widest text-terminal-gold" style={{ fontSize: 8 }}>IN YOUR WATCHLIST</span>}
        </div>
        {(item.companies?.length > 0 || knownTickerBadges(item.tickers).length > 0) && (
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {item.companies?.length ? <CompanyPills companies={item.companies} onOpenTicker={onOpenTicker} /> : <TickerBadgeRow tickers={item.tickers} onOpenTicker={onOpenTicker} />}
          </div>
        )}
        <div className="flex flex-col gap-2 mt-5">
          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-center text-2xs font-bold tracking-wide text-terminal-blue-bright border border-terminal-blue-bright/40 hover:bg-terminal-blue-bright hover:text-terminal-bg transition-colors py-2">READ FULL ARTICLE →</a>
          )}
          <button onClick={() => onAskAI(item)} className="text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/50 hover:bg-terminal-gold hover:text-terminal-bg transition-colors py-2">ASK MADDENAI ABOUT THIS ▶</button>
          <div className="flex gap-2">
            <span className="flex-1 flex"><SaveButton saved={isSaved} onClick={() => onToggleSave(item)} /></span>
            <button onClick={share} className="flex-1 text-2xs font-bold tracking-wide border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold rounded-full px-3 py-1">{shared ? '✓ COPIED' : '⧉ SHARE'}</button>
          </div>
        </div>
        <div className="font-mono text-terminal-text-dim/40 mt-4" style={{ fontSize: 8 }}>Esc to close · ← → to move between stories</div>
      </div>
    </div>
  )
}

// ─── Main module ──────────────────────────────────────────────────────────────

function NewsNudge({ stories, watchlist, nowTs }) {
  const [dismissed, setDismissed] = useState(() => new Set())
  const story = stories.find((a) => a.impact?.level === 'HIGH' && a.inWatchlist && !dismissed.has(nudgeId(a)))
  const last = readNudge()
  const show = !!story && (!last || last.id === nudgeId(story) || nowTs - last.at > NEWS_NUDGE_GAP)
  const shownId = show ? nudgeId(story) : null
  useEffect(() => {
    if (!shownId || readNudge()?.id === shownId) return
    recordNudge(shownId)
  }, [shownId])
  if (!show) return null
  const watched = new Set((watchlist ?? []).map((w) => w.replace(/\.AX$/, '')))
  const tickers = [...new Set(story.companies.map((c) => c.ticker.replace(/\.AX$/, '')).filter((t) => watched.has(t)))]
  const names = tickers.join(' and ')
  const many = tickers.length > 1
  const headline = story.headline.length > 90 ? `${story.headline.slice(0, 88)}…` : story.headline
  return (
    <ContextPrompt className="m-2"
      text={`${headline} — names ${names} on your watchlist.`}
      prompt={`This high-impact story names ${names}, which ${many ? 'are' : 'is'} on my watchlist: "${story.headline}"${story.summary ? ` — ${story.summary.slice(0, 300)}` : ''}. What does it mean for ${many ? 'these stocks' : 'this stock'}, and what should I watch next? Use only what the story says; do not invent figures.`}
      action="ASK MADDENAI"
      onDismiss={() => setDismissed((d) => new Set(d).add(nudgeId(story)))} />
  )
}

export default function NewsModule() {
  const [activeCategory, setActiveCategory] = useState(() => {
    const saved = loadCategory()
    return saved === 'SAVED' || DISPLAY_CATEGORIES.some(c => c.key === saved) ? saved : 'ALL'
  })
  const [searchTerm, setSearchTerm]   = useState('')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [timeFilter, setTimeFilter]   = useState('ALL')
  const [topic, setTopic]             = useState(null)
  // The story open in the article panel, by headline (ids are not stable
  // across refetches — see newIds below).
  const [openHeadline, setOpenHeadline] = useState(null)
  const [saved, setSaved]             = useState(loadSavedArticles)
  const [readIds, setReadIds]         = useState(loadReadSet)
  const [allArticles, setAllArticles] = useState([])
  // headline -> arrivedAt ms, drives the 30s pulse fade. Keyed by headline
  // (not item.id) because fetchNews() restarts its id counter from 1 on
  // every call, so ids aren't stable across refetches — headline is.
  const [newIds, setNewIds]           = useState(new Map())
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [nowTs, setNowTs]             = useState(() => Date.now())
  // Timestamp of the most recent new-story arrival — the banner reads this
  // against the existing 1s `nowTs` ticker to auto-dismiss 10s later.
  // Set alongside setNewIds inside the merge effect below (not its own
  // dedicated effect), so it isn't a bare derived-state effect.
  const [lastArrivalAt, setLastArrivalAt] = useState(null)
  const prevHeadlines                 = useRef(new Set())
  const listTopRef                    = useRef(null)

  const { newsFilter, setNewsFilter, clearNewsBadge, openModal, watchlist } = useStore()
  const { sentiment, status: sentimentStatus } = useSentiment()

  // Clear nav badge and tick clock
  useEffect(() => { clearNewsBadge() }, [clearNewsBadge])
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Sync CMD: NEWS filter
  useEffect(() => {
    // Consumes a one-shot command from the command bar: CMD "NEWS xyz" sets
    // newsFilter in the store, this reads it into local search state and clears
    // it so it cannot fire twice. The store is the external system here — there
    // is no way to derive this, because the value must be consumed exactly once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setLastArrivalAt(arrivedAt)
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
  }, [queryData])


  const sourceHealth = queryData?.sourceHealth ?? {}
  const isLive = allArticles.length > 0 && !isError

  // Filtering
  // Search, source and time compose; category is applied after (so its pill
  // counts reflect the other filters) and topic after annotation (company
  // topics need the detected companies).
  const today = sydneyDay(nowTs)
  const searchFiltered = useMemo(() => {
    const lc = searchTerm.toLowerCase()
    const weekAgo = new Date(`${today}T00:00:00`).getTime() - 6 * 86_400_000
    return allArticles.filter((n) =>
      (!searchTerm || n.headline.toLowerCase().includes(lc) || n.summary?.toLowerCase().includes(lc)) &&
      (sourceFilter === 'ALL' || n.source === sourceFilter) &&
      (timeFilter === 'ALL' || (timeFilter === 'TODAY' ? sydneyDay(n.pubDate) === today : n.pubDate >= weekAgo)))
  }, [allArticles, searchTerm, sourceFilter, timeFilter, today])
  const sources = useMemo(() => [...new Set(allArticles.map((a) => a.source))].sort(), [allArticles])

  const byCategory = useMemo(() => {
    const def = DISPLAY_CATEGORIES.find(c => c.key === activeCategory)
    if (!def || def.key === 'ALL') return searchFiltered
    return searchFiltered.filter(def.test)
  }, [searchFiltered, activeCategory])

  // Companies, impact and watchlist matches, attached once per feed pass.
  // Purely lexical — see newsIntelligence.js for why none of this is generated.
  const annotated = useMemo(
    () => annotateArticles(byCategory, watchlist ?? []).filter((a) => !topic || topic.test(a)),
    [byCategory, watchlist, topic],
  )
  // Every article, annotated — for the intelligence column, which describes
  // the whole wire rather than the filtered view.
  const annotatedAll = useMemo(() => annotateArticles(allArticles, watchlist ?? []), [allArticles, watchlist])

  // Stories the user actually holds or tracks float to the top. This is the
  // one reordering the module does, and it is deliberate: a feed sorted purely
  // by recency buries the story about your own position under six about
  // someone else's.
  //
  // Within each group, stories are ranked by quality score (newsIntelligence
  // scoreArticle — source, subject, watchlist matches and age), not by time.
  const prioritised = useMemo(() => {
    const byScore = (a, b) => b.score - a.score || b.pubDate - a.pubDate
    const watched = annotated.filter((a) => a.inWatchlist).sort(byScore)
    const rest = annotated.filter((a) => !a.inWatchlist).sort(byScore)
    return [...watched, ...rest]
  }, [annotated])

  const clusters = useMemo(() => clusterStories(prioritised), [prioritised])

  // Derived from the module's existing clock tick rather than a new interval.
  const session = useMemo(() => marketSession(new Date(nowTs)), [nowTs])
  const watchlistCount = useMemo(() => annotated.filter((a) => a.inWatchlist).length, [annotated])

  const catCount = useCallback(cat => {
    const def = DISPLAY_CATEGORIES.find(c => c.key === cat)
    if (!def || def.key === 'ALL') return searchFiltered.length
    return searchFiltered.filter(def.test).length
  }, [searchFiltered])

  const askAI = useCallback((item) => {
    dispatchAskAI({
      name:        item.headline,
      ticker:      item.tickers?.length ? item.tickers.join(', ') : null,
      sector:      'News',
      date:        todayAEST(),
      instruction: 'Analyse this news from an Australian investor perspective. What is the likely market impact for ASX and AUD?',
    })
  }, [])

  // Marks the featured story read. It used to also window.open() the source
  // on any click anywhere in the card — including on the headline someone was
  // only trying to select — which is a trapdoor. The card now has an explicit
  // READ FULL ARTICLE → link, so opening a tab is something the reader asks
  // for rather than something the card does to them.
  const handleMarkRead = useCallback((item) => {
    if (!readIds.has(item.id)) {
      const next = new Set(readIds); next.add(item.id); next.add(item.headline)
      setReadIds(next); saveReadSet(next)
    }
  }, [readIds])

  // Opening a story marks it read and shows it in the article panel.
  const handleOpen = useCallback((item) => {
    if (!readIds.has(item.id)) {
      const next = new Set(readIds); next.add(item.id); next.add(item.headline)
      setReadIds(next); saveReadSet(next)
    }
    setOpenHeadline(item.headline)
  }, [readIds])

  // MaddenAI on today's news: the top five stories on screen, as listed, with
  // their sources and summaries. Nothing else is passed, so the briefing can
  // only work from what the wire actually says.
  const askNewsBrief = useCallback((stories) => {
    const top = stories.slice(0, 5).map((a, i) => `${i + 1}. ${a.headline} (${a.source}, ${timeAgo(a.pubDate)})${a.summary ? `\n   ${a.summary.slice(0, 300)}` : ''}`).join('\n')
    askMaddenAI(`Based on today's top financial news stories, give me a 3-paragraph briefing on what matters most for Australian investors right now. Today is ${todayAEST()}. Work only from these stories and the verified figures in your context — no other figures.\n\nTOP STORIES:\n${top}`)
  }, [])

  const handleOpenTicker = useCallback((badge) => {
    openModal({ symbol: badge.symbol, name: badge.symbol, type: badge.type })
  }, [openModal])

  const savedKeys = useMemo(() => new Set(saved.map(savedKey)), [saved])
  const handleToggleSave = useCallback((item) => setSaved(toggleSavedArticle(item)), [])

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
        <div className="flex-1 px-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonNewsCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!isFetching && !isError && allArticles.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="panel-header flex-shrink-0">LIVE NEWS FEED</div>
        <EmptyState
          icon="📰"
          title="No news loaded"
          subtitle={`News updates every ${REFRESH_MS / 60_000} minutes. Pull to refresh.`}
          actionLabel="REFRESH NOW"
          action={refetch}
        />
      </div>
    )
  }

  // THE FEATURED SLOT GOES TO THE MOST IMPORTANT STORY, NOT THE NEWEST ONE.
  //
  // It used to be prioritised[0] — whatever arrived last. On a wire carrying
  // seventy-five articles that is frequently a routine market wrap sitting
  // above an RBA decision three rows down. The hero slot now takes the most
  // recent article whose keyword impact reads HIGH, and falls back to the most
  // recent article when nothing does.
  //
  // `prioritised` already floats watchlist stories to the front, so a HIGH
  // story about something the reader owns wins over a HIGH story about
  // something they do not, without this needing to know that.
  const topStory = prioritised.find((a) => a.impact?.level === 'HIGH') ?? prioritised[0]
  // The left column carries the three most important stories: the featured
  // one, then the next two by the feed's own ranking (watchlist first, then
  // score). The centre feed carries everything else.
  const topThree = topStory ? [topStory, ...prioritised.filter((a) => a !== topStory).slice(0, 2)] : []
  const listRest = clusters.filter((c) => !topThree.includes(c.lead))
  // The order ← and → step through in the article panel: as listed.
  const ordered = [...topThree, ...listRest.flatMap((c) => c.items ?? [c.lead])]
  const openIndex = openHeadline ? ordered.findIndex((a) => a.headline === openHeadline) : -1
  const openItem = openIndex >= 0 ? ordered[openIndex] : (openHeadline ? annotatedAll.find((a) => a.headline === openHeadline) : null)
  const stepOpen = (d) => {
    if (!ordered.length) return
    const next = ordered[((openIndex < 0 ? 0 : openIndex) + d + ordered.length) % ordered.length]
    handleOpen(next)
  }
  const sourcesOk = Object.values(sourceHealth).filter((v) => v === 'ok').length
  const bannerVisible = lastArrivalAt != null && (nowTs - lastArrivalAt < 10_000)

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <ModuleHeader
        title="NEWS"
        subtitle={`AFR · SMH · ABC · Guardian · NYT · ${NEWS_SOURCES.length} sources`}
        moduleId="news"
        isFetching={isFetching}
        lastUpdated={lastUpdatedAt}
        onRefresh={refetch}
      />

      <SessionContext nowTs={nowTs} session={session} watchlistCount={watchlistCount} />

      <NewsToolbar
        isLive={isLive}
        isFetching={isFetching}
        articleCount={allArticles.length}
        sourcesOk={sourcesOk}
        sourcesTotal={NEWS_SOURCES.length}
        lastUpdatedAt={lastUpdatedAt}
        nowTs={nowTs}
        onRefresh={refetch}
        newCount={newIds.size}
        lastArrivalAt={lastArrivalAt}
        onBrief={() => askNewsBrief([...topThree, ...listRest.map((c) => c.lead)])}
      />

      <MorningBriefing />

      <NewsletterBanner />

      <FilterBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        activeCategory={activeCategory} onCategory={handleCategoryChange} catCount={catCount} savedCount={saved.length}
        sources={sources} source={sourceFilter} setSource={setSourceFilter}
        time={timeFilter} setTime={setTimeFilter}
        topic={topic} setTopic={setTopic}
      />

      {newIds.size > 0 && bannerVisible && (
        <button
          onClick={() => { setLastArrivalAt(null); setNewIds(new Map()); listTopRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="w-full flex items-center gap-2 px-3 py-1 bg-terminal-gold/10 border-b border-terminal-gold/30 text-left hover:bg-terminal-gold/15 transition-colors flex-shrink-0 panel-fade"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />
          <span className="text-2xs text-terminal-gold font-bold tracking-wide uppercase">
            {newIds.size} new {newIds.size === 1 ? 'story' : 'stories'} — tap to jump to the top
          </span>
        </button>
      )}

      {activeCategory === 'SAVED' ? (
        <SavedArticles items={saved} searchTerm={searchTerm} onRemove={(a) => setSaved(removeSavedArticle(a))} onAskAI={askAI} />
      ) : annotated.length === 0 ? (
        <div className="p-4 text-2xs text-terminal-text-dim text-center flex-1">
          No articles match these filters.
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT 30% — the three most important stories */}
          <div className="flex flex-col overflow-y-auto border-r border-terminal-border" style={{ width: '30%', scrollbarWidth: 'none' }}>
            <NewsNudge stories={prioritised} watchlist={watchlist} nowTs={nowTs} />
            {topThree.map((item, i) => (
              <TopStoryCard
                key={item.headline}
                item={item}
                rank={i + 1}
                isUnread={!readIds.has(item.id) && !readIds.has(item.headline)}
                searchTerm={searchTerm}
                isPulsing={newIds.has(item.headline) && (nowTs - newIds.get(item.headline) < PULSE_MS)}
                onMarkRead={handleMarkRead}
                onAskAI={askAI}
                onOpenTicker={handleOpenTicker}
                isSaved={savedKeys.has(savedKey(item))}
                onToggleSave={handleToggleSave}
                onOpen={handleOpen}
              />
            ))}
          </div>

          {/* CENTRE 45% — the live feed */}
          <div className="flex flex-col overflow-y-auto border-r border-terminal-border" style={{ width: '45%' }} ref={listTopRef}>
            {listRest.map((cluster, i) => (
              <div key={cluster.id}>
                {i === 0 && cluster.lead.inWatchlist && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-terminal-gold/10 border-b border-terminal-gold/25">
                    <span className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 8 }}>WATCHLIST MENTIONS</span>
                    <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8 }}>promoted above the wire</span>
                  </div>
                )}
                {i > 0 && !cluster.lead.inWatchlist && listRest[i - 1].lead.inWatchlist && (
                  <div className="flex items-center gap-2 px-3 py-1 border-b border-terminal-border bg-terminal-surface2/40">
                    <span className="font-mono font-bold tracking-widest text-terminal-text-dim/70" style={{ fontSize: 8 }}>ALL STORIES</span>
                    <span className="font-mono text-terminal-text-dim/40" style={{ fontSize: 8 }}>ranked by relevance</span>
                  </div>
                )}
                <StoryCluster
                  cluster={cluster}
                  isUnread={!readIds.has(cluster.lead.id) && !readIds.has(cluster.lead.headline)}
                  isPulsing={newIds.has(cluster.lead.headline) && (nowTs - newIds.get(cluster.lead.headline) < PULSE_MS)}
                  onOpen={handleOpen}
                  onOpenTicker={handleOpenTicker}
                  onAskAI={askAI}
                  searchTerm={searchTerm}
                  savedKeys={savedKeys}
                  onToggleSave={handleToggleSave}
                />
              </div>
            ))}
          </div>

          {/* RIGHT 25% — intelligence */}
          <div className="flex flex-col overflow-y-auto" style={{ width: '25%', scrollbarWidth: 'none' }}>
            <IntelColumn items={allArticles} annotatedAll={annotatedAll} nowTs={nowTs} topic={topic} setTopic={setTopic} onOpen={handleOpen} sentiment={sentimentStatus === 'ready' ? sentiment : null} />
            <MovingOnNews items={allArticles} />
          </div>
        </div>
      )}

      {openItem && (
        <ArticlePanel
          item={openItem}
          index={openIndex < 0 ? 0 : openIndex}
          total={ordered.length}
          onClose={() => setOpenHeadline(null)}
          onStep={stepOpen}
          onAskAI={askAI}
          onOpenTicker={handleOpenTicker}
          isSaved={savedKeys.has(savedKey(openItem))}
          onToggleSave={handleToggleSave}
        />
      )}

      <div className="border-t border-terminal-border px-3 py-1 flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim/40">
          {annotated.length} of {allArticles.length} articles shown · auto-refresh {REFRESH_MS / 60_000}min · {NEWS_SOURCES.length} sources
        </span>
      </div>
    </div>
  )
}
