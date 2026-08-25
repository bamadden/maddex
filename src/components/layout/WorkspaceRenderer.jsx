import { Fragment, useRef, useState, useCallback } from 'react'
import { workspaceService } from '../../services/workspaceService'
import ModuleRenderer from './ModuleRenderer'
import { WORKSPACE_MODULE_LIST } from '../../config/workspaceModules'

// Renders a workspace's panels according to its `layout`:
//  - 'split-right'      → panels side by side (horizontal row)
//  - 'split-horizontal'  → panels stacked (vertical column)
//  - 'quad'              → fixed 2x2 grid (no per-cell resize — resizing a
//    2D grid from a flat panels[] list needs a separate row/col size model
//    the workspace schema doesn't carry; even 50/50 split is a reasonable
//    trade-off here since the primary "arrange + resize" use case is the
//    2-panel layouts, which get full drag-resize below)
// 'single' never reaches this component — App.jsx keeps its existing
// single-module render path for that case.

function ResizableDivider({ onResize, direction }) {
  const dragging = useRef(false)
  const startPos = useRef(0)

  const onMouseDown = useCallback((e) => {
    dragging.current = true
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY

    const onMove = (ev) => {
      if (!dragging.current) return
      const pos = direction === 'horizontal' ? ev.clientX : ev.clientY
      const delta = pos - startPos.current
      onResize(delta)
      startPos.current = pos
    }

    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [onResize, direction])

  return (
    <div
      onMouseDown={onMouseDown}
      className="flex-shrink-0 transition-colors z-10"
      style={{
        background: 'rgba(201,168,76,0.08)',
        cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
        ...(direction === 'horizontal' ? { width: 4, height: '100%' } : { height: 4, width: '100%' }),
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,168,76,0.4)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(201,168,76,0.08)' }}
    />
  )
}

function PanelHeader({ module, onChangeModule, onClose, canClose }) {
  const [showPicker, setShowPicker] = useState(false)
  const current = WORKSPACE_MODULE_LIST.find((m) => m.id === module)

  return (
    <div className="relative flex items-center gap-2 h-8 px-2 flex-shrink-0 bg-terminal-bg border-b border-terminal-border">
      <button
        onClick={() => setShowPicker((s) => !s)}
        className="flex items-center gap-1.5 px-1.5 py-0.5 text-2xs tracking-widest text-terminal-gold hover:bg-terminal-surface2 font-mono"
      >
        <span>{current?.icon}</span>
        <span>{current?.label?.toUpperCase() ?? module.toUpperCase()}</span>
        <span className="text-terminal-text-dim">▾</span>
      </button>

      <div className="flex-1" />

      {canClose && (
        <button
          title="Close panel"
          onClick={onClose}
          className="text-terminal-text-dim hover:text-terminal-red px-1 text-xs"
        >
          ✕
        </button>
      )}

      {showPicker && (
        <div className="absolute top-full left-0 mt-0.5 min-w-[180px] bg-terminal-panel border border-terminal-border-gold shadow-2xl z-50 font-mono">
          {WORKSPACE_MODULE_LIST.map((m) => (
            <button
              key={m.id}
              onClick={() => { onChangeModule(m.id); setShowPicker(false) }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-2xs tracking-wide text-left border-b border-terminal-border/40 ${
                m.id === module ? 'bg-terminal-gold/10 text-terminal-gold' : 'text-terminal-text-dim hover:bg-terminal-surface2 hover:text-terminal-text'
              }`}
            >
              <span className="w-4">{m.icon}</span>
              {m.label.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Panel({ panel, index, isHorizontal, canClose, onUpdatePanel, onRemovePanel }) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        flex: panel.flex || 1,
        minWidth: isHorizontal ? 220 : undefined,
        minHeight: !isHorizontal ? 160 : undefined,
      }}
    >
      <PanelHeader
        module={panel.module}
        canClose={canClose}
        onChangeModule={(moduleId) => onUpdatePanel(index, moduleId)}
        onClose={() => onRemovePanel(index)}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <ModuleRenderer module={panel.module} />
      </div>
    </div>
  )
}

export function WorkspaceRenderer({ workspace }) {
  const [panelSizes, setPanelSizes] = useState(() => workspace.panels.map((p) => p.flex || 1))
  const containerRef = useRef(null)

  // Reset local flex state when the active workspace changes — derived
  // during render (not an effect) per React's "adjusting state when a prop
  // changes" pattern, using state (not a ref) to track the previous id.
  const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspace.id)
  if (prevWorkspaceId !== workspace.id) {
    setPrevWorkspaceId(workspace.id)
    setPanelSizes(workspace.panels.map((p) => p.flex || 1))
  }

  const isHorizontal = workspace.layout === 'split-right'

  const handleResize = useCallback((index, delta, totalSize) => {
    setPanelSizes((prev) => {
      const next = [...prev]
      const minFlex = 0.2
      const totalFlex = next.reduce((a, b) => a + b, 0)
      const flexDelta = (delta / totalSize) * totalFlex

      next[index] = Math.max(minFlex, next[index] + flexDelta)
      next[index + 1] = Math.max(minFlex, next[index + 1] - flexDelta)

      workspaceService.updatePanelSize(workspace.id, index, next[index])
      workspaceService.updatePanelSize(workspace.id, index + 1, next[index + 1])

      return next
    })
  }, [workspace.id])

  const handleUpdatePanel = useCallback((index, moduleId) => {
    workspaceService.updatePanelModule(workspace.id, index, moduleId)
  }, [workspace.id])

  const handleRemovePanel = useCallback((index) => {
    workspaceService.removePanel(workspace.id, index)
  }, [workspace.id])

  if (workspace.layout === 'quad') {
    const cells = workspace.panels.slice(0, 4)
    return (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-px bg-terminal-border overflow-hidden">
        {cells.map((panel, i) => (
          <div key={i} className="bg-terminal-bg overflow-hidden flex flex-col">
            <PanelHeader
              module={panel.module}
              canClose={cells.length > 1}
              onChangeModule={(moduleId) => handleUpdatePanel(i, moduleId)}
              onClose={() => handleRemovePanel(i)}
            />
            <div className="flex-1 min-h-0 overflow-hidden">
              <ModuleRenderer module={panel.module} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full h-full overflow-hidden"
      style={{ flexDirection: isHorizontal ? 'row' : 'column' }}
    >
      {workspace.panels.map((panel, i) => (
        <Fragment key={`panel-${i}`}>
          <Panel
            panel={{ ...panel, flex: panelSizes[i] || panel.flex || 1 }}
            index={i}
            isHorizontal={isHorizontal}
            canClose={workspace.panels.length > 1}
            onUpdatePanel={handleUpdatePanel}
            onRemovePanel={handleRemovePanel}
          />
          {i < workspace.panels.length - 1 && (
            <ResizableDivider
              direction={isHorizontal ? 'horizontal' : 'vertical'}
              onResize={(delta) => {
                const size = isHorizontal
                  ? containerRef.current?.offsetWidth
                  : containerRef.current?.offsetHeight
                handleResize(i, delta, size || 1000)
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

export default WorkspaceRenderer
