import { createContext, useContext, useState, useCallback } from 'react'
import { WATCHLIST_DEFAULT_SYMBOLS } from '../data/placeholders'

const StoreContext = createContext(null)

const getStoredCurrency = () => {
  try { return localStorage.getItem('madden_currency') || 'AUD' } catch { return 'AUD' }
}

export function StoreProvider({ children }) {
  const [activeModule, setActiveModule] = useState('markets')
  const [watchlist, setWatchlist]       = useState(WATCHLIST_DEFAULT_SYMBOLS)
  const [cmdHistory, setCmdHistory]     = useState([])
  const [chatOpen, setChatOpen]         = useState(false)
  const [currency, setCurrencyState]    = useState(getStoredCurrency)
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content:
        'MADDEN AI // Australian Financial Intelligence. Ask about ASX stocks, AUD pairs, RBA policy, macro, or any global market.\nExamples: "BHP analysis" / "RBA next move" / "AUD/USD outlook" / "iron ore outlook"',
    },
  ])
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

  const addToWatchlist = useCallback((sym) => {
    const s = sym.toUpperCase().trim()
    setWatchlist((prev) => (prev.includes(s) ? prev : [...prev, s]))
  }, [])

  const removeFromWatchlist = useCallback((sym) => {
    setWatchlist((prev) => prev.filter((s) => s !== sym))
  }, [])

  const pushCmdHistory = useCallback((cmd) => {
    setCmdHistory((prev) => [cmd, ...prev].slice(0, 50))
  }, [])

  const addChatMessage = useCallback((msg) => {
    setChatMessages((prev) => [...prev, msg])
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
        watchlist, addToWatchlist, removeFromWatchlist,
        cmdHistory, pushCmdHistory,
        chatOpen, setChatOpen,
        currency, setCurrency,
        chatMessages, addChatMessage, updateLastChatMessage,
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
