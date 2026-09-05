import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { workspaceService } from '../../services/workspaceService'
import { WORKSPACE_MODULE_LIST } from '../../config/workspaceModules'
import { viewStateService } from '../../services/viewStateService'

const LAYOUT_OPTIONS = [
  { id: 'single', label: 'Single', panels: 1 },
  { id: 'split-right', label: 'Split Right', panels: 2 },
  { id: 'split-horizontal', label: 'Split Horiz', panels: 2 },
  { id: 'quad', label: 'Quad', panels: 4 },
]

function LayoutWireframe({ layout }) {
  const cell = 'border border-terminal-gold/50'
  if (layout === 'single') {
    return <div className={`${cell} w-full h-full`} />
  }
  if (layout === 'split-right') {
    return (
      <div className="flex w-full h-full gap-0.5">
        <div className={`${cell} flex-[2]`} />
        <div className={`${cell} flex-1`} />
      </div>
    )
  }
  if (layout === 'split-horizontal') {
    return (
      <div className="flex flex-col w-full h-full gap-0.5">
        <div className={`${cell} flex-1`} />
        <div className={`${cell} flex-1`} />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
      <div className={cell} /><div className={cell} /><div className={cell} /><div className={cell} />
    </div>
  )
}

function NewWorkspaceModal({ onClose, onCreated }) {
  const [name, setName] = useState('My Workspace')
  const [layout, setLayout] = useState('split-right')
  const panelCount = LAYOUT_OPTIONS.find((l) => l.id === layout)?.panels ?? 1
  const [modules, setModules] = useState(['markets', 'news', 'watchlist', 'portfolio'])

  const handleCreate = () => {
    const panels = Array.from({ length: panelCount }, (_, i) => ({
      module: modules[i] || 'markets',
      flex: 1,
    }))
    const id = workspaceService.createWorkspace(name.trim() || 'My Workspace', layout, panels)
    workspaceService.setActive(id)
    onCreated?.(id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border-gold p-6 w-[440px] max-w-[92vw] shadow-2xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">CREATE WORKSPACE</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>

        <div className="mb-4">
          <div className="text-2xs text-terminal-text-dim tracking-widest mb-1.5">NAME</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold"
            placeholder="My Workspace"
          />
        </div>

        <div className="mb-4">
          <div className="text-2xs text-terminal-text-dim tracking-widest mb-1.5">LAYOUT</div>
          <div className="grid grid-cols-4 gap-2">
            {LAYOUT_OPTIONS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={`flex flex-col items-center gap-1.5 p-2 border transition-colors ${
                  layout === l.id ? 'border-terminal-gold bg-terminal-gold/10' : 'border-terminal-border hover:border-terminal-gold/40'
                }`}
              >
                <div style={{ width: 48, height: 32 }}><LayoutWireframe layout={l.id} /></div>
                <span className="text-[9px] text-terminal-text-dim tracking-wide">{l.label.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-2xs text-terminal-text-dim tracking-widest mb-1.5">PANELS</div>
          <div className="space-y-1.5">
            {Array.from({ length: panelCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-2xs text-terminal-text-dim w-14 flex-shrink-0">PANEL {i + 1}</span>
                <select
                  value={modules[i] || 'markets'}
                  onChange={(e) => setModules((prev) => {
                    const next = [...prev]
                    next[i] = e.target.value
                    return next
                  })}
                  className="flex-1 bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold"
                >
                  {WORKSPACE_MODULE_LIST.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="w-full btn-primary"
        >
          CREATE
        </button>
      </div>
    </div>
  )
}

function WorkspaceContextMenu({ workspace, position, onClose }) {
  const ref = useRef(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(workspace.name)
  const isDefault = workspaceService.isDefault(workspace.id)

  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  if (renaming) {
    return (
      <div
        ref={ref}
        className="fixed z-[70] bg-terminal-panel border border-terminal-border-gold shadow-2xl p-2 font-mono"
        style={{ left: position.x, top: position.y }}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              workspaceService.renameWorkspace(workspace.id, name.trim() || workspace.name)
              onClose()
            }
            if (e.key === 'Escape') onClose()
          }}
          className="bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold w-36"
        />
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="fixed z-[70] bg-terminal-panel border border-terminal-border-gold shadow-2xl min-w-[140px] font-mono"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => setRenaming(true)}
        className="block w-full text-left px-3 py-2 text-2xs text-terminal-text-dim hover:bg-terminal-surface2 hover:text-terminal-text tracking-wide"
      >
        Rename
      </button>
      <button
        onClick={() => { workspaceService.duplicateWorkspace(workspace.id); onClose() }}
        className="block w-full text-left px-3 py-2 text-2xs text-terminal-text-dim hover:bg-terminal-surface2 hover:text-terminal-text tracking-wide"
      >
        Duplicate
      </button>
      {!isDefault && (
        <button
          onClick={() => { workspaceService.deleteWorkspace(workspace.id); onClose() }}
          className="block w-full text-left px-3 py-2 text-2xs text-terminal-red hover:bg-terminal-red/10 tracking-wide"
        >
          Delete
        </button>
      )}
    </div>
  )
}

function fmtViewTime(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function SavedViewsMenu() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [, forceUpdate] = useState(0)
  const ref = useRef(null)

  useEffect(() => viewStateService.subscribe(() => forceUpdate((n) => n + 1)), [])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setSaving(false) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const views = viewStateService.getSavedViews()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Saved views"
        className="flex items-center justify-center h-7 px-3 text-[9px] font-mono tracking-wider rounded-[2px] bg-transparent text-terminal-muted border border-terminal-gold/[0.12] hover:border-terminal-gold/30 hover:text-terminal-text-dim transition-colors"
      >
        ⧉
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-0.5 min-w-[220px] bg-terminal-panel border border-terminal-border-gold shadow-2xl z-50 font-mono">
          {saving ? (
            <div className="p-2 flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    window.dispatchEvent(new CustomEvent('madden:save-view', { detail: { name: name.trim() || 'Untitled View' } }))
                    setSaving(false); setName(''); setOpen(false)
                  }
                  if (e.key === 'Escape') setSaving(false)
                }}
                placeholder="View name…"
                className="flex-1 bg-terminal-bg border border-terminal-border px-1.5 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold"
              />
            </div>
          ) : (
            <button
              onClick={() => setSaving(true)}
              className="block w-full text-left px-3 py-2 text-2xs text-terminal-gold hover:bg-terminal-surface2 tracking-wide border-b border-terminal-border/40"
            >
              + SAVE CURRENT VIEW
            </button>
          )}
          {views.length === 0 ? (
            <div className="px-3 py-3 text-2xs text-terminal-text-dim/50 text-center">No saved views yet</div>
          ) : (
            views.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border/30 last:border-b-0 group">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('madden:load-view', { detail: { id: v.id } }))
                    setOpen(false)
                  }}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="text-2xs text-terminal-text-bright truncate">{v.name}</div>
                  <div className="text-[10px] text-terminal-text-dim/60">{fmtViewTime(v.timestamp)}</div>
                </button>
                <button
                  onClick={() => viewStateService.deleteView(v.id)}
                  className="text-terminal-text-dim/40 hover:text-terminal-red text-xs px-1.5 opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const subscribe = (cb) => workspaceService.subscribe(cb)
const getSnapshot = () => `${workspaceService.active}::${workspaceService.workspaces.length}::${JSON.stringify(workspaceService.workspaces.map((w) => [w.id, w.name]))}`

export default function WorkspaceSwitcher() {
  useSyncExternalStore(subscribe, getSnapshot)
  const [showNew, setShowNew] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => {
    const handler = () => setShowNew(true)
    window.addEventListener('madden:new-workspace', handler)
    return () => window.removeEventListener('madden:new-workspace', handler)
  }, [])

  const workspaces = workspaceService.workspaces
  const active = workspaceService.active

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {workspaces.map((ws) => (
        <button
          key={ws.id}
          onClick={() => workspaceService.setActive(ws.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ workspace: ws, position: { x: e.clientX, y: e.clientY } })
          }}
          title={ws.name}
          className={`flex items-center gap-1.5 h-7 px-3 text-[9px] font-mono tracking-wider uppercase rounded-[2px] whitespace-nowrap transition-colors ${
            ws.id === active
              ? 'bg-terminal-gold/[0.15] text-terminal-gold border border-terminal-gold/40'
              : 'bg-transparent text-terminal-muted border border-terminal-gold/[0.12] hover:border-terminal-gold/30 hover:text-terminal-text-dim'
          }`}
        >
          <span className="leading-none">{ws.icon}</span>
          <span className="hidden lg:inline">{ws.name}</span>
        </button>
      ))}
      <button
        onClick={() => setShowNew(true)}
        title="New workspace"
        className="flex items-center justify-center h-7 px-3 text-[9px] font-mono tracking-wider rounded-[2px] bg-transparent text-terminal-muted border border-terminal-gold/[0.12] hover:border-terminal-gold/30 hover:text-terminal-text-dim transition-colors"
      >
        +
      </button>

      <SavedViewsMenu />

      {showNew && <NewWorkspaceModal onClose={() => setShowNew(false)} />}
      {contextMenu && (
        <WorkspaceContextMenu
          workspace={contextMenu.workspace}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
