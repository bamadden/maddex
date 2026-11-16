import { useState } from 'react'
import { analyseImpact, cachedImpact } from '../../services/eventImpact'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'

// HISTORICAL IMPACT ANALYSIS — see services/eventImpact.

export default function EventImpact({ event }) {
  const [data, setData] = useState(() => cachedImpact(event))
  const [state, setState] = useState('idle') // idle | loading | error

  const run = async () => {
    setState('loading')
    try { setData(await analyseImpact(event)); setState('idle') } catch { setState('error') }
  }

  return (
    <div className="mb-2 pb-2 border-b border-terminal-border/30">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-terminal-text-dim/60 tracking-widest">HISTORICAL IMPACT ANALYSIS</span>
        {data && <AIContentBadge source="cache" />}
        {!data && (
          <button onClick={run} disabled={state === 'loading'}
            className="ml-auto text-[11px] font-bold text-terminal-gold border border-terminal-gold/50 px-1.5 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-50"
          >{state === 'loading' ? 'ANALYSING…' : state === 'error' ? 'RETRY' : 'ANALYSE ▶'}</button>
        )}
      </div>
      {data && (
        <div className="mt-1.5 space-y-1.5 text-2xs leading-relaxed">
          <div><span className="font-bold text-terminal-text-dim">ABOVE EXPECTATIONS, HISTORICALLY · </span><span className="text-terminal-text">{data.upside}</span></div>
          <div><span className="font-bold text-terminal-text-dim">BELOW EXPECTATIONS, HISTORICALLY · </span><span className="text-terminal-text">{data.downside}</span></div>
          {data.context && <div className="text-terminal-text-dim italic">{data.context}</div>}
          <div className="text-[11px] text-terminal-text-dim/50">Written by MaddenAI from general knowledge of past releases: not a backtested result, not a forecast of this release, and not a recommendation.</div>
        </div>
      )}
    </div>
  )
}
