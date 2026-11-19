// Saved subgraphs (WS5, 19 Nov 2026): a named view of the relationships graph
// (focus, depth, edge types, confidence levels, and an event ripple if one
// was set), kept on this device. A saved view holds no figures, only the
// filters, so reopening it always shows the graph as it is now.
const KEY = 'maddex_rel_subgraphs'
const MAX = 20

export function listSubgraphs() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function store(list) { try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode */ } }

export function subgraphFrom({ name, focus, depth, types, confidence, origin, event }, at = new Date().toISOString()) {
  return { id: `sg_${Date.parse(at)}`, name: String(name).trim().slice(0, 60), focus: focus ?? null, depth, types: [...types].sort(), confidence: [...confidence].sort(), origin: origin ?? null, event: event ?? null, savedAt: at }
}

export function saveSubgraph(view) {
  const sg = subgraphFrom(view)
  if (!sg.name) return null
  store([sg, ...listSubgraphs().filter((s) => s.name !== sg.name)].slice(0, MAX))
  return sg
}
export function deleteSubgraph(id) { store(listSubgraphs().filter((s) => s.id !== id)) }

// A saved view checked against today's graph: unknown nodes, types or levels
// are dropped rather than blanking the screen.
export function restoreSubgraph(sg, { hasNode, edgeTypes, levels, events }) {
  const types = sg.types.filter((t) => edgeTypes.includes(t))
  const confidence = sg.confidence.filter((c) => levels.includes(c))
  const ripple = sg.origin && hasNode(sg.origin) && sg.event && events[sg.event] ? { origin: sg.origin, event: sg.event } : null
  return { focus: sg.focus && hasNode(sg.focus) ? sg.focus : null, depth: [1, 2, 3].includes(sg.depth) ? sg.depth : 2, types: new Set(types.length ? types : edgeTypes), confidence: new Set(confidence.length ? confidence : levels), ripple }
}
