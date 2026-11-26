// Two widgets trade places, or null when they cannot: each must fit inside
// the columns (a 2-wide widget is shifted left to fit), and neither may land
// on a third widget (a 2-wide tile swapped into a 1-wide slot sat on top of
// its neighbour and hid it: WS2 re-audit, 26 Nov 2026).
export function swapPlacement(widgets, from, to, columns) {
  if (from == null || to == null || from === to) return null
  const a = widgets[from]
  const b = widgets[to]
  if (!a || !b) return null
  const fit = (w, col) => Math.max(0, Math.min(col, columns - w.w))
  const nextA = { ...a, col: fit(a, b.col), row: b.row }
  const nextB = { ...b, col: fit(b, a.col), row: a.row }
  if (nextA.col + nextA.w > columns || nextB.col + nextB.w > columns) return null
  const overlaps = (x, y) => x.col < y.col + y.w && y.col < x.col + x.w && x.row < y.row + (y.h ?? 1) && y.row < x.row + (x.h ?? 1)
  if (overlaps(nextA, nextB)) return null
  if (widgets.some((w, i) => i !== from && i !== to && (overlaps(w, nextA) || overlaps(w, nextB)))) return null
  const next = [...widgets]
  next[from] = nextA
  next[to] = nextB
  return next
}
