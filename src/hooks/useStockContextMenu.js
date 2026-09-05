import { useState, useCallback } from 'react'

// Open/close state for the stock context menu. Lives apart from the menu
// component so that file only exports a component (react-refresh).
//
// Desktop only: a long-press menu on touch fights scrolling, and every action
// in the menu already has a tap-reachable equivalent. Gated on a
// coarse-pointer query rather than screen width, so a small laptop keeps it.
// Position is clamped to the viewport so a right-click near an edge doesn't
// open a menu that runs off-screen.
const MENU_W = 210
const MENU_H = 232

export function useStockContextMenu() {
  const [menu, setMenu] = useState(null)

  const openMenu = useCallback((event, asset) => {
    if (window.matchMedia?.('(pointer: coarse)').matches) return
    event.preventDefault()
    setMenu({
      asset,
      x: Math.min(event.clientX, window.innerWidth - MENU_W - 8),
      y: Math.min(event.clientY, window.innerHeight - MENU_H - 8),
    })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])
  return { menu, openMenu, closeMenu }
}

export default useStockContextMenu
