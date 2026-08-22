import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { fetchEquityQuotes, fetchIndexQuotesUnified } from '../../services/dataService'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'

const TYPE_ICON  = { PRICE_ALERT: '◎', MARKET_OPEN: '▲', NEWS: '📰', SYSTEM: '✦', CALENDAR: '📅' }
const TYPE_LABEL = { PRICE_ALERT: 'PRICE ALERT', MARKET_OPEN: 'MARKET OPEN', NEWS: 'NEWS', SYSTEM: 'SYSTEM' }

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
    notifications, addNotification, markNotificationRead, clearAllNotifications,
    alerts, removeAlert,
  } = useStore()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const ref = useRef(null)
  const seenToastIds  = useRef(null)
  const seenNewsIds   = useRef(new Set())

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
  // No direction is captured when an alert is set (ALERT {sym} {price}), so
  // "reached your target" is treated as price rising to meet or pass it.
  useEffect(() => {
    if (!alerts.length) return
    const check = async () => {
      const symbols = alerts.map((a) => toYahooSymbol(a.sym, detectAssetType(a.sym)))
      try {
        const { data } = await fetchEquityQuotes(symbols)
        for (const alert of alerts) {
          const yfSym = toYahooSymbol(alert.sym, detectAssetType(alert.sym))
          const q = data?.[yfSym]
          if (q?.last != null && q.last >= alert.price) {
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
      const articles = queryClient.getQueryData(['news']) ?? []
      for (const item of articles) {
        if (!item.pubDate) continue
        const isBreaking = Date.now() - new Date(item.pubDate).getTime() <= 5 * 60_000
        if (!isBreaking) continue
        const id = item.link || item.title
        if (seenNewsIds.current.has(id)) continue
        seenNewsIds.current.add(id)
        addNotification('NEWS', `Breaking: ${item.title}`)
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [queryClient, addNotification])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-7 h-7 text-terminal-text-dim hover:text-terminal-gold transition-colors"
        title="Notifications"
      >
        <span className="text-sm">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-terminal-red text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-terminal-panel border border-terminal-border shadow-2xl z-[90]" style={{ width: 320 }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border">
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">NOTIFICATIONS</span>
            {notifications.length > 0 && (
              <button onClick={clearAllNotifications} className="text-2xs text-terminal-text-dim hover:text-terminal-red transition-colors">
                CLEAR ALL
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-2xs text-terminal-text-dim/60 text-center">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={`flex items-start gap-2 px-3 py-2 border-b border-terminal-border/40 cursor-pointer hover:bg-terminal-accent/20 transition-colors ${n.read ? 'opacity-50' : ''}`}
                >
                  <span className="text-terminal-gold text-xs flex-shrink-0">{TYPE_ICON[n.type] ?? '•'}</span>
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
        </div>
      )}

      {/* Toasts — slide in from the right, stack downward */}
      <div className="fixed top-14 right-3 z-[95] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-72 bg-terminal-panel border border-terminal-gold/40 shadow-2xl px-3 py-2 panel-slide-in"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-terminal-gold text-xs">{TYPE_ICON[t.type] ?? '•'}</span>
              <span className="text-2xs text-terminal-gold/70 font-bold tracking-wider">{TYPE_LABEL[t.type] ?? t.type}</span>
            </div>
            <div className="text-2xs text-terminal-text-bright leading-snug mt-0.5">{t.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
