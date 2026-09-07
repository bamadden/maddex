import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { sendAlertEmail } from '../../services/alertEmailService'
import { timeAgo } from '../../utils/dateUtils'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { fetchEquityQuotes, fetchIndexQuotesUnified } from '../../services/dataService'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { dispatchAskAI } from '../../utils/askAI'
import { getAiPreferences } from '../../services/aiPreferencesService'
import { loadAlerts, checkAlerts, markTriggered } from '../../services/alertsService'
import { upcomingEarnings, daysUntil } from '../../services/earningsCalendar'
import AlertsModule from '../../modules/alerts/AlertsModule'
import { logActivity } from '../../services/activityLogService'
import { soundService } from '../../services/soundService'
import {
  getHistory, groupHistoryByDay, removeHistory, clearHistory,
  shouldSendDigest, markDigestSent, buildDigest, inQuietHours,
} from '../../services/notificationPolicy'

// One face, one weight, one baseline. Every glyph here is text-presentation,
// so it inherits the panel's colour and the monospace metrics rather than
// arriving as a coloured bitmap from the OS.
const TYPE_ICON  = { DAILY_DIGEST: '▣', PRICE_ALERT: '⚡', MARKET_OPEN: '▲', NEWS: '≡', SYSTEM: '✦', CALENDAR: '◈', WATCHLIST_MOVE: '◆', CUSTOM_ALERT: '⚑', EARNINGS_RESULT: '⊞' }
// Icon-circle background per type — gold for price/alert-family, blue for
// earnings/calendar, green for news, muted for system.
const TYPE_CIRCLE = {
  PRICE_ALERT: 'bg-terminal-gold/15 text-terminal-gold',
  CUSTOM_ALERT: 'bg-terminal-gold/15 text-terminal-gold',
  MARKET_OPEN: 'bg-terminal-gold/15 text-terminal-gold',
  EARNINGS_RESULT: 'bg-terminal-blue-bright/15 text-terminal-blue-bright',
  CALENDAR: 'bg-terminal-blue-bright/15 text-terminal-blue-bright',
  NEWS: 'bg-terminal-green/15 text-terminal-green',
  WATCHLIST_MOVE: 'bg-terminal-green/15 text-terminal-green',
  DAILY_DIGEST: 'bg-terminal-blue-bright/15 text-terminal-blue-bright',
  SYSTEM: 'bg-terminal-muted/15 text-terminal-muted',
}
const TYPE_LABEL = { PRICE_ALERT: 'PRICE ALERT', MARKET_OPEN: 'MARKET OPEN', NEWS: 'NEWS', SYSTEM: 'SYSTEM', WATCHLIST_MOVE: 'WATCHLIST', CUSTOM_ALERT: 'ALERT', CALENDAR: 'EARNINGS', DAILY_DIGEST: 'DAILY DIGEST', EARNINGS_RESULT: 'EARNINGS RESULT' }
// Summary wording when several of a type arrive together. "3 price alerts
// triggered" is the headline; the individual messages are one click away.
const TYPE_SUMMARY = {
  PRICE_ALERT: (n) => `${n} price alerts triggered`,
  CUSTOM_ALERT: (n) => `${n} alerts triggered`,
  WATCHLIST_MOVE: (n) => `${n} watchlist stocks are moving`,
  NEWS: (n) => `${n} stories worth a look`,
  CALENDAR: (n) => `${n} earnings reminders`,
}
const summaryFor = (type, n) => (TYPE_SUMMARY[type] ?? ((c) => `${c} ${TYPE_LABEL[type] ?? type} notifications`))(n)

const TOAST_MS = 6000
const TOAST_MAX_MS = 14000


// Today's date key, AEST — used to show the market-open notification once
// per day rather than once per minute-check.
function todayKey(prefix) {
  return `${prefix}_${new Date().toLocaleDateString('en-CA')}`
}

// Mirrors NewsModule's BREAKING_RE — a headline is breaking on keyword match
// plus recency, since the feed carries no `breaking` flag of its own.
const BREAKING_RE = /rate (cut|hike)|crash|collapse|record (high|low)|emergency|crisis|\bwar\b|sanction|default|bankruptcy|merger|acquisition|\bIPO\b|surge/i

function isBreakingHeadline(item) {
  if (!item?.pubDate || item.dateEstimated) return false
  const ageMs = Date.now() - new Date(item.pubDate).getTime()
  return ageMs <= 30 * 60_000 && BREAKING_RE.test(item.headline ?? '')
}

// Word-boundary match so "ALL" doesn't fire on "generally".
function headlineMentions(headline, symbol) {
  if (!headline || !symbol) return false
  const base = symbol.replace('.AX', '').trim()
  if (base.length < 2) return false
  return new RegExp(`\\b${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(headline)
}

// ── Alerts pane ────────────────────────────────────────────────────────────
//
// Shows what you are waiting for, grouped by symbol, with how close each one
// is to firing. Proximity is the point: a list of alerts tells you what you
// asked for, but "97% of the way there" tells you which one to care about
// this morning.
//
// The proximity figure is a ratio of the live price to the target, clamped to
// 100. For an ABOVE alert that is price/target; for a BELOW alert it inverts
// to target/price, so both read "closer to 100 means closer to firing" rather
// than one counting up and the other down.
function alertProximity(alert, price) {
  if (price == null || !alert?.price) return null
  const ratio = (alert.direction === 'below') ? alert.price / price : price / alert.price
  return Math.max(0, Math.min(100, Math.round(ratio * 100)))
}

function AlertsPane({ alerts, onRemove }) {
  const symbols = useMemo(
    () => [...new Set((alerts ?? []).map((a) => toYahooSymbol(a.sym, detectAssetType(a.sym))))],
    [alerts],
  )

  // Prices for the proximity readout. Reuses the same quote path the alert
  // checker uses, so the number here and the trigger agree.
  const { data: quoteResult } = useQuery({
    queryKey: ['alertPaneQuotes', symbols],
    queryFn: () => fetchEquityQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60_000,
  })
  const quotes = quoteResult?.data

  if (!alerts?.length) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
        <span className="text-2xl opacity-40">⚡</span>
        <div className="text-2xs text-terminal-text-bright font-semibold">No alerts set</div>
        <div className="text-2xs text-terminal-text-dim/60">Set one from the ⚡ on any watchlist row</div>
      </div>
    )
  }

  const bySymbol = {}
  for (const a of alerts) {
    const k = a.sym?.toUpperCase() ?? '—'
    ;(bySymbol[k] ??= []).push(a)
  }

  return (
    <div className="max-h-96 overflow-auto">
      {Object.entries(bySymbol).map(([sym, list]) => {
        const price = quotes?.[toYahooSymbol(sym, detectAssetType(sym))]?.last
        return (
          <div key={sym} className="border-b border-terminal-border/40 px-3 py-2">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xs font-bold text-terminal-text-bright">{sym}</span>
              <span className="text-2xs text-terminal-text-dim tabular-nums">
                {price != null ? `A$${price.toFixed(2)}` : '—'}
              </span>
            </div>
            {list.map((a) => {
              const pct = alertProximity(a, price)
              const close = pct != null && pct >= 95
              return (
                <div key={a.id} className="flex items-center gap-2 py-0.5">
                  <span className="text-2xs flex-shrink-0" style={{ color: close ? '#C9A84C' : '#4A6080' }}>⚡</span>
                  <span className="text-2xs text-terminal-text-dim flex-1 min-w-0 truncate">
                    {(a.direction ?? 'above').toUpperCase()} A${Number(a.price).toFixed(2)}
                  </span>
                  {pct != null && (
                    <span
                      className="text-2xs tabular-nums flex-shrink-0"
                      title="How close this alert is to firing"
                      style={{ color: close ? '#C9A84C' : '#637899' }}
                    >{pct}%</span>
                  )}
                  <button
                    onClick={() => onRemove(a.id)}
                    title="Remove alert"
                    className="text-2xs text-terminal-text-dim/50 hover:text-terminal-red flex-shrink-0"
                  >✕</button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default function NotificationCenter() {
  const {
    notifications, addNotification, markNotificationRead, markAllNotificationsRead, clearAllNotifications,
    alerts, removeAlert, watchlist,
  } = useStore()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const ref = useRef(null)
  const seenToastIds  = useRef(null)
  const seenNewsIds   = useRef(new Set())
  const alertedMoversToday = useRef(new Set())
  // Set while the pointer is over the toast stack or a group is expanded — the
  // sweeper skips those ticks so a toast never vanishes mid-read.
  const toastHold = useRef(false)
  // Queued between arrival and the next sweeper tick (≤250ms).
  const pendingToasts = useRef([])
  const [expandedToast, setExpandedToast] = useState(null)

  if (seenToastIds.current === null) {
    // Don't toast whatever was already in localStorage on first mount.
    seenToastIds.current = new Set(notifications.map((n) => n.id))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  // Which pane of the dropdown is showing. Alerts live here rather than in
  // a separate surface because 'what am I waiting for' and 'what just
  // happened' are the same question asked a moment apart.
  const [pane, setPane] = useState('feed')

  // Seven days of notifications, read from storage rather than from the store
  // — the bell only keeps the last 20. Recomputed rather than held in state so
  // there is no second copy to fall out of date; historyBump is what a
  // deletion nudges, since removing a row does not change `notifications`.
  const [historyBump, setHistoryBump] = useState(0)
  const history = useMemo(() => {
    void notifications; void historyBump   // both are inputs: re-read on either
    return open && pane === 'history' ? getHistory() : []
  }, [open, pane, notifications, historyBump])
  const historyGroups = useMemo(() => groupHistoryByDay(history), [history])

  const dropHistory = useCallback((ids) => {
    removeHistory(ids)
    setHistoryBump((b) => b + 1)
  }, [])

  // Outside click closed this, Escape did not.
  useEscapeKey(() => setOpen(false), open)

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Toast any notification (from anywhere in the app) we haven't shown yet —
  // if its priority earns an interrupt. See notificationPolicy.js: MEDIUM and
  // LOW land in the bell silently, and quiet hours demote HIGH to the same.
  //
  // This walks EVERY unseen notification rather than just notifications[0].
  // The alert checker fires all its hits inside one loop, React batches those
  // into a single render, and the old version — which only ever looked at the
  // head of the list — showed one toast and silently dropped the rest. That is
  // also precisely the case grouping exists for, so the bug hid the feature.
  useEffect(() => {
    const fresh = []
    // Oldest first, so a group reads in the order things actually happened.
    for (let i = notifications.length - 1; i >= 0; i--) {
      const n = notifications[i]
      if (seenToastIds.current.has(n.id)) continue
      seenToastIds.current.add(n.id)
      if (!(n.toast ?? true)) continue
      fresh.push(n)
    }
    if (!fresh.length) return

    // A grouped card holds more to read than a single line, so it gets longer
    // on screen — six seconds is right for "BHP hit your target" and much too
    // short for a summary you are meant to consider expanding.
    const perType = {}
    for (const n of fresh) perType[n.type] = (perType[n.type] ?? 0) + 1
    const now = Date.now()
    pendingToasts.current.push(...fresh.map((n) => ({
      ...n,
      expiresAt: now + Math.min(TOAST_MS + (perType[n.type] - 1) * 1500, TOAST_MAX_MS),
    })))
  }, [notifications])

  // One sweeper owns the whole toast queue: it admits what the effect above
  // queued and retires what has expired. Both halves run in the timer callback
  // rather than in an effect body, so a burst of notifications produces one
  // state update instead of a cascade — and "hold while the user is reading"
  // is a single flag rather than a pile of timer ids to chase, which is what
  // expanding a group needs.
  useEffect(() => {
    const id = setInterval(() => {
      const incoming = pendingToasts.current
      if (toastHold.current && incoming.length === 0) return
      pendingToasts.current = []
      setToasts((prev) => {
        const now = Date.now()
        const kept = toastHold.current ? prev : prev.filter((t) => t.expiresAt > now)
        if (incoming.length === 0 && kept.length === prev.length) return prev
        return [...kept, ...incoming]
      })
    }, 250)
    return () => clearInterval(id)
  }, [])

  // Coming off a hold, give everything a moment rather than letting the whole
  // stack disappear the instant the pointer leaves.
  const releaseHold = useCallback(() => {
    toastHold.current = false
    setToasts((prev) => prev.map((t) => ({ ...t, expiresAt: Math.max(t.expiresAt, Date.now() + 2500) })))
  }, [])

  // Toasts grouped by type, in the order each type first appeared.
  const toastGroups = useMemo(() => {
    const order = []
    const byType = new Map()
    for (const t of toasts) {
      if (!byType.has(t.type)) { byType.set(t.type, []); order.push(t.type) }
      byType.get(t.type).push(t)
    }
    return order.map((type) => ({ type, items: byType.get(type) }))
  }, [toasts])

  const dismissGroup = useCallback((type) => {
    setToasts((prev) => prev.filter((t) => t.type !== type))
    // Dismissing the expanded group must also drop the hold, or the sweeper
    // stays paused and every later toast sits on screen forever.
    setExpandedToast((cur) => {
      if (cur === type) toastHold.current = false
      return cur === type ? null : cur
    })
  }, [])

  // ── PRICE ALERT — poll watchlist-style quotes for any active alert ─────────
  // Alerts created via the CommandBar's ALERT {sym} {price} text command have
  // no `direction` field (defaults to 'above' in addAlert) — "reached your
  // target" for those is treated as price rising to meet or pass it. Alerts
  // created via the DetailModal's bell-icon form can also target 'below'.
  useEffect(() => {
    if (!alerts.length) return
    const check = async () => {
      const symbols = alerts.map((a) => toYahooSymbol(a.sym, detectAssetType(a.sym)))
      try {
        const { data } = await fetchEquityQuotes(symbols)
        for (const alert of alerts) {
          const yfSym = toYahooSymbol(alert.sym, detectAssetType(alert.sym))
          const q = data?.[yfSym]
          const hit = alert.direction === 'below'
            ? q?.last != null && q.last <= alert.price
            : q?.last != null && q.last >= alert.price
          if (hit) {
            addNotification('PRICE_ALERT', `${alert.sym} reached your target of A$${alert.price.toFixed(2)}`)
            // Second copy, for someone who is not looking at the tab. The
            // in-app notification above has already been delivered, so this is
            // deliberately not awaited and its failure is not surfaced.
            sendAlertEmail({
              symbol: alert.sym,
              direction: alert.direction ?? 'above',
              value: alert.price,
              currentPrice: q.last,
            })
            removeAlert(alert.id)
          }
        }
      } catch {
        // Alerts just get checked again next tick
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [alerts, addNotification, removeAlert])

  // ── WATCHLIST MOVE — any tracked symbol crossing +/-2% intraday gets a
  // notification plus a MaddenAI-generated one-line reason, dispatched into
  // the AI panel the same way every other "Ask AI" button in the app does.
  // Each symbol only fires once per session (todayKey-scoped set) so a
  // stock hovering right at the 2% line doesn't spam on every poll.
  useEffect(() => {
    if (!watchlist.length) return
    const check = async () => {
      const symbols = watchlist.map((s) => toYahooSymbol(s, detectAssetType(s)))
      try {
        const { data } = await fetchEquityQuotes(symbols)
        for (const sym of watchlist) {
          const yfSym = toYahooSymbol(sym, detectAssetType(sym))
          const q = data?.[yfSym]
          const pct = q?.dayChangePct
          if (pct == null || Math.abs(pct) < 2) continue
          const key = todayKey(`madden_notif_mover_${sym}`)
          if (alertedMoversToday.current.has(key)) continue
          alertedMoversToday.current.add(key)
          const dir = pct >= 0 ? 'up' : 'down'

          // The auto-analysis honours the Auto-Analyse preference, which
          // defaults OFF. It previously fired regardless — so a setting that
          // exists, is documented in Settings and defaults to off was silently
          // overridden, and the AI panel took over the screen and spent a call
          // on nearly every load (demo prices jitter across ±2% constantly).
          // A notification is a notification; opening a panel over whatever
          // someone was reading is not.
          if (!getAiPreferences().autoAnalyse) {
            addNotification('WATCHLIST_MOVE', `${sym} moved ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% today`)
            continue
          }

          addNotification('WATCHLIST_MOVE', `${sym} moved ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% today — asking MaddenAI why`)
          dispatchAskAI({
            name: q.name ?? sym, ticker: sym,
            price: q.price != null ? q.price.toFixed(2) : undefined,
            change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
            instruction:
              `This watchlist stock just moved ${dir} ${Math.abs(pct).toFixed(2)}% today. ` +
              // "Give the most likely specific reason" asked for a cause the
              // model has no news feed to know, and it answered with a list of
              // candidates — an earnings miss OR a tariff escalation OR a
              // regulatory ruling — presented as analysis. Naming what to
              // check is honest and more useful than a guess dressed as a
              // finding.
              'In 1-2 sentences: say what category of driver a move this size in this sector usually implies, ' +
              'and name the specific thing to check to confirm it. Do not assert a cause you have not been given — ' +
              'you have no news feed for this move. Concise and direct; this is a push alert, not a report.',
          })
        }
      } catch {
        // Try again next tick
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [watchlist, addNotification])

  // ── MARKET OPEN — ASX 200, 09:58–10:02 AEST Mon–Fri, once per day ──────────
  useEffect(() => {
    const check = async () => {
      const aest = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
      const day = aest.getDay()
      if (day === 0 || day === 6) return
      const mins = aest.getHours() * 60 + aest.getMinutes()
      if (mins < 9 * 60 + 58 || mins > 10 * 60 + 2) return
      const key = todayKey('madden_notif_mktopen')
      if (localStorage.getItem(key)) return
      try {
        const { data } = await fetchIndexQuotesUnified(['^AXJO'])
        const pct = data?.['^AXJO']?.pct
        const pctText = pct != null ? ` — ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(2)}%` : ''
        // The sound follows the notification's own treatment rather than
        // firing unconditionally — quiet hours mean quiet.
        if (addNotification('MARKET_OPEN', `ASX 200 has opened${pctText}`)?.sound) soundService.marketOpen()
        localStorage.setItem(key, '1')
      } catch {
        // Try again next minute — key is only set on success
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [addNotification])

  // ── NEWS — deliberately narrow. Background refreshes must never notify.
  // Previously ANY article under 5 minutes old fired one, and fetchNews was
  // stamping date-less articles with a random time inside the last 10
  // minutes, so roughly half of them qualified the moment they arrived. Now
  // only two things notify: a genuinely breaking headline (keyword match +
  // under 30 min old, matching the News module's own definition), or a story
  // naming a symbol the user actually tracks. Estimated dates never count.
  // Everything else surfaces as the in-feed "N NEW STORIES" pill instead.
  useEffect(() => {
    const check = () => {
      // getQueryData returns the raw cached fetchNews() result — the
      // `select: d => d?.articles ?? []` on App.jsx's useQuery only
      // transforms data for that hook's own consumers, not direct cache reads.
      const articles = queryClient.getQueryData(['news'])?.articles ?? []
      for (const item of articles) {
        if (!item.pubDate || item.dateEstimated) continue
        const id = item.link || item.headline
        if (seenNewsIds.current.has(id)) continue

        const breaking = isBreakingHeadline(item)
        const mentioned = watchlist.find((sym) => headlineMentions(item.headline, sym))
        if (!breaking && !mentioned) continue

        // Only mark seen once it actually qualifies, so a story that becomes
        // watchlist-relevant after the user adds the symbol can still notify.
        seenNewsIds.current.add(id)
        addNotification(
          'NEWS',
          breaking
            ? `🔴 BREAKING — ${item.headline.slice(0, 60)}${item.headline.length > 60 ? '…' : ''}`
            : `${mentioned} in the news — ${item.headline.slice(0, 60)}${item.headline.length > 60 ? '…' : ''}`,
        )
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [queryClient, addNotification, watchlist])

  // ── CUSTOM ALERTS — the alertsService alerts engine (price/session-move/
  // NOTE: this effect existed TWICE, byte-identical, each on its own 60s
  // interval. Both ran check() on mount in the same tick, and both read
  // loadAlerts() before either called markTriggered — so the lastFiredDate
  // guard could not help and every alert fired twice: two notifications,
  // two sounds. One copy removed.
  // volume-spike/RSI/news-mention/economic-event/portfolio-P&L), separate
  // from the simple CommandBar ALERT list above. Checked every 60s; fired
  // alerts get a notification and are marked triggered so they don't re-fire
  // the same day. ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const engineAlerts = loadAlerts()
      if (!engineAlerts.length) return
      const articles = queryClient.getQueryData(['news'])?.articles ?? []
      const newsHeadlines = articles.map((a) => a.headline).filter(Boolean)
      const results = checkAlerts(engineAlerts, { symbols: watchlist, newsHeadlines })
      for (const { alert, message } of results) {
        const n = addNotification('CUSTOM_ALERT', message)
        markTriggered(alert.id)
        logActivity('alert', message)
        if (n?.sound) soundService.priceAlert()
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [queryClient, addNotification, watchlist])

  // ── EARNINGS — notify once, 2 days before a watchlist stock reports.
  // Watchlist-scoped (not every ASX_STOCKS ticker) to avoid noise for
  // stocks the user doesn't actually track. ──────────────────────────────
  useEffect(() => {
    if (!watchlist.length) return
    const check = () => {
      for (const sym of watchlist) {
        const e = upcomingEarnings().find((ev) => ev.ticker === sym || ev.ticker === `${sym}.AX`)
        if (!e || daysUntil(e.date) !== 2) continue
        const key = todayKey(`madden_notif_earnings_${e.ticker}_${e.date}`)
        if (localStorage.getItem(key)) continue
        addNotification('CALENDAR', `${e.ticker.replace('.AX', '')} reports in 2 days — earnings preview ready`)
        localStorage.setItem(key, '1')
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [watchlist, addNotification])

  // ── DAILY DIGEST — one summary per market day, after 4:30pm AEST ──────────
  //
  // Composed from the notification history this app actually recorded today
  // plus the live ASX 200 close, so every clause in it is a count of something
  // that happened rather than a written-up view of the day. shouldSendDigest
  // owns the once-per-day guard; it is checked on mount and on the same 60s
  // tick as everything else, so both "opens the app at 9pm" and "leaves it
  // open through the close" get exactly one.
  useEffect(() => {
    const check = async () => {
      if (!shouldSendDigest()) return
      let close = null
      try {
        const { data } = await fetchIndexQuotesUnified(['^AXJO'])
        close = data?.['^AXJO'] ?? null
      } catch {
        // Digest still goes out — it just leads with the counts instead of
        // the close, rather than not arriving at all.
      }
      markDigestSent()
      addNotification('DAILY_DIGEST', buildDigest({ close }).message)
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [addNotification])

  // The AI EARNINGS ANALYST poll that sat here is gone.
  //
  // It called simulateEarningsResult, which produced a beat or a miss from
  // Math.random(), then pushed "CSL EARNINGS: BEAT +8.3% — Analysis ready"
  // as a notification, seeded a News feed card, and flipped a RESULTS badge
  // in the Watchlist. Three authoritative-looking surfaces, all downstream of
  // a coin flip. This terminal has no earnings-results feed, so it now
  // reports no earnings results. The "reports in 2 days" notification above
  // stays — those dates are real.


  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          const next = !open
          setOpen(next)
          // Opening the inbox retires the toasts. They occupy the same corner
          // as the dropdown, and a preview of a notification has nothing to
          // add once you are looking at the notification itself.
          if (next) { setToasts([]); setExpandedToast(null); toastHold.current = false }
        }}
        className="relative flex items-center justify-center w-6 h-7 text-terminal-text-dim hover:text-terminal-gold transition-colors"
        title="Notifications"
      >
        <span className="text-sm">◎</span>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-terminal-red"
            title={`${unreadCount} unread`}
          />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-terminal-panel border border-terminal-border shadow-2xl z-[90]" style={{ width: 320 }}>
          <div className="flex items-center border-b border-terminal-border">
            {[['feed', 'INBOX'], ['alerts', `ALERTS${alerts.length ? ` (${alerts.length})` : ''}`], ['history', 'HISTORY']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPane(id)}
                aria-pressed={pane === id}
                className={`flex-1 text-2xs font-bold tracking-widest py-2 transition-colors border-b-2 ${
                  pane === id ? 'text-terminal-gold border-b-terminal-gold' : 'text-terminal-text-dim border-b-transparent hover:text-terminal-gold'
                }`}
              >{label}</button>
            ))}
          </div>

          {pane === 'feed' && notifications.length > 0 && (
            <div className="flex items-center justify-end gap-3 px-3 py-1 border-b border-terminal-border/50">
              <button onClick={markAllNotificationsRead} className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors">
                MARK ALL READ
              </button>
              <button onClick={clearAllNotifications} className="text-2xs text-terminal-text-dim hover:text-terminal-red transition-colors">
                CLEAR ALL
              </button>
            </div>
          )}

          {pane === 'alerts' && <AlertsPane alerts={alerts} onRemove={removeAlert} />}

          {pane === 'history' && (
            <>
              <div className="flex items-center justify-between px-3 py-1 border-b border-terminal-border/50">
                <span className="text-2xs text-terminal-text-dim/60">Last 7 days · {history.length}</span>
                {history.length > 0 && (
                  <button
                    onClick={() => { clearHistory(); setHistoryBump((b) => b + 1) }}
                    className="text-2xs text-terminal-text-dim hover:text-terminal-red transition-colors"
                  >CLEAR ALL</button>
                )}
              </div>
              <div className="max-h-96 overflow-auto">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
                    <span className="text-2xl opacity-40">≡</span>
                    <div className="text-2xs text-terminal-text-bright font-semibold">Nothing in the last 7 days</div>
                    <div className="text-2xs text-terminal-text-dim/60">History builds up as notifications arrive</div>
                  </div>
                ) : (
                  Object.entries(historyGroups).map(([day, items]) => items.length === 0 ? null : (
                    <div key={day}>
                      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1 bg-terminal-panel border-b border-terminal-border/50">
                        <span className="text-2xs text-terminal-gold font-bold tracking-widest">
                          {day} <span className="text-terminal-text-dim/60 tabular-nums">({items.length})</span>
                        </span>
                        <button
                          onClick={() => dropHistory(items.map((n) => n.id))}
                          title={`Clear ${day.toLowerCase()}`}
                          className="text-2xs text-terminal-text-dim/60 hover:text-terminal-red transition-colors"
                        >CLEAR</button>
                      </div>
                      {items.map((n) => (
                        <div key={n.id} className="group flex items-start gap-2 px-3 py-1.5 border-b border-terminal-border/30">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_CIRCLE[n.type] ?? 'bg-terminal-muted/15 text-terminal-muted'}`} style={{ fontSize: 10 }}>
                            {TYPE_ICON[n.type] ?? '•'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-2xs text-terminal-text-bright leading-snug">{n.message}</div>
                            <div className="text-2xs text-terminal-text-dim/50 mt-0.5">
                              {TYPE_LABEL[n.type] ?? n.type}
                              {n.priority ? ` · ${n.priority}` : ''}
                              {' · '}{new Date(n.createdAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <button
                            onClick={() => dropHistory(n.id)}
                            title="Remove"
                            className="text-2xs text-terminal-text-dim/30 hover:text-terminal-red flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <div className="max-h-96 overflow-auto" hidden={pane !== 'feed'}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
                <span className="text-2xl opacity-40">◎</span>
                <div className="text-2xs text-terminal-text-bright font-semibold">All caught up</div>
                <div className="text-2xs text-terminal-text-dim/60">No new notifications</div>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={`flex items-start gap-2 px-3 py-2 border-b border-terminal-border/40 cursor-pointer hover:bg-terminal-accent/20 transition-colors ${n.read ? 'opacity-50' : ''}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${TYPE_CIRCLE[n.type] ?? 'bg-terminal-muted/15 text-terminal-muted'}`}>
                    {TYPE_ICON[n.type] ?? '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xs text-terminal-gold/70 font-bold tracking-wider">{TYPE_LABEL[n.type] ?? n.type}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-terminal-blue-bright flex-shrink-0" />}
                    </div>
                    <div className="text-2xs text-terminal-text-bright leading-snug mt-0.5">{n.message}</div>
                    <div className="text-2xs text-terminal-text-dim/50 mt-0.5">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-terminal-border px-3 py-1.5">
            <button
              onClick={() => { setManageOpen(true); setOpen(false) }}
              className="text-2xs text-terminal-gold hover:text-terminal-gold-bright transition-colors"
            >⚙ MANAGE ALERTS</button>
            {inQuietHours() && (
              <span className="ml-2 text-2xs text-terminal-text-dim/60" title="Only price alerts interrupt during quiet hours">
                · ◗ quiet hours
              </span>
            )}
          </div>
        </div>
      )}

      {manageOpen && <AlertsModule onClose={() => setManageOpen(false)} />}

      {/* Toasts — slide in from the right, stack downward. Several of a kind
          collapse into one card ("3 price alerts triggered") that expands on
          click, so a busy minute costs one slot on screen instead of ten. */}
      <div
        className="fixed top-14 right-3 z-[95] flex flex-col gap-2 pointer-events-none"
        onMouseEnter={() => { toastHold.current = true }}
        onMouseLeave={() => { if (!expandedToast) releaseHold() }}
      >
        {!open && toastGroups.map(({ type, items }) => {
          const grouped = items.length > 1
          const expanded = expandedToast === type
          const accent = (TYPE_CIRCLE[type] ?? '').includes('blue') ? 'var(--mt-blue-bright, #2D7DD2)'
            : (TYPE_CIRCLE[type] ?? '').includes('green') ? 'var(--mt-green, #2D8A50)' : '#C9A84C'
          return (
            <div
              key={type}
              className="pointer-events-auto w-72 bg-terminal-panel border border-terminal-gold/40 border-l-2 shadow-2xl panel-slide-in overflow-hidden"
              style={{ borderLeftColor: accent }}
            >
              <div className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-terminal-gold text-xs">{TYPE_ICON[type] ?? '•'}</span>
                  <span className="text-2xs text-terminal-gold/70 font-bold tracking-wider">{TYPE_LABEL[type] ?? type}</span>
                  {grouped && (
                    <span className="text-2xs tabular-nums px-1 rounded-sm bg-terminal-gold/20 text-terminal-gold font-bold">{items.length}</span>
                  )}
                  <span className="flex-1" />
                  <button
                    onClick={() => dismissGroup(type)}
                    title="Dismiss"
                    className="text-2xs text-terminal-text-dim/50 hover:text-terminal-red"
                  >✕</button>
                </div>

                {grouped && !expanded ? (
                  <button
                    onClick={() => { setExpandedToast(type); toastHold.current = true }}
                    className="text-left w-full group"
                  >
                    <div className="text-2xs text-terminal-text-bright leading-snug mt-0.5">{summaryFor(type, items.length)}</div>
                    <div className="text-2xs text-terminal-gold/60 mt-0.5 group-hover:text-terminal-gold">Click to see all {items.length} →</div>
                  </button>
                ) : (
                  <div className="mt-0.5 space-y-1">
                    {items.map((t) => (
                      <div key={t.id} className="text-2xs text-terminal-text-bright leading-snug flex gap-1.5">
                        {grouped && <span className="text-terminal-gold/40 flex-shrink-0">·</span>}
                        <span className="min-w-0">{t.message}</span>
                      </div>
                    ))}
                    {grouped && (
                      <button
                        onClick={() => { setExpandedToast(null); releaseHold() }}
                        className="text-2xs text-terminal-text-dim/60 hover:text-terminal-gold"
                      >Collapse</button>
                    )}
                  </div>
                )}
              </div>
              {!expanded && <div className="h-0.5 bg-terminal-gold/60 toast-progress" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
