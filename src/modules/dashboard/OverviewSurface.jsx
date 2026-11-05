import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { YF_INDICES, USING_MOCK_DATA, EQUITY_SOURCE, transformCryptoMarkets } from '../../services/api'
import { fetchIndexQuotesUnified, fetchCryptoMarketsUnified, fetchFxRatesUnified, fetchEquityQuotes } from '../../services/dataService'
import { getEconomicCalendar, pendingEvents, eventInstant } from '../../services/calendarService'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { DATED_CHANGES } from '../../data/datedChanges'
import { currentRegime } from '../../services/marketRegime'
import { loadAlertHistory } from '../../services/alertsService'
import { beginVisit, recordVisit, sinceLastVisit } from '../../services/lastVisit'
import { useMarketSentiment, sentimentTooltip } from '../../hooks/useMarketSentiment'
import SentimentClass from '../../components/ui/SentimentClass'
import { useAudRates } from '../../hooks/useAudRates'
import { requireYFSym } from '../../utils/tickerGuard'
import { sydneyClock, sydneyOffset, formatDate } from '../../utils/dateUtils'
import { classOfResult } from '../../utils/dataClass'
import { formatCryptoPrice } from '../../utils/cryptoSource'
import DataBadge from '../../components/ui/DataBadge'
import PriceChange from '../../components/ui/PriceChange'
import ScoreNote from '../../components/ui/ScoreNote'
import { computePortfolioSnapshot, holdingRows, byMove } from './portfolioSnapshot'
import { queryHealth, healthSummary, SCREEN_FEEDS } from '../../services/dataHealth'
import { useOfficialCheck } from '../../hooks/useOfficialCheck'
import { getCachedBrief, isAuWeekend, auHour, briefHourLabel } from '../../services/morningBriefService'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'
import { readOrder, saveOrder, clearOrder, moveId, OVERVIEW_PANELS } from './overviewOrder'

// OVERVIEW — the dashboard's default view: one dense screen, in the order a
// returning investor reads it. Market state across the top; the RBA and the
// macro regime with the decision countdown; holdings; watchlist; what changed
// since the last visit; what is coming. Every panel names its data class,
// source and time. The customisable widget grid is one click away (CUSTOM).

const STRIP = ['^AXJO', '^GSPC', '^IXIC', '^N225', '^FTSE', '^HSI']
const ALL_INDEX_SYMBOLS = YF_INDICES.map((i) => i.symbol)
const LABEL = Object.fromEntries(YF_INDICES.map((i) => [i.symbol, i.label.toUpperCase()]))
const PORTFOLIO_KEY = 'madden_portfolio_v2'
const fmtNum = (v, dp = 1) => (v == null ? '—' : v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp }))
const fmtAud = (v, dp = 2) => (v == null ? '—' : `${v < 0 ? '−' : ''}A$${Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`)
const longDate = (iso) => formatDate(iso, { weekday: true })

function Panel({ title, badge, action, onAction, className = '', children, id, arrange }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 min-h-0 flex flex-col border border-terminal-border bg-terminal-panel ${className}`}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 border-b border-terminal-border flex-shrink-0 min-w-0">
        <h2 id={id} className="font-mono font-semibold tracking-widest text-terminal-gold whitespace-nowrap" style={{ fontSize: 11 }}>{title}</h2>
        <span className="flex-1" />
        {badge && <span className="flex flex-wrap justify-end gap-1 order-last w-full sm:order-none sm:w-auto">{badge}</span>}
        {action && <button onClick={onAction} className="font-mono tracking-widest text-terminal-text-dim hover:text-terminal-gold whitespace-nowrap flex-shrink-0" style={{ fontSize: 11 }}>{action} →</button>}
        {arrange && (
          <span className="flex gap-1 flex-shrink-0" data-arrange={arrange.id}>
            {[[-1, '◀', 'earlier'], [1, '▶', 'later']].map(([dir, glyph, word]) => (
              <button key={dir} onClick={() => arrange.move(arrange.id, dir)} disabled={dir < 0 ? arrange.first : arrange.last}
                aria-label={`Move ${title} ${word}`}
                className="font-mono px-2 border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg disabled:opacity-30 disabled:pointer-events-none"
                style={{ fontSize: 11, minWidth: 28, minHeight: 24 }}>{glyph}</button>
            ))}
          </span>
        )}
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2">{children}</div>
    </section>
  )
}

const Empty = ({ children, action, onAction }) => (
  <div className="h-full flex flex-col items-start justify-center gap-1.5 text-terminal-text-dim" style={{ fontSize: 12 }}>
    <span>{children}</span>
    {action && <button onClick={onAction} className="font-mono tracking-widest text-terminal-gold hover:underline" style={{ fontSize: 11 }}>{action} →</button>}
  </div>
)

function Stat({ label, value, sub, tone, title }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="font-mono tracking-widest text-terminal-text-dim truncate" style={{ fontSize: 11 }}>{label}</div>
      <div className="font-mono tabular-nums text-terminal-text-bright truncate" style={{ fontSize: 16, color: tone }}>{value}</div>
      {sub != null && <div className="font-mono tabular-nums truncate" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  )
}

// ── Market state ─────────────────────────────────────────────────────────────
function MarketState() {
  const { data: idx, dataUpdatedAt: idxAt } = useQuery({ queryKey: ['yfBatch', 'indices'], queryFn: () => fetchIndexQuotesUnified(ALL_INDEX_SYMBOLS), staleTime: 60_000, retry: 1 })
  const { data: crypto } = useQuery({ queryKey: ['cryptoMarkets', 'aud'], queryFn: () => fetchCryptoMarketsUnified('aud'), staleTime: 60_000, retry: 1 })
  const { data: fx } = useQuery({ queryKey: ['fxRates'], queryFn: () => fetchFxRatesUnified('AUD'), staleTime: 5 * 60_000, retry: 1 })
  const ms = useMarketSentiment()
  const btc = crypto?.data ? transformCryptoMarkets(crypto.data, 'aud').find((c) => c.symbol === 'BTC') : null
  const audUsd = fx?.data?.USD ?? null
  return (
    <Panel id="ov-market" title="MARKET STATE" className="col-span-full"
      badge={<>
        <DataBadge cls={classOfResult(idx, { demo: USING_MOCK_DATA })} source={`indices · ${EQUITY_SOURCE}`} at={idx?.stale ? idx.cachedAt : idxAt || null} />
        {/* ECB reference rates are set once a working day: DELAYED, dated by
            the ECB's rate date (it said LIVE with the fetch time). */}
        <DataBadge cls={classOfResult(fx, { delayed: true })} source="FX · ECB reference rate" at={fx?.stale ? fx.cachedAt : fx?.data?.asOf ?? null} />
        {crypto && <DataBadge cls={classOfResult(crypto)} source={`BTC · ${crypto.meta?.provider}`} at={crypto.stale ? crypto.cachedAt : crypto.meta?.at ?? null} />}
      </>}>
      <div className="grid gap-x-4 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}>
        {STRIP.map((s) => {
          const q = idx?.data?.[s]
          return <Stat key={s} label={LABEL[s]} value={fmtNum(q?.last)} sub={<PriceChange pct={q?.pct ?? null} size="text-[11px]" />} />
        })}
        <Stat label="AUD/USD" value={audUsd != null ? audUsd.toFixed(4) : '—'} sub={<span className="text-terminal-text-dim">ECB reference</span>} />
        <Stat label="BTC" value={btc ? formatCryptoPrice(btc.price, btc.currency) : '—'} sub={<PriceChange pct={btc?.pct24h ?? null} size="text-[11px]" />} />
        <div title={sentimentTooltip(ms)}>
          <Stat label="SENTIMENT" value={<span className="inline-flex items-center gap-1.5"><span data-sentiment-score={ms.sentiment?.score} style={{ color: ms.sentiment?.color }}>{ms.sentiment?.score ?? '—'}</span><SentimentClass ms={ms} /></span>}
            sub={<span className="text-terminal-text-dim">{ms.sentiment ? `${ms.sentiment.label} · ${ms.demo ? 'demo composite' : 'computed'}` : ms.status === 'loading' ? 'reading data…' : 'no data yet'}</span>} />
        </div>
      </div>
      {ms.sentiment && <ScoreNote method="sentiment" inputs={ms.inputs} asOf={ms.asOf} className="px-2 pb-1.5" />}
    </Panel>
  )
}

// ── RBA and the macro regime ────────────────────────────────────────────────
function decisionInstant(rba) {
  const m = String(rba.nextMeetingTime ?? '').match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (!m) return null
  let h = Number(m[1]) % 12
  if (m[3].toLowerCase() === 'pm') h += 12
  return new Date(`${rba.nextMeeting}T${String(h).padStart(2, '0')}:${m[2]}:00${sydneyOffset(rba.nextMeeting)}`)
}

function Countdown({ at }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id) }, [])
  if (!at) return null
  const ms = at.getTime() - now
  if (ms <= 0) return <span className="text-terminal-gold">Decision due — the terminal updates once the statement is read</span>
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return <span className="tabular-nums text-terminal-text-bright" data-countdown>{d > 0 ? `${d} day${d === 1 ? '' : 's'} ` : ''}{h} hr {m} min</span>
}

function RbaMacro({ goTo, arrange }) {
  const { rba, au } = VERIFIED_CONSTANTS
  const regime = useMemo(() => currentRegime(), [])
  const at = decisionInstant(rba)
  const row = (k, v, src) => (
    <div className="flex items-baseline justify-between gap-3 py-0.5 border-b border-terminal-border/40 last:border-0" style={{ fontSize: 12 }}>
      <span className="text-terminal-text-dim">{k}</span>
      <span className="text-right tabular-nums text-terminal-text-bright">{v}{src && <span className="text-terminal-text-dim"> · {src}</span>}</span>
    </div>
  )
  return (
    <Panel id="ov-rba" arrange={arrange} title="RBA & MACRO" action="RATES" onAction={() => goTo('fx')}
      badge={<DataBadge cls="DELAYED" source="RBA, ABS" at={rba.lastDecision} />}>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 11 }}>CASH RATE</div>
          <div className="font-mono tabular-nums text-terminal-gold leading-none" style={{ fontSize: 28 }}>{rba.cashRate.toFixed(2)}%</div>
          <div className="font-mono text-terminal-text-dim mt-1" style={{ fontSize: 11 }}>{rba.lastDecisionVerb} {rba.lastChange} · {longDate(rba.lastDecision)}</div>
        </div>
        <div className="min-w-0">
          <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 11 }}>NEXT DECISION · {longDate(rba.nextMeeting)}, {rba.nextMeetingTime}</div>
          <div className="font-mono" style={{ fontSize: 13 }}>TIME TO DECISION <Countdown at={at} /></div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 11 }}>REGIME</span>
        <span className="font-mono font-bold tracking-widest" style={{ fontSize: 12, color: regime.colour }}>{regime.regime}</span>
      </div>
      <div className="mt-1">
        {row('RBA', regime.inputs?.rba ?? '—')}
        {row('CPI', `${au.cpi}% y/y`, `${au.cpiPeriod}, ABS ${formatDate(au.cpiLastRelease)}`)}
        {row('Trimmed mean (qtr)', `${au.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q`, au.cpiQuarterPeriod)}
        {row('Unemployment', `${au.unemployment}%`, `${au.unemploymentPeriod}, ABS ${formatDate(au.unemploymentLastRelease)}`)}
        {row('GDP', `${au.gdpAnnual}% y/y`, au.gdpPeriod)}
        {row('Next CPI', longDate(au.cpiNextRelease))}
        {row('Next Labour Force', longDate(au.unemploymentNextRelease))}
      </div>
    </Panel>
  )
}

// ── Holdings ────────────────────────────────────────────────────────────────
function useHoldings() {
  const [holdings] = useState(() => { try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]') } catch { return [] } })
  const priceable = useMemo(() => holdings.filter((h) => h.type === 'asx' || h.type === 'us'), [holdings])
  const symbols = useMemo(() => priceable.map(requireYFSym).filter(Boolean), [priceable])
  const { data, dataUpdatedAt } = useQuery({ queryKey: ['dashPortfolio', symbols], queryFn: () => fetchEquityQuotes(symbols), enabled: symbols.length > 0, staleTime: 60_000, retry: 1 })
  const { usdToAud } = useAudRates()
  const stats = useMemo(() => computePortfolioSnapshot(priceable, data?.data ?? {}, usdToAud), [priceable, data, usdToAud])
  const rows = useMemo(() => byMove(holdingRows(priceable, data?.data ?? {}, usdToAud)), [priceable, data, usdToAud])
  return { holdings, stats, rows, data, dataUpdatedAt }
}

function Holdings({ h, goTo, arrange }) {
  const th = 'text-right font-normal font-mono tracking-widest text-terminal-text-dim pb-1'
  return (
    <Panel id="ov-holdings" arrange={arrange} title="HOLDINGS · BY TODAY'S MOVE" action="PORTFOLIO" onAction={() => goTo('portfolio')}
      badge={h.data && <DataBadge cls={classOfResult(h.data, { demo: USING_MOCK_DATA })} source={EQUITY_SOURCE} at={h.data.stale ? h.data.cachedAt : h.dataUpdatedAt || null} />}>
      {!h.holdings.length ? <Empty action="ADD HOLDINGS" onAction={() => goTo('portfolio')}>No holdings yet. Add what you own to see value, P&amp;L and rate exposure here.</Empty> : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <Stat label="VALUE" value={fmtAud(h.stats?.value, 0)} />
            <Stat label="TODAY" value={h.stats?.dayPnl != null ? fmtAud(h.stats.dayPnl, 0) : '—'} sub={<PriceChange pct={h.stats?.dayPct ?? null} size="text-[11px]" />} />
            <Stat label="TOTAL P&L" value={h.stats ? fmtAud(h.stats.pnl, 0) : '—'} sub={<PriceChange pct={h.stats?.pnlPct ?? null} size="text-[11px]" />} />
          </div>
          <table className="w-full font-mono" style={{ fontSize: 12 }}>
            <thead><tr><th className={`${th} text-left`} style={{ fontSize: 11 }}>SYMBOL</th><th className={th} style={{ fontSize: 11 }}>LAST</th><th className={th} style={{ fontSize: 11 }}>DAY</th><th className={th} style={{ fontSize: 11 }}>VALUE</th><th className={th} style={{ fontSize: 11 }}>P&amp;L</th><th className={th} style={{ fontSize: 11 }}>WEIGHT</th></tr></thead>
            <tbody>
              {h.rows.map((r) => (
                <tr key={r.symbol} className="border-t border-terminal-border/40">
                  <td className="py-1 text-terminal-text-bright">{r.symbol}</td>
                  <td className="text-right tabular-nums">{fmtAud(r.last)}</td>
                  <td className="text-right"><PriceChange pct={r.pct} size="text-[12px]" className="justify-end" showArrow={false} /></td>
                  <td className="text-right tabular-nums">{fmtAud(r.value, 0)}</td>
                  <td className="text-right"><PriceChange pct={r.pnlPct} size="text-[12px]" className="justify-end" showArrow={false} /></td>
                  <td className="text-right tabular-nums text-terminal-text-dim">{r.weight != null ? `${r.weight.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  )
}

// ── Watchlist ───────────────────────────────────────────────────────────────
function Watchlist({ goTo, arrange }) {
  const { watchlist } = useStore()
  const { usdToAud } = useAudRates()
  const syms = (watchlist ?? []).map((w) => w.symbol ?? w)
  // Quotes for every equity on the list, so the movers are chosen from all
  // of it; the panel shows the 14 largest moves and says how many more.
  const all = syms.filter((s) => /\.AX$/.test(s) || /^[A-Z]{1,5}$/.test(s))
  const { data, dataUpdatedAt } = useQuery({ queryKey: ['dashWatchlist', all], queryFn: () => fetchEquityQuotes(all), enabled: all.length > 0, staleTime: 60_000, retry: 1 })
  const ranked = byMove(all, (s) => data?.data?.[s]?.pct ?? null)
  const equities = ranked.slice(0, 14)
  const more = all.length - equities.length
  const other = syms.length - all.length
  return (
    <Panel id="ov-watch" arrange={arrange} title="WATCHLIST · BY TODAY'S MOVE" action="WATCHLIST" onAction={() => goTo('watchlist')}
      badge={data && <DataBadge cls={classOfResult(data, { demo: USING_MOCK_DATA })} source={EQUITY_SOURCE} at={data.stale ? data.cachedAt : dataUpdatedAt || null} />}>
      {!equities.length ? <Empty action="ADD STOCKS" onAction={() => goTo('watchlist')}>Your watchlist is empty.</Empty> : (
        <table className="w-full font-mono" style={{ fontSize: 12 }}>
          <tbody>
            {equities.map((s) => {
              const q = data?.data?.[s]
              const aud = q?.last == null ? null : q.currency === 'USD' ? usdToAud(q.last) : q.last
              return (
                <tr key={s} className="border-t border-terminal-border/40 first:border-0">
                  <td className="py-1 text-terminal-text-bright">{s.replace('.AX', '')}</td>
                  <td className="text-right tabular-nums">{fmtAud(aud)}</td>
                  <td className="text-right w-20"><PriceChange pct={q?.pct ?? null} size="text-[12px]" className="justify-end" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {(more > 0 || other > 0) && (
        <div className="mt-1 font-mono text-terminal-text-dim" style={{ fontSize: 11 }} data-watch-more>
          {[more > 0 && `${more} more on the list`, other > 0 && `${other} non-equity (crypto, FX) not shown here`].filter(Boolean).join(' · ')}
        </div>
      )}
    </Panel>
  )
}

// ── Since your last visit ───────────────────────────────────────────────────
function SinceLastVisit({ asx200, portfolioValue, arrange }) {
  const [prev] = useState(() => beginVisit())
  const [openedAt] = useState(() => Date.now())
  useEffect(() => { recordVisit({ asx200, portfolioValue }) }, [asx200, portfolioValue])
  const items = useMemo(() => sinceLastVisit(prev, { at: openedAt, asx200, portfolioValue }, { constants: VERIFIED_CONSTANTS, alerts: loadAlertHistory(), changes: DATED_CHANGES }), [prev, openedAt, asx200, portfolioValue])
  return (
    <Panel id="ov-since" arrange={arrange} title="SINCE YOUR LAST VISIT" badge={prev?.at && <span className="font-mono text-terminal-text-dim" style={{ fontSize: 11 }}>{formatDate(prev.at, { weekday: true, year: false })} {sydneyClock(prev.at).text}</span>}>
      {!prev?.at ? <Empty>First visit on this device. Changes from now on will be listed here next time.</Empty>
        : !items.length ? <Empty>Nothing has changed since your last visit.</Empty> : (
          <ul className="space-y-1" style={{ fontSize: 12 }}>
            {items.map((i) => (
              <li key={i.text} className="flex gap-2">
                <span className="font-mono tracking-widest text-terminal-text-dim w-20 flex-shrink-0 uppercase" style={{ fontSize: 11 }}>{i.kind}</span>
                <span className="text-terminal-text-bright" style={{ color: i.value != null ? (i.value >= 0 ? 'var(--color-up, #3FB06B)' : 'var(--color-down-text, #E06666)') : undefined }}>{i.text}</span>
              </li>
            ))}
          </ul>
        )}
    </Panel>
  )
}

// ── Today's brief ───────────────────────────────────────────────────────────
// Read from the Brief module's own cache: no AI call from here.

function BriefSummary({ goTo, arrange }) {
  const [brief, setBrief] = useState(() => getCachedBrief())
  useEffect(() => { const id = setInterval(() => setBrief(getCachedBrief()), 60_000); return () => clearInterval(id) }, [])
  const weekend = isAuWeekend()
  const has = brief && !brief.isWeekend
  const first = has ? (brief.headline || brief.sections?.[0]?.content || '') : ''
  return (
    <Panel id="ov-brief" arrange={arrange} title="TODAY'S BRIEF" action="BRIEF" onAction={() => goTo('brief')}
      badge={has && <AIContentBadge source="cache" />}>
      {!has ? (
        <Empty action={weekend ? null : 'OPEN BRIEF'} onAction={() => goTo('brief')}>
          {weekend ? `No brief at the weekend. The next one is Monday from ${briefHourLabel()}.`
            : auHour() < 7 ? `Today's brief is written from ${briefHourLabel()}.`
            : 'No brief yet today. Open Brief to have MaddenAI write it from the day\'s data.'}
        </Empty>
      ) : (
        <div className="flex flex-col gap-1.5 h-full" data-brief-summary>
          <p className="text-terminal-text-bright leading-snug line-clamp-5" style={{ fontSize: 12 }}>{first}</p>
          <div className="mt-auto font-mono text-terminal-text-dim" style={{ fontSize: 11 }}>
            Written by MaddenAI from the data shown{brief.generatedAt ? ` · ${formatDate(brief.generatedAt, { weekday: true, year: false })} ${sydneyClock(brief.generatedAt).text}` : ''} · general information, not advice
          </div>
        </div>
      )}
    </Panel>
  )
}

// ── Coming up ───────────────────────────────────────────────────────────────
function ComingUp({ goTo, arrange }) {
  const { data, isLoading } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  const events = pendingEvents(data?.events ?? [], 14).slice(0, 8)
  return (
    <Panel id="ov-coming" arrange={arrange} title="COMING UP · 14 DAYS" action="CALENDAR" onAction={() => goTo('calendar')}
      badge={data && (data.source === 'fallback'
        ? <DataBadge cls="STALE" source="built-in schedule" />
        : <DataBadge cls="LIVE" source="economic calendar" />)}>
      {isLoading ? <Empty>Loading the calendar…</Empty> : !events.length ? <Empty>No scheduled events in the next 14 days.</Empty> : (
        <table className="w-full" style={{ fontSize: 12 }}>
          <tbody>
            {events.map((e) => {
              const t = eventInstant(e)
              return (
                <tr key={`${e.date}-${e.event ?? e.title}`} className="border-t border-terminal-border/40 first:border-0">
                  <td className="py-1 pr-2 font-mono text-terminal-text-dim whitespace-nowrap" style={{ fontSize: 11 }}>
                    {formatDate(e.date, { weekday: true, year: false })}
                    {t && /^\d{1,2}:\d{2}$/.test(e.time ?? '') ? ` ${sydneyClock(t).text}` : ''}
                  </td>
                  <td className="text-terminal-text-bright">{e.event ?? e.title}</td>
                  <td className="text-right font-mono tracking-widest text-terminal-text-dim uppercase" style={{ fontSize: 11 }}>{e.importance ?? ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

// ── Data health ─────────────────────────────────────────────────────────────
// One line: are the feeds behind this screen fresh, and do the hand-entered
// official figures still match the agencies? The detail is Settings → Data
// Sources, one click away.
function DataHealthLine() {
  const check = useOfficialCheck()
  const qc = useQueryClient()
  const [tick, setTick] = useState(0)
  // Re-read whenever any query settles, so the line moves with the panels.
  useEffect(() => qc.getQueryCache().subscribe((e) => { if (e?.type === 'updated') setTick((t) => t + 1) }), [qc])
  const h = useMemo(() => healthSummary(queryHealth(SCREEN_FEEDS.map(([label, key]) => ({ label, state: qc.getQueryState(key) && { ...qc.getQueryState(key), data: qc.getQueryData(key) } }))), check),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, check])
  const open = () => window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: { section: 'DATA SOURCES' } }))
  const tone = h.ok ? 'var(--color-up, #3FB06B)' : '#D9773B'
  const parts = [
    `Feeds: ${h.fresh} fresh`,
    h.stale.length ? `${h.stale.length} stale (${h.stale.join(', ')})` : null,
    h.notLoaded ? `${h.notLoaded} not loaded yet` : null,
    h.stats ? `Official stats: ${h.stats.match} of ${h.stats.total} match${h.stats.drift ? `, ${h.stats.drift} differ` : ''}${h.stats.unavailable ? `, ${h.stats.unavailable} unavailable` : ''}${h.stats.at ? ` (checked ${sydneyClock(h.stats.at).text})` : ''}`
      : 'Official stats: not checked yet this session',
  ].filter(Boolean)
  return (
    <section aria-labelledby="ov-health" className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border border-terminal-border bg-terminal-panel font-mono" style={{ fontSize: 11 }} data-health-line>
      <h2 id="ov-health" className="font-semibold tracking-widest text-terminal-gold">DATA HEALTH</h2>
      <span style={{ color: tone }} aria-hidden="true">{h.ok ? '●' : '▲'}</span>
      <span className="text-terminal-text min-w-0">{parts.join(' · ')}</span>
      <button onClick={open} className="ml-auto tracking-widest text-terminal-text-dim hover:text-terminal-gold whitespace-nowrap">DETAILS →</button>
    </section>
  )
}

export default function OverviewSurface({ arranging = false, onDoneArranging }) {
  const { setActiveModule } = useStore()
  const [order, setOrder] = useState(() => readOrder())
  const move = (id, dir) => setOrder((o) => { const next = moveId(o, id, dir); saveOrder(next); return next })
  const reset = () => { clearOrder(); setOrder([...OVERVIEW_PANELS]) }
  const arrangeFor = (id) => arranging ? { id, move, first: order[0] === id, last: order[order.length - 1] === id } : undefined
  const h = useHoldings()
  const { data: idx } = useQuery({ queryKey: ['yfBatch', 'indices'], queryFn: () => fetchIndexQuotesUnified(ALL_INDEX_SYMBOLS), staleTime: 60_000, retry: 1 })
  return (
    <div className="flex-1 min-h-0 overflow-auto p-2">
      {arranging && (
        <div className="mb-2 flex flex-wrap items-center gap-3 px-3 py-1.5 border border-terminal-gold/50 font-mono" style={{ fontSize: 11 }} data-arranging>
          <span className="tracking-widest text-terminal-gold">ARRANGING</span>
          <span className="text-terminal-text">◀ ▶ on each panel moves it. Kept on this device.</span>
          <button onClick={reset} className="ml-auto tracking-widest text-terminal-text-dim hover:text-terminal-gold">RESET ORDER</button>
          <button onClick={onDoneArranging} className="tracking-widest text-terminal-gold hover:underline">DONE</button>
        </div>
      )}
      <div className="grid gap-2 overview-grid">
        <MarketState />
        {order.map((id) => ({
          rba: <RbaMacro key={id} goTo={setActiveModule} arrange={arrangeFor(id)} />,
          holdings: <Holdings key={id} h={h} goTo={setActiveModule} arrange={arrangeFor(id)} />,
          watch: <Watchlist key={id} goTo={setActiveModule} arrange={arrangeFor(id)} />,
          since: <SinceLastVisit key={id} asx200={idx?.data?.['^AXJO']?.last ?? null} portfolioValue={h.stats?.value ?? null} arrange={arrangeFor(id)} />,
          brief: <BriefSummary key={id} goTo={setActiveModule} arrange={arrangeFor(id)} />,
          coming: <ComingUp key={id} goTo={setActiveModule} arrange={arrangeFor(id)} />,
        })[id])}
        <DataHealthLine />
      </div>
    </div>
  )
}
