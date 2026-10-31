// Queries over the relationships graph — pure functions, no React.
//
// neighbourhood: the nodes and edges within N hops of a focus, after filters.
// exposureMap:   the shock simulator. From a shocked node, which nodes are
//                exposed to it, and at what hop. Direction only — exposed or
//                not. It never computes a price or a size of effect: the
//                edges do not carry the elasticities that would need, and a
//                number made up here would be the most persuasive thing on
//                the screen and the least true.

// Which way exposure travels along each edge type. For an edge from → to:
//   'fromTo'  a shock at `from` reaches `to`
//   'toFrom'  a shock at `to` reaches `from`
//   'both'
//   null      not propagated — a peer or a director is related, not exposed
export const PROPAGATES = {
  owns: 'toFrom',         // the holder is exposed to what it holds
  exposed_to: 'toFrom',   // the exposed node is exposed to its driver
  member_of: 'fromTo',    // an index moves with its members
  customer_of: 'both',    // revenue one way, supply the other
  supplies: 'both',
  competes_with: null,
  director_of: null,
}

export function edgePasses(e, { types, confidence } = {}) {
  if (types && !types.has(e.type)) return false
  if (confidence && !confidence.has(e.confidence)) return false
  return true
}

// Undirected adjacency over the edges that pass the filters.
function adjacency(edges, filters) {
  const adj = new Map()
  const add = (a, b, e) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, e]) }
  for (const e of edges) {
    if (!edgePasses(e, filters)) continue
    add(e.from, e.to, e); add(e.to, e.from, e)
  }
  return adj
}

// Nodes within `depth` hops of `focus` (or the whole filtered graph when no
// focus), with the edges between them. hop: Map id → hops from focus.
export function neighbourhood(graph, { focus = null, depth = 1, ...filters } = {}) {
  const passing = graph.edges.filter((e) => edgePasses(e, filters))
  if (!focus || !graph.byId.has(focus)) {
    const ids = new Set(passing.flatMap((e) => [e.from, e.to]))
    return { nodes: graph.nodes.filter((n) => ids.has(n.id)), edges: passing, hop: new Map() }
  }
  const adj = adjacency(graph.edges, filters)
  const hop = new Map([[focus, 0]])
  let frontier = [focus]
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next = []
    for (const id of frontier) for (const [nb] of adj.get(id) ?? []) if (!hop.has(nb)) { hop.set(nb, d); next.push(nb) }
    frontier = next
  }
  return {
    nodes: graph.nodes.filter((n) => hop.has(n.id)),
    edges: passing.filter((e) => hop.has(e.from) && hop.has(e.to)),
    hop,
  }
}

// A node's own edges, grouped by type, each with the node on the other end.
export function edgesOf(graph, id) {
  const groups = {}
  for (const e of graph.edges) {
    if (e.from !== id && e.to !== id) continue
    const other = graph.byId.get(e.from === id ? e.to : e.from)
    const outgoing = e.from === id
    ;(groups[e.type] ??= []).push({ edge: e, other, outgoing })
  }
  return groups
}

// Shock simulator. Breadth-first from `origin` along the direction each edge
// carries exposure, up to `maxHop`. Returns Map id → { hop, via, parent } for
// every exposed node (origin excluded); `via` is the edge that first reached
// it, so the panel can say why.
export function exposureMap(graph, origin, { maxHop = 3, ...filters } = {}) {
  const out = new Map()
  for (const e of graph.edges) {
    if (!edgePasses(e, filters) || !PROPAGATES[e.type]) continue
    const dir = PROPAGATES[e.type]
    if (dir === 'fromTo' || dir === 'both') (out.get(e.from) ?? out.set(e.from, []).get(e.from)).push([e.to, e])
    if (dir === 'toFrom' || dir === 'both') (out.get(e.to) ?? out.set(e.to, []).get(e.to)).push([e.from, e])
  }
  const reached = new Map()
  let frontier = [origin]
  const seen = new Set([origin])
  for (let h = 1; h <= maxHop && frontier.length; h++) {
    const next = []
    for (const id of frontier) for (const [nb, e] of out.get(id) ?? []) {
      if (seen.has(nb)) continue
      seen.add(nb); next.push(nb)
      reached.set(nb, { hop: h, via: e, parent: id })
    }
    frontier = next
  }
  return reached
}

// Case-insensitive search over name and ticker.
export function searchNodes(graph, q, limit = 8) {
  const s = String(q ?? '').trim().toLowerCase()
  if (!s) return []
  const score = (n) => {
    const t = (n.ticker ?? '').toLowerCase(), nm = n.name.toLowerCase()
    if (t === s) return 0
    if (nm.startsWith(s) || t.startsWith(s)) return 1
    if (nm.includes(s)) return 2
    return 9
  }
  return graph.nodes.map((n) => [score(n), n]).filter(([sc]) => sc < 9).sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, n]) => n)
}
