import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { fetchEquityQuotes, fetchIndexQuotesUnified } from '../../services/dataService'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { dispatchAskAI } from '../../utils/askAI'
import { loadAlerts, checkAlerts, markTriggered } from '../../services/alertsService'
import { upcomingEarnings, daysUntil } from '../../services/earningsCalendar'
import { checkAndAnalyseEarnings } from '../../services/earningsAnalystService'
import AlertsModule from '../../modules/alerts/AlertsModule'
import { logActivity } from '../../services/activityLogService'
import { soundService } from '../../services/soundService'

const TYPE_ICON  = { PRICE_ALERT: '◎', MARKET_OPEN: '▲', NEWS: '📰', SYSTEM: '✦', CALENDAR: '📅', WATCHLIST_MOVE: '◆', CUSTOM_ALERT: '⚑', EARNINGS_RESULT: '📊' }
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
  SYSTEM: 'bg-terminal-muted/15 text-terminal-muted',
}
const TYPE_LABEL = { PRICE_ALERT: 'PRICE ALERT', MARKET_OPEN: 'MARKET OPEN', NEWS: 'NEWS', SYSTEM: 'SYSTEM', WATCHLIST_MOVE: 'WATCHLIST', CUSTOM_ALERT: 'ALERT', CALENDAR: 'EARNINGS', EARNINGS_RESULT: 'EARNINGS RESULT' }

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Today's date key, AEST — used to show the market-open notification once
// per day rather than once per minute-check.
function todayKey(prefix) {
  return `${prefix}_${new Date().toLocaleDateString('en-CA')}`
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

  if (seenToastIds.current === null) {
    // Don't toast whatever was already in localStorage on first mount.
    seenToastIds.current = new Set(notifications.map((n) => n.id))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Toast any notification (from anywhere in the app) we haven't shown yet.
  useEffect(() => {
    const latest = notifications[0]
    if (!latest || seenToastIds.current.has(latest.id)) return
    seenToastIds.current.add(latest.id)
    setToasts((prev) => [...prev, latest])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== latest.id)), 6000)
  }, [notifications])

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
          addNotification('WATCHLIST_MOVE', `${sym} moved ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% today — asking MaddenAI why`)
          dispatchAskAI({
            name: q.name ?? sym, ticker: sym,
            price: q.price != null ? q.price.toFixed(2) : undefined,
            change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
            instruction:
              `This watchlist stock just moved ${dir} ${Math.abs(pct).toFixed(2)}% today. ` +
              'In 1-2 sentences, give the most likely specific reason (sector news, commodity/rate moves, ' +
              'volume vs average, or broader market direction). Be concise and direct — this is a push-style alert, not a full report.',
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
        addNotification('MARKET_OPEN', `ASX 200 has opened${pctText}`)
        soundService.marketOpen()
        localStorage.setItem(key, '1')
      } catch {
        // Try again next minute — key is only set on success
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [addNotification])

  // ── NEWS — breaking (published in the last 5 min) headlines already being
  // fetched for the News module's badge (App.jsx keeps ['news'] warm) ────────
  useEffect(() => {
    const check = () => {
      // getQueryData returns the raw cached fetchNews() result — the
      // `select: d => d?.articles ?? []` on App.jsx's useQuery only
      // transforms data for that hook's own consumers, not direct cache reads.
      const articles = queryClient.getQueryData(['news'])?.articles ?? []
      for (const item of articles) {
        if (!item.pubDate) continue
        const isBreaking = Date.now() - new Date(item.pubDate).getTime() <= 5 * 60_000
        if (!isBreaking) continue
        const id = item.link || item.headline
        if (seenNewsIds.current.has(id)) continue
        seenNewsIds.current.add(id)
        addNotification('NEWS', `Breaking: ${item.headline}`)
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [queryClient, addNotification])

  // ── CUSTOM ALERTS — the alertsService alerts engine (price/session-move/
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
        addNotification('CUSTOM_ALERT', message)
        markTriggered(alert.id)
        logActivity('alert', message)
        soundService.priceAlert()
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

  // ── AI EARNINGS ANALYST — once a watchlist stock's earnings date has
  // passed, simulate the print and have MaddenAI analyse it automatically:
  // fire a notification, and (via earningsAnalystService's cache) flip the
  // Watchlist badge from "EARNINGS IN Xd" to "RESULTS: BEAT/MISS". The News
  // feed card is NOT pushed from here — NewsModule reads completed results
  // straight from the same localStorage cache (see getAllEarningsResults),
  // since pushing into the ['news'] query cache would just get silently
  // dropped by that query's own periodic RSS refetch. checkAndAnalyseEarnings
  // is itself idempotent (caches per ticker), this loop just polls it. ──────
  useEffect(() => {
    if (!watchlist.length) return
    const inFlight = new Set()
    const check = () => {
      for (const sym of watchlist) {
        if (inFlight.has(sym)) continue
        inFlight.add(sym)
        checkAndAnalyseEarnings(sym)
          .then((result) => {
            inFlight.delete(sym)
            if (!result) return
            addNotification('EARNINGS_RESULT', result.message)
          })
          .catch(() => { inFlight.delete(sym) })
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [watchlist, addNotification])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-7 h-7 text-terminal-text-dim hover:text-terminal-gold transition-colors"
        title="Notifications"
      >
        <span className="text-sm">🔔</span>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-terminal-red"
            title={`${unreadCount} unread`}
          />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-terminal-panel border border-terminal-border shadow-2xl z-[90]" style={{ width: 320 }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border">
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">NOTIFICATIONS</span>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                <button onClick={markAllNotificationsRead} className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors">
                  MARK ALL READ
                </button>
                <button onClick={clearAllNotifications} className="text-2xs text-terminal-text-dim hover:text-terminal-red transition-colors">
                  CLEAR ALL
                </button>
              </div>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
                <span className="text-2xl opacity-40">🔔</span>
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
          </div>
        </div>
      )}

      {manageOpen && <AlertsModule onClose={() => setManageOpen(false)} />}

      {/* Toasts — slide in from the right, stack downward */}
      <div className="fixed top-14 right-3 z-[95] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-72 bg-terminal-panel border border-terminal-gold/40 border-l-2 shadow-2xl panel-slide-in overflow-hidden"
            style={{ borderLeftColor: (TYPE_CIRCLE[t.type] ?? '').includes('blue') ? 'var(--mt-blue-bright, #2D7DD2)' : (TYPE_CIRCLE[t.type] ?? '').includes('green') ? 'var(--mt-green, #2D8A50)' : '#C9A84C' }}
          >
            <div className="px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-terminal-gold text-xs">{TYPE_ICON[t.type] ?? '•'}</span>
                <span className="text-2xs text-terminal-gold/70 font-bold tracking-wider">{TYPE_LABEL[t.type] ?? t.type}</span>
              </div>
              <div className="text-2xs text-terminal-text-bright leading-snug mt-0.5">{t.message}</div>
            </div>
            <div className="h-0.5 bg-terminal-gold/60 toast-progress" />
          </div>
        ))}
      </div>
    </div>
  )
}
