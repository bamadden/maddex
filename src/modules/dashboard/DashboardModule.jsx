import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { useStore } from '../../store/useStore'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { dashboardService } from '../../services/dashboardService'
import DashboardGrid from './DashboardGrid'
import DashboardControls from './DashboardControls'
import WidgetPicker from './WidgetPicker'

// The dashboard is now a layout host, not a fixed page.
//
// It used to hard-code three rows of nine cards. Those cards have moved to
// src/modules/dashboard/widgets/ as standalone components, so the same tiles
// can appear in any arrangement, more than once, or not at all — and this
// file no longer knows or cares what a portfolio snapshot looks like.
//
// Placement lives in dashboardService; this component reads it, renders the
// grid, and owns the three pieces of UI that change it: the layout panel,
// edit mode, and the widget picker.

// ─── Root ───────────────────────────────────────────────────────────────────

export default function DashboardModule() {
  const { setActiveModule, watchlist } = useStore()

  // Subscribes to the layout rather than copying it into state: the service
  // is the single source of truth and the picker, the grid and the keyboard
  // shortcut all write to it from different places.
  useSyncExternalStore(
    useCallback((cb) => dashboardService.subscribe(cb), []),
    useCallback(() => JSON.stringify(dashboardService.getLayout()), []),
  )
  const layout = dashboardService.getLayout()

  const [showPicker, setShowPicker] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [addAt, setAddAt] = useState(null)
  const [showSetup, setShowSetup] = useState(() => !dashboardService.isSetupDone())
  const [viewportCols, setViewportCols] = useState(null)

  // Widgets navigate by event so they can render anywhere, including inside
  // a popout window with no store provider in scope.
  useEffect(() => {
    const handler = (e) => e.detail?.moduleId && setActiveModule(e.detail.moduleId)
    window.addEventListener('madden:goto-module', handler)
    return () => window.removeEventListener('madden:goto-module', handler)
  }, [setActiveModule])

  // Responsive cap. This does NOT write to the layout — narrowing the window
  // must not permanently rewrite the arrangement the user chose. The cap is
  // applied at render and released when the window grows back.
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      setViewportCols(w < 900 ? 1 : w < 1200 ? 2 : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setEditMode((v) => !v)
      }
      if (e.key === 'Escape') setEditMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const effective = viewportCols && viewportCols < layout.columns
    ? { ...layout, columns: viewportCols, widgets: layout.widgets.map((w) => ({ ...w, w: Math.min(w.w, viewportCols), col: Math.min(w.col, viewportCols - 1) })) }
    : layout

  return (
    <div className="h-full flex flex-col min-h-0 relative">
      <ModuleHeader
        title="DASHBOARD"
        subtitle="Your terminal at a glance"
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPicker((v) => !v)}
              className={`font-mono text-[9px] tracking-widest px-2 py-1 rounded-sm transition-colors ${
                showPicker ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
              style={showPicker ? undefined : { border: '1px solid rgba(201,168,76,0.2)' }}
            >⊞ LAYOUT</button>
            <button
              onClick={() => setEditMode((v) => !v)}
              title="Toggle edit mode (⌘E)"
              className={`font-mono text-[9px] tracking-widest px-2 py-1 rounded-sm transition-colors ${
                editMode ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
              style={editMode ? undefined : { border: '1px solid rgba(201,168,76,0.2)' }}
            >{editMode ? '✓ DONE' : '✎ EDIT'}</button>
          </div>
        }
      />

      {showPicker && <DashboardControls layout={layout} onChange={() => {}} />}

      {editMode && (
        <div
          className="flex-shrink-0 font-mono"
          style={{
            padding: '6px 20px', fontSize: 9, letterSpacing: '0.08em', color: '#4A6080',
            background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid rgba(201,168,76,0.1)',
          }}
        >
          Click + to add a widget · Click ✕ to remove · ⌘E or Esc when finished
        </div>
      )}

      <DashboardGrid
        layout={effective}
        editMode={editMode}
        onAddAt={(col, row) => { setAddAt({ col, row }); }}
      />

      {addAt && (
        <WidgetPicker
          at={addAt}
          onClose={() => setAddAt(null)}
          onAdded={() => setAddAt(null)}
        />
      )}

      {showSetup && (
        <DashboardSetup
          onPick={(presetId) => {
            dashboardService.applyPreset(presetId)
            dashboardService.markSetupDone()
            setShowSetup(false)
          }}
          onSkip={() => { dashboardService.markSetupDone(); setShowSetup(false) }}
        />
      )}

      {watchlist.length === 0 && !showSetup && null}
    </div>
  )
}

// First run only. Four large preset cards, because choosing a shape is the
// one decision that makes every later one easier — and a dashboard that
// opens empty teaches nothing about what it can do.
function DashboardSetup({ onPick, onSkip }) {
  const presets = dashboardService.getPresets()
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 40, background: 'rgba(2,6,12,0.9)', backdropFilter: 'blur(3px)' }}
    >
      <div style={{ width: 620, maxWidth: '92vw', padding: 24 }}>
        <div className="font-mono mb-1" style={{ fontSize: 13, letterSpacing: '0.2em', color: '#C9A84C' }}>
          WELCOME TO YOUR DASHBOARD
        </div>
        <div className="font-sans mb-5" style={{ fontSize: 12, color: '#8BA3C4' }}>
          Choose a layout to get started, or customise it to fit your workflow.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {presets.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="dash-preset-card text-left"
              style={{
                background: 'rgba(201,168,76,0.04)',
                border: '1px solid rgba(201,168,76,0.15)',
                borderRadius: 3, padding: 14, cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: 13, color: '#C9A84C' }}>{p.icon}</span>
                <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', color: '#E8EDF5' }}>{p.name}</span>
              </div>
              <div className="font-sans" style={{ fontSize: 11, color: '#637899' }}>{p.description}</div>
            </button>
          ))}
        </div>
        <button onClick={onSkip} className="font-mono text-[9px] tracking-widest mt-4" style={{ color: '#4A6080' }}>
          SKIP — USE DEFAULT
        </button>
      </div>
    </div>
  )
}
