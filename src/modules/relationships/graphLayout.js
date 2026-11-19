// Layout for the relationships canvas, kept apart from React so it can be
// tested at scale (WS5, 19 Nov 2026).
//
// Up to LARGE_GRAPH nodes the layout animates as before. Above it, the
// simulation is run to rest before anything is drawn, with a capped number of
// ticks and lighter forces, so a view of thousands of nodes lays out once
// instead of re-positioning thousands of SVG elements sixty times a second.
// Minor labels are hidden on a large view until the reader zooms in.
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force'

export const LARGE_GRAPH = 300
export const LARGE_TICKS = 160
export const LABEL_ZOOM = 1.4

export const nodeRadius = (n) => (n.type === 'company' ? (n.top20 ? 9 : 6) : n.type === 'person' ? 4 : 8)

export function buildSimulation(nodes, links, { width, height }) {
  const large = nodes.length > LARGE_GRAPH
  return forceSimulation(nodes)
    .force('link', forceLink(links).id((d) => d.id).distance((l) => (l.type === 'director_of' ? 28 : l.type === 'member_of' ? 90 : 60)).strength(large ? 0.3 : 0.5))
    .force('charge', forceManyBody().strength(large ? -60 : -180).theta(large ? 1.2 : 0.9).distanceMax(large ? 400 : Infinity))
    .force('center', forceCenter(width / 2, height / 2))
    .force('x', forceX(width / 2).strength(0.04))
    .force('y', forceY(height / 2).strength(0.04))
    .force('collide', forceCollide((d) => nodeRadius(d) + (large ? 3 : 10)).iterations(large ? 1 : 1))
}

// Run a large layout to rest without drawing; returns the tick count used.
export function settle(sim, maxTicks = LARGE_TICKS) {
  sim.stop()
  const needed = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()))
  const n = Math.min(maxTicks, needed)
  sim.alphaDecay(1 - Math.pow(sim.alphaMin(), 1 / n))
  sim.tick(n)
  return n
}

// Which labels a view shows: all of them on a small view; on a large one the
// top 20, anything selected, lit or held, or everything once zoomed in.
export function labelled(n, { large, zoom = 1, selected, lit }) {
  if (!large || zoom >= LABEL_ZOOM) return true
  return !!(n.top20 || n.id === selected || lit?.(n.id) || n.type === 'commodity' || n.type === 'index')
}
