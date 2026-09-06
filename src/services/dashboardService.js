// Dashboard layout — what widgets exist, where they sit, and how that
// arrangement is stored.
//
// The layout is a plain object: a column count plus a list of placements.
// Everything else in the dashboard reads from it, so a preset, a custom
// arrangement and a half-edited grid are all the same shape.

const WIDGET_CATALOGUE = [
  { id: 'portfolio-snapshot',    name: 'Portfolio Snapshot', category: 'Portfolio', minW: 1, minH: 1, description: 'Total value, P&L, top movers' },
  { id: 'market-score',          name: 'Market Score',       category: 'Markets',   minW: 1, minH: 1, description: 'MaddenAI sentiment gauge' },
  { id: 'next-event',            name: 'Next Event',         category: 'Calendar',  minW: 1, minH: 1, description: 'Countdown to next major event' },
  { id: 'index-bar',             name: 'Key Indices',        category: 'Markets',   minW: 2, minH: 1, description: 'Live index prices with ticking' },
  { id: 'watchlist-preview',     name: 'Watchlist',          category: 'Portfolio', minW: 1, minH: 1, description: 'Your watchlist prices live' },
  { id: 'sector-breadth',        name: 'Sector Breadth',     category: 'Markets',   minW: 2, minH: 1, description: 'ASX sector performance bars' },
  { id: 'news-feed',             name: 'Latest News',        category: 'News',      minW: 1, minH: 1, description: '3 latest headlines' },
  { id: 'calendar-events',       name: 'Upcoming Events',    category: 'Calendar',  minW: 1, minH: 1, description: 'Next 3 scheduled events' },
  { id: 'quick-actions',         name: 'Quick Actions',      category: 'Tools',     minW: 1, minH: 1, description: '6 action shortcuts' },
  { id: 'activity-feed',         name: 'Activity Feed',      category: 'Portfolio', minW: 1, minH: 1, description: 'Recent terminal activity' },
  { id: 'fx-rates',              name: 'FX Rates',           category: 'Markets',   minW: 1, minH: 1, description: 'Live AUD pairs' },
  { id: 'crypto-overview',       name: 'Crypto Overview',    category: 'Crypto',    minW: 1, minH: 1, description: 'Top crypto prices' },
  { id: 'rba-status',            name: 'RBA Status',         category: 'Macro',     minW: 1, minH: 1, description: 'Rate, next meeting, outlook' },
  { id: 'commodity-pulse',       name: 'Commodities',        category: 'Global',    minW: 1, minH: 1, description: 'Iron ore, gold, LNG prices' },
  { id: 'morning-brief-preview', name: 'Morning Brief',      category: 'AI',        minW: 2, minH: 1, description: 'Daily AI market brief' },
]

// Presets are templates. applyPreset deep-copies them — see the note there.
const PRESET_LAYOUTS = [
  {
    id: 'minimal', name: '1×3 Focus', icon: '▣', description: 'Single column, focused', columns: 1,
    widgets: [
      { widgetId: 'portfolio-snapshot', col: 0, row: 0, w: 1, h: 1 },
      { widgetId: 'market-score',       col: 0, row: 1, w: 1, h: 1 },
      { widgetId: 'next-event',         col: 0, row: 2, w: 1, h: 1 },
    ],
  },
  {
    id: 'overview', name: '2×2 Overview', icon: '⊞', description: 'Balanced 4-widget view', columns: 2,
    widgets: [
      { widgetId: 'portfolio-snapshot', col: 0, row: 0, w: 1, h: 1 },
      { widgetId: 'market-score',       col: 1, row: 0, w: 1, h: 1 },
      { widgetId: 'watchlist-preview',  col: 0, row: 1, w: 1, h: 1 },
      { widgetId: 'next-event',         col: 1, row: 1, w: 1, h: 1 },
    ],
  },
  {
    id: 'standard', name: '3×2 Standard', icon: '⊟', description: 'Default 6-widget layout', columns: 3,
    widgets: [
      { widgetId: 'portfolio-snapshot', col: 0, row: 0, w: 1, h: 1 },
      { widgetId: 'market-score',       col: 1, row: 0, w: 1, h: 1 },
      { widgetId: 'next-event',         col: 2, row: 0, w: 1, h: 1 },
      { widgetId: 'index-bar',          col: 0, row: 1, w: 2, h: 1 },
      { widgetId: 'watchlist-preview',  col: 2, row: 1, w: 1, h: 1 },
    ],
  },
  {
    id: 'trading', name: '3×3 Trading', icon: '⊠', description: 'Data-dense 9-widget grid', columns: 3,
    widgets: [
      { widgetId: 'portfolio-snapshot', col: 0, row: 0, w: 1, h: 1 },
      { widgetId: 'market-score',       col: 1, row: 0, w: 1, h: 1 },
      { widgetId: 'next-event',         col: 2, row: 0, w: 1, h: 1 },
      { widgetId: 'index-bar',          col: 0, row: 1, w: 2, h: 1 },
      { widgetId: 'watchlist-preview',  col: 2, row: 1, w: 1, h: 1 },
      { widgetId: 'news-feed',          col: 0, row: 2, w: 1, h: 1 },
      { widgetId: 'calendar-events',    col: 1, row: 2, w: 1, h: 1 },
      { widgetId: 'quick-actions',      col: 2, row: 2, w: 1, h: 1 },
    ],
  },
  {
    id: 'research', name: '4×3 Research', icon: '◈', description: 'Full research station', columns: 4,
    widgets: [
      { widgetId: 'portfolio-snapshot',    col: 0, row: 0, w: 1, h: 1 },
      { widgetId: 'market-score',          col: 1, row: 0, w: 1, h: 1 },
      { widgetId: 'rba-status',            col: 2, row: 0, w: 1, h: 1 },
      { widgetId: 'next-event',            col: 3, row: 0, w: 1, h: 1 },
      { widgetId: 'index-bar',             col: 0, row: 1, w: 2, h: 1 },
      { widgetId: 'fx-rates',              col: 2, row: 1, w: 1, h: 1 },
      { widgetId: 'crypto-overview',       col: 3, row: 1, w: 1, h: 1 },
      { widgetId: 'morning-brief-preview', col: 0, row: 2, w: 2, h: 1 },
      { widgetId: 'news-feed',             col: 2, row: 2, w: 1, h: 1 },
      { widgetId: 'calendar-events',       col: 3, row: 2, w: 1, h: 1 },
    ],
  },
]

const LAYOUT_KEY = 'maddex_dashboard_layout'
const CUSTOM_KEY = 'maddex_dashboard_custom'
const SETUP_KEY = 'maddex_dashboard_setup_done'

const DEFAULT_PRESET_ID = 'standard'

// Structured clone via JSON. Presets are module constants: handing one
// straight to the live layout means the first addWidget mutates the constant
// for the rest of the session, and every later "apply this preset" returns
// the edited version. A shallow {...preset} does NOT prevent that — the
// widgets array is still shared by reference.
const clone = (o) => JSON.parse(JSON.stringify(o))

class DashboardService {
  constructor() {
    this.listeners = new Set()
    this.layout = this.load()
  }

  // ── Storage ─────────────────────────────────────────────────────────────
  load() {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY)
      const parsed = saved ? JSON.parse(saved) : null
      if (parsed?.widgets && Array.isArray(parsed.widgets)) return parsed
    } catch { /* fall through to the default */ }
    return clone(PRESET_LAYOUTS.find((p) => p.id === DEFAULT_PRESET_ID))
  }

  save(layout) {
    this.layout = layout
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch { /* quota */ }
    this.emit()
  }

  // ── Subscription ────────────────────────────────────────────────────────
  // Matches workspaceService's pattern so components can use
  // useSyncExternalStore rather than polling or prop-drilling a copy.
  subscribe(cb) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  emit() {
    this.listeners.forEach((cb) => cb())
  }

  // ── Reads ───────────────────────────────────────────────────────────────
  getPresets() { return PRESET_LAYOUTS }
  getCatalogue() { return WIDGET_CATALOGUE }
  getLayout() { return this.layout }
  getWidget(id) { return WIDGET_CATALOGUE.find((w) => w.id === id) }

  getMaxRow() {
    if (!this.layout.widgets.length) return 0
    return Math.max(...this.layout.widgets.map((w) => w.row + w.h - 1))
  }

  // Is this cell covered by any widget? Used by the grid to find gaps and by
  // placement to avoid dropping a widget on top of another.
  isOccupied(col, row, ignoreIndex = -1) {
    return this.layout.widgets.some((w, i) =>
      i !== ignoreIndex
      && col >= w.col && col < w.col + w.w
      && row >= w.row && row < w.row + w.h)
  }

  // First free cell wide enough for a widget of width `w`, scanning rows
  // top-to-bottom. Returns a position past the last row if nothing fits,
  // which is how "add to the end" falls out without a special case.
  findSlot(w = 1) {
    const cols = this.layout.columns
    for (let row = 0; row <= this.getMaxRow() + 1; row++) {
      for (let col = 0; col + w <= cols; col++) {
        let free = true
        for (let d = 0; d < w && free; d++) if (this.isOccupied(col + d, row)) free = false
        if (free) return { col, row }
      }
    }
    return { col: 0, row: this.getMaxRow() + 1 }
  }

  // ── Writes ──────────────────────────────────────────────────────────────
  applyPreset(presetId) {
    const preset = PRESET_LAYOUTS.find((p) => p.id === presetId)
    if (preset) this.save(clone(preset))
    return this.layout
  }

  addWidget(widgetId, col, row) {
    const meta = this.getWidget(widgetId)
    if (!meta) return
    // A widget cannot be wider than the grid — a 2-wide widget dropped into a
    // 1-column layout would render into a column that does not exist and
    // vanish.
    const w = Math.min(meta.minW, this.layout.columns)
    const at = (col == null || row == null) ? this.findSlot(w) : { col, row }
    this.save({
      ...this.layout,
      id: 'custom',
      widgets: [...this.layout.widgets, { widgetId, col: at.col, row: at.row, w, h: meta.minH }],
    })
  }

  removeWidget(index) {
    this.save({
      ...this.layout,
      id: 'custom',
      widgets: this.layout.widgets.filter((_, i) => i !== index),
    })
  }

  moveWidget(index, col, row) {
    const widgets = this.layout.widgets.map((w, i) => (i === index ? { ...w, col, row } : w))
    this.save({ ...this.layout, id: 'custom', widgets })
  }

  // Changing column count has to re-place anything that would fall outside
  // the new width, or those widgets disappear. Narrowing to 2 columns with a
  // widget at col 3 is the common case.
  setColumns(n) {
    const cols = Math.max(1, Math.min(4, n))
    const next = { ...this.layout, columns: cols, id: 'custom', widgets: [] }
    const fitted = []
    const occupied = (c, r, w) => fitted.some((f) =>
      r >= f.row && r < f.row + f.h && c < f.col + f.w && c + w > f.col)

    for (const widget of this.layout.widgets) {
      const w = Math.min(widget.w, cols)
      let placed = null
      for (let row = 0; row < 64 && !placed; row++) {
        for (let col = 0; col + w <= cols && !placed; col++) {
          if (!occupied(col, row, w)) placed = { col, row }
        }
      }
      fitted.push({ ...widget, w, col: placed?.col ?? 0, row: placed?.row ?? 0 })
    }
    next.widgets = fitted
    this.save(next)
  }

  addRow() {
    // A row with nothing in it has no representation in this model — the grid
    // draws empty cells wherever a position is unoccupied. So "add a row"
    // means "let the grid know it should render one more", which it derives
    // from maxRow. Returning the index lets the caller scroll to it.
    return this.getMaxRow() + 1
  }

  // ── Custom saved layouts ────────────────────────────────────────────────
  getCustomLayouts() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') } catch { return [] }
  }

  saveCustomLayout(name) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) return null
    const entry = { ...clone(this.layout), id: `custom-${Date.now()}`, name: trimmed, icon: '✎', custom: true }
    const all = [...this.getCustomLayouts().filter((l) => l.name !== trimmed), entry]
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)) } catch { /* quota */ }
    this.emit()
    return entry
  }

  deleteCustomLayout(id) {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(this.getCustomLayouts().filter((l) => l.id !== id)))
    } catch { /* quota */ }
    this.emit()
  }

  applyCustomLayout(id) {
    const found = this.getCustomLayouts().find((l) => l.id === id)
    if (found) this.save(clone(found))
    return this.layout
  }

  // ── First-run ───────────────────────────────────────────────────────────
  isSetupDone() {
    try { return localStorage.getItem(SETUP_KEY) === 'true' } catch { return true }
  }

  markSetupDone() {
    try { localStorage.setItem(SETUP_KEY, 'true') } catch { /* ignore */ }
    this.emit()
  }
}

export const dashboardService = new DashboardService()
export { PRESET_LAYOUTS, WIDGET_CATALOGUE }
