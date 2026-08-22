import { useAuthStore } from '../../store/useAuthStore'

// Shown full-screen, un-dismissable, once a trial's 7 days are up and the
// user hasn't upgraded. The only ways out are picking a plan (payments
// aren't wired up yet — see the TODO below) or signing out.
const PLANS = [
  { tier: 'core',  label: 'CORE',  price: 'A$29', featured: true,
    features: ['Markets, Crypto, News, Global modules', 'Watchlist — up to 20 items', 'Portfolio — up to 10 holdings', 'MaddenAI — 50 messages/month'] },
  { tier: 'prime', label: 'PRIME', price: 'A$79', featured: false,
    features: ['Everything in Core', 'Rates/FX + Macro modules', 'Unlimited MaddenAI messages', 'Unlimited watchlist & portfolio'] },
  { tier: 'apex',  label: 'APEX',  price: 'A$149', featured: false,
    features: ['Everything in Prime', 'Research Notes', 'API access'] },
]

function startCheckout(tier) {
  // TODO: wire up a Stripe Checkout session for this tier once payments
  // are live. Until then this is a visual placeholder only.
  alert(`Payments are launching soon — contact support to start your ${tier.toUpperCase()} plan early.`)
}

export default function TrialExpiredModal() {
  const { signOut } = useAuthStore()

  return (
    <div className="fixed inset-0 z-[300] bg-terminal-bg flex items-center justify-center font-mono p-4"
      style={{ backgroundImage: 'radial-gradient(circle, #0d2244 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="w-full max-w-2xl border border-terminal-gold bg-terminal-panel shadow-2xl">
        <div className="py-6 px-6 text-center border-b border-terminal-border">
          <div className="text-terminal-gold text-2xl font-bold tracking-[0.3em]">▲ MADDEX</div>
          <div className="text-terminal-text-bright text-sm font-bold mt-3">Your 7-day free trial has ended</div>
          <div className="text-terminal-text-dim text-2xs mt-1">Choose a plan to keep your full Maddex terminal access</div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <div
              key={p.tier}
              className={`flex flex-col border p-4 space-y-3 ${p.featured ? 'border-terminal-gold' : 'border-terminal-border'}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-terminal-text-bright">{p.label}</span>
                  {p.featured && <span className="text-2xs text-terminal-gold">RECOMMENDED</span>}
                </div>
                <div className="text-lg font-bold text-terminal-gold mt-1">{p.price}<span className="text-2xs text-terminal-text-dim font-normal">/mo</span></div>
              </div>
              <ul className="space-y-1 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-2xs text-terminal-text-dim leading-tight">· {f}</li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(p.tier)}
                className={`w-full py-2 text-2xs font-bold tracking-widest transition-colors ${
                  p.featured
                    ? 'bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright'
                    : 'border border-terminal-gold text-terminal-gold hover:bg-terminal-gold/10'
                }`}
              >
                {p.featured ? `START WITH CORE ${p.price}/mo` : `CHOOSE ${p.label}`}
              </button>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 text-center">
          <button
            onClick={signOut}
            className="text-2xs text-terminal-text-dim hover:text-terminal-red underline transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
