// Modules a workspace panel can display. Mirrors App.jsx's MODULE_MAP minus
// 'maddenai' — AIPanel is a global singleton gated on the store's chatOpen
// flag, not an independently routable module.
export const WORKSPACE_MODULE_LIST = [
  { id: 'markets',   label: 'Markets',    icon: '📈' },
  { id: 'crypto',    label: 'Crypto',     icon: '₿' },
  { id: 'fx',        label: 'Rates & FX', icon: '💱' },
  { id: 'macro',     label: 'Macro',      icon: '🌐' },
  { id: 'global',    label: 'Global',     icon: '🗺' },
  { id: 'watchlist', label: 'Watchlist',  icon: '★' },
  { id: 'portfolio', label: 'Portfolio',  icon: '💼' },
  { id: 'news',      label: 'News',       icon: '📰' },
  { id: 'brief',     label: 'Morning Brief', icon: '☀' },
  { id: 'scanner',   label: 'Scanner',    icon: '◎' },
  { id: 'screener',  label: 'Screener',   icon: '⚡' },
  { id: 'replay',    label: 'Market Replay', icon: '⏮' },
]
