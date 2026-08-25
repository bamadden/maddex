import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { workspaceService } from '../../services/workspaceService'
import { WORKSPACE_MODULE_LIST } from '../../config/workspaceModules'

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
          className="w-full py-2 bg-terminal-gold text-terminal-bg font-bold text-2xs tracking-widest hover:bg-terminal-gold/90"
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

const subscribe = (cb) => workspaceService.subscribe(cb)
const getSnapshot = () => `${workspaceService.active}::${workspaceService.workspaces.length}::${JSON.stringify(workspaceService.workspaces.map((w) => [w.id, w.name]))}`

export default function WorkspaceSwitcher() {
  useSyncExternalStore(subscribe, getSnapshot)
  const [showNew, setShowNew] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

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
          className={`flex items-center gap-1 px-1.5 py-0.5 text-2xs font-mono tracking-wide border transition-colors ${
            ws.id === active
              ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-semibold'
              : 'bg-transparent text-terminal-text-dim border-transparent hover:border-terminal-gold/40 hover:text-terminal-text'
          }`}
        >
          <span>{ws.icon}</span>
          <span className="hidden xl:inline">{ws.name}</span>
        </button>
      ))}
      <button
        onClick={() => setShowNew(true)}
        title="New workspace"
        className="px-1.5 py-0.5 text-2xs text-terminal-text-dim hover:text-terminal-gold border border-transparent hover:border-terminal-gold/40"
      >
        +
      </button>

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
