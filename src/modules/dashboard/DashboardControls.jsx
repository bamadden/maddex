import { useState } from 'react'
import { dashboardService } from '../../services/dashboardService'

// Miniature of a layout, drawn from its own placements rather than a picture.
// A preset that changes updates its own preview, and a custom layout gets one
// for free.
function LayoutPreview({ layout, active }) {
  const W = 48, H = 32, GAP = 1.5
  const cols = layout.columns
  const rows = Math.max(1, ...layout.widgets.map((w) => w.row + w.h))
  const cw = (W - (cols - 1) * GAP) / cols
  const ch = (H - (rows - 1) * GAP) / rows

  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <rect width={W} height={H} fill="rgba(99,120,153,0.08)" rx="1" />
      {layout.widgets.map((w, i) => (
        <rect
          key={i}
          x={w.col * (cw + GAP)}
          y={w.row * (ch + GAP)}
          width={cw * w.w + GAP * (w.w - 1)}
          height={ch * w.h + GAP * (w.h - 1)}
          rx="1"
          fill={active ? 'rgba(201,168,76,0.85)' : 'rgba(201,168,76,0.4)'}
        />
      ))}
    </svg>
  )
}

const cardStyle = (active) => ({
  width: 168,
  flexShrink: 0,
  background: active ? 'rgba(201,168,76,0.09)' : 'rgba(201,168,76,0.04)',
  border: `1px solid rgba(201,168,76,${active ? 0.4 : 0.12})`,
  borderRadius: 3,
  padding: '10px 12px',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'border-color 150ms, background-color 150ms',
})

export default function DashboardControls({ layout, onChange }) {
  const [name, setName] = useState('')
  const presets = dashboardService.getPresets()
  const customs = dashboardService.getCustomLayouts()

  const apply = (id, custom) => {
    if (custom) dashboardService.applyCustomLayout(id)
    else dashboardService.applyPreset(id)
    onChange?.()
  }

  return (
    <div
      style={{
        background: '#030912',
        borderBottom: '1px solid rgba(201,168,76,0.15)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <div className="font-mono mb-2" style={{ fontSize: 8, letterSpacing: '0.2em', color: '#C9A84C' }}>
          PRESET LAYOUTS
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {[...presets, ...customs].map((p) => {
            const active = layout.id === p.id
            return (
              <button key={p.id} onClick={() => apply(p.id, !!p.custom)} style={cardStyle(active)} className="dash-preset-card">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 11, color: '#C9A84C' }}>{p.icon}</span>
                  <span className="font-mono truncate" style={{ fontSize: 10, letterSpacing: '0.08em', color: active ? '#C9A84C' : '#E8EDF5' }}>
                    {p.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <LayoutPreview layout={p} active={active} />
                  <span className="font-sans leading-snug" style={{ fontSize: 10, color: '#4A6080' }}>
                    {p.description ?? `${p.widgets.length} widgets`}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="font-mono mb-1.5" style={{ fontSize: 8, letterSpacing: '0.2em', color: '#C9A84C' }}>COLUMNS</div>
          <div className="flex border border-terminal-border w-fit">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => { dashboardService.setColumns(n); onChange?.() }}
                className={`font-mono text-[9px] font-bold px-3 py-1.5 border-r border-terminal-border last:border-r-0 transition-colors ${
                  layout.columns === n ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
                }`}
              >{n}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono mb-1.5" style={{ fontSize: 8, letterSpacing: '0.2em', color: '#C9A84C' }}>SAVE AS CUSTOM</div>
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { dashboardService.saveCustomLayout(name); setName(''); onChange?.() } }}
              placeholder="Layout name…"
              className="bg-terminal-bg border border-terminal-border px-2 py-1 font-mono text-[10px] text-terminal-text-bright outline-none focus:border-terminal-gold"
              style={{ width: 150 }}
            />
            <button
              onClick={() => { if (name.trim()) { dashboardService.saveCustomLayout(name); setName(''); onChange?.() } }}
              disabled={!name.trim()}
              className="btn-primary btn-sm disabled:opacity-30"
            >SAVE</button>
          </div>
        </div>
      </div>
    </div>
  )
}
