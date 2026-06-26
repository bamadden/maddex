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
  const [currency, setCurrencyState]    = useState(getStoredCurrency)
  const INITIAL_CHAT = [
    {
      role: 'assistant',
      content:
        'MADDEX AI // Australian Financial Intelligence. Ask about ASX stocks, AUD pairs, RBA policy, macro, or any global market.\nExamples: "BHP analysis" / "RBA next move" / "AUD/USD outlook" / "iron ore outlook"',
    },
  ]
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT)
  const [watchlistFocus, setWatchlistFocus] = useState(null)
  const [modalAsset, setModalAsset]         = useState(null)
  const [newsFilter, setNewsFilterState]    = useState('')
  const [alerts, setAlerts]                 = useState(() => {
    try { return JSON.parse(localStorage.getItem('madden_alerts') ?? '[]') } catch { return [] }
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
    setChatMessages([{
      role: 'assistant',
      content: 'MADDEX AI // Australian Financial Intelligence. Ask about ASX stocks, AUD pairs, RBA policy, macro, or any global market.\nExamples: "BHP analysis" / "RBA next move" / "AUD/USD outlook" / "iron ore outlook"',
    }])
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

  const setNewsFilter = useCallback((kw) => setNewsFilterState(kw), [])

  const addAlert = useCallback((sym, price) => {
    const alert = { id: Date.now(), sym: sym.toUpperCase(), price: parseFloat(price), createdAt: new Date().toISOString() }
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

  return (
    <StoreContext.Provider
      value={{
        activeModule, setActiveModule,
        watchlist, addToWatchlist, removeFromWatchlist, reorderWatchlist, clearWatchlist,
        cmdHistory, pushCmdHistory,
        chatOpen, setChatOpen,
        currency, setCurrency,
        chatMessages, addChatMessage, updateLastChatMessage, clearChatMessages,
        watchlistFocus, setWatchlistFocus,
        modalAsset, openModal, closeModal,
        newsFilter, setNewsFilter,
        alerts, addAlert, removeAlert,
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
