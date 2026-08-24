import { useCallback, useEffect, useState } from 'react'

export const LAYOUT_MODES = [
  { key: 'standard', label: 'STANDARD', desc: 'Sidebar + content + AI panel' },
  { key: 'focus',     label: 'FOCUS',     desc: 'Full-width content only' },
  { key: 'split',     label: 'SPLIT',     desc: 'Two modules side by side' },
  { key: 'research',  label: 'RESEARCH',  desc: 'Content + AI panel, 50/50' },
]

const STORAGE_KEY = 'maddex_layout'
const EVENT = 'madden:layout-change'

// Two independent call sites use this hook — the switcher UI in TopBar and
// the actual layout logic in App.jsx's Terminal(). A plain per-instance
// useState wouldn't let TopBar's click update Terminal()'s copy, so
// setLayout also broadcasts a CustomEvent that every instance (including
// the one that triggered it) listens for, keeping them in sync.
export function useLayoutMode() {
  const [layout, setLayoutState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LAYOUT_MODES.some((m) => m.key === saved) ? saved : 'standard'
  })

  useEffect(() => {
    const handler = (e) => { if (e.detail?.mode) setLayoutState(e.detail.mode) }
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])

  const setLayout = useCallback((mode) => {
    if (!LAYOUT_MODES.some((m) => m.key === mode)) return
    localStorage.setItem(STORAGE_KEY, mode)
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { mode } }))
  }, [])

  return { layout, setLayout }
}
