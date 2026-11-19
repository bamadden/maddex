import { formatDate } from '../../utils/dateUtils'

// Under every MaddenAI answer (WS4): the dated datasets its figures were
// given from, and how the answer was produced. Collapsed to one line; the
// detail opens on request.
export default function AnswerMeta({ meta }) {
  if (!meta) return null
  const g = meta.guard
  return (
    <div className="mt-2 pt-1.5 border-t border-terminal-border/40 font-mono text-terminal-text-dim" style={{ fontSize: 11 }} data-answer-meta>
      <div data-answer-sources>
        <span className="tracking-widest text-terminal-gold/80">FIGURES GIVEN TO MADDENAI</span>
        {meta.sources.map((s) => (
          <span key={s.id}> · {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-terminal-text">{s.source}</a> : s.source}{s.asOf ? `, ${formatDate(s.asOf)}` : ''}</span>
        ))}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer tracking-widest hover:text-terminal-text" style={{ minHeight: 24 }}>HOW THIS WAS PRODUCED</summary>
        <ul className="mt-1 space-y-0.5 list-none" data-answer-produced>
          <li>Written by the {meta.model} language model at {new Date(meta.at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} Sydney time, from the figures above and the question asked.</li>
          <li>Prompt versions: {meta.versions.join(', ')}.</li>
          <li>Advice check: {g.checked ? (g.blocked ? 'the reply was mostly advice and was replaced with the standard decline' : g.removed ? `${g.removed} sentence${g.removed === 1 ? '' : 's'} that read as advice or a forecast removed` : 'every sentence checked; nothing removed') : 'not run for this reply'}.</li>
          {meta.elapsed != null && <li>Took {(meta.elapsed / 1000).toFixed(1)}s{meta.outputTokens ? `, ${meta.outputTokens} tokens` : ''}.</li>}
          <li>General information only, not personal advice. Language models can make mistakes: check any figure against its source.</li>
        </ul>
      </details>
    </div>
  )
}
