import { useState } from 'react'
import { assessStance, cachedStance } from '../../services/aiStance'

// ANALYST COVERAGE for stocks with no live consensus data. Says plainly what
// is missing (coverage counts and targets need a live consensus feed) and
// offers the one thing the terminal can give honestly: MaddenAI's own stance,
// labelled AI-ESTIMATE.

const TONE = { CONSTRUCTIVE: '#2D8A50', BALANCED: '#C9A84C', CAUTIOUS: '#A83232' }

export default function AnalystCoverage({ symbol, name }) {
  const [stance, setStance] = useState(() => cachedStance(symbol))
  const [state, setState] = useState('idle') // idle | loading | error

  const run = async () => {
    setState('loading')
    try { setStance(await assessStance({ symbol, name })); setState('idle') } catch { setState('error') }
  }

  return (
    <div className="text-2xs font-mono space-y-1.5">
      <div className="text-terminal-text-dim/60">Where public data is available.</div>
      <div className="flex justify-between"><span className="text-terminal-text-dim">Broker coverage</span><span className="text-terminal-text-dim/70">Not available — needs a live consensus feed</span></div>
      <div className="flex justify-between"><span className="text-terminal-text-dim">Average target</span><span className="text-terminal-text-dim/70">NOT SHOWN — requires live data</span></div>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-terminal-border/20">
        <span className="text-terminal-text-dim">MaddenAI stance</span>
        {stance ? (
          <span className="flex items-center gap-1.5">
            <span className="font-bold px-1.5" style={{ color: TONE[stance.stance], border: `1px solid ${TONE[stance.stance]}66` }}>{stance.stance}</span>
            <span className="text-[9px] font-bold px-1 border border-terminal-text-dim/40 text-terminal-text-dim">AI-ESTIMATE</span>
          </span>
        ) : (
          <button onClick={run} disabled={state === 'loading'}
            className="font-bold text-terminal-gold border border-terminal-gold/50 px-1.5 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-50"
          >{state === 'loading' ? 'ASSESSING…' : state === 'error' ? 'RETRY' : 'ASSESS ▶'}</button>
        )}
      </div>
      {stance?.rationale && (
        <div className="text-terminal-text-dim italic leading-snug">
          {stance.rationale}{' '}
          <span className="not-italic text-terminal-text-dim/50">
            ({stance.from}, {new Date(stance.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · not a recommendation)
          </span>
        </div>
      )}
    </div>
  )
}
