// Modules a workspace panel can display. Mirrors App.jsx's MODULE_MAP minus
// 'maddenai' — AIPanel is a global singleton gated on the store's chatOpen
// flag, not an independently routable module.
// One typeface for the whole set. See the note in NotificationCenter: a row
// that mixes monospace glyphs with OS emoji bitmaps reads as two designs.
export const WORKSPACE_MODULE_LIST = [
  { id: 'markets',   label: 'Markets',    icon: '▲' },
  { id: 'crypto',    label: 'Crypto',     icon: '₿' },
  { id: 'fx',        label: 'Rates & FX', icon: '⇄' },
  { id: 'macro',     label: 'Macro',      icon: '◉' },
  { id: 'global',    label: 'Global',     icon: '⊕' },
  { id: 'watchlist', label: 'Watchlist',  icon: '★' },
  { id: 'portfolio', label: 'Portfolio',  icon: '▣' },
  { id: 'news',      label: 'News',       icon: '≡' },
  { id: 'brief',     label: 'Morning Brief', icon: '☀' },
  { id: 'scanner',   label: 'Scanner',    icon: '◎' },
  { id: 'screener',  label: 'Screener',   icon: '⚡' },
  { id: 'replay',    label: 'Market Replay', icon: '⏮' },
  { id: 'calendar',  label: 'Calendar',   icon: '▦' },
  { id: 'bonds',     label: 'Bonds',      icon: '⌇' },
  { id: 'etf',       label: 'ETFs',       icon: '▤' },
  { id: 'futures',   label: 'Futures',    icon: '⧖' },
  { id: 'calculators', label: 'Calculators', icon: '∑' },
]

// Routable from the nav but not offered as a workspace pane — the dashboard
// is itself a grid of panes. Listed so the breadcrumb can still name it.
export const NAV_ONLY_MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
]
