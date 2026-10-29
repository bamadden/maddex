import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { PricingModal, ComingSoonModal } from '../billing/PlanModals'
import { markTrialEndedSeen, PRICES, LIMITS } from '../../services/plans'

// Shown once when a 7-day trial ends. Core is a free plan now, so this is a
// choice rather than a lock: continue on Core, or pick a paid plan. The
// choice is remembered per account (services/plans markTrialEndedSeen) and
// the terminal opens on Core from then on — effectiveTier() already treats an
// expired trial as Core.
//
// Rendered before the Terminal (and so before PlanOverlays) mounts, so it
// hosts its own pricing and waitlist modals.

export default function TrialExpiredModal({ onContinue }) {
  const { user, signOut } = useAuthStore()
  const [view, setView] = useState('intro')   // intro | plans
  const [upgradeTier, setUpgradeTier] = useState(null)

  const continueOnCore = () => { markTrialEndedSeen(user?.id); onContinue?.() }

  // PricingModal's upgrade buttons dispatch maddex:upgrade, which nothing
  // listens for here — so catch it and show the waitlist directly.
  if (view === 'plans') {
    return (
      <UpgradeListener onUpgrade={setUpgradeTier}>
        <PricingModal onClose={() => setView('intro')} />
        {upgradeTier && <ComingSoonModal tier={upgradeTier} onClose={() => setUpgradeTier(null)} />}
      </UpgradeListener>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] bg-terminal-bg flex items-center justify-center font-mono p-4"
      style={{ backgroundImage: 'radial-gradient(circle, #0F1E35 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      <div className="w-full max-w-lg shadow-2xl px-8 pt-9 pb-7 text-center"
        style={{ backgroundColor: '#0B1628', backgroundImage: 'linear-gradient(180deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0) 34%)', border: '1px solid rgba(201,168,76,0.45)' }}>
        <img src="/icons/icon-mark-192.png" alt="" aria-hidden="true" className="mx-auto" style={{ width: 52, height: 52, objectFit: 'contain' }} />
        <div className="text-terminal-text-bright text-lg font-bold mt-4 tracking-wide">YOUR TRIAL HAS ENDED</div>
        <p className="text-terminal-text-dim leading-relaxed mt-2 font-sans" style={{ fontSize: 13 }}>
          Thank you for trying Maddex. We hope you found it valuable.
        </p>
        <div className="mt-4 px-3 py-2 text-left font-sans" style={{ border: '1px solid rgba(45,138,80,0.4)', background: 'rgba(45,138,80,0.06)', fontSize: 12 }}>
          <span className="text-terminal-green font-bold">Your data is safe.</span>{' '}
          <span className="text-terminal-text">Your watchlist, portfolio and alerts are kept, whichever plan you choose.</span>
        </div>
        <div className="text-[10px] tracking-[0.16em] text-terminal-text-dim mt-5 mb-2">CONTINUE ON CORE (FREE) OR UPGRADE</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { tier: 'core', label: 'CORE', price: 'FREE', note: `${LIMITS.core.aiPerDay} AI questions a day, ${LIMITS.core.watchlist}-stock watchlist`, onClick: continueOnCore },
            { tier: 'prime', label: 'PRIME', price: `A$${PRICES.prime.monthly}/mo`, note: 'Portfolio, alerts, scanner, research notes', onClick: () => setUpgradeTier('prime'), featured: true },
            { tier: 'apex', label: 'APEX', price: `A$${PRICES.apex.monthly}/mo`, note: 'Everything, unlimited MaddenAI', onClick: () => setUpgradeTier('apex') },
          ].map((p) => (
            <button key={p.tier} onClick={p.onClick} autoFocus={p.tier === 'core'}
              className={`px-2 py-3 flex flex-col items-center gap-1 transition-colors ${p.featured ? 'bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright' : 'border border-terminal-gold/50 text-terminal-gold hover:bg-terminal-gold/10'}`}>
              <span className="text-xs font-bold tracking-[0.16em]">{p.label}</span>
              <span className="text-[11px] font-bold">{p.price}</span>
              <span className={`font-sans leading-tight ${p.featured ? 'text-terminal-bg/80' : 'text-terminal-text-dim'}`} style={{ fontSize: 10 }}>{p.note}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setView('plans')} className="mt-4 text-[10px] tracking-[0.14em] text-terminal-gold/80 hover:text-terminal-gold">COMPARE EVERY FEATURE →</button>
        {upgradeTier && <ComingSoonModal tier={upgradeTier} onClose={() => setUpgradeTier(null)} />}
        <div />
        <button onClick={signOut} className="mt-5 text-[10px] tracking-[0.14em] text-terminal-text-dim hover:text-terminal-text">SIGN OUT</button>
      </div>
    </div>
  )
}

function UpgradeListener({ onUpgrade, children }) {
  useUpgradeEvent(onUpgrade)
  return children
}

function useUpgradeEvent(fn) {
  useEffect(() => {
    const h = (e) => fn(e.detail?.tier ?? 'prime')
    window.addEventListener('maddex:upgrade', h)
    return () => window.removeEventListener('maddex:upgrade', h)
  }, [fn])
}
