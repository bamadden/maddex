// Saved views + session auto-restore. The service itself is pure
// localStorage plumbing — it doesn't reach into React/store state directly.
// Callers (App.jsx's Terminal component) assemble the snapshot from live
// store/workspaceService values and hand it to saveView()/saveAutosave().
//
// Captured fields are scoped to what the app actually tracks globally:
// active workspace, active module, and the AI panel's open/mode state.
// Per-panel selected-asset/chart-period/scroll-position from the brief
// aren't tracked anywhere in the app yet, so they're not part of the
// snapshot — capturing fields nothing produces would just silently no-op
// on restore.
const SAVED_VIEWS_KEY = 'maddex_saved_views'
const AUTOSAVE_KEY = 'maddex_autosave'
const MAX_SAVED_VIEWS = 10

class ViewStateService {
  constructor() {
    this.listeners = new Set()
  }

  subscribe(cb) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  emit() {
    this.listeners.forEach((cb) => cb())
  }

  getSavedViews() {
    try {
      const saved = localStorage.getItem(SAVED_VIEWS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  saveView(name, state) {
    // A name already saved is replaced, not duplicated (WS2 audit).
    const label = name || 'Untitled View'
    const views = this.getSavedViews().filter((v) => v.name.toLowerCase() !== label.toLowerCase())
    // Unique even for two saves in one millisecond (rename and delete go by id).
    const view = { id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: label, timestamp: Date.now(), state }
    const next = [view, ...views].slice(0, MAX_SAVED_VIEWS)
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)) } catch { /* best-effort */ }
    this.emit()
    return view.id
  }

  // The view a save under this name would push out (the oldest, when the
  // list is full and the name is new), or null (WS2 audit, 26 Nov 2026: the
  // eleventh view dropped the oldest without a word).
  wouldDrop(name) {
    const label = (name || 'Untitled View').toLowerCase()
    const views = this.getSavedViews()
    if (views.some((v) => v.name.toLowerCase() === label)) return null
    return views.length >= MAX_SAVED_VIEWS ? views[views.length - 1] : null
  }

  // → 'renamed' | 'missing' | 'taken' (another view has that name).
  renameView(id, name) {
    const label = String(name ?? '').trim().slice(0, 40)
    const views = this.getSavedViews()
    if (!label || !views.some((v) => v.id === id)) return 'missing'
    if (views.some((v) => v.id !== id && v.name.toLowerCase() === label.toLowerCase())) return 'taken'
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.map((v) => (v.id === id ? { ...v, name: label } : v)))) } catch { /* best-effort */ }
    this.emit()
    return 'renamed'
  }

  deleteView(id) {
    const next = this.getSavedViews().filter((v) => v.id !== id)
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)) } catch { /* best-effort */ }
    this.emit()
  }

  getView(id) {
    return this.getSavedViews().find((v) => v.id === id) ?? null
  }

  // "view NAME" in the command bar: the exact name, else the only one that
  // starts with it, else the only one that contains it (WS2 audit).
  findByName(raw) {
    const q = String(raw ?? '').trim().toLowerCase()
    if (!q) return null
    const views = this.getSavedViews()
    const exact = views.find((v) => v.name.toLowerCase() === q)
    if (exact) return exact
    const starts = views.filter((v) => v.name.toLowerCase().startsWith(q))
    if (starts.length === 1) return starts[0]
    const has = views.filter((v) => v.name.toLowerCase().includes(q))
    return has.length === 1 ? has[0] : null
  }

  saveAutosave(state) {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }))
    } catch { /* best-effort */ }
  }

  loadAutosave() {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  }

  clearAutosave() {
    try { localStorage.removeItem(AUTOSAVE_KEY) } catch { /* best-effort */ }
  }
}

export const viewStateService = new ViewStateService()
export { MAX_SAVED_VIEWS }
