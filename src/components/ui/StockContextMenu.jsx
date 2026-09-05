import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { dispatchAskAI } from '../../utils/askAI'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'

// Right-click menu for a stock, wherever one appears — table row, card, tile.
//
// Desktop only: a long-press menu on touch fights scrolling, and every action
// here already has a tap-reachable equivalent. Gated on a coarse-pointer
// media query rather than screen width, so a small laptop still gets it.
//
// Positioning and open/close state live in hooks/useStockContextMenu.js so
// this file only exports a component.
export default function StockContextMenu({ menu, onClose }) {
  const ref = useRef(null)
  const { addToWatchlist, setActiveModule, watchlist } = useStore()
  const { copy } = useCopyToClipboard()
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu, onClose])

  if (!menu) return null
  const { asset } = menu
  const ticker = asset.symbol ?? asset.ticker ?? ''
  const already = watchlist?.some((w) => w.toUpperCase() === ticker.toUpperCase())

  const run = async (label, fn) => {
    await fn()
    // Confirm in place rather than closing instantly — a menu that vanishes
    // gives no signal that anything happened.
    if (label) { setFlash(label); setTimeout(onClose, 550) } else onClose()
  }

  const items = [
    { icon: '📊', label: 'Analyse with MaddenAI', run: () => dispatchAskAI({
        ticker, name: asset.name ?? ticker,
        price: asset.price != null ? String(asset.price) : undefined,
        instruction: `Give me a concise read on ${ticker} — what it is, what's driving it right now, and the main risk.`,
      }, { rawPrompt: true }) },
    already
      ? { icon: '✓', label: 'Already in watchlist', disabled: true, run: () => {} }
      : { icon: '+', label: 'Add to watchlist', flash: 'ADDED', run: () => addToWatchlist(ticker) },
    { icon: '📋', label: 'Copy ticker', flash: 'COPIED', run: () => copy(ticker) },
    { icon: '📋', label: 'Copy price', flash: 'COPIED', disabled: asset.price == null,
      run: () => copy(String(asset.price)) },
    { icon: '🔗', label: 'Open in Markets', run: () => setActiveModule('markets') },
  ]

  return (
    <div
      ref={ref}
      className="fixed bg-terminal-panel border border-terminal-border-gold shadow-2xl font-mono"
      style={{ left: menu.x, top: menu.y, width: 210, zIndex: 300 }}
    >
      <div className="px-3 py-2 border-b border-terminal-border">
        <div className="text-2xs font-bold text-terminal-text-bright truncate">{asset.name ?? ticker}</div>
        <div className="text-[9px] text-terminal-gold tracking-wider">{ticker}</div>
      </div>
      {items.map((it) => (
        <button
          key={it.label}
          disabled={it.disabled}
          onClick={() => run(it.flash, it.run)}
          className="w-full flex items-center gap-2 px-3 py-2 text-2xs text-left text-terminal-text-dim hover:bg-terminal-surface2 hover:text-terminal-text disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span aria-hidden="true" className="w-3 flex-shrink-0">{it.icon}</span>
          <span className="truncate">{flash && it.flash === flash ? flash : it.label}</span>
        </button>
      ))}
    </div>
  )
}
