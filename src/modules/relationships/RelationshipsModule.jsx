import { useEffect, useMemo, useRef, useState } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { drag as d3drag } from 'd3-drag'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { GRAPH } from '../../data/graph'
import { EDGE_TYPES, CONFIDENCE, EDGE_LABEL } from '../../data/graph/schema'
import { GRAPH_AS_OF, TOP20_LABEL, graphNodeForTicker } from '../../data/graph/nodes'
import { neighbourhood, edgesOf, exposureMap, searchNodes, PROPAGATES, completeness } from '../../services/graphQuery'
import { takeModuleIntent } from '../../services/moduleIntent'
import { useStore } from '../../store/useStore'
import { openCompanyProfile } from '../../utils/openRelationships'
import { TYPE_COLOUR, DASH, CONF_TONE, HELD_TONE, STALE_TONE, fmtDate, nodeLabel } from './theme'
import { ConfidenceBadge, StaleBadge, EdgeDetail, PathFinder, ConnectedHoldings } from './RelPanels'

// RELATIONSHIPS — the company graph.
//
// Every line on this screen is an edge from src/data/graph, and every edge
// carries the document it came from. The panel shows that source next to the
// relationship, not behind a click, because the source is the point: a graph
// of who-owns-what is only as good as the filing under each line.
//
// The shock simulator traces exposure, not effect. It says which nodes are
// downstream of a shock and how many hops away, and nothing about how much
// anything moves — see services/graphQuery.js.

const HOP_TONE = ['#E8A33D', '#E8A33D', '#C4853A', '#8A6A3A']
const DEFAULT_TYPES = EDGE_TYPES.filter((t) => t !== 'member_of')
const THIN_COMPANIES = new Set(GRAPH.nodes.filter((n) => n.type === 'company' && completeness(GRAPH, n.id).level === 'THIN').map((n) => n.id))
const LEVEL_TONE = { THIN: '#C4653A', PARTIAL: '#C9A84C', FULLER: '#2D8A50' }


// The user's holdings, one row per symbol, from the portfolio saved on this
// device. Cost basis only: the graph has no prices.
function loadHoldings() {
  let rows = []
  try { rows = JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]') } catch { /* private mode */ }
  const by = new Map()
  for (const h of rows) {
    const sym = String(h.symbol ?? '').toUpperCase()
    if (!sym) continue
    const r = by.get(sym) ?? { symbol: sym, cost: 0, currency: h.costCurrency ?? 'AUD', nodeId: graphNodeForTicker(sym) }
    r.cost += (Number(h.shares) || 0) * (Number(h.avgCost) || 0)
    by.set(sym, r)
  }
  return [...by.values()]
}
const radius = (n) => (n.type === 'company' ? (n.top20 ? 9 : 6) : n.type === 'person' ? 4 : 8)

function Chip({ on, onClick, children, tone }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className="font-mono tracking-wider px-2 py-0.5 border transition-colors"
      style={{
        fontSize: 9,
        borderColor: on ? 'rgba(201,168,76,0.6)' : 'rgba(74,96,128,0.35)',
        color: on ? '#C9A84C' : '#637899',
        background: on ? 'rgba(201,168,76,0.08)' : 'transparent',
      }}>
      {tone && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 6, background: tone, marginRight: 5 }} />}
      {children}
    </button>
  )
}

// ── The graph canvas ─────────────────────────────────────────────────────
function GraphCanvas({ view, selected, onSelect, onSelectEdge, selectedEdge, exposure, origin, held, watched }) {
  const svgRef = useRef(null)
  const rootRef = useRef(null)
  const [layout, setLayout] = useState({ nodes: [], links: [] })
  const positions = useRef(new Map())

  useEffect(() => {
    const svg = svgRef.current
    const { width, height } = svg.getBoundingClientRect()
    const nodes = view.nodes.map((n) => ({ ...n, ...(positions.current.get(n.id) ?? { x: width / 2 + (Math.random() - 0.5) * 200, y: height / 2 + (Math.random() - 0.5) * 200 }) }))
    const links = view.edges.map((e) => ({ ...e, source: e.from, target: e.to }))
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => d.id).distance((l) => (l.type === 'director_of' ? 28 : l.type === 'member_of' ? 90 : 60)).strength(0.5))
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(width / 2, height / 2))
      .force('x', forceX(width / 2).strength(0.04))
      .force('y', forceY(height / 2).strength(0.04))
      .force('collide', forceCollide((d) => radius(d) + 10))
    setLayout({ nodes, links })

    const root = rootRef.current
    const tick = () => {
      for (const el of root.querySelectorAll('[data-nid]')) {
        const d = sim.nodes().find((n) => n.id === el.dataset.nid)
        if (d) el.setAttribute('transform', `translate(${d.x},${d.y})`)
      }
      for (const el of root.querySelectorAll('[data-eid]')) {
        const l = links.find((x) => x.id === el.dataset.eid)
        if (l) { el.setAttribute('x1', l.source.x); el.setAttribute('y1', l.source.y); el.setAttribute('x2', l.target.x); el.setAttribute('y2', l.target.y) }
      }
      for (const n of nodes) positions.current.set(n.id, { x: n.x, y: n.y })
    }
    sim.on('tick', tick)

    const z = d3zoom().scaleExtent([0.3, 4]).on('zoom', (ev) => root.setAttribute('transform', ev.transform))
    select(svg).call(z).on('dblclick.zoom', null)
    select(svg).call(z.transform, zoomIdentity)

    // Fit everything in view once the layout has mostly settled, and again
    // when it stops — disconnected clusters otherwise drift off the canvas.
    const fit = () => {
      if (!nodes.length) return
      const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y)
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      const k = Math.min(width / (x1 - x0 + 120), height / (y1 - y0 + 100), 1.8)
      select(svg).call(z.transform, zoomIdentity.translate(width / 2 - k * (x0 + x1) / 2, height / 2 - k * (y0 + y1) / 2).scale(k))
    }
    const fitTimer = setTimeout(fit, 900)
    sim.on('end', fit)

    // Drag after React has rendered the nodes for this layout.
    const id = requestAnimationFrame(() => {
      select(root).selectAll('[data-nid]').call(d3drag()
        .subject(function () { return nodes.find((n) => n.id === this.dataset.nid) })
        .on('start', (ev) => { if (!ev.active) sim.alphaTarget(0.3).restart(); ev.subject.fx = ev.subject.x; ev.subject.fy = ev.subject.y })
        .on('drag', (ev) => { ev.subject.fx = ev.x; ev.subject.fy = ev.y })
        .on('end', (ev) => { if (!ev.active) sim.alphaTarget(0); ev.subject.fx = null; ev.subject.fy = null }))
    })
    return () => { sim.stop(); clearTimeout(fitTimer); cancelAnimationFrame(id); select(svg).on('.zoom', null) }
  }, [view])

  const lit = (id) => !exposure || id === origin || exposure.has(id)
  const thin = THIN_COMPANIES
  return (
    <svg ref={svgRef} className="w-full h-full block" style={{ background: '#040A14', cursor: 'grab' }} role="img" aria-label="Relationships graph">
      <g ref={rootRef}>
        {layout.links.map((l) => {
          const on = !exposure || ((l.from === origin || exposure.has(l.from)) && (l.to === origin || exposure.has(l.to)) && PROPAGATES[l.type])
          const sel = l.id === selectedEdge
          return (
            <g key={l.id}>
              <line data-eid={l.id} stroke={sel ? '#C9A84C' : on && exposure ? '#E8A33D' : '#4A6080'}
                strokeOpacity={sel ? 1 : on ? (exposure ? 0.8 : 0.55) : 0.08} strokeWidth={sel ? 2.2 : l.confidence === 'VERIFIED' ? 1.6 : 1}
                strokeDasharray={DASH[l.confidence] ?? undefined} style={{ pointerEvents: 'none' }} />
              {/* A wide invisible line over each edge, so a 1px line can be clicked. */}
              <line data-eid={l.id} stroke="transparent" strokeWidth={9} style={{ cursor: 'pointer' }}
                onClick={(ev) => { ev.stopPropagation(); onSelectEdge(l.id) }}>
                <title>{`${EDGE_LABEL[l.type]} · ${l.confidence} — click for the source\n${l.source.label}`}</title>
              </line>
            </g>
          )
        })}
        {layout.nodes.map((n) => {
          const hop = exposure?.get(n.id)?.hop
          const isSel = n.id === selected
          const isOrigin = exposure && n.id === origin
          return (
            <g key={n.id} data-nid={n.id} style={{ cursor: 'pointer', opacity: lit(n.id) ? 1 : 0.15 }}
              onClick={(ev) => { ev.stopPropagation(); onSelect(n.id) }}>
              {(isSel || isOrigin || hop) && (
                <circle r={radius(n) + 4} fill="none" stroke={isSel ? '#C9A84C' : HOP_TONE[hop ?? 0]} strokeWidth={isSel ? 2 : 1.5} />
              )}
              {/* MY HOLDINGS: solid green ring for a holding, dashed for a
                  watchlist name. */}
              {(held?.has(n.id) || watched?.has(n.id)) && !isSel && (
                <circle r={radius(n) + 6.5} fill="none" stroke={HELD_TONE} strokeWidth={1.6}
                  strokeDasharray={held?.has(n.id) ? undefined : '2 2'} />
              )}
              {/* A THIN company is drawn hollow: it is on the map, but the
                  graph knows little about it yet. */}
              {n.type === 'company' && thin.has(n.id)
                ? <circle r={radius(n)} fill="#040A14" stroke={TYPE_COLOUR[n.type]} strokeWidth={1.5} strokeDasharray="2 2" />
                : <circle r={radius(n)} fill={TYPE_COLOUR[n.type]} fillOpacity={n.type === 'person' ? 0.7 : 0.9} stroke="#040A14" strokeWidth={1} />}
              <text y={radius(n) + 10} textAnchor="middle" className="font-mono select-none"
                style={{ fontSize: n.type === 'person' ? 7 : 8, fill: isSel ? '#C9A84C' : '#8BA3C4', letterSpacing: '0.06em', pointerEvents: 'none' }}>
                {nodeLabel(n)}{hop ? ` ·${hop}` : ''}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ── Side panel: a node's edges, grouped, each with its source ─────────────
function EdgeRow({ row, onSelect, onEdge, now }) {
  const { edge: e, other, outgoing } = row
  return (
    <div className="py-1.5 border-b border-terminal-border/40">
      <div className="flex items-start gap-2">
        <button onClick={() => onSelect(other.id)} className="text-left flex-1 min-w-0 text-terminal-text-bright hover:text-terminal-gold" style={{ fontSize: 12 }}>
          <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{outgoing ? '→' : '←'} </span>
          {other.name}{other.ticker && other.ticker !== other.name ? <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}> {other.ticker}</span> : null}
        </button>
        {e.weight != null && <span className="font-mono tabular-nums text-terminal-text-bright" style={{ fontSize: 11 }}>{e.weight}%</span>}
        <StaleBadge edge={e} now={now} />
        <ConfidenceBadge c={e.confidence} />
        <button onClick={() => onEdge(e.id)} className="font-mono text-terminal-text-dim hover:text-terminal-gold flex-shrink-0" style={{ fontSize: 9 }} title="Source, page, date and quote">ⓘ</button>
      </div>
      {(e.note || e.weightLabel) && <div className="text-terminal-text-dim mt-0.5 leading-snug" style={{ fontSize: 10 }}>{[e.weightLabel, e.note].filter(Boolean).join(' · ')}</div>}
      <a href={e.source.url} target="_blank" rel="noopener noreferrer"
        className="block font-mono text-terminal-text-dim/70 hover:text-terminal-gold mt-0.5 leading-snug" style={{ fontSize: 9 }}>
        SOURCE: {e.source.label} · {fmtDate(e.source.date)} ↗
      </a>
    </div>
  )
}

function Completeness({ id, now }) {
  const c = completeness(GRAPH, id, now)
  const n = GRAPH.byId.get(id)
  const showLevel = n.type === 'company'
  return (
    <div className="mt-2 border px-2 py-1.5" style={{ borderColor: showLevel ? `${LEVEL_TONE[c.level]}55` : 'rgba(74,96,128,0.35)' }}>
      <div className="flex items-center gap-2">
        <span className="font-mono tracking-widest text-terminal-text-dim flex-1" style={{ fontSize: 9 }}>DATA COMPLETENESS</span>
        {showLevel && <span className="font-mono font-bold tracking-widest" style={{ fontSize: 9, color: LEVEL_TONE[c.level] }}>{c.level}</span>}
      </div>
      <div className="flex items-center gap-3 mt-1 font-mono tabular-nums" style={{ fontSize: 10 }}>
        {CONFIDENCE.map((k) => (
          <span key={k} style={{ color: c.byConfidence[k] ? CONF_TONE[k] : '#3A4E68' }}>{c.byConfidence[k]} {k.slice(0, 4)}</span>
        ))}
        {c.stale > 0 && <span style={{ color: STALE_TONE }} title="Figure more than 12 months old">{c.stale} STALE</span>}
        <span className="text-terminal-text-dim ml-auto">{c.total} edges</span>
      </div>
      <div className="font-mono text-terminal-text-dim/80 mt-1 leading-snug" style={{ fontSize: 9 }}>
        {c.lastVerified ? `Last verified ${fmtDate(c.lastVerified)}` : 'No edges'}
        {c.oldestSource && c.oldestSource !== c.lastVerified ? ` · oldest source ${fmtDate(c.oldestSource)}` : ''}
        {showLevel && c.level === 'THIN' ? ' · no sourced ownership, customer, exposure or peer edge yet' : ''}
      </div>
    </div>
  )
}

function NodePanel({ id, onSelect, onShock, onEdge, overlay, holdings, now }) {
  const n = GRAPH.byId.get(id)
  const { setActiveModule } = useStore()
  const groups = edgesOf(GRAPH, id)
  return (
    <div>
      <div className="font-mono tracking-widest" style={{ fontSize: 9, color: TYPE_COLOUR[n.type] }}>{n.type.toUpperCase()}{n.top20 ? ` · #${n.top20} BY ASX MARKET CAP` : ''}</div>
      {n.top20 && <div className="font-mono text-terminal-text-dim/70" style={{ fontSize: 8, letterSpacing: '0.08em' }}>{TOP20_LABEL}</div>}
      <div className="text-terminal-text-bright font-semibold mt-0.5" style={{ fontSize: 15 }}>{n.name}</div>
      <div className="font-mono text-terminal-text-dim mt-0.5" style={{ fontSize: 10 }}>
        {[...new Set([n.ticker && `ASX:${n.ticker}`, n.sector, n.industry, n.country])].filter(Boolean).join(' · ')}
      </div>
      <Completeness id={id} now={now} />
      {overlay && <ConnectedHoldings id={id} holdings={holdings} onSelectNode={onSelect} />}
      <button onClick={() => onShock(id)}
        className="mt-2 font-mono font-bold tracking-widest border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-2 py-1" style={{ fontSize: 9 }}>
        SHOCK THIS NODE ▶
      </button>
      {n.type === 'company' && (
        <button onClick={() => openCompanyProfile(setActiveModule, id)}
          className="mt-2 ml-2 font-mono font-bold tracking-widest border border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold/40 px-2 py-1" style={{ fontSize: 9 }}>
          COMPANY PROFILE ◧
        </button>
      )}
      {EDGE_TYPES.filter((t) => groups[t]).map((t) => (
        <div key={t} className="mt-3">
          <div className="font-mono tracking-widest text-terminal-text-dim mb-0.5" style={{ fontSize: 9 }}>{EDGE_LABEL[t]} · {groups[t].length}</div>
          {groups[t].map((r) => <EdgeRow key={r.edge.id} row={r} onSelect={onSelect} onEdge={onEdge} now={now} />)}
        </div>
      ))}
    </div>
  )
}

function ShockPanel({ origin, setOrigin, shock, setShock, exposure, onSelect }) {
  const [q, setQ] = useState('')
  const hits = searchNodes(GRAPH, q, 6)
  const byHop = [1, 2, 3].map((h) => [...(exposure ?? new Map())].filter(([, r]) => r.hop === h))
  const o = origin && GRAPH.byId.get(origin)
  return (
    <div>
      <div className="font-mono font-bold tracking-widest" style={{ fontSize: 10, color: '#E8A33D' }}>SHOCK SIMULATOR</div>
      <div className="font-mono font-bold tracking-widest mt-1 px-1.5 py-1 inline-block" style={{ fontSize: 9, color: '#E8A33D', border: '1px solid rgba(232,163,61,0.5)' }}>
        EXPOSURE MAP, NOT FORECAST
      </div>
      <p className="text-terminal-text-dim mt-2 leading-snug" style={{ fontSize: 11 }}>
        Which nodes sit downstream of a shock, and how many hops away, along owns, exposure, index and customer edges. It does not estimate how much
        anything moves — the edges carry no sensitivities, and none is invented here.
      </p>
      <div className="mt-2 relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={o ? o.name : 'Shock a node — e.g. iron ore, RBA, BHP'}
          className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 font-mono text-terminal-text-bright focus:border-terminal-gold/60 outline-none" style={{ fontSize: 11 }} />
        {q && hits.length > 0 && (
          <div className="absolute z-10 left-0 right-0 bg-terminal-panel border border-terminal-border">
            {hits.map((n) => (
              <button key={n.id} onClick={() => { setOrigin(n.id); setQ('') }} className="block w-full text-left px-2 py-1 hover:bg-terminal-gold/10 text-terminal-text" style={{ fontSize: 11 }}>
                {n.name} <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{n.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>SHOCK</span>
        {[-20, -10, -5, 5, 10].map((v) => (
          <Chip key={v} on={shock === v} onClick={() => setShock(v)}>{v > 0 ? '+' : ''}{v}%</Chip>
        ))}
      </div>
      {o && (
        <div className="mt-3">
          <div className="text-terminal-text-bright" style={{ fontSize: 12 }}>
            {o.name} <span className="font-mono" style={{ color: '#E8A33D' }}>{shock > 0 ? '+' : ''}{shock}%</span>
            <span className="text-terminal-text-dim"> — {exposure.size} node{exposure.size === 1 ? '' : 's'} exposed</span>
          </div>
          <div className="text-terminal-text-dim mt-0.5" style={{ fontSize: 10 }}>
            The shock size is a label for the scenario. Nothing below is scaled by it.
          </div>
          {byHop.map((rows, i) => rows.length > 0 && (
            <div key={i} className="mt-2">
              <div className="font-mono tracking-widest mb-0.5" style={{ fontSize: 9, color: HOP_TONE[i + 1] }}>HOP {i + 1} · {rows.length}</div>
              {rows.map(([id, r]) => {
                const n = GRAPH.byId.get(id), p = GRAPH.byId.get(r.parent)
                return (
                  <button key={id} onClick={() => onSelect(id)} className="block w-full text-left py-1 border-b border-terminal-border/30 hover:text-terminal-gold" style={{ fontSize: 11 }}>
                    <span className="flex items-center gap-2">
                      <span className="text-terminal-text-bright flex-1 min-w-0">{n.name}</span>
                      <ConfidenceBadge c={r.via.confidence} />
                    </span>
                    <span className="block font-mono text-terminal-text-dim mt-0.5" style={{ fontSize: 9 }}>EXPOSED · via {EDGE_LABEL[r.via.type].toLowerCase()} {p.name}</span>
                  </button>
                )
              })}
            </div>
          ))}
          {exposure.size === 0 && <div className="text-terminal-text-dim mt-2" style={{ fontSize: 11 }}>No sourced exposure edges lead downstream of this node yet.</div>}
          <button onClick={() => setOrigin(null)} className="mt-3 font-mono tracking-widest text-terminal-text-dim hover:text-terminal-text-bright" style={{ fontSize: 9 }}>CLEAR SHOCK ✕</button>
        </div>
      )}
    </div>
  )
}

function Legend() {
  const counts = CONFIDENCE.map((c) => [c, GRAPH.edges.filter((e) => e.confidence === c).length])
  return (
    <div>
      <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>EVERY EDGE IS SOURCED</div>
      <p className="text-terminal-text mt-1 leading-snug" style={{ fontSize: 12 }}>
        {GRAPH.nodes.length} nodes and {GRAPH.edges.length} relationships, each carrying the filing, release or profile it was read from.
        Nothing here is generated by MaddenAI. Click a node to see its relationships and their sources.
      </p>
      <div className="mt-3 space-y-1.5">
        {counts.map(([c, k]) => (
          <div key={c} className="flex items-center gap-2" style={{ fontSize: 11 }}>
            <svg width="34" height="6"><line x1="0" y1="3" x2="34" y2="3" stroke="#8BA3C4" strokeWidth={c === 'VERIFIED' ? 1.6 : 1} strokeDasharray={DASH[c] ?? undefined} /></svg>
            <ConfidenceBadge c={c} /><span className="text-terminal-text-dim">{k}</span>
          </div>
        ))}
      </div>
      <div className="text-terminal-text-dim mt-2 leading-snug" style={{ fontSize: 10 }}>
        VERIFIED — read from the primary document, figure as filed. DISCLOSED — stated by the company, fund or exchange. INFERRED — derived from
        disclosed facts; never weighted.
      </div>
      <div className="font-mono mt-3 leading-snug" style={{ fontSize: 9, color: '#C9A84C' }}>{TOP20_LABEL}</div>
      <div className="text-terminal-text-dim mt-1 leading-snug" style={{ fontSize: 10 }}>
        Ranked by the market cap on each company's ASX profile. The official index is float-adjusted and rebalanced quarterly; the two
        can differ at the margin.
      </div>
      <div className="mt-2 flex items-center gap-2 font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
        <svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="none" stroke="#8BA3C4" strokeWidth="1.5" strokeDasharray="2 2" /></svg>
        HOLLOW = THIN: NO SOURCED OWNERSHIP, CUSTOMER, EXPOSURE OR PEER EDGE YET ({THIN_COMPANIES.size})
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(TYPE_COLOUR).map(([t, c]) => (
          <span key={t} className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 7, background: c, marginRight: 4 }} />{t.toUpperCase()}
          </span>
        ))}
      </div>
      <div className="text-terminal-text-dim/70 mt-3 leading-snug" style={{ fontSize: 10 }}>
        Phase 1.5 seed, as at {fmtDate(GRAPH_AS_OF)}: six commodities, index and ETF membership, GICS peers, chairs and CEOs, the
        substantial holders of the ten largest companies from their annual reports, and ownership edges from holder notices and company releases.
      </div>
    </div>
  )
}

export default function RelationshipsModule() {
  const [focus, setFocus] = useState(() => takeModuleIntent('relationships')?.focus ?? null)
  const [selected, setSelected] = useState(focus)
  const [depth, setDepth] = useState(2)
  const [types, setTypes] = useState(() => new Set(DEFAULT_TYPES))
  const [confidence, setConfidence] = useState(() => new Set(CONFIDENCE))
  const [q, setQ] = useState('')
  const [origin, setOrigin] = useState(null)
  const [shock, setShock] = useState(-10)
  const [tab, setTab] = useState(focus ? 'node' : 'about')
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [pathA, setPathA] = useState(null)
  const [pathB, setPathB] = useState(null)
  const [viaIndex, setViaIndex] = useState(false)
  const [shownPath, setShownPath] = useState(null) // { i, hops }
  const [overlay, setOverlay] = useState(false)
  const [holdings] = useState(loadHoldings)
  const [now] = useState(() => Date.now())
  const { watchlist } = useStore()
  const held = useMemo(() => new Set(holdings.map((h) => h.nodeId).filter(Boolean)), [holdings])
  const watched = useMemo(() => new Set((watchlist ?? []).map((w) => graphNodeForTicker(typeof w === 'string' ? w : w?.symbol)).filter(Boolean)), [watchlist])

  // An "Open in Relationships" while the module is already on screen.
  useEffect(() => {
    const on = (ev) => {
      if (ev.detail?.module !== 'relationships') return
      takeModuleIntent('relationships')
      const f = ev.detail.intent?.focus
      if (f && GRAPH.byId.has(f)) { setFocus(f); setSelected(f); setTab('node') }
    }
    window.addEventListener('madden:module-intent', on)
    return () => window.removeEventListener('madden:module-intent', on)
  }, [])

  const view = useMemo(() => neighbourhood(GRAPH, { focus, depth, types, confidence }), [focus, depth, types, confidence])
  const exposure = useMemo(() => (origin ? exposureMap(GRAPH, origin, { maxHop: 3, confidence }) : null), [origin, confidence])
  const hits = searchNodes(GRAPH, q, 8)
  // While a shock is set, the canvas draws the exposure map itself — the
  // origin, every exposed node and the edge that reached each — whatever the
  // focus or edge-type filters say.
  const shockView = useMemo(() => (exposure ? {
    nodes: [origin, ...exposure.keys()].map((id) => GRAPH.byId.get(id)),
    edges: [...exposure.values()].map((r) => r.via),
    hop: new Map(),
  } : null), [exposure, origin])
  // A path from the path finder, when one is shown: just its nodes and hops.
  const pathView = useMemo(() => (tab === 'paths' && shownPath ? {
    nodes: [...new Set(shownPath.hops.flatMap((h) => [h.from, h.to]))].map((id) => GRAPH.byId.get(id)),
    edges: [...new Map(shownPath.hops.map((h) => [h.edge.id, h.edge])).values()],
    hop: new Map(),
  } : null), [tab, shownPath])
  const drawn = shockView ?? pathView ?? view

  const select_ = (id) => { setSelected(id); setTab('node') }
  const toggle = (set, setter, v) => setter(() => { const s = new Set(set); s.has(v) ? s.delete(v) : s.add(v); return s })
  const startShock = (id) => { setOrigin(id); setTab('shock') }
  const selectEdge = (id) => { setSelectedEdge(id); setTab('edge') }

  return (
    <div className="h-full flex flex-col min-h-0">
      <ModuleHeader title="RELATIONSHIPS" subtitle="Company graph · every edge sourced" moduleId="relationships"
        right={<span className="hidden sm:inline font-mono text-terminal-text-dim text-2xs">PHASE 1.5 · AS AT {fmtDate(GRAPH_AS_OF).toUpperCase()}</span>} />

      {/* Search + filters */}
      <div className="px-3 py-2 border-b border-terminal-border flex items-center gap-2 flex-wrap flex-shrink-0">
        <div className="relative" style={{ width: 220 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, commodity, person…"
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 font-mono text-terminal-text-bright focus:border-terminal-gold/60 outline-none" style={{ fontSize: 11 }} />
          {q && hits.length > 0 && (
            <div className="absolute z-20 left-0 right-0 bg-terminal-panel border border-terminal-border shadow-2xl">
              {hits.map((n) => (
                <button key={n.id} onClick={() => { setFocus(n.id); setSelected(n.id); setTab('node'); setQ('') }}
                  className="block w-full text-left px-2 py-1 hover:bg-terminal-gold/10 text-terminal-text" style={{ fontSize: 11 }}>
                  {n.name} <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{n.ticker ?? n.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {focus && (
          <>
            <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>DEPTH</span>
            {[1, 2, 3].map((d) => <Chip key={d} on={depth === d} onClick={() => setDepth(d)}>{d}</Chip>)}
            <Chip on={false} onClick={() => setFocus(null)}>WHOLE GRAPH ✕</Chip>
          </>
        )}
        <span className="w-px h-4 bg-terminal-border mx-1" />
        {EDGE_TYPES.map((t) => <Chip key={t} on={types.has(t)} onClick={() => toggle(types, setTypes, t)}>{EDGE_LABEL[t]}</Chip>)}
        <span className="w-px h-4 bg-terminal-border mx-1" />
        {CONFIDENCE.map((c) => <Chip key={c} on={confidence.has(c)} tone={CONF_TONE[c]} onClick={() => toggle(confidence, setConfidence, c)}>{c}</Chip>)}
        <span className="w-px h-4 bg-terminal-border mx-1" />
        <Chip on={overlay} tone={HELD_TONE} onClick={() => setOverlay((v) => !v)}>MY HOLDINGS{overlay ? ` · ${held.size} HELD · ${watched.size} WATCHED` : ''}</Chip>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="relative flex-1 min-h-[360px]">
          <GraphCanvas view={drawn} selected={selected} onSelect={select_} onSelectEdge={selectEdge} selectedEdge={tab === 'edge' ? selectedEdge : null}
            exposure={exposure} origin={origin} held={overlay ? held : null} watched={overlay ? watched : null} />
          <div className="absolute left-3 bottom-2 font-mono text-terminal-text-dim/70 pointer-events-none" style={{ fontSize: 9 }}>
            {drawn.nodes.length} NODES · {drawn.edges.length} EDGES{pathView ? ' · PATH' : focus && !shockView ? ` · ${depth} HOP${depth > 1 ? 'S' : ''} FROM ${nodeLabel(GRAPH.byId.get(focus)).toUpperCase()}` : ''} · CLICK A LINE FOR ITS SOURCE · SCROLL TO ZOOM
          </div>
          {overlay && !exposure && (
            <div className="absolute left-3 top-2 font-mono font-bold tracking-widest px-1.5 py-0.5 pointer-events-none"
              style={{ fontSize: 9, color: HELD_TONE, border: `1px solid ${HELD_TONE}88`, background: 'rgba(4,10,20,0.85)' }}>
              CONNECTED EXPOSURE, NOT FORECAST
            </div>
          )}
          {exposure && (
            <div className="absolute left-3 top-2 font-mono font-bold tracking-widest px-1.5 py-0.5 pointer-events-none"
              style={{ fontSize: 9, color: '#E8A33D', border: '1px solid rgba(232,163,61,0.5)', background: 'rgba(4,10,20,0.85)' }}>
              EXPOSURE MAP, NOT FORECAST
            </div>
          )}
        </div>
        <aside className="lg:w-[340px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-terminal-border flex flex-col min-h-0 bg-terminal-panel">
          <div className="flex border-b border-terminal-border flex-shrink-0">
            {[['about', 'ABOUT'], ['node', 'NODE'], ['edge', 'EDGE'], ['paths', 'PATHS'], ['shock', 'SHOCK']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} disabled={(k === 'node' && !selected) || (k === 'edge' && !selectedEdge)}
                className="flex-1 font-mono tracking-widest py-1.5 disabled:opacity-30"
                style={{ fontSize: 9, color: tab === k ? '#C9A84C' : '#637899', borderBottom: tab === k ? '2px solid #C9A84C' : '2px solid transparent' }}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {tab === 'about' && <Legend />}
            {tab === 'node' && selected && <NodePanel id={selected} onSelect={select_} onShock={startShock} onEdge={selectEdge} overlay={overlay} holdings={holdings} now={now} />}
            {tab === 'edge' && selectedEdge && <EdgeDetail id={selectedEdge} onSelectNode={select_} now={now} />}
            {tab === 'paths' && (
              <PathFinder a={pathA} b={pathB} setA={(id) => { setPathA(id); setShownPath(null) }} setB={(id) => { setPathB(id); setShownPath(null) }}
                viaIndex={viaIndex} setViaIndex={(v) => { setViaIndex(v); setShownPath(null) }} confidence={confidence}
                shown={shownPath?.i} onShowPath={(i, hops) => setShownPath({ i, hops })} onSelectEdge={selectEdge} />
            )}
            {tab === 'shock' && <ShockPanel origin={origin} setOrigin={setOrigin} shock={shock} setShock={setShock} exposure={exposure} onSelect={select_} />}
          </div>
        </aside>
      </div>
    </div>
  )
}
