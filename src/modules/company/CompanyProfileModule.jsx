import { useEffect, useMemo, useState } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { useStore } from '../../store/useStore'
import { GRAPH } from '../../data/graph'
import { EDGE_LABEL } from '../../data/graph/schema'
import { TOP20_LABEL } from '../../data/graph/nodes'
import { COMPANY_FACTS, factsSource } from '../../data/graph/companyFacts'
import { edgeAsAt } from '../../data/graph/staleness'
import { completeness, edgesOf, searchNodes } from '../../services/graphQuery'
import { takeModuleIntent } from '../../services/moduleIntent'
import { MOCK_ASX_STOCKS } from '../../services/mockData'
import { openInRelationships } from '../../utils/openRelationships'
import { ConfidenceBadge, StaleBadge } from '../relationships/RelPanels'
import { TYPE_COLOUR, CONF_TONE, STALE_TONE, fmtDate } from '../relationships/theme'

// COMPANY PROFILE — one screen per company, in the spirit of a terminal's
// DES/FA pages, built only from what the graph and the ASX profiles hold.
//
// The rule for this screen: a fact is either shown with its source, or the
// row says NOT YET SOURCED. Never blank, never estimated. The price is the
// demo layer's and is tagged DEMO.

const LAST_KEY = 'maddex_company_profile_last'
const LEVEL_TONE = { THIN: '#C4653A', PARTIAL: '#C9A84C', FULLER: '#2D8A50' }
const NOT_SOURCED = 'NOT YET SOURCED'

function Section({ title, count, children }) {
  return (
    <section className="border border-terminal-border bg-terminal-panel">
      <div className="px-3 py-1.5 border-b border-terminal-border flex items-center gap-2">
        <span className="font-mono font-bold tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>{title}</span>
        {count != null && <span className="font-mono text-terminal-text-dim/70" style={{ fontSize: 9 }}>· {count}</span>}
      </div>
      <div className="px-3 py-2">{children}</div>
    </section>
  )
}

const NotSourced = ({ what }) => (
  <div className="font-mono tracking-widest py-1" style={{ fontSize: 9, color: '#637899' }}>{NOT_SOURCED}{what ? ` — ${what}` : ''}</div>
)

function SourceLine({ source, asAt }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
      className="block font-mono text-terminal-text-dim/70 hover:text-terminal-gold leading-snug" style={{ fontSize: 9 }}>
      {source.label}{asAt ? ` · as at ${fmtDate(asAt)}` : ''} ↗
    </a>
  )
}

// ── Completeness meter ─────────────────────────────────────────────────────
function Meter({ id, now }) {
  const c = completeness(GRAPH, id, now)
  const total = c.total || 1
  return (
    <div className="border px-3 py-2" style={{ borderColor: `${LEVEL_TONE[c.level]}66`, background: 'rgba(6,13,26,0.6)' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono font-bold tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>DATA COMPLETENESS</span>
        <span className="font-mono font-bold tracking-widest" style={{ fontSize: 10, color: LEVEL_TONE[c.level] }}>{c.level}</span>
        <div className="flex-1 min-w-[160px] h-2 flex overflow-hidden" style={{ background: 'rgba(74,96,128,0.18)' }} aria-hidden>
          {['VERIFIED', 'DISCLOSED', 'INFERRED'].map((k) => (
            <div key={k} style={{ width: `${(c.byConfidence[k] / total) * 100}%`, background: CONF_TONE[k], opacity: k === 'INFERRED' ? 0.55 : 0.9 }} />
          ))}
        </div>
        <span className="font-mono tabular-nums" style={{ fontSize: 10 }}>
          {['VERIFIED', 'DISCLOSED', 'INFERRED'].map((k) => (
            <span key={k} className="mr-2" style={{ color: c.byConfidence[k] ? CONF_TONE[k] : '#3A4E68' }}>{c.byConfidence[k]} {k.slice(0, 4)}</span>
          ))}
          {c.stale > 0 && <span style={{ color: STALE_TONE }}>{c.stale} STALE</span>}
        </span>
      </div>
      <div className="font-mono text-terminal-text-dim/80 mt-1" style={{ fontSize: 9 }}>
        {c.total} relationships · {c.sourcedSubstantive} sourced and current ownership, customer, exposure or peer edge{c.sourcedSubstantive === 1 ? '' : 's'}
        {c.lastVerified ? ` · last verified ${fmtDate(c.lastVerified)}` : ''}
      </div>
    </div>
  )
}

// ── One related node, linked into the graph ────────────────────────────────
function Linked({ row, now, onOpen, right }) {
  const { edge: e, other } = row
  return (
    <div className="py-1.5 border-b border-terminal-border/30 last:border-b-0">
      <div className="flex items-center gap-2">
        <span style={{ width: 7, height: 7, borderRadius: 7, background: TYPE_COLOUR[other.type], flexShrink: 0 }} />
        <button onClick={() => onOpen(other.id)} title="Open in Relationships" className="text-left flex-1 min-w-0 text-terminal-text-bright hover:text-terminal-gold" style={{ fontSize: 12 }}>
          {other.name}{other.ticker ? <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}> {other.ticker}</span> : null} <span className="text-terminal-text-dim" style={{ fontSize: 10 }}>⊶</span>
        </button>
        {right}
        {e.weight != null && <span className="font-mono tabular-nums text-terminal-text-bright" style={{ fontSize: 11 }}>{e.weight}%</span>}
        <StaleBadge edge={e} now={now} />
        <ConfidenceBadge c={e.confidence} />
      </div>
      {e.note && <div className="text-terminal-text-dim mt-0.5 leading-snug" style={{ fontSize: 10 }}>{e.note}</div>}
      <SourceLine source={e.source} asAt={edgeAsAt(e) !== e.source.date ? edgeAsAt(e) : null} />
    </div>
  )
}

function Group({ label, rows, now, onOpen, empty }) {
  return (
    <div className="mb-2">
      <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>{label}{rows.length ? ` · ${rows.length}` : ''}</div>
      {rows.length ? rows.map((r) => <Linked key={r.edge.id} row={r} now={now} onOpen={onOpen} />) : <NotSourced what={empty} />}
    </div>
  )
}

// ── Key facts ──────────────────────────────────────────────────────────────
function KeyFacts({ node }) {
  const f = COMPANY_FACTS[node.ticker]
  const src = f ? factsSource(node.ticker) : null
  const idx = (code) => (f ? (f.indices.includes(code) ? 'Yes' : 'No') : null)
  const rows = [
    ['Business', f?.description, src],
    ['Listed on ASX', f?.listed ? fmtDate(f.listed) : null, src],
    ['GICS sector', f ? node.sector : null, src],
    ['GICS industry group', f ? node.industry : null, src],
    ['S&P/ASX 20 member', idx('XTL'), src],
    ['S&P/ASX 200 member', idx('XJO'), src],
    ['Registered office', f?.office, src],
    ['Website', f?.website, src],
    // Not yet sourced for any company. Each needs the latest annual report,
    // read by a person; the proposal pipeline does not extract figures.
    ['Financial year end', null],
    ['Revenue (latest FY)', null],
    ['Net profit (latest FY)', null],
    ['Employees', null],
    ['Auditor', null],
  ]
  return (
    <div>
      {rows.map(([k, v, s]) => (
        <div key={k} className="flex gap-3 py-1 border-b border-terminal-border/30 last:border-b-0" style={{ fontSize: 11 }}>
          <span className="font-mono tracking-widest text-terminal-text-dim w-36 flex-shrink-0" style={{ fontSize: 9 }}>{k.toUpperCase()}</span>
          {v != null && v !== '' ? (
            <span className="min-w-0">
              <span className="text-terminal-text-bright">{k === 'Website' ? <a href={/^https?:/.test(v) ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="hover:text-terminal-gold underline decoration-dotted">{v.replace(/^https?:\/\//, '')}</a> : v}</span>
              {s && <span className="font-mono text-terminal-text-dim/60 ml-2" style={{ fontSize: 8 }}>DISCLOSED · {s.label.replace('ASX company profile — ', 'ASX profile ')} · {fmtDate(s.date)}</span>}
            </span>
          ) : (
            <span className="font-mono tracking-widest" style={{ fontSize: 9, color: '#637899' }}>{NOT_SOURCED}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function CompanyPicker({ onPick }) {
  const [q, setQ] = useState('')
  const hits = searchNodes(GRAPH, q, 12).filter((n) => n.type === 'company').slice(0, 7)
  return (
    <div className="relative" style={{ width: 230 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company or ticker…" aria-label="Find a company"
        className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 font-mono text-terminal-text-bright focus:border-terminal-gold/60 outline-none" style={{ fontSize: 11 }} />
      {q && hits.length > 0 && (
        <div className="absolute z-20 left-0 right-0 bg-terminal-panel border border-terminal-border shadow-2xl">
          {hits.map((n) => (
            <button key={n.id} onClick={() => { onPick(n.id); setQ('') }} className="block w-full text-left px-2 py-1 hover:bg-terminal-gold/10 text-terminal-text" style={{ fontSize: 11 }}>
              {n.name} <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{n.ticker}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const readLast = () => { try { return localStorage.getItem(LAST_KEY) } catch { return null } }

export default function CompanyProfileModule() {
  const { setActiveModule, openModal } = useStore()
  const [id, setId] = useState(() => {
    const want = takeModuleIntent('company')?.id ?? readLast() ?? 'BHP'
    return GRAPH.byId.get(want)?.type === 'company' ? want : 'BHP'
  })
  const [now] = useState(() => Date.now())

  // "Company profile" pressed while this screen is already open.
  useEffect(() => {
    const on = (ev) => {
      if (ev.detail?.module !== 'company') return
      takeModuleIntent('company')
      const next = ev.detail.intent?.id
      if (GRAPH.byId.get(next)?.type === 'company') setId(next)
    }
    window.addEventListener('madden:module-intent', on)
    return () => window.removeEventListener('madden:module-intent', on)
  }, [])
  useEffect(() => { try { localStorage.setItem(LAST_KEY, id) } catch { /* private mode */ } }, [id])

  const node = GRAPH.byId.get(id)
  const groups = useMemo(() => edgesOf(GRAPH, id), [id])
  const open = (otherId) => openInRelationships(setActiveModule, otherId)
  const rows = (type, pred = () => true) => (groups[type] ?? []).filter(pred)

  const holders = rows('owns', (r) => !r.outgoing).sort((a, b) => (b.edge.weight ?? 0) - (a.edge.weight ?? 0))
  const stakes = rows('owns', (r) => r.outgoing)
  const board = rows('director_of')
  const chair = board.find((r) => /\bchair/i.test(r.edge.note ?? ''))
  const ceo = board.find((r) => /\b(CEO|Managing Director)\b/.test(r.edge.note ?? ''))
  const supply = [...rows('supplies'), ...rows('customer_of'), ...rows('joint_venture')]
  const peers = rows('competes_with')
  const exposure = rows('exposed_to')
  const membership = rows('member_of')
  // ETFs that track an index this company is in.
  const etfs = useMemo(() => {
    const idxIds = new Set(membership.map((r) => r.other.id))
    return GRAPH.edges.filter((e) => e.type === 'exposed_to' && idxIds.has(e.to) && GRAPH.byId.get(e.from)?.type === 'etf')
  }, [membership])
  const quote = MOCK_ASX_STOCKS[`${node.ticker}.AX`]

  const person = (r, title) => (r ? (
    <div className="min-w-0">
      <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 8 }}>{title}</div>
      <button onClick={() => open(r.other.id)} className="text-terminal-text-bright hover:text-terminal-gold" style={{ fontSize: 12 }}>{r.other.name}</button>
      <div className="font-mono text-terminal-text-dim/70" style={{ fontSize: 8 }}>{r.edge.note} · ASX directory, as at {fmtDate(r.edge.source.date)}</div>
    </div>
  ) : (
    <div className="min-w-0">
      <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 8 }}>{title}</div>
      <div className="font-mono tracking-widest" style={{ fontSize: 9, color: '#637899' }}>{NOT_SOURCED}</div>
    </div>
  ))

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <ModuleHeader title="COMPANY" subtitle="Profile · every fact sourced or marked" moduleId="company"
        right={<CompanyPicker onPick={setId} />} />

      <div className="p-3 space-y-3 max-w-[1200px] w-full">
        <Meter id={id} now={now} />

        {/* Header */}
        <div className="flex items-start gap-6 flex-wrap px-1">
          <div className="min-w-0">
            <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>
              ASX:{node.ticker}{node.top20 ? ` · ${TOP20_LABEL}` : ''}
            </div>
            <div className="text-terminal-text-bright font-semibold leading-tight" style={{ fontSize: 22 }}>{node.name}</div>
            <div className="font-mono text-terminal-text-dim mt-0.5" style={{ fontSize: 10 }}>
              {[...new Set([node.sector, node.industry])].filter(Boolean).join(' · ') || NOT_SOURCED}{node.country ? ` · ${node.country}` : ''}
            </div>
          </div>
          <div>
            <div className="font-mono tracking-widest text-terminal-text-dim flex items-center gap-1.5" style={{ fontSize: 8 }}>
              PRICE <span className="font-bold px-1" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.5)' }}>DEMO</span>
            </div>
            {quote ? (
              <button onClick={() => openModal({ symbol: node.ticker, name: node.name, price: quote.price, pct: quote.changePct, change: quote.price * (quote.changePct / 100), type: 'asx' })}
                className="font-mono tabular-nums text-terminal-text-bright hover:text-terminal-gold" style={{ fontSize: 20 }} title="Open the quote (simulated prices)">
                A${quote.price.toFixed(2)} <span style={{ fontSize: 11, color: quote.changePct >= 0 ? '#2D8A50' : '#C4453A' }}>{quote.changePct >= 0 ? '▲' : '▼'}{Math.abs(quote.changePct).toFixed(2)}%</span>
              </button>
            ) : <div className="font-mono tracking-widest" style={{ fontSize: 9, color: '#637899' }}>NO PRICE IN THE DEMO SET</div>}
            <div className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8 }}>Simulated until a live equities feed is connected</div>
          </div>
          {person(chair, 'CHAIR')}
          {person(ceo, 'CEO / MANAGING DIRECTOR')}
          <button onClick={() => open(id)} className="ml-auto self-center font-mono font-bold tracking-widest border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-3 py-1.5" style={{ fontSize: 9 }}>
            VIEW IN GRAPH ⊶
          </button>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <Section title="OWNERSHIP — SUBSTANTIAL HOLDERS" count={holders.length}>
            {holders.length ? holders.map((r) => <Linked key={r.edge.id} row={r} now={now} onOpen={open} />)
              : <NotSourced what="no substantial-holder table or notice read yet" />}
            {stakes.length > 0 && (
              <div className="mt-3">
                <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>STAKES IT HOLDS · {stakes.length}</div>
                {stakes.map((r) => <Linked key={r.edge.id} row={r} now={now} onOpen={open} />)}
              </div>
            )}
          </Section>

          <Section title="CONNECTIONS">
            <Group label="SUPPLY CHAIN — CUSTOMERS, SUPPLIERS, JOINT VENTURES" rows={supply} now={now} onOpen={open} empty="no customer or supplier disclosure read yet" />
            <Group label="COMMODITY & MACRO EXPOSURE" rows={exposure} now={now} onOpen={open} empty="no exposure edge yet" />
            <Group label="PEERS" rows={peers} now={now} onOpen={open} empty="no peer group yet" />
            <Group label="INDEX MEMBERSHIP" rows={membership} now={now} onOpen={open} empty="no index listing read" />
            <div className="mb-1">
              <div className="font-mono tracking-widest text-terminal-text-dim" style={{ fontSize: 9 }}>ETFS THROUGH THOSE INDICES{etfs.length ? ` · ${etfs.length}` : ''}</div>
              {etfs.length ? etfs.map((e) => (
                <button key={e.id} onClick={() => open(e.from)} className="block text-left py-0.5 hover:text-terminal-gold" style={{ fontSize: 11 }}>
                  <span className="text-terminal-text-bright">{GRAPH.byId.get(e.from).name}</span>
                  <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}> tracks {GRAPH.byId.get(e.to).name} </span>
                  <ConfidenceBadge c={e.confidence} />
                </button>
              )) : <NotSourced what="no tracked index in the graph" />}
            </div>
          </Section>

          <Section title="KEY FACTS">
            <KeyFacts node={node} />
          </Section>

          <Section title="BOARD (CHAIR AND CEO ONLY SO FAR)" count={board.length}>
            {board.length ? board.map((r) => <Linked key={r.edge.id} row={r} now={now} onOpen={open} />) : <NotSourced what="no directors read yet" />}
            <div className="font-mono text-terminal-text-dim/60 mt-1" style={{ fontSize: 8 }}>
              {EDGE_LABEL.director_of} edges from the ASX company directory. Full boards are not yet in the graph.
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
