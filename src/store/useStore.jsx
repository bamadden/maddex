import { createContext, useContext, useState, useCallback } from 'react'
import { WATCHLIST_DEFAULT_SYMBOLS } from '../data/placeholders'

const StoreContext = createContext(null)

const getStoredCurrency = () => {
  try { return localStorage.getItem('madden_currency') || 'AUD' } catch { return 'AUD' }
}

const WATCHLIST_KEY = 'madden_watchlist_v1'

const getStoredWatchlist = () => {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) && parsed.length ? parsed : WATCHLIST_DEFAULT_SYMBOLS
  } catch { return WATCHLIST_DEFAULT_SYMBOLS }
}

export function StoreProvider({ children }) {
  const [activeModule, setActiveModule] = useState('markets')
  const [watchlist, setWatchlist]       = useState(getStoredWatchlist)
  const [cmdHistory, setCmdHistory]     = useState([])
  const [chatOpen, setChatOpen]         = useState(false)
  // Sidebar (docked, ~320px) vs fullscreen (replaces the whole module
  // viewport) — lifted up here rather than kept local to AIPanel so the
  // global Escape handler below can tell "exit fullscreen" apart from
  // "close the chat entirely".
  const [aiMode, setAiModeState] = useState(() => {
    try { return localStorage.getItem('maddex_ai_mode') === 'fullscreen' ? 'fullscreen' : 'sidebar' } catch { return 'sidebar' }
  })
  const setAiMode = useCallback((mode) => {
    setAiModeState(mode)
    try { localStorage.setItem('maddex_ai_mode', mode) } catch { /* ignore */ }
  }, [])
  const [currency, setCurrencyState]    = useState(getStoredCurrency)
  // Empty by default — AIPanel renders a minimal "READY" empty state plus
  // the quick-prompt chips instead of a seeded welcome message.
  const [chatMessages, setChatMessages] = useState([])
  const [watchlistFocus, setWatchlistFocus] = useState(null)
  const [modalAsset, setModalAsset]         = useState(null)
  const [compareAssets, setCompareAssets]   = useState(null)
  const [newsFilter, setNewsFilterState]    = useState('')
  const [newsBadgeCount, setNewsBadgeCountState] = useState(0)
  const [alerts, setAlerts]                 = useState(() => {
    try { return JSON.parse(localStorage.getItem('madden_alerts') ?? '[]') } catch { return [] }
  })
  const [notifications, setNotifications]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('madden_notifications') ?? '[]') } catch { return [] }
  })

  const setCurrency = useCallback((c) => {
    try { localStorage.setItem('madden_currency', c) } catch {}
    setCurrencyState(c)
  }, [])

  const persistWatchlist = useCallback((next) => {
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)) } catch {}
    return next
  }, [])

  const addToWatchlist = useCallback((sym) => {
    const s = sym.toUpperCase().trim()
    setWatchlist((prev) => persistWatchlist(prev.includes(s) ? prev : [...prev, s]))
  }, [persistWatchlist])

  const removeFromWatchlist = useCallback((sym) => {
    setWatchlist((prev) => persistWatchlist(prev.filter((s) => s !== sym)))
  }, [persistWatchlist])

  const reorderWatchlist = useCallback((fromIndex, toIndex) => {
    setWatchlist((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return persistWatchlist(next)
    })
  }, [persistWatchlist])

  const clearWatchlist = useCallback(() => {
    setWatchlist(persistWatchlist([]))
  }, [persistWatchlist])

  const pushCmdHistory = useCallback((cmd) => {
    setCmdHistory((prev) => [cmd, ...prev].slice(0, 50))
  }, [])

  const addChatMessage = useCallback((msg) => {
    setChatMessages((prev) => [...prev, msg])
  }, [])

  const clearChatMessages = useCallback(() => {
    setChatMessages([])
  }, [])

  const updateLastChatMessage = useCallback((updater) => {
    setChatMessages((prev) => {
      const msgs = [...prev]
      const last = msgs[msgs.length - 1]
      msgs[msgs.length - 1] =
        typeof updater === 'function' ? updater(last) : { ...last, ...updater }
      return msgs
    })
  }, [])

  const openModal  = useCallback((asset) => setModalAsset(asset), [])
  const closeModal = useCallback(() => setModalAsset(null), [])

  // Compare mode — seeded with one asset (from a stock detail panel's
  // COMPARE button) or opened empty (from the command bar's COMPARE {a} {b}).
  const openCompare  = useCallback((asset) => setCompareAssets(asset ? [asset] : []), [])
  const closeCompare = useCallback(() => setCompareAssets(null), [])
  const addCompareAsset = useCallback((asset) => {
    setCompareAssets((prev) => {
      const list = prev ?? []
      if (list.some((a) => a.symbol === asset.symbol)) return list
      return [...list, asset].slice(0, 3)
    })
  }, [])
  const removeCompareAsset = useCallback((symbol) => {
    setCompareAssets((prev) => (prev ?? []).filter((a) => a.symbol !== symbol))
  }, [])

  const setNewsFilter   = useCallback((kw) => setNewsFilterState(kw), [])
  const setNewsBadgeCount = useCallback((n) => setNewsBadgeCountState(n), [])
  const clearNewsBadge    = useCallback(() => setNewsBadgeCountState(0), [])

  const addAlert = useCallback((sym, price, direction = 'above') => {
    const alert = { id: Date.now(), sym: sym.toUpperCase(), price: parseFloat(price), direction, createdAt: new Date().toISOString() }
    setAlerts((prev) => {
      const next = [...prev, alert]
      try { localStorage.setItem('madden_alerts', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id)
      try { localStorage.setItem('madden_alerts', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // type: 'PRICE_ALERT' | 'MARKET_OPEN' | 'NEWS' | 'SYSTEM'
  const addNotification = useCallback((type, message) => {
    const notification = { id: Date.now() + Math.random(), type, message, read: false, createdAt: new Date().toISOString() }
    setNotifications((prev) => {
      const next = [notification, ...prev].slice(0, 20)
      try { localStorage.setItem('madden_notifications', JSON.stringify(next)) } catch {
        // Persistence is best-effort — the in-memory list still updates
      }
      return next
    })
    return notification
  }, [])

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      try { localStorage.setItem('madden_notifications', JSON.stringify(next)) } catch {
        // Persistence is best-effort — the in-memory list still updates
      }
      return next
    })
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      try { localStorage.setItem('madden_notifications', JSON.stringify(next)) } catch {
        // Persistence is best-effort — the in-memory list still updates
      }
      return next
    })
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
    try { localStorage.setItem('madden_notifications', '[]') } catch {
      // Persistence is best-effort — the in-memory list still updates
    }
  }, [])

  return (
    <StoreContext.Provider
      value={{
        activeModule, setActiveModule,
        watchlist, addToWatchlist, removeFromWatchlist, reorderWatchlist, clearWatchlist,
        cmdHistory, pushCmdHistory,
        chatOpen, setChatOpen,
        aiMode, setAiMode,
        currency, setCurrency,
        chatMessages, setChatMessages, addChatMessage, updateLastChatMessage, clearChatMessages,
        watchlistFocus, setWatchlistFocus,
        modalAsset, openModal, closeModal,
        compareAssets, openCompare, closeCompare, addCompareAsset, removeCompareAsset,
        newsFilter, setNewsFilter,
        newsBadgeCount, setNewsBadgeCount, clearNewsBadge,
        alerts, addAlert, removeAlert,
        notifications, addNotification, markNotificationRead, markAllNotificationsRead, clearAllNotifications,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
