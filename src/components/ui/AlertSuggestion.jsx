import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { fetchEquityQuotes } from '../../services/dataService'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { alertSuggestionsEnabled } from '../../services/alertsService'
import { canAccess, getCurrentTier } from '../../services/plans'

// "Set an alert for BHP.AX?" — two seconds after a stock is added to the
// watchlist, offer alerts 5% either side of its current price.
//
// Only offered when the plan includes alerts: on Core it would be an upgrade
// prompt in disguise, triggered by an action that has nothing to do with
// alerts. Not offered during setup (the wizard has its own alert step), when
// the price is unknown, or when switched off in Settings → Alerts.

const DELAY = 2000
const LINGER = 15000
const round = (v) => Math.round(v * 100) / 100
const money = (v) => `A$${v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AlertSuggestion() {
  const { addAlert } = useStore()
  const [offer, setOffer] = useState(null)   // { symbol, price, set: { above?, below? } }
  const timers = useRef([])

  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
    const onAdded = (e) => {
      const symbol = e.detail?.symbol
      if (!symbol || !alertSuggestionsEnabled() || !canAccess('alerts', getCurrentTier())) return
      clear()
      timers.current.push(setTimeout(async () => {
        if (document.querySelector('[aria-label^="Setup, step"]')) return
        const key = toYahooSymbol(symbol, detectAssetType(symbol))
        let price = null
        try { price = (await fetchEquityQuotes([key])).data?.[key]?.last ?? null } catch { /* no price, no offer */ }
        if (!(price > 0)) return
        setOffer({ symbol, price, set: {} })
        timers.current.push(setTimeout(() => setOffer(null), LINGER))
      }, DELAY))
    }
    window.addEventListener('maddex:watchlist-added', onAdded)
    return () => { window.removeEventListener('maddex:watchlist-added', onAdded); clear() }
  }, [])

  if (!offer) return null
  const above = round(offer.price * 1.05)
  const below = round(offer.price * 0.95)

  const set = (dir, level) => {
    if (!addAlert(offer.symbol, level, dir)) { setOffer(null); return }   // plan limit — prompt shown
    const next = { ...offer, set: { ...offer.set, [dir]: true } }
    setOffer(next.set.above && next.set.below ? null : next)
  }

  const row = (dir, level, label) => (
    <div key={dir} className="flex items-center gap-2 py-1">
      <span className="text-2xs" style={{ color: dir === 'above' ? 'var(--color-gain, #22C55E)' : 'var(--color-loss, #EF4444)' }}>{dir === 'above' ? '▲' : '▼'}</span>
      <span className="flex-1 text-2xs text-terminal-text">{dir === 'above' ? 'Above' : 'Below'} {money(level)} <span className="text-terminal-text-dim">({label})</span></span>
      {offer.set[dir]
        ? <span className="text-2xs text-terminal-green font-bold">✓ SET</span>
        : <button onClick={() => set(dir, level)} className="text-2xs font-bold tracking-widest px-2 py-0.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors">SET</button>}
    </div>
  )

  return (
    <div role="dialog" aria-label={`Suggested alerts for ${offer.symbol}`}
      className="fixed bottom-14 right-4 z-[95] w-72 bg-terminal-panel border border-terminal-gold/40 shadow-2xl px-3 py-2.5 font-mono"
      style={{ animation: 'slideUp 0.2s ease-out' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-terminal-gold text-xs" aria-hidden="true">⚡</span>
        <span className="text-xs text-terminal-text-bright font-semibold flex-1">Set an alert for {offer.symbol}?</span>
        <span className="text-2xs text-terminal-text-dim tabular-nums">{money(offer.price)}</span>
      </div>
      {row('above', above, '+5%')}
      {row('below', below, '−5%')}
      <div className="flex justify-end mt-1">
        <button onClick={() => setOffer(null)} className="text-2xs text-terminal-text-dim hover:text-terminal-text tracking-widest">DISMISS</button>
      </div>
    </div>
  )
}
