import { useRef, useState, useEffect } from 'react'
import { dashboardService } from '../../services/dashboardService'
import WidgetContent from './WidgetContent'

// The grid. Placements come from dashboardService; this file only draws them.
//
// Widgets sit on a CSS grid with 1px gaps and the gap colour supplied by the
// container's background showing through. That is cheaper and steadier than
// borders on each tile, which double up between neighbours and leave a 2px
// line down the middle of the grid.

function WidgetCell({ widget, index, editMode, onRemove, drag, columns }) {
  const meta = dashboardService.getWidget(widget.widgetId)
  const isDragging = drag.dragIndex === index
  const isTarget = drag.overIndex === index && drag.dragIndex !== index

  return (
    <div
      draggable={editMode}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        // Firefox refuses to start a drag without data on the transfer.
        e.dataTransfer.setData('text/plain', String(index))
        drag.onStart(index)
      }}
      onDragOver={(e) => {
        if (!drag.isDragging()) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        drag.onOver(index)
      }}
      onDrop={(e) => { e.preventDefault(); drag.onDrop(index) }}
      onDragEnd={drag.onEnd}
      style={{
        // Placement is clamped to the RENDERED column count, not the saved one.
        // A widget saved at column 3 spanning 2 keeps "4 / span 2" in a
        // one-column render, and the grid answers by inventing implicit columns
        // — the layout silently reflows into a shape nobody chose. Clamping
        // here keeps the narrow view coherent while the saved layout is
        // untouched.
        gridColumn: `${Math.min(widget.col, columns - 1) + 1} / span ${Math.min(widget.w, columns)}`,
        gridRow: `${widget.row + 1} / span ${widget.h}`,
        background: '#060D1A',
        position: 'relative',
        // 140 in a single column: a phone shows one widget per row, so each gets
        // the full width and needs less height to be readable than it does
        // sharing a row with three others.
        minHeight: columns === 1 ? 140 : 160,
        overflow: 'hidden',
        // outline, not border: a border would take space inside the cell and
        // shift the widget's content by a pixel when edit mode turns on.
        ...(editMode ? { outline: '1px dashed rgba(201,168,76,0.3)', outlineOffset: -1 } : null),
        ...(editMode ? { cursor: isDragging ? 'grabbing' : 'grab' } : null),
        ...(isDragging ? { opacity: 0.5, transform: 'scale(0.98)' } : null),
        ...(isTarget ? { outline: '2px dashed #C9A84C', outlineOffset: -2, background: 'rgba(201,168,76,0.08)' } : null),
        transition: 'opacity 120ms, transform 120ms, background-color 120ms',
      }}
    >
      {editMode && (
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span
            style={{
              background: 'rgba(6,13,26,0.9)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 2,
              padding: '2px 6px',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 8,
              color: '#C9A84C',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}
          >
            {meta?.name ?? widget.widgetId}
          </span>
          <button
            onClick={() => onRemove(index)}
            title={`Remove ${meta?.name ?? widget.widgetId}`}
            aria-label={`Remove ${meta?.name ?? widget.widgetId}`}
            style={{
              background: 'rgba(168,50,50,0.85)', border: 'none', borderRadius: 2,
              color: '#fff', width: 20, height: 20, cursor: 'pointer', fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >✕</button>
        </div>
      )}

      <WidgetContent widgetId={widget.widgetId} index={index} />
    </div>
  )
}

// Gaps in the grid, drawn only while editing. Rendered one row past the last
// occupied one, so there is always somewhere to add to without a separate
// "add row" step having to insert anything.
function EmptyCells({ layout, onAdd }) {
  const cols = layout.columns
  const maxRow = dashboardService.getMaxRow()
  const cells = []

  for (let row = 0; row <= maxRow + 1; row++) {
    for (let col = 0; col < cols; col++) {
      if (dashboardService.isOccupied(col, row)) continue
      cells.push(
        <button
          key={`empty-${row}-${col}`}
          onClick={() => onAdd(col, row)}
          className="dash-empty-cell"
          style={{
            gridColumn: col + 1,
            gridRow: row + 1,
            minHeight: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(201,168,76,0.02)',
            border: '1px dashed rgba(201,168,76,0.12)',
            cursor: 'pointer',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'rgba(201,168,76,0.45)',
          }}
        >
          + ADD WIDGET
        </button>,
      )
    }
  }
  return cells
}

// Caps the rendered column count by available width.
//
// The saved layout can be up to four columns, and gridTemplateColumns honoured
// that at any viewport — on a 390px phone the "4x3 Research" layout renders
// four ~95px columns, which makes every widget unreadable while still
// technically laying out. The saved preference is left untouched; only what is
// drawn is clamped, so widening the window restores the chosen layout without
// the user having to re-pick it.
function useResponsiveColumns(preferred, containerRef) {
  const [width, setWidth] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [containerRef])

  // Null until measured — render the preference rather than flashing a
  // single-column layout on first paint.
  if (width == null) return preferred
  if (width < 560) return 1
  if (width < 900) return Math.min(2, preferred)
  if (width < 1200) return Math.min(3, preferred)
  return preferred
}

export default function DashboardGrid({ layout, editMode, onAddAt }) {
  const gridRef = useRef(null)
  const columns = useResponsiveColumns(layout.columns || 3, gridRef)
  // The index being dragged is held in a ref AND in state, deliberately.
  //
  // State drives the visual (dimmed source, highlighted target). The ref is
  // what the handlers read, because dragover can fire in the same tick as
  // dragstart — before React has re-rendered — and a handler that gates on
  // stale state ignores the first dragover of every drag. Reading the ref
  // makes the gate correct on the first event rather than the second.
  const dragRef = useRef(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const beginDrag = (i) => { dragRef.current = i; setDragIndex(i) }
  const endDrag = () => { dragRef.current = null; setDragIndex(null); setOverIndex(null) }

  // Swaps the two widgets' positions.
  //
  // The swap is validated before it is saved. Two widgets of different widths
  // do not simply trade places: moving a 2-wide widget to a 1-wide widget's
  // column can push its right edge past the last column, where it renders
  // into a column that does not exist and disappears. When that would happen
  // the widget is shifted left to fit, and if it still cannot fit the swap is
  // refused rather than silently losing a tile.
  const handleDrop = (dropIndex) => {
    const from = dragRef.current
    if (from == null || from === dropIndex) return endDrag()

    const widgets = [...layout.widgets]
    const a = widgets[from]
    const b = widgets[dropIndex]
    if (!a || !b) return endDrag()

    const fit = (w, col) => Math.max(0, Math.min(col, columns - w.w))
    const nextA = { ...a, col: fit(a, b.col), row: b.row }
    const nextB = { ...b, col: fit(b, a.col), row: a.row }

    if (nextA.col + nextA.w > columns || nextB.col + nextB.w > columns) return endDrag()

    widgets[from] = nextA
    widgets[dropIndex] = nextB
    dashboardService.save({ ...layout, id: 'custom', widgets })
    endDrag()
  }

  const drag = {
    dragIndex,
    overIndex,
    onStart: beginDrag,
    onOver: setOverIndex,
    onDrop: handleDrop,
    onEnd: endDrag,
    isDragging: () => dragRef.current != null,
  }

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: 'minmax(160px, auto)',
        gap: 1,
        background: 'rgba(201,168,76,0.08)',
        alignContent: 'start',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
      }}
    >
      {layout.widgets.map((widget, index) => (
        <WidgetCell
          // Index is part of the key on purpose. Two of the same widget can
          // sit on one dashboard, so widgetId alone is not unique.
          key={`${widget.widgetId}-${index}`}
          widget={widget}
          index={index}
          editMode={editMode}
          onRemove={(i) => dashboardService.removeWidget(i)}
          drag={drag}
          columns={columns}
        />
      ))}

      {editMode && <EmptyCells layout={layout} onAdd={onAddAt} />}
    </div>
  )
}
