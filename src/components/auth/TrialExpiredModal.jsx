import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { PricingModal, ComingSoonModal } from '../billing/PlanOverlays'
import { markTrialEndedSeen } from '../../services/plans'

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
      <div className="w-full max-w-md shadow-2xl px-8 pt-9 pb-7 text-center"
        style={{ backgroundColor: '#0B1628', backgroundImage: 'linear-gradient(180deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0) 34%)', border: '1px solid rgba(201,168,76,0.45)' }}>
        <img src="/icons/icon-mark-192.png" alt="" aria-hidden="true" className="mx-auto" style={{ width: 52, height: 52, objectFit: 'contain' }} />
        <div className="text-terminal-text-bright text-lg font-bold mt-4">Your 7-day trial has ended</div>
        <p className="text-xs text-terminal-text-dim leading-relaxed mt-2 font-sans" style={{ fontSize: 13 }}>
          You can keep using Maddex on Core, free — live crypto and FX, a 5-stock watchlist, MaddenAI (10 questions a day)
          and three morning briefs a week. Prime and Apex bring back portfolio tracking, alerts, the scanner and more.
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <button onClick={() => setView('plans')}
            className="w-full py-2.5 text-xs font-bold tracking-[0.16em] bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors"
          >SEE PLANS</button>
          <button onClick={continueOnCore} autoFocus
            className="w-full py-2.5 text-xs font-bold tracking-[0.16em] border border-terminal-gold/50 text-terminal-gold hover:bg-terminal-gold/10 transition-colors"
          >CONTINUE ON CORE (FREE)</button>
        </div>
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
