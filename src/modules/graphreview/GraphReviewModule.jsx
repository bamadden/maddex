import { useMemo, useState } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { useGraphReview } from '../../hooks/useGraphReview'
import { canWriteGraph } from '../../services/graphReviewAccess'
import { pendingProposals, proposalDocs } from '../../data/graph/reviewQueue'
import { PROPOSAL_TYPES, weightInQuote } from '../../data/graph/validate'
import { GRAPH } from '../../data/graph'
import { NodePicker } from '../relationships/RelPanels'

// REVIEW — the Relationships proposal queue.
//
// Proposals come from `npm run propose-edges`: each carries a quote that the
// script has already found verbatim in the source document. Nothing here is
// published until a person approves it, and approving writes to the repo
// through the dev server (scripts/graphReview.js), which re-checks the edge.
// In production the queue is read-only and shown only to listed reviewers.

const TYPE_TO_EDGE = { supplier: 'supplies', customer: 'customer_of', owns: 'owns', subsidiary: 'owns', joint_venture: 'joint_venture', director_of: 'director_of' }
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Proposal({ p, onDone }) {
  const writable = canWriteGraph()
  const [type, setType] = useState(p.type)
  const [fromId, setFromId] = useState(p.from.id)
  const [toId, setToId] = useState(p.to.id)
  const [weight, setWeight] = useState(p.weight ?? '')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const w = weight === '' ? null : Number(weight)
  const weightOk = w == null || weightInQuote(w, p.quote)
  // An edge the graph already holds between the same two, of the same type.
  const dup = GRAPH.edges.find((e) => e.from === fromId && e.to === toId && e.type === TYPE_TO_EDGE[type])
  // Counterparties the graph does not know yet get a new node on approval.
  const newNodes = [
    !fromId && { id: `${type === 'director_of' ? 'person' : 'co'}:${slug(p.from.name)}`, type: type === 'director_of' ? 'person' : 'company', name: p.from.name, side: 'from' },
    !toId && { id: `co:${slug(p.to.name)}`, type: 'company', name: p.to.name, side: 'to' },
  ].filter(Boolean)

  const send = async (action) => {
    setBusy(true); setMsg(null)
    try {
      const edit = { type, fromId: fromId ?? newNodes.find((n) => n.side === 'from')?.id, toId: toId ?? newNodes.find((n) => n.side === 'to')?.id, weight: w, note: note || undefined, newNodes: newNodes.map(({ side: _side, ...n }) => n) }
      const r = await fetch('/__graph/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: p.doc.file, id: p.id, action, reason, edit }) })
      const j = await r.json()
      if (!j.ok) setMsg(j.error)
      else onDone(p.id, action)
    } catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }

  const label = (id, fallback) => (id ? GRAPH.byId.get(id)?.name ?? id : `${fallback} (new node)`)
  return (
    <div className="border border-terminal-border bg-terminal-panel p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 10 }}>{p.doc.ticker}</span>
        <span className="text-terminal-text-bright" style={{ fontSize: 13 }}>{label(fromId, p.from.name)}</span>
        <span className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>{type.replace('_', ' ').toUpperCase()}</span>
        <span className="text-terminal-text-bright" style={{ fontSize: 13 }}>{label(toId, p.to.name)}</span>
        {w != null && <span className="font-mono text-terminal-text-bright">{w}%</span>}
        {dup && <span className="font-mono font-bold tracking-widest px-1" style={{ fontSize: 8, color: '#C4653A', border: '1px solid #C4653A88' }}>ALREADY IN GRAPH · {dup.confidence}</span>}
      </div>

      {/* The sentence, highlighted in the text around it, as extracted. */}
      <div className="mt-2 leading-relaxed text-terminal-text-dim" style={{ fontSize: 12 }}>
        {p.context ? (
          <>…{p.context.before}<mark className="text-terminal-text-bright px-0.5" style={{ background: 'rgba(201,168,76,0.22)' }}>{p.context.quote}</mark>{p.context.after}…</>
        ) : <mark className="text-terminal-text-bright" style={{ background: 'rgba(201,168,76,0.22)' }}>{p.quote}</mark>}
      </div>
      <div className="mt-1.5 font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
        <a href={`${p.doc.sourceUrl.split('#')[0]}#page=${p.page}`} target="_blank" rel="noopener noreferrer" className="hover:text-terminal-gold underline decoration-dotted">
          {p.doc.label} · PAGE {p.page} ↗
        </a>
        {p.pageClaimed && <span> · model said p{p.pageClaimed}; corrected</span>}
        <span> · as at {p.doc.asAt} · {p.doc.model}</span>
      </div>

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <label className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>TYPE
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={!writable}
            className="block w-full mt-0.5 bg-terminal-bg border border-terminal-border px-1 py-1 text-terminal-text-bright" style={{ fontSize: 11 }}>
            {PROPOSAL_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </label>
        <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>FROM {!fromId && <span style={{ color: '#C9A84C' }}>· "{p.from.name}" not in graph</span>}
          <NodePicker value={fromId} onPick={setFromId} placeholder={fromId ? 'Change…' : 'Pick a node, or leave to create'} />
        </div>
        <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>TO {!toId && <span style={{ color: '#C9A84C' }}>· "{p.to.name}" not in graph</span>}
          <NodePicker value={toId} onPick={setToId} placeholder={toId ? 'Change…' : 'Pick a node, or leave to create'} />
        </div>
        <label className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>WEIGHT % (MUST BE IN THE QUOTE)
          <input value={weight} onChange={(e) => setWeight(e.target.value)} disabled={!writable} inputMode="decimal"
            className="block w-full mt-0.5 bg-terminal-bg border px-1 py-1 text-terminal-text-bright" style={{ fontSize: 11, borderColor: weightOk ? undefined : '#C4653A' }} />
        </label>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} disabled={!writable} placeholder="Note (optional)"
        className="block w-full mt-2 bg-terminal-bg border border-terminal-border px-2 py-1 text-terminal-text-bright" style={{ fontSize: 11 }} />

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button onClick={() => send('approve')} disabled={!writable || busy || !weightOk}
          className="font-mono font-bold tracking-widest px-3 py-1 bg-terminal-gold text-terminal-bg disabled:opacity-40" style={{ fontSize: 10 }}>APPROVE AS DISCLOSED</button>
        <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!writable} placeholder="Reason for rejecting (optional)"
          className="flex-1 min-w-[160px] bg-terminal-bg border border-terminal-border px-2 py-1 text-terminal-text-bright" style={{ fontSize: 11 }} />
        <button onClick={() => send('reject')} disabled={!writable || busy}
          className="font-mono font-bold tracking-widest px-3 py-1 border border-terminal-border text-terminal-text-dim hover:text-terminal-text-bright disabled:opacity-40" style={{ fontSize: 10 }}>REJECT</button>
      </div>
      {!weightOk && <div className="mt-1 font-mono" style={{ fontSize: 10, color: '#C4653A' }}>{w} does not appear in the quote.</div>}
      {newNodes.length > 0 && writable && <div className="mt-1 text-terminal-text-dim" style={{ fontSize: 10 }}>Approving creates {newNodes.map((n) => `${n.name} (${n.id})`).join(' and ')}.</div>}
      {msg && <div className="mt-1 font-mono" style={{ fontSize: 10, color: '#C4653A' }}>{msg}</div>}
    </div>
  )
}

export default function GraphReviewModule() {
  const { canReview } = useGraphReview()
  const [done, setDone] = useState({})
  const pending = useMemo(() => pendingProposals(), [])
  const docs = useMemo(() => proposalDocs(), [])
  if (!canReview) {
    return <div className="h-full flex items-center justify-center text-terminal-text-dim font-mono" style={{ fontSize: 11 }}>Not available.</div>
  }
  const left = pending.filter((p) => !done[p.id])
  const rejectedByScript = docs.reduce((n, d) => n + (d.rejected?.length ?? 0), 0)
  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <ModuleHeader title="REVIEW" subtitle="Relationships proposals · approve, edit or reject" moduleId="graphreview"
        right={<span className="font-mono text-terminal-text-dim text-2xs">{left.length} PENDING</span>} />
      <div className="px-4 py-2 border-b border-terminal-border text-terminal-text-dim leading-snug" style={{ fontSize: 11 }}>
        Each proposal's quote was found verbatim in its source by <span className="font-mono">npm run propose-edges</span>; {rejectedByScript} proposal{rejectedByScript === 1 ? ' was' : 's were'} rejected
        there for a quote or weight that did not check out. Approve writes the edge to <span className="font-mono">src/data/graph/approved.json</span> as DISCLOSED,
        with the quote; reject is remembered so it is not proposed again.
        {!canWriteGraph() && <span className="text-terminal-gold"> Read-only here: approving writes to the repo, which only the dev server can do.</span>}
      </div>
      <div className="p-4 space-y-3">
        {left.length === 0 && <div className="text-terminal-text-dim" style={{ fontSize: 12 }}>Nothing waiting. Run <span className="font-mono">npm run propose-edges -- --file … --ticker … --source-url … --as-at …</span> to add proposals.</div>}
        {left.map((p) => <Proposal key={p.id} p={p} onDone={(id, action) => setDone((d) => ({ ...d, [id]: action }))} />)}
        {Object.keys(done).length > 0 && (
          <div className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>
            This session: {Object.values(done).filter((a) => a === 'approve').length} approved, {Object.values(done).filter((a) => a === 'reject').length} rejected. The graph reloads with approved edges.
          </div>
        )}
      </div>
    </div>
  )
}
