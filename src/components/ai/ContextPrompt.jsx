import { askMaddenAI } from '../../utils/askAI'

// A quiet one-line nudge from MaddenAI about what is on screen, with a button
// that asks the question (sent visibly — see askMaddenAI).

export default function ContextPrompt({ text, prompt, action = 'ASK MADDENAI', onDismiss, className = '' }) {
  return (
    <div role="note" className={`flex items-center gap-3 px-3 py-2 border border-terminal-gold/25 bg-terminal-gold/[0.04] ${className}`}>
      <span className="text-terminal-gold text-xs flex-shrink-0" aria-hidden="true">✦</span>
      <span className="text-2xs text-terminal-text leading-snug flex-1 min-w-0">{text}</span>
      <button onClick={() => askMaddenAI(prompt)}
        className="text-2xs font-bold tracking-widest text-terminal-gold hover:text-terminal-gold-bright flex-shrink-0 whitespace-nowrap"
      >{action} ▶</button>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="text-2xs text-terminal-text-dim/60 hover:text-terminal-text flex-shrink-0">✕</button>
      )}
    </div>
  )
}
