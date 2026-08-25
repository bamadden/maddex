// Customisable keyboard shortcut registry. Action ids map to a binding
// ({ key } for a plain unmodified key, or { mac, win, display } for a
// modifier combo) plus a `display` label shown in the Settings UI.
//
// DEFAULT_SHORTCUTS mirrors the terminal's REAL existing bindings (the
// single-letter nav scheme + ⌘K/⌘F/? etc. already wired in App.jsx's
// keydown handler) rather than inventing a parallel ⌘1-9 scheme, so the
// Settings customiser shows shortcuts that actually work. App.jsx's global
// handler consults `shortcutService.shortcuts` for the entries below so a
// customisation takes effect immediately; workspace switching (ws.*) is
// new — App.jsx registers real handlers for it via `register()`.
export const DEFAULT_SHORTCUTS = {
  'nav.markets':   { key: 'm', display: 'M' },
  'nav.crypto':    { key: 'c', display: 'C' },
  'nav.rates':     { key: 'f', display: 'F' },
  'nav.macro':     { key: 'x', display: 'X' },
  'nav.global':    { key: 'g', display: 'G' },
  'nav.watchlist': { key: 'w', display: 'W' },
  'nav.portfolio': { key: 'p', display: 'P' },
  'nav.news':      { key: 'n', display: 'N' },
  'nav.brief':     { key: 'b', display: 'B' },
  'nav.calendar':  { key: 'k', display: 'K' },
  'nav.scanner':   { key: 's', display: 'S' },

  'ui.command':        { key: '/', display: '/' },
  'ui.shortcuts':      { key: '?', display: '?' },
  'ui.ai':             { key: 'a', display: 'A' },
  'ui.refresh':        { key: 'r', display: 'R' },
  'ui.pause-ticker':   { key: ' ', display: 'SPACE' },

  'ui.ai-pip': { mac: 'Meta+Shift+A', win: 'Ctrl+Shift+A', display: '⌘⇧A' },

  'ws.1':   { mac: 'Meta+Shift+1', win: 'Ctrl+Shift+1', display: '⌘⇧1' },
  'ws.2':   { mac: 'Meta+Shift+2', win: 'Ctrl+Shift+2', display: '⌘⇧2' },
  'ws.3':   { mac: 'Meta+Shift+3', win: 'Ctrl+Shift+3', display: '⌘⇧3' },
  'ws.4':   { mac: 'Meta+Shift+4', win: 'Ctrl+Shift+4', display: '⌘⇧4' },
  'ws.new': { mac: 'Meta+Shift+N', win: 'Ctrl+Shift+N', display: '⌘⇧N' },
}

export const ACTION_LABELS = {
  'nav.markets':   'Go to Markets',
  'nav.crypto':    'Go to Crypto',
  'nav.rates':     'Go to Rates & FX',
  'nav.macro':     'Go to Macro',
  'nav.global':    'Go to Global',
  'nav.watchlist': 'Go to Watchlist',
  'nav.portfolio': 'Go to Portfolio',
  'nav.news':      'Go to News',
  'nav.brief':     'Go to Morning Brief',
  'nav.calendar':  'Go to Calendar',
  'nav.scanner':   'Go to Scanner',
  'ui.command':      'Focus command bar',
  'ui.shortcuts':    'Show shortcuts reference',
  'ui.ai':           'Toggle AI panel',
  'ui.refresh':      'Refresh all live data',
  'ui.pause-ticker': 'Pause/resume ticker tape',
  'ui.ai-pip':       'Toggle AI picture-in-picture',
  'ws.1':   'Switch to workspace 1',
  'ws.2':   'Switch to workspace 2',
  'ws.3':   'Switch to workspace 3',
  'ws.4':   'Switch to workspace 4',
  'ws.new': 'New workspace',
}

const SHORTCUTS_KEY = 'maddex_shortcuts'

class ShortcutService {
  constructor() {
    this.shortcuts = this.load()
    this.handlers = new Map()
    this.listeners = new Set()
    this.platform = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? 'mac' : 'win'
  }

  load() {
    try {
      const saved = localStorage.getItem(SHORTCUTS_KEY)
      const custom = saved ? JSON.parse(saved) : {}
      return { ...DEFAULT_SHORTCUTS, ...custom }
    } catch {
      return { ...DEFAULT_SHORTCUTS }
    }
  }

  save() {
    try {
      const custom = {}
      for (const [action, binding] of Object.entries(this.shortcuts)) {
        if (JSON.stringify(binding) !== JSON.stringify(DEFAULT_SHORTCUTS[action])) custom[action] = binding
      }
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(custom))
    } catch { /* best-effort */ }
    this.listeners.forEach((cb) => cb())
  }

  subscribe(cb) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  // Register a live handler for an action (used for actions App.jsx doesn't
  // hardcode, e.g. workspace switching). Returns an unsubscribe fn.
  register(action, handler) {
    this.handlers.set(action, handler)
    return () => this.handlers.delete(action)
  }

  dispatch(action) {
    this.handlers.get(action)?.()
  }

  // True if `event` matches `binding` (a DEFAULT_SHORTCUTS-shaped entry).
  matches(event, binding) {
    if (!binding) return false
    const platformKey = binding[this.platform]
    if (platformKey) {
      const parts = platformKey.split('+')
      const key = parts[parts.length - 1].toLowerCase()
      const meta = parts.includes('Meta')
      const ctrl = parts.includes('Ctrl')
      const shift = parts.includes('Shift')
      const alt = parts.includes('Alt')
      return event.key.toLowerCase() === key &&
        event.metaKey === meta && event.ctrlKey === ctrl &&
        event.shiftKey === shift && event.altKey === alt
    }
    if (binding.key != null) {
      return event.key.toLowerCase() === binding.key.toLowerCase() &&
        !event.metaKey && !event.ctrlKey && !event.altKey
    }
    return false
  }

  // Which action (if any) in `this.shortcuts` matches this event.
  matchAction(event) {
    return Object.keys(this.shortcuts).find((action) => this.matches(event, this.shortcuts[action])) || null
  }

  // Which action (other than `exceptAction`) already uses this binding.
  findConflict(binding, exceptAction) {
    const bindingKey = binding[this.platform] ?? binding.key
    return Object.entries(this.shortcuts).find(([action, b]) => {
      if (action === exceptAction) return false
      const k = b[this.platform] ?? b.key
      return k != null && String(k).toLowerCase() === String(bindingKey).toLowerCase()
    })?.[0] ?? null
  }

  customize(action, newBinding) {
    this.shortcuts[action] = { ...this.shortcuts[action], ...newBinding }
    this.save()
  }

  reset(action) {
    this.shortcuts[action] = DEFAULT_SHORTCUTS[action]
    this.save()
  }

  resetAll() {
    this.shortcuts = { ...DEFAULT_SHORTCUTS }
    try { localStorage.removeItem(SHORTCUTS_KEY) } catch { /* best-effort */ }
    this.listeners.forEach((cb) => cb())
  }

  // Builds a binding object from a live keydown event, for the "press your
  // new shortcut" recorder in Settings.
  bindingFromEvent(event) {
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
    if (!hasModifier) {
      return { key: event.key, display: event.key === ' ' ? 'SPACE' : event.key.toUpperCase() }
    }
    const parts = []
    if (event.metaKey) parts.push('Meta')
    if (event.ctrlKey) parts.push('Ctrl')
    if (event.shiftKey) parts.push('Shift')
    if (event.altKey) parts.push('Alt')
    parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key)
    const combo = parts.join('+')
    const display = combo
      .replace('Meta', '⌘').replace('Ctrl', '⌃').replace('Shift', '⇧').replace('Alt', '⌥')
      .replace(/\+/g, '')
    return this.platform === 'mac'
      ? { mac: combo, win: combo.replace('Meta', 'Ctrl'), display }
      : { win: combo, mac: combo.replace('Ctrl', 'Meta'), display }
  }
}

export const shortcutService = new ShortcutService()
