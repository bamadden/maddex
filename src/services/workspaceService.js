// Multi-panel workspace layouts — lets a user arrange several modules side
// by side, resize them, and save the arrangement. Panel `module` values are
// keys into App.jsx's MODULE_MAP; 'maddenai' is deliberately not offered as
// a panel module since AIPanel is a global singleton gated on the store's
// chatOpen flag, not an independently routable module.
const DEFAULT_WORKSPACES = [
  {
    id: 'default',
    name: 'Standard',
    icon: '▣',
    layout: 'single',
    panels: [{ module: 'markets', flex: 1 }],
  },
  {
    id: 'research',
    name: 'Research',
    icon: '⊞',
    layout: 'split-right',
    panels: [
      { module: 'markets', flex: 1 },
      { module: 'news', flex: 0.4 },
    ],
  },
  {
    id: 'macro-watch',
    name: 'Macro',
    icon: '⊟',
    layout: 'split-horizontal',
    panels: [
      { module: 'global', flex: 1 },
      { module: 'macro', flex: 1 },
    ],
  },
  {
    id: 'trading',
    name: 'Trading',
    icon: '⊠',
    layout: 'quad',
    panels: [
      { module: 'markets', flex: 1 },
      { module: 'news', flex: 1 },
      { module: 'watchlist', flex: 1 },
      { module: 'portfolio', flex: 1 },
    ],
  },
]

const WORKSPACES_KEY = 'maddex_workspaces'
const ACTIVE_KEY = 'maddex_active_workspace'

class WorkspaceService {
  constructor() {
    this.workspaces = this.load()
    this.active = this.loadActive()
    this.listeners = new Set()
  }

  load() {
    try {
      const saved = localStorage.getItem(WORKSPACES_KEY)
      const parsed = saved ? JSON.parse(saved) : null
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_WORKSPACES
    } catch {
      return DEFAULT_WORKSPACES
    }
  }

  loadActive() {
    try {
      return localStorage.getItem(ACTIVE_KEY) || 'default'
    } catch {
      return 'default'
    }
  }

  save() {
    try {
      localStorage.setItem(WORKSPACES_KEY, JSON.stringify(this.workspaces))
    } catch { /* best-effort */ }
    this.emit()
  }

  subscribe(cb) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  emit() {
    this.listeners.forEach((cb) => cb())
  }

  setActive(id) {
    this.active = id
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* best-effort */ }
    this.emit()
  }

  getActive() {
    return this.workspaces.find((w) => w.id === this.active) || this.workspaces[0]
  }

  updatePanelSize(workspaceId, panelIndex, flex) {
    const ws = this.workspaces.find((w) => w.id === workspaceId)
    if (ws?.panels[panelIndex]) {
      ws.panels[panelIndex].flex = flex
      this.save()
    }
  }

  updatePanelModule(workspaceId, panelIndex, module) {
    const ws = this.workspaces.find((w) => w.id === workspaceId)
    if (ws?.panels[panelIndex]) {
      ws.panels[panelIndex].module = module
      this.save()
    }
  }

  removePanel(workspaceId, panelIndex) {
    const ws = this.workspaces.find((w) => w.id === workspaceId)
    if (ws && ws.panels.length > 1) {
      ws.panels = ws.panels.filter((_, i) => i !== panelIndex)
      this.save()
    }
  }

  createWorkspace(name, layout, panels) {
    const id = `ws_${Date.now()}`
    const workspace = { id, name, icon: '◈', layout, panels }
    this.workspaces.push(workspace)
    this.save()
    return id
  }

  duplicateWorkspace(id) {
    const ws = this.workspaces.find((w) => w.id === id)
    if (!ws) return null
    const newId = `ws_${Date.now()}`
    this.workspaces.push({
      ...ws,
      id: newId,
      name: `${ws.name} Copy`,
      panels: ws.panels.map((p) => ({ ...p })),
    })
    this.save()
    return newId
  }

  deleteWorkspace(id) {
    if (DEFAULT_WORKSPACES.find((w) => w.id === id)) return
    this.workspaces = this.workspaces.filter((w) => w.id !== id)
    if (this.active === id) this.setActive('default')
    this.save()
  }

  renameWorkspace(id, name) {
    const ws = this.workspaces.find((w) => w.id === id)
    if (ws) {
      ws.name = name
      this.save()
    }
  }

  isDefault(id) {
    return !!DEFAULT_WORKSPACES.find((w) => w.id === id)
  }

  // Settings → Workspaces → Import: appends workspaces from an exported
  // JSON array, regenerating ids so they never collide with existing ones.
  importWorkspaces(list) {
    if (!Array.isArray(list)) return 0
    const valid = list.filter((w) => w && typeof w.name === 'string' && Array.isArray(w.panels))
    valid.forEach((w, i) => {
      this.workspaces.push({ ...w, id: `ws_${Date.now()}_${i}` })
    })
    if (valid.length) this.save()
    return valid.length
  }
}

export const workspaceService = new WorkspaceService()
export { DEFAULT_WORKSPACES }
