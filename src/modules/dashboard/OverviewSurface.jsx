import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { useAudRates } from '../../hooks/useAudRates'
import { requireYFSym } from '../../utils/tickerGuard'
import { sydneyClock, sydneyOffset, formatDate } from '../../utils/dateUtils'
import { classOfResult } from '../../utils/dataClass'
import { formatCryptoPrice } from '../../utils/cryptoSource'
import DataBadge from '../../components/ui/DataBadge'
import PriceChange from '../../components/ui/PriceChange'
import ScoreNote from '../../components/ui/ScoreNote'
import { computePortfolioSnapshot, holdingRows, byMove } from './portfolioSnapshot'

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

function Panel({ title, badge, action, onAction, className = '', children, id }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 min-h-0 flex flex-col border border-terminal-border bg-terminal-panel ${className}`}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 border-b border-terminal-border flex-shrink-0 min-w-0">
        <h2 id={id} className="font-mono font-semibold tracking-widest text-terminal-gold whitespace-nowrap" style={{ fontSize: 11 }}>{title}</h2>
        <span className="flex-1" />
        {badge && <span className="flex flex-wrap justify-end gap-1 order-last w-full sm:order-none sm:w-auto">{badge}</span>}
        {action && <button onClick={onAction} className="font-mono tracking-widest text-terminal-text-dim hover:text-terminal-gold whitespace-nowrap flex-shrink-0" style={{ fontSize: 11 }}>{action} →</button>}
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
          <Stat label="SENTIMENT" value={<span data-sentiment-score={ms.sentiment?.score} style={{ color: ms.sentiment?.color }}>{ms.sentiment?.score ?? '—'}</span>}
            sub={<span className="text-terminal-text-dim">{ms.sentiment ? `${ms.sentiment.label} · computed` : ms.status === 'loading' ? 'reading data…' : 'no data yet'}</span>} />
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

function RbaMacro({ goTo }) {
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
    <Panel id="ov-rba" title="RBA & MACRO" action="RATES" onAction={() => goTo('fx')}
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

function Holdings({ h, goTo }) {
  const th = 'text-right font-normal font-mono tracking-widest text-terminal-text-dim pb-1'
  return (
    <Panel id="ov-holdings" title="HOLDINGS · BY TODAY'S MOVE" action="PORTFOLIO" onAction={() => goTo('portfolio')}
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
function Watchlist({ goTo }) {
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
    <Panel id="ov-watch" title="WATCHLIST · BY TODAY'S MOVE" action="WATCHLIST" onAction={() => goTo('watchlist')}
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
function SinceLastVisit({ asx200, portfolioValue }) {
  const [prev] = useState(() => beginVisit())
  const [openedAt] = useState(() => Date.now())
  useEffect(() => { recordVisit({ asx200, portfolioValue }) }, [asx200, portfolioValue])
  const items = useMemo(() => sinceLastVisit(prev, { at: openedAt, asx200, portfolioValue }, { constants: VERIFIED_CONSTANTS, alerts: loadAlertHistory(), changes: DATED_CHANGES }), [prev, openedAt, asx200, portfolioValue])
  return (
    <Panel id="ov-since" title="SINCE YOUR LAST VISIT" badge={prev?.at && <span className="font-mono text-terminal-text-dim" style={{ fontSize: 11 }}>{formatDate(prev.at, { weekday: true, year: false })} {sydneyClock(prev.at).text}</span>}>
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

// ── Coming up ───────────────────────────────────────────────────────────────
function ComingUp({ goTo }) {
  const { data, isLoading } = useQuery({ queryKey: ['econCalendar'], queryFn: getEconomicCalendar, staleTime: 6 * 60 * 60_000 })
  const events = pendingEvents(data?.events ?? [], 14).slice(0, 8)
  return (
    <Panel id="ov-coming" title="COMING UP · 14 DAYS" action="CALENDAR" onAction={() => goTo('calendar')} className="overview-wide"
      badge={data && (data.source === 'fallback'
        ? <DataBadge cls="STALE" source="built-in schedule (live calendar unavailable)" />
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
                    {t && /^\d{1,2}:\d{2}$/.test(e.time ?? '') ? ` ${sydneyClock(t).time}` : ''}
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

export default function OverviewSurface() {
  const { setActiveModule } = useStore()
  const h = useHoldings()
  const { data: idx } = useQuery({ queryKey: ['yfBatch', 'indices'], queryFn: () => fetchIndexQuotesUnified(ALL_INDEX_SYMBOLS), staleTime: 60_000, retry: 1 })
  return (
    <div className="flex-1 min-h-0 overflow-auto p-2">
      <div className="grid gap-2 overview-grid">
        <MarketState />
        <RbaMacro goTo={setActiveModule} />
        <Holdings h={h} goTo={setActiveModule} />
        <Watchlist goTo={setActiveModule} />
        <SinceLastVisit asx200={idx?.data?.['^AXJO']?.last ?? null} portfolioValue={h.stats?.value ?? null} />
        <ComingUp goTo={setActiveModule} />
      </div>
    </div>
  )
}
