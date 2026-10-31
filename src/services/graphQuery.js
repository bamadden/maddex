import { isStale } from '../data/graph/staleness.js'

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
  joint_venture: 'both',  // partners share the asset
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
export function exposureMap(graph, origin, { maxHop = 3, rules = PROPAGATES, ...filters } = {}) {
  const out = new Map()
  for (const e of graph.edges) {
    if (!edgePasses(e, filters) || !rules[e.type]) continue
    const dir = rules[e.type]
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

// How much is known about a node, so a thin node looks thin.
//
// Substantive edges are the ones that say something about the business:
// ownership, customers and suppliers, exposures, peers. Index membership and
// board seats are true of every large company and say little, so they are
// counted but do not lift the level.
//   THIN     no substantive edge that is VERIFIED or DISCLOSED
//   PARTIAL  at least one, but fewer than three substantive edges in all
//   FULLER   at least one sourced substantive edge and three or more in all
// "FULLER", not "COMPLETE": no node in a phase-1 graph is complete.
//
// A STALE edge (staleness.js: figure more than 12 months old) is counted on
// its own and does not lift the level — a node whose only sourced edges are
// stale reads THIN.
const SUBSTANTIVE = new Set(['owns', 'supplies', 'customer_of', 'joint_venture', 'exposed_to', 'competes_with'])
export function completeness(graph, id, now = Date.now()) {
  const mine = graph.edges.filter((e) => e.from === id || e.to === id)
  const byConfidence = { VERIFIED: 0, DISCLOSED: 0, INFERRED: 0 }
  for (const e of mine) byConfidence[e.confidence]++
  const stale = mine.filter((e) => isStale(e, now)).length
  const subst = mine.filter((e) => SUBSTANTIVE.has(e.type))
  const sourced = subst.filter((e) => e.confidence !== 'INFERRED' && !isStale(e, now)).length
  const level = sourced === 0 ? 'THIN' : subst.length < 3 ? 'PARTIAL' : 'FULLER'
  const lastVerified = mine.reduce((m, e) => (e.lastVerified > m ? e.lastVerified : m), '')
  const oldestSource = mine.reduce((m, e) => (!m || e.source.date < m ? e.source.date : m), '')
  return { total: mine.length, byConfidence, stale, substantive: subst.length, sourcedSubstantive: sourced, level, lastVerified: lastVerified || null, oldestSource: oldestSource || null }
}

// ── Path finder ─────────────────────────────────────────────────────────────
// "How are X and Y connected?" Up to `max` shortest simple paths, breadth
// first, each a list of { from, to, edge } hops read in either direction.
// A path is only as strong as its weakest edge, so its confidence is the
// lowest on it. Index membership is excluded unless asked for: every large
// company shares the S&P/ASX 200, which connects everything and explains
// nothing.
const RANK = { INFERRED: 0, DISCLOSED: 1, VERIFIED: 2 }
export const weakestConfidence = (hops) => hops.reduce((w, h) => (RANK[h.edge.confidence] < RANK[w] ? h.edge.confidence : w), 'VERIFIED')

export function findPaths(graph, a, b, { max = 3, maxDepth = 6, includeTypes = null, confidence = null, budget = 40_000 } = {}) {
  if (!graph.byId.has(a) || !graph.byId.has(b) || a === b) return []
  const adj = new Map()
  for (const e of graph.edges) {
    if (includeTypes && !includeTypes.has(e.type)) continue
    if (confidence && !confidence.has(e.confidence)) continue
    ;(adj.get(e.from) ?? adj.set(e.from, []).get(e.from)).push([e.to, e])
    ;(adj.get(e.to) ?? adj.set(e.to, []).get(e.to)).push([e.from, e])
  }
  const found = []
  let queue = [{ at: a, hops: [], seen: new Set([a]) }]
  let work = 0
  for (let depth = 1; depth <= maxDepth && queue.length && found.length < max; depth++) {
    const next = []
    for (const path of queue) {
      for (const [nb, e] of adj.get(path.at) ?? []) {
        if (path.seen.has(nb)) continue
        if (++work > budget) return found
        const hops = [...path.hops, { from: path.at, to: nb, edge: e }]
        if (nb === b) { found.push(hops); if (found.length >= max) return found; continue }
        next.push({ at: nb, hops, seen: new Set([...path.seen, nb]) })
      }
    }
    queue = next
  }
  return found
}

// The chain of hops exposureMap used to reach `id` from its origin.
export function exposurePath(exposure, id) {
  const hops = []
  let cur = id
  while (exposure.has(cur)) {
    const r = exposure.get(cur)
    hops.unshift({ from: r.parent, to: cur, edge: r.via })
    cur = r.parent
  }
  return hops
}

// ── Event ripple ────────────────────────────────────────────────────────────
// Which nodes an event at one node reaches, and by which edges — direction of
// exposure only. Each event type travels along different edges:
//
//   rate decision / commodity move — the standard exposure directions
//     (PROPAGATES): exposed companies, their indices and ETFs, their holders.
//   earnings / guidance cut — a company's own news reaches its holders,
//     customers, suppliers and joint-venture partners, its indices and the
//     ETFs on them; peers are reached as read-across ("competes with").
//   substantial holder change — the holders themselves, then the other
//     companies those holders own (owns, both ways, two hops).
//
// No event carries a size. Nothing here estimates a price move.
const COMPANY_NEWS = { ...PROPAGATES, competes_with: 'both' }
export const RIPPLE_EVENTS = {
  rate:     { label: 'RATE DECISION',      appliesTo: ['macro'], rules: PROPAGATES, maxHop: 3 },
  commodity:{ label: 'COMMODITY MOVE',     appliesTo: ['commodity'], rules: PROPAGATES, maxHop: 3 },
  earnings: { label: 'EARNINGS',           appliesTo: ['company'], rules: COMPANY_NEWS, maxHop: 3 },
  guidance: { label: 'GUIDANCE CUT',       appliesTo: ['company'], rules: COMPANY_NEWS, maxHop: 3 },
  holder:   { label: 'SUBSTANTIAL HOLDER CHANGE', appliesTo: ['company', 'fund'], rules: { owns: 'both' }, maxHop: 2 },
}

export const eventsFor = (node) => Object.entries(RIPPLE_EVENTS).filter(([, ev]) => ev.appliesTo.includes(node?.type)).map(([k]) => k)

// → Map id → { hop, via, parent } (as exposureMap), for that event type.
export function rippleMap(graph, origin, event, filters = {}) {
  const ev = RIPPLE_EVENTS[event]
  if (!ev) return new Map()
  return exposureMap(graph, origin, { ...filters, rules: ev.rules, maxHop: ev.maxHop })
}
