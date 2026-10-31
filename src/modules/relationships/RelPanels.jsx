import { useMemo, useState } from 'react'
import { GRAPH } from '../../data/graph'
import { EDGE_LABEL } from '../../data/graph/schema'
import { isStale, ageDays, edgeAsAt } from '../../data/graph/staleness'
import { searchNodes, findPaths, weakestConfidence, exposureMap, exposurePath } from '../../services/graphQuery'
import { CONF_TONE, STALE_TONE, HELD_TONE, fmtDate, nodeLabel, pageOf } from './theme'

// Side-panel pieces added in phase 2: edge detail, the path finder, and the
// portfolio overlay's connected-exposure list. All read the same loaded
// GRAPH; none computes a price effect.

export function ConfidenceBadge({ c }) {
  return (
    <span className="font-mono font-bold tracking-widest px-1 flex-shrink-0"
      style={{ fontSize: 8, color: CONF_TONE[c], border: `1px solid ${CONF_TONE[c]}66` }}>{c}</span>
  )
}

// Figure more than 12 months old (staleness.js). The title says how old.
export function StaleBadge({ edge, now }) {
  if (!isStale(edge, now)) return null
  const days = ageDays(edge, now)
  return (
    <span className="font-mono font-bold tracking-widest px-1 flex-shrink-0" title={`Figure dated ${fmtDate(edgeAsAt(edge))} — ${Math.floor(days / 30)} months old`}
      style={{ fontSize: 8, color: STALE_TONE, border: `1px solid ${STALE_TONE}88` }}>STALE</span>
  )
}

export function NodePicker({ value, onPick, placeholder }) {
  const [q, setQ] = useState('')
  const hits = searchNodes(GRAPH, q, 6)
  const n = value && GRAPH.byId.get(value)
  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={n ? n.name : placeholder}
        className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 font-mono text-terminal-text-bright focus:border-terminal-gold/60 outline-none"
        style={{ fontSize: 11 }} aria-label={placeholder} />
      {q && hits.length > 0 && (
        <div className="absolute z-20 left-0 right-0 bg-terminal-panel border border-terminal-border shadow-2xl">
          {hits.map((h) => (
            <button key={h.id} onClick={() => { onPick(h.id); setQ('') }}
              className="block w-full text-left px-2 py-1 hover:bg-terminal-gold/10 text-terminal-text" style={{ fontSize: 11 }}>
              {h.name} <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{h.ticker ?? h.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edge detail ─────────────────────────────────────────────────────────────
export function EdgeDetail({ id, onSelectNode, now }) {
  const e = GRAPH.edges.find((x) => x.id === id)
  if (!e) return <div className="text-terminal-text-dim" style={{ fontSize: 11 }}>That relationship is no longer in the graph.</div>
  const a = GRAPH.byId.get(e.from), b = GRAPH.byId.get(e.to)
  const page = pageOf(e)
  const row = (k, v) => (
    <div className="flex gap-2 py-1 border-b border-terminal-border/30" style={{ fontSize: 11 }}>
      <span className="font-mono tracking-widest text-terminal-text-dim w-24 flex-shrink-0" style={{ fontSize: 9 }}>{k}</span>
      <span className="text-terminal-text-bright min-w-0">{v}</span>
    </div>
  )
  return (
    <div>
      <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>RELATIONSHIP</div>
      <div className="text-terminal-text-bright mt-1 leading-snug" style={{ fontSize: 13 }}>
        <button className="hover:text-terminal-gold" onClick={() => onSelectNode(a.id)}>{a.name}</button>
        <span className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}> {EDGE_LABEL[e.type]} </span>
        <button className="hover:text-terminal-gold" onClick={() => onSelectNode(b.id)}>{b.name}</button>
        {e.weight != null && <span className="font-mono tabular-nums"> · {e.weight}%</span>}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <ConfidenceBadge c={e.confidence} />
        <StaleBadge edge={e} now={now} />
      </div>
      {e.quote && (
        <blockquote className="mt-3 pl-2 text-terminal-text leading-snug" style={{ fontSize: 12, borderLeft: '2px solid rgba(201,168,76,0.5)' }}>
          “{e.quote}”
        </blockquote>
      )}
      <div className="mt-3">
        {row('SOURCE', <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="hover:text-terminal-gold underline decoration-dotted">{e.source.label} ↗</a>)}
        {row('PDF PAGE', page ?? '—')}
        {row('AS AT', fmtDate(edgeAsAt(e)))}
        {e.asAt && e.asAt !== e.source.date && row('DOCUMENT', fmtDate(e.source.date))}
        {row('CONFIDENCE', e.confidence)}
        {e.weightLabel && row('WEIGHT', e.weightLabel)}
        {e.note && row('NOTE', e.note)}
        {row('VERIFIED', fmtDate(e.lastVerified))}
      </div>
      {!e.quote && (
        <div className="text-terminal-text-dim/70 mt-2 leading-snug" style={{ fontSize: 10 }}>
          No quoted sentence is stored for this relationship; it was read from the source above by a person.
        </div>
      )}
    </div>
  )
}

// ── Path finder ─────────────────────────────────────────────────────────────
const NO_INDEX = new Set(['owns', 'supplies', 'customer_of', 'joint_venture', 'competes_with', 'exposed_to', 'director_of'])

export function PathFinder({ a, b, setA, setB, viaIndex, setViaIndex, confidence, onShowPath, shown, onSelectEdge }) {
  const paths = useMemo(() => (a && b
    ? findPaths(GRAPH, a, b, { max: 3, includeTypes: viaIndex ? null : NO_INDEX, confidence })
    : []), [a, b, viaIndex, confidence])
  return (
    <div>
      <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>HOW ARE THESE CONNECTED?</div>
      <div className="mt-2 space-y-1.5">
        <NodePicker value={a} onPick={setA} placeholder="From — company, commodity, person…" />
        <NodePicker value={b} onPick={setB} placeholder="To" />
      </div>
      <label className="flex items-center gap-2 mt-2 font-mono text-terminal-text-dim cursor-pointer" style={{ fontSize: 9 }}>
        <input type="checkbox" checked={viaIndex} onChange={(e) => setViaIndex(e.target.checked)} />
        INCLUDE INDEX MEMBERSHIP (CONNECTS EVERY LARGE COMPANY)
      </label>
      {a && b && (
        <div className="mt-3">
          {paths.length === 0 && (
            <div className="text-terminal-text-dim leading-snug" style={{ fontSize: 11 }}>
              No path between these two within six hops{viaIndex ? '' : ' (index membership excluded)'} on the sourced edges in the graph.
            </div>
          )}
          {paths.map((hops, i) => {
            const weakest = weakestConfidence(hops)
            return (
              <div key={i} className="mb-3 border px-2 py-1.5" style={{ borderColor: shown === i ? 'rgba(201,168,76,0.6)' : 'rgba(74,96,128,0.35)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => onShowPath(i, hops)} className="font-mono tracking-widest text-terminal-text-dim hover:text-terminal-gold flex-1 text-left" style={{ fontSize: 9 }}>
                    PATH {i + 1} · {hops.length} HOP{hops.length === 1 ? '' : 'S'} {shown === i ? '· SHOWN' : '· SHOW ▶'}
                  </button>
                  <span className="font-mono text-terminal-text-dim" style={{ fontSize: 8 }}>AS STRONG AS</span>
                  <ConfidenceBadge c={weakest} />
                </div>
                {hops.map((h, j) => {
                  const forward = h.edge.from === h.from
                  return (
                    <button key={j} onClick={() => onSelectEdge(h.edge.id)} className="block w-full text-left mt-1 hover:text-terminal-gold" style={{ fontSize: 11 }}>
                      <span className="text-terminal-text-bright">{GRAPH.byId.get(h.from).name}</span>
                      <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}> {forward ? '' : '← '}{EDGE_LABEL[h.edge.type].toLowerCase()}{forward ? ' →' : ''} </span>
                      <span className="text-terminal-text-bright">{GRAPH.byId.get(h.to).name}</span>
                      <span className="ml-1.5 inline-block align-middle"><ConfidenceBadge c={h.edge.confidence} /></span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Portfolio overlay: which of my holdings connect to this node ─────────────
// Downstream along the same exposure directions as the shock simulator, so
// an ETF holding is reached through the index its members sit in. Weights are
// by cost basis — the graph has no live prices — over A$-denominated
// holdings only, so currencies are never added together.
export function ConnectedHoldings({ id, holdings, onSelectNode }) {
  const result = useMemo(() => {
    const exp = exposureMap(GRAPH, id, { maxHop: 4 })
    const aud = holdings.filter((h) => h.currency === 'AUD')
    const totalCost = aud.reduce((s, h) => s + h.cost, 0)
    const rows = holdings.filter((h) => h.nodeId && exp.has(h.nodeId)).map((h) => ({ ...h, hops: exposurePath(exp, h.nodeId) }))
    const connectedCost = rows.filter((r) => r.currency === 'AUD').reduce((s, r) => s + r.cost, 0)
    return { rows, weight: totalCost > 0 ? (connectedCost / totalCost) * 100 : null, mixed: aud.length < holdings.length }
  }, [id, holdings])
  const n = GRAPH.byId.get(id)
  return (
    <div className="mt-3 border px-2 py-1.5" style={{ borderColor: `${HELD_TONE}66` }}>
      <div className="font-mono font-bold tracking-widest" style={{ fontSize: 9, color: HELD_TONE }}>CONNECTED EXPOSURE, NOT FORECAST</div>
      {holdings.length === 0 ? (
        <div className="text-terminal-text-dim mt-1" style={{ fontSize: 11 }}>No portfolio holdings saved on this device.</div>
      ) : (
        <>
          <div className="text-terminal-text-bright mt-1" style={{ fontSize: 12 }}>
            {result.rows.length} of your {holdings.length} holding{holdings.length === 1 ? '' : 's'} connect to {n.name}
            {result.weight != null && result.rows.length > 0 && <span className="font-mono"> · {result.weight.toFixed(1)}% of A$ cost basis</span>}
          </div>
          <div className="text-terminal-text-dim mt-0.5 leading-snug" style={{ fontSize: 10 }}>
            Connected means a sourced path exists, nothing more. No price effect is estimated.{result.mixed ? ' Non-A$ holdings are listed but left out of the weight.' : ''}
          </div>
          {result.rows.map((r) => (
            <div key={r.symbol} className="mt-1.5" style={{ fontSize: 11 }}>
              <button onClick={() => onSelectNode(r.nodeId)} className="text-terminal-text-bright hover:text-terminal-gold">{r.symbol}</button>
              <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
                {' '}{nodeLabel(n)}{r.hops.map((h) => ` ·${EDGE_LABEL[h.edge.type].toLowerCase()}· ${nodeLabel(GRAPH.byId.get(h.to))}`).join('')}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
