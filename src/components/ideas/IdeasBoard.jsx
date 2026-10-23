import { useState } from 'react'

const VOTES_KEY = 'maddex_ideas_votes_v1'
const SUBMISSIONS_KEY = 'maddex_ideas_submissions_v1'

// Ideas & roadmap.
//
// There is no shared voting backend yet, so this board shows no counts: the
// numbers it used to show were constants, and read as community votes. A pick
// or a submitted idea is saved on this device only, and SEND TO MADDEX opens
// the user's own mail client with them filled in. That is the only way
// anything here reaches us, and the copy says so.
//
// The list carries no dates. Add an ETA only once it is a commitment.

const FEEDBACK_EMAIL = 'ben@maddex.com.au'

const ROADMAP = [
  { title: 'Options data', desc: 'Chains, greeks, and unusual options activity for ASX and US listed names.' },
  { title: 'Mobile app', desc: 'Native iOS/Android companion — watchlist, alerts, and MaddenAI on the go.' },
]

const BASE_IDEAS = [
  { id: 'mobile-app',     label: 'Mobile app' },
  { id: 'options-data',   label: 'Options data' },
  { id: 'us-premarket',   label: 'US pre-market data' },
  { id: 'options-flow',   label: 'Options flow scanner' },
  { id: 'multi-currency', label: 'Multi-currency portfolios' },
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
  const [picks, setPicks] = useState(loadVotes)
  const [submissions, setSubmissions] = useState(loadSubmissions)
  const [draft, setDraft] = useState('')

  const allIdeas = [...BASE_IDEAS, ...submissions.map((s) => ({ id: s.id, label: s.label, mine: true }))]

  const toggle = (id) => {
    const next = { ...picks }
    if (next[id]) delete next[id]
    else next[id] = 1
    setPicks(next)
    saveVotes(next)
  }

  const submit = (e) => {
    e.preventDefault()
    const label = draft.trim()
    if (!label) return
    const id = `submitted-${Date.now()}`
    const nextSubs = [...submissions, { id, label }]
    setSubmissions(nextSubs)
    saveSubmissions(nextSubs)
    const nextPicks = { ...picks, [id]: 1 }
    setPicks(nextPicks)
    saveVotes(nextPicks)
    setDraft('')
  }

  const picked = allIdeas.filter((i) => picks[i.id])
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Maddex — feature picks')}&body=${encodeURIComponent(
    ['What I want next:', ...picked.map((i) => `- ${i.label}${i.mine ? ' (my idea)' : ''}`), ''].join('\n'),
  )}`

  return (
    <div className="modal-backdrop fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
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
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">ON THE LIST</div>
            <div className="space-y-2">
              {ROADMAP.map((r) => (
                <div key={r.title} className="border border-terminal-border p-2.5">
                  <span className="text-2xs font-bold text-terminal-text-bright">{r.title}</span>
                  <div className="text-2xs text-terminal-text-dim mt-1">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest">WHAT DO YOU WANT NEXT?</div>
            <div className="text-2xs text-terminal-text-dim mt-1 mb-2">Pick any number. Picks are saved on this device only. There is no public tally yet.</div>
            <div className="divide-y divide-terminal-border/50 border border-terminal-border">
              {allIdeas.map((idea) => {
                const on = !!picks[idea.id]
                return (
                  <div key={idea.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-2xs text-terminal-text">
                      {idea.label}
                      {idea.mine && <span className="ml-2 text-terminal-text-dim">· YOUR IDEA</span>}
                    </span>
                    <button
                      onClick={() => toggle(idea.id)}
                      aria-pressed={on}
                      className={`text-2xs font-bold px-2 py-1 border transition-colors ${
                        on
                          ? 'border-terminal-gold/60 text-terminal-gold'
                          : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold'
                      }`}
                    >{on ? '✓ PICKED' : '+ PICK'}</button>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="text-2xs text-terminal-text-dim">To make sure we see them, send them to {FEEDBACK_EMAIL}.</span>
              {picked.length > 0 ? (
                <a href={mailto}
                  className="flex-shrink-0 text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">
                  SEND TO MADDEX ({picked.length})
                </a>
              ) : (
                <span className="flex-shrink-0 text-2xs font-bold text-terminal-text-dim/50 border border-terminal-border px-3 py-1.5">SEND TO MADDEX</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">ADD AN IDEA</div>
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
              >ADD</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
