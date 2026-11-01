import { useMemo, useState } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { useGraphReview } from '../../hooks/useGraphReview'
import { canWriteGraph } from '../../services/graphReviewAccess'
import { queueItems, triageMeta } from '../../data/graph/reviewQueue'
import { PROPOSAL_TYPES } from '../../data/graph/validate'
import { matchOnPage } from '../../data/graph/verify'
import { partiesOf } from '../../data/graph/secondPass'
import { SPOT_CHECK_SIZE } from '../../data/graph/reviewConfig'
import { GRAPH } from '../../data/graph'
import { PAL } from '../../styles/palette.js'

// REVIEW — the Relationships proposal queue.
//
// Every proposal has been through the pipeline before it reaches a person:
// Stage 1 checked its quote word for word against the source (and its
// source, endpoints, type and stake); Stage 2 had a second model read the
// passage blind; Stage 3 sorted it. NEEDS HUMAN is the default view.
// Nothing publishes without a person's approval: approving writes through the
// dev server (scripts/graphReview.js), which re-checks everything and records
// the approver. In production the queue is read-only.

const RED = '#C4653A'
const GREEN = PAL.up
const TABS = [
  { id: 'NEEDS_HUMAN', label: 'NEEDS HUMAN' },
  { id: 'AGREED', label: 'AGREED' },
  { id: 'AUTO_REJECTED', label: 'AUTO-REJECTED' },
]
const typeLabel = (t) => String(t ?? '').replace('_', ' ').toUpperCase()
const nodeName = (id, fallback) => (id ? GRAPH.byId.get(id)?.name ?? fallback : fallback)

function sample(list, n) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, n)
}

async function post(body) {
  const r = await fetch('/__graph/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return r.json()
}

// The quote, highlighted where it sits in the passage the second pass read
// (or the context the first pass recorded).
function QuoteInContext({ item }) {
  const passage = item.v2?.passage
  const m = passage ? matchOnPage(passage, item.quote) : null
  const [before, quote, after] = m
    ? [passage.slice(0, m.start), m.text, passage.slice(m.end)]
    : item.context ? [item.context.before, item.context.quote, item.context.after] : ['', item.quote, '']
  return (
    <div className="mt-2 leading-relaxed text-terminal-text-dim" style={{ fontSize: 12 }}>
      {before && '…'}{before}<mark className="text-terminal-text-bright px-0.5" style={{ background: 'rgba(201,168,76,0.22)' }}>{quote}</mark>{after}{after && '…'}
    </div>
  )
}

function Checks({ v1 }) {
  if (!v1) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono" style={{ fontSize: 11 }}>
      {Object.entries(v1.checks).map(([k, c]) => (
        <span key={k} style={{ color: c.ok ? GREEN : RED }} title={c.ok ? c.detail ?? '' : c.reason}>{c.ok ? '✓' : '✗'} {k.toUpperCase()}</span>
      ))}
      {v1.match?.sourceSha256 && <span className="text-terminal-text-dim" title={v1.match.sourceSha256}>SOURCE SHA-256 {v1.match.sourceSha256.slice(0, 12)}…</span>}
    </div>
  )
}

function Verdicts({ item }) {
  const { a, b } = partiesOf(item)
  const v = item.v2?.verdict
  const dir = v && ({ a_to_b: `${a} → ${b}`, b_to_a: `${b} → ${a}`, mutual: `${a} ↔ ${b}`, not_applicable: '—' }[v.direction])
  const outcome = item.v2?.comparison?.outcome
  const cell = 'border border-terminal-border p-2'
  const k = 'font-mono text-terminal-text-dim tracking-widest'
  return (
    <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', fontSize: 12 }}>
      <div className={cell}>
        <div className={k} style={{ fontSize: 11 }}>FIRST PASS · {item.doc.model ?? 'model unknown'}</div>
        <div className="mt-1 text-terminal-text-bright">{typeLabel(item.type)} · {item.from.name} → {item.to.name}</div>
        <div className="text-terminal-text-dim">{item.weight != null ? `${item.weight}% · ` : ''}page {item.page}</div>
      </div>
      <div className={cell} style={{ borderColor: outcome && outcome !== 'agree' ? `${RED}88` : undefined }}>
        <div className={k} style={{ fontSize: 11 }}>SECOND PASS · {item.v2?.model ?? 'not run'} · BLIND</div>
        {v ? (
          <>
            <div className="mt-1 text-terminal-text-bright">{typeLabel(v.relationship)} · {dir} · <span style={{ color: v.confidence === 'high' ? GREEN : PAL.gold }}>{v.confidence.toUpperCase()}</span></div>
            <div className="text-terminal-text-dim">“{v.supporting_quote}”</div>
            <div className="text-terminal-text-dim mt-0.5">{v.rationale}</div>
          </>
        ) : <div className="mt-1 text-terminal-text-dim">{item.v2?.error ?? 'Run npm run graph:second-pass.'}</div>}
        {outcome && <div className="mt-1 font-mono" style={{ fontSize: 11, color: outcome === 'agree' ? GREEN : RED }}>{outcome.replace(/_/g, ' ').toUpperCase()} — {item.v2.comparison.detail}</div>}
      </div>
    </div>
  )
}

function Card({ item, mode, onDone, onSpot }) {
  const writable = canWriteGraph() && mode === 'review'
  const [fixType, setFixType] = useState(item.type)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const send = async (body, action) => {
    setBusy(true); setMsg(null)
    try {
      const j = await post({ file: item.doc.file, id: item.id, ...body })
      if (!j.ok) setMsg(j.error)
      else onDone(item.id, action)
    } catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }
  const btn = 'font-mono font-bold tracking-widest px-3 py-1.5 disabled:opacity-40'
  return (
    <article className="border border-terminal-border bg-terminal-panel p-3" aria-label={`${item.from.name} ${typeLabel(item.type)} ${item.to.name}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 11 }}>{item.doc.ticker}</span>
        <span className="text-terminal-text-bright" style={{ fontSize: 13 }}>{nodeName(item.v1?.resolved?.from, item.from.name)}</span>
        <span className="font-mono text-terminal-text-dim" style={{ fontSize: 11 }}>{typeLabel(item.type)}</span>
        <span className="text-terminal-text-bright" style={{ fontSize: 13 }}>{nodeName(item.v1?.resolved?.to, item.to.name)}</span>
        {item.weight != null && <span className="font-mono text-terminal-text-bright">{item.weight}%</span>}
      </div>
      <ul className="mt-1.5 space-y-0.5" style={{ fontSize: 11, color: item.bucket === 'AGREED' ? GREEN : item.bucket === 'AUTO_REJECTED' ? RED : PAL.gold }}>
        {item.reasons.map((r) => <li key={r}>· {r}</li>)}
      </ul>
      <QuoteInContext item={item} />
      <div className="mt-1.5 font-mono text-terminal-text-dim" style={{ fontSize: 11 }}>
        <a href={`${item.doc.sourceUrl.split('#')[0]}#page=${item.page}`} target="_blank" rel="noopener noreferrer" className="hover:text-terminal-gold underline decoration-dotted">
          {item.doc.label} · PAGE {item.page} ↗
        </a>
        <span> · as at {item.doc.asAt}</span>
      </div>
      <Checks v1={item.v1} />
      {mode !== 'log' && <Verdicts item={item} />}

      {mode === 'review' && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button onClick={() => send({ action: 'approve' }, 'approve')} disabled={!writable || busy}
            className={`${btn} bg-terminal-gold text-terminal-bg`} style={{ fontSize: 11 }}>APPROVE</button>
          <span className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`fix-${item.id}`}>Fix type</label>
            <select id={`fix-${item.id}`} value={fixType} onChange={(e) => setFixType(e.target.value)} disabled={!writable || busy}
              className="bg-terminal-bg border border-terminal-border px-1 py-1 text-terminal-text-bright" style={{ fontSize: 11 }}>
              {PROPOSAL_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <button onClick={() => send({ action: 'approve', edit: { type: fixType } }, 'fix')} disabled={!writable || busy || fixType === item.type}
              className={`${btn} border border-terminal-gold text-terminal-gold`} style={{ fontSize: 11 }}>FIX TYPE &amp; APPROVE</button>
          </span>
          <label className="sr-only" htmlFor={`why-${item.id}`}>Reason for rejecting</label>
          <input id={`why-${item.id}`} value={reason} onChange={(e) => setReason(e.target.value)} disabled={!writable} placeholder="Reason for rejecting (optional)"
            className="flex-1 min-w-[160px] bg-terminal-bg border border-terminal-border px-2 py-1 text-terminal-text-bright" style={{ fontSize: 11 }} />
          <button onClick={() => send({ action: 'reject', reason }, 'reject')} disabled={!writable || busy}
            className={`${btn} border border-terminal-border text-terminal-text-dim hover:text-terminal-text-bright`} style={{ fontSize: 11 }}>REJECT</button>
        </div>
      )}
      {mode === 'spot' && (
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => onSpot(item.id, 'correct')} className={`${btn} border`} style={{ fontSize: 11, color: GREEN, borderColor: GREEN }}>CORRECT</button>
          <button onClick={() => onSpot(item.id, 'wrong')} className={`${btn} border`} style={{ fontSize: 11, color: RED, borderColor: RED }}>WRONG</button>
        </div>
      )}
      {msg && <div className="mt-1 font-mono" role="alert" style={{ fontSize: 11, color: RED }}>{msg}</div>}
    </article>
  )
}

// "Approve all agreed": a spot-check of SPOT_CHECK_SIZE random agreed items,
// each marked correct, then one confirmation showing the count.
function ApproveAllAgreed({ items, onDone }) {
  const [phase, setPhase] = useState('idle') // idle | checking | confirm | aborted
  const [picks, setPicks] = useState([])
  const [verdicts, setVerdicts] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const writable = canWriteGraph()
  const n = Math.min(SPOT_CHECK_SIZE, items.length)

  const start = () => { setPicks(sample(items, n)); setVerdicts({}); setMsg(null); setPhase('checking') }
  const mark = (id, verdict) => {
    const next = { ...verdicts, [id]: verdict }
    setVerdicts(next)
    if (verdict === 'wrong') { setPhase('aborted'); return }
    if (picks.every((p) => next[p.id] === 'correct')) setPhase('confirm')
  }
  const approveAll = async () => {
    setBusy(true); setMsg(null)
    try {
      const j = await post({ action: 'approve-agreed', ids: items.map((i) => i.id), spotCheck: picks.map((p) => ({ id: p.id, verdict: verdicts[p.id] })) })
      if (!j.ok) setMsg(j.error)
      else { items.forEach((i) => onDone(i.id, 'approve')); setPhase('idle') }
    } catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }

  if (!items.length) return null
  const next = picks.find((p) => !verdicts[p.id])
  return (
    <div className="border border-terminal-gold/40 p-3 space-y-3" style={{ background: 'rgba(201,168,76,0.04)' }}>
      {phase === 'idle' && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={start} disabled={!writable} className="font-mono font-bold tracking-widest px-3 py-1.5 bg-terminal-gold text-terminal-bg disabled:opacity-40" style={{ fontSize: 11 }}>
            APPROVE ALL AGREED ({items.length})
          </button>
          <span className="text-terminal-text-dim" style={{ fontSize: 11 }}>Spot-check {n} at random first. One marked wrong cancels the batch.</span>
        </div>
      )}
      {phase === 'checking' && next && (
        <>
          <div className="font-mono tracking-widest text-terminal-gold" style={{ fontSize: 11 }}>SPOT-CHECK {picks.indexOf(next) + 1} OF {n} — IS THIS EDGE CORRECT?</div>
          <Card key={next.id} item={next} mode="spot" onSpot={mark} />
          <button onClick={() => setPhase('idle')} className="font-mono text-terminal-text-dim hover:text-terminal-text-bright" style={{ fontSize: 11 }}>CANCEL</button>
        </>
      )}
      {phase === 'confirm' && (
        <div className="flex items-center gap-3 flex-wrap" role="alertdialog" aria-label="Confirm bulk approval">
          <span className="text-terminal-text-bright" style={{ fontSize: 12 }}>{n} of {n} spot-checks correct. Approve all {items.length} agreed edges as DISCLOSED?</span>
          <button onClick={approveAll} disabled={busy} className="font-mono font-bold tracking-widest px-3 py-1.5 bg-terminal-gold text-terminal-bg disabled:opacity-40" style={{ fontSize: 11 }}>
            APPROVE {items.length}
          </button>
          <button onClick={() => setPhase('idle')} className="font-mono text-terminal-text-dim hover:text-terminal-text-bright" style={{ fontSize: 11 }}>CANCEL</button>
        </div>
      )}
      {phase === 'aborted' && (
        <div className="flex items-center gap-3 flex-wrap" role="alert">
          <span style={{ fontSize: 12, color: RED }}>Marked wrong — batch cancelled. Review that item on its own below (Fix type or Reject).</span>
          <button onClick={() => setPhase('idle')} className="font-mono text-terminal-text-dim hover:text-terminal-text-bright" style={{ fontSize: 11 }}>OK</button>
        </div>
      )}
      {msg && <div className="font-mono" role="alert" style={{ fontSize: 11, color: RED }}>{msg}</div>}
    </div>
  )
}

export default function GraphReviewModule() {
  const { canReview } = useGraphReview()
  const [tab, setTab] = useState('NEEDS_HUMAN')
  const [done, setDone] = useState({})
  const items = useMemo(() => queueItems(), [])
  const meta = useMemo(() => triageMeta(), [])
  if (!canReview) {
    return <div className="h-full flex items-center justify-center text-terminal-text-dim font-mono" style={{ fontSize: 11 }}>Not available.</div>
  }
  const left = items.filter((i) => !done[i.id])
  const inTab = left.filter((i) => i.bucket === tab)
  const count = (b) => left.filter((i) => i.bucket === b).length
  const onDone = (id, action) => setDone((d) => ({ ...d, [id]: action }))

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <ModuleHeader title="REVIEW" subtitle="Relationships proposals · verified, read twice, triaged" moduleId="graphreview"
        right={<span className="font-mono text-terminal-text-dim text-2xs">{count('NEEDS_HUMAN') + count('AGREED')} TO DECIDE</span>} />
      <div className="px-4 py-2 border-b border-terminal-border text-terminal-text-dim leading-snug" style={{ fontSize: 11 }}>
        Stage 1 checked each quote word for word on its cited page. Stage 2 had a second model read the passage without seeing the proposal. Nothing is published until you approve it; each approval records you, the time, both readings and the quote match.
        <span className="font-mono"> Triage {meta.generatedAt?.slice(0, 16).replace('T', ' ')} UTC.</span>
        {!canWriteGraph() && <span className="text-terminal-gold"> Read-only here: approving writes to the repo, which only the dev server can do.</span>}
      </div>
      <div role="tablist" aria-label="Review buckets" className="flex border-b border-terminal-border px-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`font-mono tracking-widest px-3 py-2 border-b-2 ${tab === t.id ? 'border-terminal-gold text-terminal-gold' : 'border-transparent text-terminal-text-dim hover:text-terminal-text-bright'}`} style={{ fontSize: 11 }}>
            {t.label} ({count(t.id)})
          </button>
        ))}
      </div>
      <div className="p-4 space-y-3" role="tabpanel">
        {tab === 'AGREED' && <ApproveAllAgreed items={inTab} onDone={onDone} />}
        {tab === 'AUTO_REJECTED' && inTab.length > 0 && (
          <div className="text-terminal-text-dim" style={{ fontSize: 11 }}>Read-only log. These failed a Stage 1 check and cannot be approved; fix the cause (for example, add the missing node in nodes.js) and re-run <span className="font-mono">npm run graph:verify</span> and <span className="font-mono">graph:triage</span>.</div>
        )}
        {inTab.length === 0 && <div className="text-terminal-text-dim" style={{ fontSize: 12 }}>Nothing in {TABS.find((t) => t.id === tab).label}.</div>}
        {inTab.map((i) => <Card key={i.id} item={i} mode={tab === 'AUTO_REJECTED' ? 'log' : 'review'} onDone={onDone} />)}
        {Object.keys(done).length > 0 && (
          <div className="font-mono text-terminal-text-dim" style={{ fontSize: 11 }}>
            This session: {Object.values(done).filter((a) => a !== 'reject').length} approved, {Object.values(done).filter((a) => a === 'reject').length} rejected. The graph reloads with approved edges.
          </div>
        )}
      </div>
    </div>
  )
}
