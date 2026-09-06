import { dashboardService } from '../../services/dashboardService'
import WidgetContent from './WidgetContent'

// The grid. Placements come from dashboardService; this file only draws them.
//
// Widgets sit on a CSS grid with 1px gaps and the gap colour supplied by the
// container's background showing through. That is cheaper and steadier than
// borders on each tile, which double up between neighbours and leave a 2px
// line down the middle of the grid.

function WidgetCell({ widget, index, editMode, onRemove }) {
  const meta = dashboardService.getWidget(widget.widgetId)

  return (
    <div
      style={{
        gridColumn: `${widget.col + 1} / span ${widget.w}`,
        gridRow: `${widget.row + 1} / span ${widget.h}`,
        background: '#060D1A',
        position: 'relative',
        minHeight: 160,
        overflow: 'hidden',
        // outline, not border: a border would take space inside the cell and
        // shift the widget's content by a pixel when edit mode turns on.
        ...(editMode ? { outline: '1px dashed rgba(201,168,76,0.3)', outlineOffset: -1 } : null),
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

export default function DashboardGrid({ layout, editMode, onAddAt }) {
  const columns = layout.columns || 3

  return (
    <div
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
        />
      ))}

      {editMode && <EmptyCells layout={layout} onAdd={onAddAt} />}
    </div>
  )
}
