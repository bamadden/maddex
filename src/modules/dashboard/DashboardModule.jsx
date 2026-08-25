import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { useLivePrice } from '../../hooks/useLivePrice'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { fmt } from '../../utils/format'
import { timeAgo, relativeDate } from '../../utils/dateUtils'
import { getMockFMPRow, MOCK_CRYPTO } from '../../services/mockData'
import { getEconomicCalendar, upcomingEvents } from '../../services/calendarService'
import { getActivityLog, iconFor } from '../../services/activityLogService'
import {
  YF_INDICES, fetchFearGreed, transformFearGreed, ASX_STOCKS, fetchNews,
} from '../../services/api'
import { fetchEquityQuotes, fetchIndexQuotesUnified, fetchCryptoMarketsUnified } from '../../services/dataService'
import { calculateMarketSentimentScore, generateShortSummary, scoreToColor } from '../../services/maddenAiScoring'
import { GICS_SECTORS, SECTOR_ABBR, ASX_SECTOR_STOCKS } from '../markets/SectorHeatmap'

const PORTFOLIO_KEY = 'madden_portfolio_v2'
const ONBOARDING_KEY = 'maddex_dashboard_onboarding'
const REGION_FLAGS = { AU: '🇦🇺', US: '🇺🇸', CN: '🇨🇳', JP: '🇯🇵', UK: '🇬🇧' }

// Live-ticking mini index row (ASX 200 only — real getMockFMPRow support for
// ^-prefixed indices via MOCK_INDICES, no exchange-suffix restriction needed
// here since it's not an equity ticker; the others don't tick to keep this
// card's network/compute footprint small — the full ticking treatment lives
// on the Markets module's IndicesTable).
function MiniIndexRow({ symbol, label, live }) {
  const { quote, flash } = useLivePrice(live ? symbol : null)
  const q = quote ?? getMockFMPRow(symbol)
  if (!q) return null
  const pct = q.regularMarketChangePercent
  const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''
  return (
    <div className="flex items-center justify-between py-1 text-2xs font-mono">
      <span className="text-terminal-text-dim">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-terminal-text-bright font-semibold px-1 ${flashClass}`}>{fmt.price(q.regularMarketPrice, 1)}</span>
        <span className={`font-semibold w-14 text-right ${pct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

function useCountdown(targetDate) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!targetDate) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [targetDate])
  if (!targetDate) return null
  const diff = targetDate.getTime() - now
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true }
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    expired: false,
  }
}

function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-terminal-panel border border-terminal-border flex flex-col ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-2xs font-bold text-terminal-gold tracking-widest">{title}</span>
          {action}
        </div>
      )}
      <div className="flex-1 min-h-0 p-3">{children}</div>
    </div>
  )
}

// ─── TOP ROW ────────────────────────────────────────────────────────────────

function PortfolioSnapshotCard({ goto }) {
  const { usdToAud } = useAudRates()
  const [holdings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]') } catch { return [] }
  })

  const computed = useMemo(() => holdings.map((h) => {
    let last = null, dayPct = 0
    if (h.type === 'crypto') {
      const c = MOCK_CRYPTO.find((m) => m.symbol === h.symbol.toLowerCase())
      if (c) { last = usdToAud(c.current_price); dayPct = c.price_change_percentage_24h }
    } else {
      const q = getMockFMPRow(h.yfSym ?? h.symbol)
      if (q) { last = q.currency === 'USD' ? usdToAud(q.regularMarketPrice) : q.regularMarketPrice; dayPct = q.regularMarketChangePercent }
    }
    const mktVal = last != null ? last * h.shares : null
    return { symbol: h.symbol, mktVal, dayPct }
  }), [holdings, usdToAud])

  const live = computed.filter((h) => h.mktVal != null)
  const totalValue = live.reduce((s, h) => s + h.mktVal, 0)
  const dayPnl = live.reduce((s, h) => s + h.mktVal * (h.dayPct / 100), 0)
  const dayPct = totalValue ? (dayPnl / (totalValue - dayPnl)) * 100 : 0
  const sorted = [...live].sort((a, b) => b.dayPct - a.dayPct)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  if (holdings.length === 0) {
    return (
      <Card title="PORTFOLIO SNAPSHOT">
        <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
          <div className="text-xs text-terminal-text-dim">Track your investments</div>
          <button
            onClick={() => goto('portfolio')}
            className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >
            + ADD FIRST HOLDING
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card title="PORTFOLIO SNAPSHOT">
      <div className="flex flex-col gap-1.5">
        <div className="text-2xl font-mono font-bold text-white">{fmt.aud(totalValue, { decimals: 0, clarify: true })}</div>
        <div className={`text-xs font-mono font-semibold ${dayPnl >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {dayPnl >= 0 ? '▲' : '▼'} {fmt.aud(Math.abs(dayPnl), { decimals: 0, clarify: true })} ({fmt.pct(dayPct)})
        </div>
        {best && worst && (
          <div className="text-2xs text-terminal-text-dim font-mono">
            Best: <span className="text-terminal-green font-semibold">{best.symbol.replace('.AX', '')} ▲{Math.abs(best.dayPct).toFixed(2)}%</span>
            {' · '}
            Worst: <span className="text-terminal-red font-semibold">{worst.symbol.replace('.AX', '')} ▼{Math.abs(worst.dayPct).toFixed(2)}%</span>
          </div>
        )}
        <button onClick={() => goto('portfolio')} className="text-2xs text-terminal-gold hover:underline self-start mt-1">VIEW PORTFOLIO →</button>
      </div>
    </Card>
  )
}

function MarketScoreCard({ goto }) {
  const { currency } = useStore()
  const vsCurrency = currency.toLowerCase()
  const { data: asxResult } = useQuery({ queryKey: ['yahooMoversBatch', 'asx'], queryFn: () => fetchEquityQuotes(ASX_STOCKS), staleTime: 60_000, retry: 1 })
  const { data: indexResult } = useQuery({ queryKey: ['yfBatch', 'indices'], queryFn: () => fetchIndexQuotesUnified(YF_INDICES.map((i) => i.symbol)), staleTime: 60_000, retry: 1 })
  const { data: rawCrypto } = useQuery({ queryKey: ['cryptoMarkets', vsCurrency], queryFn: () => fetchCryptoMarketsUnified(vsCurrency), staleTime: 60_000, retry: 1 })
  const { data: rawFearGreed } = useQuery({ queryKey: ['fearGreed'], queryFn: fetchFearGreed, staleTime: 5 * 60_000, retry: 1 })

  const asxChanges = asxResult?.data ? Object.values(asxResult.data).map((q) => q.dayChangePct) : null
  const spxChange = indexResult?.data?.['^GSPC']?.pct ?? null
  const cryptoList = rawCrypto?.data ?? null
  const cryptoChanges = cryptoList ? cryptoList.map((c) => c.price_change_percentage_24h) : null
  const btc = cryptoList?.find((c) => c.symbol?.toUpperCase() === 'BTC')
  const fearGreed = rawFearGreed ? transformFearGreed(rawFearGreed) : null
  const haveData = asxChanges || spxChange != null || cryptoChanges || fearGreed

  const sentiment = haveData ? calculateMarketSentimentScore({
    fearGreed, asxChanges, spxChange, btcChange: btc?.price_change_percentage_24h ?? null, cryptoChanges,
  }) : null
  const summary = sentiment ? generateShortSummary({ marketSentimentScore: sentiment, asxChanges, fearGreed }) : ''
  const color = sentiment ? scoreToColor(sentiment.score) : 'var(--color-neutral)'

  return (
    <Card title="MARKET SCORE">
      {!sentiment ? (
        <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim animate-pulse">Loading…</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end gap-3">
            <div className="text-3xl font-mono font-bold" style={{ color }}>{sentiment.score}</div>
            <svg width="64" height="34" viewBox="0 0 64 34" className="flex-shrink-0 mb-1">
              <path d="M4,32 A28,28 0 0,1 60,32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
              <path
                d="M4,32 A28,28 0 0,1 60,32"
                fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(sentiment.score / 100) * 88} 88`}
              />
            </svg>
          </div>
          <div className="text-2xs font-bold tracking-widest" style={{ color }}>{sentiment.label.toUpperCase()}</div>
          <div className="text-2xs text-terminal-text-dim truncate">{summary}</div>
          <button onClick={() => goto('brief')} className="text-2xs text-terminal-gold hover:underline self-start mt-1">READ MORNING BRIEF →</button>
        </div>
      )}
    </Card>
  )
}

function NextEventCard({ goto }) {
  const { data } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  const next = data ? upcomingEvents(data.events, 120)[0] : null
  const countdown = useCountdown(next?.dateObj ?? null)

  return (
    <Card title="NEXT EVENT">
      {!next ? (
        <div className="h-full flex items-center justify-center text-2xs text-terminal-text-dim">No upcoming events</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span>{REGION_FLAGS[next.region] ?? '🌐'}</span>
            <span className={`text-2xs font-bold px-1.5 py-0.5 ${
              next.importance === 'high' ? 'bg-terminal-red/15 text-terminal-red' : next.importance === 'medium' ? 'bg-terminal-gold/15 text-terminal-gold' : 'bg-terminal-muted/15 text-terminal-muted'
            }`}>
              ●{next.importance?.toUpperCase()}
            </span>
          </div>
          <div className="text-sm font-bold text-white uppercase leading-tight">{next.event}</div>
          <div className="text-2xs text-terminal-text-dim">{new Date(`${next.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          {countdown && !countdown.expired && (
            <div className="text-xs font-mono font-bold text-terminal-gold mt-0.5">
              {countdown.d}D {countdown.h}H {countdown.m}M
            </div>
          )}
          <button onClick={() => goto('calendar')} className="text-2xs text-terminal-gold hover:underline self-start mt-1">VIEW CALENDAR →</button>
        </div>
      )}
    </Card>
  )
}

// ─── MIDDLE ROW ─────────────────────────────────────────────────────────────

const KEY_INDICES = [
  { symbol: '^AXJO', label: 'ASX 200', live: true },
  { symbol: '^GSPC', label: 'S&P 500', live: false },
  { symbol: '^IXIC', label: 'NASDAQ', live: false },
  { symbol: '^DJI',  label: 'DOW JONES', live: false },
]

function SectorBreadthMini() {
  const [hovered, setHovered] = useState(null)
  const sectors = useMemo(() => GICS_SECTORS.map((sector) => {
    const stocks = (ASX_SECTOR_STOCKS[sector] || []).slice(0, 4)
    const changes = stocks.map(([sym]) => getMockFMPRow(sym)?.regularMarketChangePercent).filter((v) => v != null)
    const avg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0
    return { sector, abbr: SECTOR_ABBR[sector], avg }
  }), [])
  const maxAbs = Math.max(1, ...sectors.map((s) => Math.abs(s.avg)))

  return (
    <div className="mt-2">
      <div className="text-2xs text-terminal-text-dim/60 tracking-widest mb-1">SECTOR BREADTH</div>
      <div className="flex items-end gap-1 h-8">
        {sectors.map((s) => (
          <div
            key={s.sector}
            className="flex-1 relative cursor-default"
            style={{ height: '100%' }}
            onMouseEnter={() => setHovered(s.sector)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: `${Math.max(8, (Math.abs(s.avg) / maxAbs) * 100)}%`,
                background: s.avg >= 0 ? 'var(--color-gain)' : 'var(--color-loss)',
                opacity: 0.85,
              }}
            />
            {hovered === s.sector && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-terminal-panel border border-terminal-border-gold text-2xs whitespace-nowrap z-10">
                {s.abbr} {fmt.pct(s.avg)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketsSnapshotCard() {
  return (
    <Card title="KEY INDICES" className="min-w-0">
      <div>
        {KEY_INDICES.map((idx) => <MiniIndexRow key={idx.symbol} symbol={idx.symbol} label={idx.label} live={idx.live} />)}
        <div className="flex items-center justify-between py-1 text-2xs font-mono">
          <span className="text-terminal-text-dim">BTC/AUD</span>
          <div className="flex items-center gap-2">
            {(() => {
              const btc = MOCK_CRYPTO.find((c) => c.symbol === 'btc')
              return btc ? (
                <>
                  <span className="text-terminal-text-bright font-semibold">A${fmt.price(btc.current_price / 0.652, 0)}</span>
                  <span className={`font-semibold w-14 text-right ${btc.price_change_percentage_24h >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {btc.price_change_percentage_24h >= 0 ? '▲' : '▼'}{Math.abs(btc.price_change_percentage_24h).toFixed(2)}%
                  </span>
                </>
              ) : null
            })()}
          </div>
        </div>
      </div>
      <SectorBreadthMini />
    </Card>
  )
}

function WatchlistRow({ symbol }) {
  const isAsx = symbol.endsWith('.AX')
  const { quote } = useLivePrice(isAsx ? symbol : null)
  const q = quote ?? getMockFMPRow(symbol)
  if (!q) return <div className="text-2xs text-terminal-text-dim py-1">{symbol} — not found</div>
  const pct = q.regularMarketChangePercent
  return (
    <div className="flex items-center justify-between py-1 text-2xs font-mono border-b border-terminal-border/30 last:border-b-0">
      <span className="text-terminal-gold font-semibold">{symbol.replace('.AX', '')}</span>
      <div className="flex items-center gap-2">
        <span className="text-terminal-text-bright">{fmt.price(q.regularMarketPrice, 2)}</span>
        <span className={`font-semibold w-14 text-right ${pct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

function WatchlistPreviewCard({ goto }) {
  const { watchlist } = useStore()
  const preview = watchlist.slice(0, 5)
  return (
    <Card title="WATCHLIST" className="min-w-0">
      <div className="flex flex-col h-full">
        {preview.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-2xs text-terminal-text-dim">Add stocks to track</div>
            <button onClick={() => goto('watchlist')} className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-3 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">+ ADD</button>
          </div>
        ) : (
          <div className="flex-1">
            {preview.map((sym) => <WatchlistRow key={sym} symbol={sym} />)}
          </div>
        )}
        <button onClick={() => goto('watchlist')} className="text-2xs text-terminal-gold hover:underline mt-2 self-start">VIEW ALL →</button>
      </div>
    </Card>
  )
}

function ActivityFeedCard() {
  const [entries] = useState(() => {
    const real = getActivityLog(8)
    if (real.length) return real
    // Empty-state demo content, clearly labelled — not fabricated as real history.
    return [
      { id: 'demo1', type: 'brief', text: 'Morning brief generated', timestamp: Date.now() - 3 * 3600_000, demo: true },
      { id: 'demo2', type: 'unusual', text: 'Unusual activity: WTC 4.2x volume', timestamp: Date.now() - 5 * 3600_000, demo: true },
      { id: 'demo3', type: 'ai', text: 'Asked MaddenAI about BHP.AX', timestamp: Date.now() - 8 * 3600_000, demo: true },
    ]
  })
  return (
    <Card title="RECENT ACTIVITY" className="min-w-0">
      {entries[0]?.demo && <div className="text-[9px] text-terminal-gold/60 tracking-widest mb-1.5">● DEMO — your real activity will appear here</div>}
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-1.5 text-2xs">
            <span className="text-terminal-gold flex-shrink-0">{iconFor(e.type)}</span>
            <span className="text-terminal-text-dim flex-1 min-w-0">{e.text}</span>
            <span className="text-terminal-text-dim/50 flex-shrink-0 font-mono">{timeAgo(e.timestamp)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── BOTTOM ROW ─────────────────────────────────────────────────────────────

function LatestNewsCard({ goto }) {
  const { data } = useQuery({ queryKey: ['news'], queryFn: fetchNews, staleTime: 3 * 60_000, select: (d) => d?.articles ?? [] })
  const items = (data ?? []).slice(0, 3)
  return (
    <Card title="LATEST NEWS">
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="text-2xs text-terminal-text-dim">No news loaded yet</div>
        ) : items.map((n, i) => (
          <div key={i} className="flex items-start gap-1.5 text-2xs border-b border-terminal-border/30 last:border-b-0 pb-1.5 last:pb-0">
            {n.category && <span className="text-[9px] font-bold text-terminal-gold border border-terminal-gold/40 px-1 flex-shrink-0 mt-0.5">{n.category.toUpperCase()}</span>}
            <span className="text-terminal-text-dim flex-1 min-w-0 truncate">{n.headline}</span>
            <span className="text-terminal-text-dim/50 flex-shrink-0">{timeAgo(n.pubDate)}</span>
          </div>
        ))}
      </div>
      <button onClick={() => goto('news')} className="text-2xs text-terminal-gold hover:underline mt-2">VIEW NEWS →</button>
    </Card>
  )
}

function UpcomingEventsCard({ goto }) {
  const { data } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  const items = data ? upcomingEvents(data.events, 120).slice(0, 3) : []
  return (
    <Card title="UPCOMING EVENTS">
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="text-2xs text-terminal-text-dim">No upcoming events</div>
        ) : items.map((e) => (
          <div key={`${e.date}-${e.event}`} className="flex items-center justify-between text-2xs border-b border-terminal-border/30 last:border-b-0 pb-1.5 last:pb-0 gap-2">
            <span className="text-terminal-text-dim flex-shrink-0 w-16">{relativeDate(e.date)}</span>
            <span className="text-terminal-text-bright flex-1 min-w-0 truncate">{e.event}</span>
            <span className={`text-[9px] font-bold px-1 flex-shrink-0 ${
              e.importance === 'high' ? 'text-terminal-red' : e.importance === 'medium' ? 'text-terminal-gold' : 'text-terminal-muted'
            }`}>
              ●{e.importance?.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <button onClick={() => goto('calendar')} className="text-2xs text-terminal-gold hover:underline mt-2">VIEW CALENDAR →</button>
    </Card>
  )
}

function QuickActionsCard({ goto }) {
  const actions = [
    { label: '🔍 Screen Stocks', target: 'screener' },
    { label: '☀ Morning Brief', target: 'brief' },
    { label: '📊 Research Note', target: 'markets' },
    { label: '⚡ Set Alert', target: 'watchlist' },
    { label: '⏮ Market Replay', target: 'replay' },
    { label: '📅 View Calendar', target: 'calendar' },
  ]
  return (
    <Card title="QUICK ACTIONS">
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => goto(a.target)}
            className="text-2xs font-semibold text-terminal-gold border border-terminal-gold/40 px-2 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors text-center"
          >
            {a.label}
          </button>
        ))}
      </div>
    </Card>
  )
}

// ─── Getting started overlay ────────────────────────────────────────────────

const ONBOARD_STEPS = [
  { id: 'watchlist', label: 'Add stocks to watchlist', target: 'watchlist' },
  { id: 'portfolio', label: 'Track portfolio holdings', target: 'portfolio' },
  { id: 'brief', label: 'Generate morning brief', target: 'brief' },
  { id: 'ai', label: 'Try MaddenAI', target: null },
]

function GettingStartedOverlay({ goto, onDismiss }) {
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}') } catch { return {} }
  })
  const toggle = (id) => {
    const next = { ...done, [id]: !done[id] }
    setDone(next)
    try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)) } catch { /* best-effort */ }
  }
  return (
    <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-terminal-panel border border-terminal-border-gold p-6 w-[380px] max-w-[90vw] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">SET UP YOUR TERMINAL</span>
          <button onClick={onDismiss} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>
        <div className="space-y-2.5">
          {ONBOARD_STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => { toggle(s.id); if (s.target) goto(s.target); else window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt: '', context: 'Getting started' } })) }}
              className="flex items-center gap-2.5 w-full text-left group"
            >
              <span className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 text-[10px] ${done[s.id] ? 'bg-terminal-gold border-terminal-gold text-terminal-bg' : 'border-terminal-border text-transparent group-hover:border-terminal-gold/50'}`}>
                {done[s.id] ? '✓' : ''}
              </span>
              <span className={`text-xs ${done[s.id] ? 'text-terminal-text-dim line-through' : 'text-terminal-text-bright'}`}>{s.label}</span>
              <span className="ml-auto text-terminal-gold/60 text-2xs">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Root ───────────────────────────────────────────────────────────────────

export default function DashboardModule() {
  const { setActiveModule, watchlist } = useStore()
  const [holdingsCount] = useState(() => {
    try { return (JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]')).length } catch { return 0 }
  })
  const [showOnboarding, setShowOnboarding] = useState(true)
  const goto = (moduleId) => setActiveModule(moduleId)
  const isEmpty = watchlist.length === 0 && holdingsCount === 0

  return (
    <div className="h-full overflow-y-auto relative">
      <ModuleHeader title="DASHBOARD" subtitle="Your terminal at a glance" />
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PortfolioSnapshotCard goto={goto} />
          <MarketScoreCard goto={goto} />
          <NextEventCard goto={goto} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[40%_35%_25%] gap-3">
          <MarketsSnapshotCard />
          <WatchlistPreviewCard goto={goto} />
          <ActivityFeedCard />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <LatestNewsCard goto={goto} />
          <UpcomingEventsCard goto={goto} />
          <QuickActionsCard goto={goto} />
        </div>
      </div>

      {isEmpty && showOnboarding && (
        <GettingStartedOverlay goto={goto} onDismiss={() => setShowOnboarding(false)} />
      )}
    </div>
  )
}
