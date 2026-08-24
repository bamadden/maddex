import { useState } from 'react'

const VOTES_KEY = 'maddex_ideas_votes_v1'
const SUBMISSIONS_KEY = 'maddex_ideas_submissions_v1'

const ROADMAP = [
  { title: 'Options data', eta: 'Next quarter', desc: 'Chains, greeks, and unusual options activity for ASX and US listed names.' },
  { title: 'Mobile app', eta: 'In development', desc: 'Native iOS/Android companion — watchlist, alerts, and MaddenAI on the go.' },
  { title: 'Dark mode themes', eta: 'Coming soon', desc: 'A handful of alternate colour themes beyond the current terminal look.' },
]

const BASE_IDEAS = [
  { id: 'dark-mode',    label: 'Dark mode themes',      votes: 847 },
  { id: 'mobile-app',   label: 'Mobile app',             votes: 1203 },
  { id: 'options-data', label: 'Options data',           votes: 634 },
  { id: 'us-premarket', label: 'US pre-market data',     votes: 521 },
  { id: 'options-flow', label: 'Options flow scanner',   votes: 312 },
  { id: 'multi-currency', label: 'Multi-currency portfolios', votes: 198 },
]

function loadVotes() {
  try { return JSON.parse(localStorage.getItem(VOTES_KEY) ?? '{}') } catch { return {} }
}
function saveVotes(v) {
  try { localStorage.setItem(VOTES_KEY, JSON.stringify(v)) } catch { /* best-effort */ }
}
function loadSubmissions() {
  try { return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) ?? '[]') } catch { return [] }
}
function saveSubmissions(s) {
  try { localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(s)) } catch { /* best-effort */ }
}

export default function IdeasBoard({ onClose }) {
  const [votedIds, setVotedIds] = useState(() => new Set(Object.keys(loadVotes())))
  const [extraVotes, setExtraVotes] = useState(() => loadVotes())
  const [submissions, setSubmissions] = useState(loadSubmissions)
  const [draft, setDraft] = useState('')

  const allIdeas = [
    ...BASE_IDEAS,
    ...submissions.map((s) => ({ id: s.id, label: s.label, votes: 1 })),
  ].map((idea) => ({ ...idea, votes: idea.votes + (extraVotes[idea.id] ? 1 : 0) }))
    .sort((a, b) => b.votes - a.votes)

  const vote = (id) => {
    if (votedIds.has(id)) return
    const next = { ...extraVotes, [id]: 1 }
    setExtraVotes(next)
    saveVotes(next)
    setVotedIds(new Set(next ? Object.keys(next) : []))
  }

  const submit = (e) => {
    e.preventDefault()
    const label = draft.trim()
    if (!label) return
    const id = `submitted-${Date.now()}`
    const next = [...submissions, { id, label }]
    setSubmissions(next)
    saveSubmissions(next)
    vote(id)
    setDraft('')
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-terminal-panel border border-terminal-gold/40 w-full max-w-2xl shadow-2xl font-mono max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">IDEAS &amp; ROADMAP</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">COMING UP</div>
            <div className="space-y-2">
              {ROADMAP.map((r) => (
                <div key={r.title} className="border border-terminal-border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold text-terminal-text-bright">{r.title}</span>
                    <span className="text-2xs text-terminal-gold">{r.eta}</span>
                  </div>
                  <div className="text-2xs text-terminal-text-dim mt-1">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">VOTE FOR FEATURES</div>
            <div className="divide-y divide-terminal-border/50 border border-terminal-border">
              {allIdeas.map((idea) => {
                const voted = votedIds.has(idea.id)
                return (
                  <div key={idea.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-2xs text-terminal-text">{idea.label}</span>
                    <button
                      onClick={() => vote(idea.id)}
                      disabled={voted}
                      className={`flex items-center gap-1.5 text-2xs font-bold px-2 py-1 border transition-colors ${
                        voted
                          ? 'border-terminal-gold/50 text-terminal-gold cursor-default'
                          : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold'
                      }`}
                    >
                      <span>▲</span>{idea.votes.toLocaleString()}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">SUBMIT AN IDEA</div>
            <form onSubmit={submit} className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What should Maddex build next?"
                className="cmd-input flex-1 px-2 py-1.5 text-2xs border border-terminal-border"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-40"
              >SUBMIT</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
