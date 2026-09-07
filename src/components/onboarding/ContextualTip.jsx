import { useEffect, useState } from 'react'
import { isNewUser, isTipDismissed, dismissTip, MODULE_TIPS } from '../../services/onboardingState'

// A one-line hint, once, on a module's first visit during the first week.
//
// THREE RULES, EACH LEARNED FROM HOW THESE USUALLY GO WRONG
//
// 1. It says something you cannot see. "This is the markets module" is noise
//    when the header says MARKETS. Every tip names a shortcut or a hidden
//    interaction — the things a terminal hides on purpose and a newcomer
//    therefore never finds.
//
// 2. It appears once and remembers. A tip that returns is not help; it trains
//    the reader to dismiss on sight, which is the habit that makes a genuinely
//    important notice invisible three months later.
//
// 3. It expires. After seven days the user knows the app, and the tips stop
//    regardless of whether they were ever dismissed.
// `suppressed` is passed while a modal owns the screen. A tip that fires
// behind the welcome card is both invisible and spent — it marks itself shown
// and the user never sees it.
export default function ContextualTip({ moduleId, suppressed = false }) {
  const tip = MODULE_TIPS[moduleId]

  // Eligibility is read ONCE, in the initialiser, not in an effect.
  //
  // Both checks hit localStorage, and calling them from an effect meant
  // setting state on every mount just to conclude "no tip" — a state write per
  // module switch, for the overwhelmingly common case of a user who is not new.
  // The component is keyed by module, so a fresh mount re-reads anyway.
  const [eligible] = useState(() => Boolean(tip) && isNewUser() && !isTipDismissed(tip.id))
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!eligible || suppressed) return
    // A short delay so the tip arrives after the module has painted. Appearing
    // in the same frame as the content reads as the layout jumping.
    const id = setTimeout(() => setVisible(true), 700)
    return () => clearTimeout(id)
  }, [eligible, suppressed])

  if (!tip || !eligible || !visible || suppressed) return null

  const close = () => {
    dismissTip(tip.id)
    setVisible(false)
  }

  return (
    <div
      className="absolute z-30 flex items-start gap-2.5 px-3 py-2 shadow-2xl font-mono"
      style={{
        bottom: 14,
        left: 14,
        maxWidth: 340,
        border: '1px solid rgba(201,168,76,0.45)',
        background: 'linear-gradient(180deg, rgba(201,168,76,0.07) 0%, rgba(255,255,255,0) 60%), rgb(var(--t-header))',
        animation: 'maddex-tip-in 260ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      role="status"
    >
      <span className="text-terminal-gold flex-shrink-0" style={{ fontSize: 11, lineHeight: '15px' }}>◆</span>
      <div className="min-w-0">
        <div className="text-2xs text-terminal-text leading-relaxed">{tip.text}</div>
        <button
          onClick={close}
          className="text-2xs text-terminal-gold/70 hover:text-terminal-gold tracking-widest mt-1"
        >GOT IT</button>
      </div>
      <button
        onClick={close}
        aria-label="Dismiss tip"
        className="text-terminal-text-dim hover:text-terminal-text flex-shrink-0 leading-none"
        style={{ fontSize: 12 }}
      >✕</button>
    </div>
  )
}
