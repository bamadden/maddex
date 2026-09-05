// Shown over a locked feature/area. The parent that renders this must be
// (or contain) a `position: relative` container the same size as the
// locked area — this fills it with `absolute inset-0`.

const TIER_LABEL = { trial: 'Trial', core: 'Core', prime: 'Prime', apex: 'Apex' }
const TIER_PRICE = { core: 'A$29/mo', prime: 'A$79/mo', apex: 'A$149/mo' }

function openUpgrade() {
  window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: { section: 'SUBSCRIPTION' } }))
}

export default function UpgradePrompt({ feature, requiredTier, currentTier }) {
  const requiredLabel = TIER_LABEL[requiredTier] ?? requiredTier
  const currentLabel  = TIER_LABEL[currentTier] ?? currentTier ?? 'Trial'
  const price         = TIER_PRICE[requiredTier]

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-terminal-bg/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs text-center px-6 py-7 border border-terminal-gold/40 bg-terminal-panel shadow-2xl">
        <div className="text-terminal-gold text-2xl mb-3">🔒</div>
        <div className="text-xs font-bold text-terminal-text-bright mb-1">{feature}</div>
        <div className="text-2xs text-terminal-text-dim leading-relaxed mb-4">
          This feature requires the <span className="text-terminal-gold font-bold">{requiredLabel}</span> plan
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-2xs text-terminal-text-dim">Current plan:</span>
          <span className="px-2 py-0.5 text-2xs font-bold border border-terminal-border text-terminal-text-dim tracking-wider">
            {currentLabel.toUpperCase()}
          </span>
        </div>
        <button
          onClick={openUpgrade}
          className="w-full btn-primary"
        >
          UPGRADE TO {requiredLabel.toUpperCase()}{price ? ` — ${price}` : ''}
        </button>
        <button
          onClick={openUpgrade}
          className="mt-2 text-2xs text-terminal-text-dim hover:text-terminal-gold underline transition-colors"
        >
          View all plans
        </button>
      </div>
    </div>
  )
}
