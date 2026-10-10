import { TIER_LABEL, PRICES, FEATURE_COPY, openPricing, startUpgrade } from '../../services/plans'

// Shown over a locked feature. The parent must be (or contain) a
// `position: relative` container the size of the locked area — this fills it.
//
// `featureKey` (a services/plans feature id) supplies the name and the one
// line on why it is worth having; `feature` / `requiredTier` remain for the
// older call sites that pass a label directly. `message` overrides the body,
// for limits ("You've used today's 10 MaddenAI questions").
export function UpgradeCard({ featureKey, feature, requiredTier = 'prime', message, onClose }) {
  const copy = FEATURE_COPY[featureKey] ?? {}
  const name = copy.name ?? feature ?? 'This feature'
  const label = TIER_LABEL[requiredTier] ?? requiredTier
  const price = PRICES[requiredTier]?.monthly

  return (
    <div className="relative w-full max-w-sm text-center px-7 pt-7 pb-6 font-mono shadow-2xl"
      style={{ backgroundColor: '#0B1628', backgroundImage: 'linear-gradient(180deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0) 40%)', border: '1px solid rgba(201,168,76,0.45)' }}
      role="dialog" aria-label={`${label} feature`}>
      {onClose && (
        <button onClick={onClose} aria-label="Close" className="absolute top-2.5 right-3 text-terminal-text-dim hover:text-terminal-text text-xs">✕</button>
      )}
      <div className="text-[9px] tracking-[0.24em] text-terminal-gold">{label.toUpperCase()} FEATURE</div>
      <svg className="mx-auto mt-3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.6" aria-hidden="true">
        <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1.2" fill="#C9A84C" stroke="none" />
      </svg>
      <div className="text-sm font-bold text-terminal-text-bright mt-3 leading-snug">
        {message ?? <>{name} is available on Maddex {label}</>}
      </div>
      {copy.why && <div className="text-xs text-terminal-text-dim leading-relaxed mt-2 font-sans" style={{ fontSize: 13 }}>{copy.why}</div>}
      <button
        onClick={() => startUpgrade(requiredTier)}
        className="w-full mt-5 py-2.5 text-xs font-bold tracking-[0.16em] bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors"
      >UPGRADE TO {label.toUpperCase()}{price ? ` — A$${price}/mo` : ''}</button>
      <button onClick={openPricing} className="mt-3 text-[10px] tracking-[0.16em] text-terminal-text-dim hover:text-terminal-gold underline underline-offset-4">
        SEE ALL PLANS
      </button>
    </div>
  )
}

export default function UpgradePrompt({ feature, featureKey, requiredTier = 'prime', message }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-terminal-bg/80 backdrop-blur-sm p-4">
      <UpgradeCard featureKey={featureKey} feature={feature} requiredTier={requiredTier} message={message} />
    </div>
  )
}
