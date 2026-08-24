import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews, NEWS_SOURCES, FINANCIAL_KEYWORDS, ASX_STOCKS, US_STOCKS, askClaude } from '../../services/api'
import { MOCK_ASX_STOCKS, MOCK_CRYPTO, MOCK_INDICES } from '../../services/mockData'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Panel'
import { ModuleLoader, ModuleError } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { SentimentBar } from '../../components/ui/SentimentIndicator'
import { useSentiment } from '../../hooks/useSentiment'
import { getAllEarningsResults } from '../../services/earningsAnalystService'

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

// Synthetic "EARNINGS RESULT" article built from a completed AI Earnings
// Analyst record (see earningsAnalystService) — shaped to match what
// fetchNews() returns so it slots into the same list/filter/render logic
// as a real article.
function earningsResultToArticle({ ticker, reportData, analysis }) {
  const bareTicker = ticker.replace('.AX', '')
  const sentiment = ['STRONG BEAT', 'BEAT'].includes(analysis.verdict)
    ? 'BULLISH'
    : ['STRONG MISS', 'MISS'].includes(analysis.verdict) ? 'BEARISH' : 'NEUTRAL'
  return {
    id: `earnings-${ticker}`,
    time: new Date(reportData.reportDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    pubDate: new Date(reportData.reportDate),
    fetchedAt: new Date(reportData.reportDate).getTime(),
    source: 'MaddenAI',
    sourceCategory: 'AU',
    tag: 'EARNINGS_RESULT',
    categories: ['AU'],
    sentiment,
    headline: `${bareTicker} EARNINGS: ${analysis.verdict} — ${analysis.headline}`,
    summary: analysis.fullAnalysis,
    link: null,
    tickers: [bareTicker],
    priority: 0,
  }
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

// Heuristic market-impact tier for the featured-story badge — breaking
// headlines or macro/rates-tagged stories read as HIGH impact, stories
// naming a tracked ticker as MEDIUM (they move a specific stock), everything
// else LOW. Not a model, just a legible signal for the reader's eye.
function storyImpactTier(item) {
  if (isBreakingArticle(item)) return 'HIGH'
  if (item.tag === 'MACRO' || item.tag === 'RATES' || item.categories?.includes('MACRO')) return 'HIGH'
  if ((item.tickers ?? []).length > 0) return 'MEDIUM'
  return 'LOW'
}
const IMPACT_COLOR = { HIGH: '#a83232', MEDIUM: '#c8a84b', LOW: '#4a6580' }

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

// ─── Sentiment aggregation — reuses the per-article `.sentiment` field
// already populated by inferSentiment() in api.js at fetch time ──────────────

function overallSentiment(items) {
  let bull = 0, bear = 0, neutral = 0
  for (const item of items) {
    if (item.sentiment === 'BULLISH') bull++
    else if (item.sentiment === 'BEARISH') bear++
    else neutral++
  }
  const total = bull + bear + neutral || 1
  return {
    bullPct: Math.round((bull / total) * 100),
    bearPct: Math.round((bear / total) * 100),
    neutralPct: Math.round((neutral / total) * 100),
    total,
    label: bull >= bear && bull >= neutral ? 'BULLISH' : bear >= bull && bear >= neutral ? 'BEARISH' : 'NEUTRAL',
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
  const color = up ? '#c8a84b' : '#a83232'
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

// ─── SENTIMENT VISUALISER — full-width bar above the 3-column layout ────────

function SentimentVisualiser({ items, trending, searchTerm, onTagClick }) {
  const s = useMemo(() => overallSentiment(items), [items])
  const topTags = trending.slice(0, 6)

  return (
    <div className="px-3 py-2 border-b border-terminal-border flex-shrink-0" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-mono tracking-widest text-terminal-text-dim/60 uppercase">MARKET SENTIMENT:</span>
        <span className="text-2xs font-bold" style={{ color: '#3aaa63' }}>{s.bullPct}% BULLISH</span>
        <span className="text-2xs text-terminal-text-dim/50">·</span>
        <span className="text-2xs font-bold" style={{ color: '#c9a84c' }}>{s.neutralPct}% NEUTRAL</span>
        <span className="text-2xs text-terminal-text-dim/50">·</span>
        <span className="text-2xs font-bold" style={{ color: '#cc4444' }}>{s.bearPct}% BEARISH</span>
        <span className="text-2xs text-terminal-text-dim/40 ml-auto">{s.total} articles analysed</span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          style={{ width: `${s.bullPct}%`, height: '100%', background: '#c9a84c', transition: 'width 300ms ease' }}
          title={`Bullish ${s.bullPct}%`}
        />
      </div>

      {topTags.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {topTags.map(([word]) => {
            const isActive = searchTerm.toLowerCase() === word.toLowerCase()
            return (
              <button
                key={word}
                onClick={() => onTagClick(isActive ? '' : word)}
                className={`text-[9px] font-mono px-2 py-0.5 rounded-full border flex-shrink-0 transition-colors ${
                  isActive
                    ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/15'
                    : 'border-terminal-gold/30 text-terminal-gold/80 hover:border-terminal-gold hover:bg-terminal-gold/10'
                }`}
              >
                #{word.replace(/\s+/g, '')}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── MARKET IMPACT — ticker | %change | mini bar, below the top story ───────

function MarketImpactRow() {
  const assets = useMemo(() => marketImpactAssets(), [])
  const maxAbs = Math.max(...assets.map(a => Math.abs(a.changePct)), 0.1)

  return (
    <div className="px-3 py-2 border-t border-terminal-border flex-shrink-0">
      <div className="text-[9px] font-mono tracking-widest text-terminal-text-dim/60 uppercase mb-1.5">MARKET IMPACT</div>
      <div className="flex flex-col gap-1">
        {assets.map(a => {
          const up = a.changePct >= 0
          const widthPct = (Math.abs(a.changePct) / maxAbs) * 100
          return (
            <div key={a.label} className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-terminal-text-bright w-14 flex-shrink-0">{a.label}</span>
              <span className={`w-12 flex-shrink-0 text-right ${up ? 'pos' : 'neg'}`}>{up ? '+' : ''}{a.changePct.toFixed(2)}%</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${widthPct}%`, height: '100%', background: up ? '#3aaa63' : '#a83232' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
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

function TopStoryCard({ item, isUnread, searchTerm, isPulsing, onToggle, onAskAI, onOpenTicker }) {
  const isNew      = isNewArticle(item)
  const isBreaking = isBreakingArticle(item)
  const asset       = useMemo(() => resolveStoryAsset(item), [item])
  const impact      = storyImpactTier(item)

  return (
    <div
      className={`news-top-story ${isPulsing ? 'news-pulse' : ''} bg-terminal-surface hover:border-terminal-border-gold transition-colors cursor-pointer px-4 py-3`}
      style={{ borderLeft: `3px solid ${isBreaking ? '#a83232' : '#c8a84b'}` }}
      onClick={() => onToggle(item)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-terminal-text-bright leading-snug mb-1 line-clamp-3" style={{ fontSize: 16 }}>
          {isUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-gold mr-1.5" />}
          {isBreaking && <span className="text-[#a83232] font-bold mr-1.5">● BREAKING</span>}
          <HighlightText text={item.headline} term={searchTerm} />
        </p>
        {asset && (
          <div className="flex-shrink-0 text-right">
            <MiniSparkline values={asset.values} up={asset.up} width={60} height={30} />
            <div className={`text-[9px] font-mono ${asset.up ? 'pos' : 'neg'}`}>{asset.label} {asset.up ? '+' : ''}{asset.changePct.toFixed(2)}%</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] font-mono text-terminal-text-dim mb-1.5">
        <SourceCircle source={item.source} size={12} />
        <span>{item.source}</span>
        <span>· {timeAgo(item.pubDate)}</span>
        {isNew && !isBreaking && <span className="text-terminal-gold font-bold ml-1">NEW</span>}
      </div>

      {item.summary && (
        <p className="text-xs text-terminal-text-dim leading-snug mb-2 line-clamp-2">{item.summary}</p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant={TAG_VARIANTS[item.tag] || 'default'}>{primaryDisplayCategory(item)}</Badge>
          <span
            className="text-2xs font-bold px-1.5 py-0.5 rounded-full border"
            style={{ color: IMPACT_COLOR[impact], borderColor: `${IMPACT_COLOR[impact]}66` }}
          >
            {impact === 'HIGH' ? 'HIGH IMPACT' : impact}
          </span>
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
            READ FULL STORY →
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

// ─── STORY ROW — plain list row (48px), click expands an inline accordion
// with the 2-line summary + Read/Ask actions; only one row open at a time. ──

function StoryRow({ item, isUnread, isPulsing, isExpanded, onExpand, onOpenTicker, onAskAI }) {
  const isNew      = isNewArticle(item)
  const isBreaking = isBreakingArticle(item)
  const asset       = useMemo(() => (isExpanded ? resolveStoryAsset(item) : null), [item, isExpanded])
  const relevanceColor = isBreaking ? '#a83232' : item.sentiment === 'BULLISH' ? '#3aaa63' : item.sentiment === 'BEARISH' ? '#a83232' : '#4a6580'

  return (
    <div className="border-b border-terminal-border">
      <div
        className={`news-row ${isPulsing ? 'news-pulse' : ''} flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-terminal-surface2 transition-colors`}
        style={{ minHeight: 48 }}
        onClick={() => onExpand(item)}
      >
        <SourceCircle source={item.source} size={12} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-terminal-text-bright leading-snug line-clamp-1">
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
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
          style={{ background: relevanceColor }}
        />
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-8 panel-fade">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-terminal-text-dim leading-snug flex-1">
              {item.summary || <span className="italic text-terminal-text-dim/60">Full story available at {item.source}.</span>}
            </p>
            {asset && (
              <div className="flex-shrink-0 text-right">
                <MiniSparkline values={asset.values} up={asset.up} />
                <div className={`text-[9px] font-mono ${asset.up ? 'pos' : 'neg'}`}>{asset.label} {asset.up ? '+' : ''}{asset.changePct.toFixed(2)}%</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-2xs text-terminal-blue-bright hover:text-terminal-gold transition-colors"
              >
                Read →
              </a>
            )}
            <button
              onClick={e => { e.stopPropagation(); onAskAI(item) }}
              className="text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/40 rounded-full hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-3 py-1"
            >
              Ask MaddenAI ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SPONSORED DATA row — visual break inserted every 4th feed row, showing
// the mini sparkline for one of the app's tracked market-impact assets. ────

function SponsoredDataRow({ asset }) {
  const values = useMemo(() => generateSparkline(asset.label, asset.price, asset.changePct), [asset])
  const up = asset.changePct >= 0
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 border-b border-terminal-border bg-terminal-gold/5">
      <span className="text-[8px] font-mono tracking-widest text-terminal-gold/50 flex-shrink-0">DATA</span>
      <MiniSparkline values={values} up={up} width={44} height={20} />
      <span className="text-[11px] font-bold text-terminal-text-bright flex-shrink-0">{asset.label}</span>
      <span className={`text-[10px] font-mono ml-auto flex-shrink-0 ${up ? 'pos' : 'neg'}`}>
        {up ? '+' : ''}{asset.changePct.toFixed(2)}% 24H
      </span>
    </div>
  )
}

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

function TopTopicsCloud({ trending, searchTerm, onTagClick }) {
  if (trending.length === 0) return null
  const maxCount = Math.max(...trending.map(([, c]) => c))
  const minCount = Math.min(...trending.map(([, c]) => c))
  const range = maxCount - minCount || 1
  const sizeFor = (c) => 9 + Math.round(((c - minCount) / range) * 7) // 9px .. 16px

  return (
    <div className="px-3 py-2 border-b border-terminal-border">
      <div className="text-[9px] font-mono tracking-widest text-terminal-text-dim/60 uppercase mb-1.5">TOP TOPICS</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trending.slice(0, 12).map(([word, count]) => {
          const isActive = searchTerm.toLowerCase() === word.toLowerCase()
          return (
            <button
              key={word}
              onClick={() => onTagClick(isActive ? '' : word)}
              className={`font-mono leading-none transition-colors ${isActive ? 'text-terminal-gold font-bold' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
              style={{ fontSize: sizeFor(count) }}
            >
              {word}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BreakingFeed({ items }) {
  const top3 = items.slice(0, 3)
  if (top3.length === 0) return null
  return (
    <div className="px-3 py-2">
      <div className="text-[9px] font-mono tracking-widest text-terminal-text-dim/60 uppercase mb-1.5">BREAKING</div>
      <div className="flex flex-col gap-1.5">
        {top3.map(item => (
          <div key={item.id} className="text-[10px] leading-snug text-terminal-text-dim">
            <span className="text-[#a83232] font-bold mr-1">●</span>
            {item.headline}
          </div>
        ))}
      </div>
    </div>
  )
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
  const [expanded, setExpanded] = useState(true)

  const generate = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const prompt =
        `You are MaddenAI. Today is ${today}. ` +
        'Generate a professional 3-paragraph morning market briefing for Australian investors covering:\n' +
        'Para 1: Overnight global market moves and key drivers\n' +
        'Para 2: ASX outlook for today + key stocks to watch\n' +
        'Para 3: Key risk events this week\n' +
        'Keep it factual, specific, and Australian-focused. General information only.'
      const { text: result } = await askClaude([{ role: 'user', content: prompt }], null, {
        systemPrompt: 'You are MaddenAI, the financial intelligence analyst embedded in the Maddex terminal.',
      })
      setText(result)
      try { localStorage.setItem(briefKey(today), result) } catch { /* best-effort cache write */ }
    } catch (e) {
      setError(e.message || 'Failed to generate briefing')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    if (!text && !loading && !error) {
      const t = setTimeout(generate, 0)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        {loading && <span className="text-2xs text-terminal-text-dim animate-pulse">generating…</span>}
        <button
          onClick={(e) => { e.stopPropagation(); generate() }}
          title="Regenerate"
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold ml-1"
        >↻</button>
        <span className="ml-auto text-terminal-text-dim text-2xs">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-terminal-text leading-relaxed panel-fade">
          {error ? (
            <div className="text-terminal-red text-2xs">⚠ {error} — <button onClick={generate} className="underline hover:text-terminal-gold">retry</button></div>
          ) : text ? (
            text.split('\n').filter(Boolean).map((para, i) => <p key={i} className="mb-2 last:mb-0">{para}</p>)
          ) : (
            <div className="text-terminal-text-dim text-2xs animate-pulse">MaddenAI is drafting today's briefing…</div>
          )}
        </div>
      )}
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
  const [expandedId, setExpandedId]   = useState(null)
  // Timestamp of the most recent new-story arrival — the banner reads this
  // against the existing 1s `nowTs` ticker to auto-dismiss 10s later.
  // Set alongside setNewIds inside the merge effect below (not its own
  // dedicated effect), so it isn't a bare derived-state effect.
  const [lastArrivalAt, setLastArrivalAt] = useState(null)
  const prevHeadlines                 = useRef(new Set())
  const listTopRef                    = useRef(null)

  const { newsFilter, setNewsFilter, clearNewsBadge, openModal } = useStore()
  const { sentiment, status: sentimentStatus, error: sentimentError } = useSentiment()

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
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 800)
  }, [queryData])

  // AI Earnings Analyst — merge in any completed earnings-result cards
  // straight from localStorage (durable across the RSS query's own
  // refetches, which is why these aren't pushed through the query cache).
  // Polled independently of the RSS feed since a result can complete while
  // News is already open.
  useEffect(() => {
    const mergeEarningsResults = () => {
      const results = getAllEarningsResults()
      if (!results.length) return
      setAllArticles((prev) => {
        const prevIds = new Set(prev.map((a) => a.id))
        const newCards = results.map(earningsResultToArticle).filter((a) => !prevIds.has(a.id))
        if (!newCards.length) return prev
        return [...newCards, ...prev].sort((a, b) => b.pubDate - a.pubDate).slice(0, MAX_ARTICLES)
      })
    }
    mergeEarningsResults()
    const id = setInterval(mergeEarningsResults, 60_000)
    return () => clearInterval(id)
  }, [])

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

  const trending = useMemo(() => extractTrending(allArticles), [allArticles])
  const sponsoredAssets = useMemo(() => marketImpactAssets(), [])

  const askAI = useCallback((item) => {
    dispatchAskAI({
      name:        item.headline,
      ticker:      item.tickers?.length ? item.tickers.join(', ') : null,
      sector:      'News',
      date:        todayAEST(),
      instruction: 'Analyse this news from an Australian investor perspective. What is the likely market impact for ASX and AUD?',
    })
  }, [])

  // Clicking the top story marks it read and opens the source article
  // directly (it's the hero item, no accordion). Story-row clicks instead
  // toggle the inline accordion via handleExpand below.
  const handleToggle = useCallback((item) => {
    if (!readIds.has(item.id)) {
      const next = new Set(readIds); next.add(item.id); next.add(item.headline)
      setReadIds(next); saveReadSet(next)
    }
    if (item.link) window.open(item.link, '_blank', 'noopener,noreferrer')
  }, [readIds])

  // Story rows: click expands an inline accordion (only one open at a time)
  // and marks read, but does NOT navigate away — "Read full story" inside
  // the accordion is the explicit action for that.
  const handleExpand = useCallback((item) => {
    if (!readIds.has(item.id)) {
      const next = new Set(readIds); next.add(item.id); next.add(item.headline)
      setReadIds(next); saveReadSet(next)
    }
    setExpandedId(prev => (prev === item.id ? null : item.id))
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

  const topStory   = byCategory[0]
  const listRest    = byCategory.slice(1)
  const bannerVisible = lastArrivalAt != null && (nowTs - lastArrivalAt < 10_000)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader title="NEWS" subtitle="AFR · Reuters · CNBC · 30+ sources" moduleId="news" />

      <MorningBriefing />

      <div className="px-2 pt-2 flex-shrink-0">
        <SentimentBar sentiment={sentiment} status={sentimentStatus} error={sentimentError} />
      </div>

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

      {/* Category pills — moved to the very top of the interactive area,
          above search, per the redesign */}
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
              {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          )
        })}

        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <span className="text-terminal-text-dim text-2xs">⌕</span>
          <input
            className="cmd-input text-2xs py-0"
            style={{ width: 160 }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Filter headlines..."
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-terminal-text-dim/40 hover:text-terminal-text-dim text-xs">✕</button>
          )}
        </div>
      </div>

      {/* Sentiment visualiser — full width, top of the news area */}
      <SentimentVisualiser items={allArticles} trending={trending} searchTerm={searchTerm} onTagClick={setSearchTerm} />

      {/* New stories banner — slides down, click scrolls to top of the feed,
          auto-dismisses 10s after the most recent arrival either way */}
      {newIds.size > 0 && bannerVisible && (
        <button
          onClick={() => { setLastArrivalAt(null); setNewIds(new Map()); listTopRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="w-full flex items-center gap-2 px-3 py-1 bg-terminal-gold/10 border-b border-terminal-gold/30 text-left hover:bg-terminal-gold/15 transition-colors flex-shrink-0 panel-fade"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold flex-shrink-0" />
          <span className="text-2xs text-terminal-gold font-bold">● {newIds.size} new {newIds.size === 1 ? 'story' : 'stories'} — tap to refresh</span>
        </button>
      )}

      {/* 3-column layout: LEFT top story/sentiment context/market impact,
          CENTRE story list with accordion, RIGHT trending/topics/breaking */}
      {byCategory.length === 0 ? (
        <div className="p-4 text-2xs text-terminal-text-dim text-center flex-1">
          {searchTerm ? `No articles matching "${searchTerm}"` : 'No articles in this category'}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT 35% */}
          <div className="flex flex-col overflow-y-auto border-r border-terminal-border" style={{ width: '35%', scrollbarWidth: 'none' }}>
            <TopStoryCard
              item={topStory}
              isUnread={!readIds.has(topStory.id) && !readIds.has(topStory.headline)}
              searchTerm={searchTerm}
              isPulsing={newIds.has(topStory.headline) && (nowTs - newIds.get(topStory.headline) < PULSE_MS)}
              onToggle={handleToggle}
              onAskAI={askAI}
              onOpenTicker={handleOpenTicker}
            />
            <MarketImpactRow />
          </div>

          {/* CENTRE 40% — a "SPONSORED DATA" sparkline row breaks up the feed
              every 4th story, cycling through the tracked market-impact assets */}
          <div className="flex flex-col overflow-y-auto border-r border-terminal-border" style={{ width: '40%' }} ref={listTopRef}>
            {listRest.map((item, i) => (
              <div key={item.id}>
                <StoryRow
                  item={item}
                  isUnread={!readIds.has(item.id) && !readIds.has(item.headline)}
                  isPulsing={newIds.has(item.headline) && (nowTs - newIds.get(item.headline) < PULSE_MS)}
                  isExpanded={expandedId === item.id}
                  onExpand={handleExpand}
                  onOpenTicker={handleOpenTicker}
                  onAskAI={askAI}
                />
                {(i + 1) % 4 === 0 && (
                  <SponsoredDataRow asset={sponsoredAssets[(Math.floor(i / 4)) % sponsoredAssets.length]} />
                )}
              </div>
            ))}
          </div>

          {/* RIGHT 25% */}
          <div className="flex flex-col overflow-y-auto" style={{ width: '25%', scrollbarWidth: 'none' }}>
            <MovingOnNews items={allArticles} />
            <TopTopicsCloud trending={trending} searchTerm={searchTerm} onTagClick={setSearchTerm} />
            <BreakingFeed items={breakingItems} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-terminal-border px-3 py-1 flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim/40">
          {byCategory.length} articles · auto-refresh 5min · {NEWS_SOURCES.length} sources
        </span>
      </div>
    </div>
  )
}
