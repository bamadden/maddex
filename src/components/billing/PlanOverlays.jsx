import { useEffect, useState } from 'react'
import { useSubscription } from '../../hooks/useSubscription'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import {
  TIERS, TIER_LABEL, PRICES, PLAN_CARDS, annualSaving, planFor, startUpgrade,
} from '../../services/plans'
import { UpgradeCard } from '../ui/UpgradePrompt'

// Every plan surface that floats over the terminal, driven by window events
// from services/plans so any component (or a store action) can raise them:
//   maddex:open-pricing  → the pricing comparison
//   maddex:gate          → the upgrade prompt for one feature or limit
//   maddex:upgrade       → "payments coming soon" + waitlist (until Stripe)

const WAITLIST_KEY = 'maddex_waitlist_email'

function Backdrop({ onClose, children, z = 'z-[260]' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={`fixed inset-0 ${z} flex items-center justify-center p-4 overflow-y-auto`}
      style={{ background: 'radial-gradient(ellipse at center, rgba(6,13,26,0.9) 0%, rgba(0,0,0,0.96) 100%)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}

// ── Pricing ─────────────────────────────────────────────────────────────────

function Price({ tier, billing }) {
  const p = PRICES[tier]
  const v = billing === 'annual' ? p.annual : p.monthly
  return (
    <div className="mt-4 flex items-baseline gap-1.5">
      {/* Keyed on the value so a toggle re-mounts it and the change animates. */}
      <span key={`${tier}-${billing}`} className="text-3xl font-bold text-terminal-text-bright tabular-nums inline-block"
        style={{ animation: 'maddex-price-in 260ms cubic-bezier(0.22, 1, 0.36, 1)' }}>A${v}</span>
      <span className="text-xs text-terminal-text-dim">/month</span>
    </div>
  )
}

export function PricingModal({ onClose }) {
  const { plan, isTrial } = useSubscription()
  const [billing, setBilling] = useState('monthly')

  return (
    <Backdrop onClose={onClose}>
      <div className="relative w-full max-w-5xl font-mono my-auto" role="dialog" aria-label="Maddex plans">
        <button onClick={onClose} aria-label="Close" className="absolute -top-1 right-0 text-terminal-text-dim hover:text-terminal-text text-sm">✕</button>
        <div className="text-center">
          <div className="text-terminal-gold text-sm font-bold tracking-[0.3em]">MADDEX PLANS</div>
          <div className="text-xs text-terminal-text-dim mt-1.5">All prices in AUD.</div>
          <div className="inline-flex mt-5 border border-terminal-gold/40" role="radiogroup" aria-label="Billing period">
            {[['monthly', 'MONTHLY'], ['annual', 'ANNUALLY ★ SAVE']].map(([id, label]) => (
              <button key={id} role="radio" aria-checked={billing === id} onClick={() => setBilling(id)}
                className={`px-4 py-1.5 text-[10px] font-bold tracking-[0.16em] transition-colors ${billing === id ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
          {TIERS.map((t) => {
            const card = PLAN_CARDS[t]
            const current = plan === t && !(isTrial && t === 'apex')
            const featured = t === 'prime'
            return (
              <div key={t} className="relative flex flex-col p-5"
                style={{ backgroundColor: '#0B1628', border: `1px solid ${featured ? 'rgba(201,168,76,0.7)' : 'rgba(99,120,153,0.35)'}`,
                  backgroundImage: featured ? 'linear-gradient(180deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0) 30%)' : undefined }}>
                {featured && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-bold tracking-[0.18em] bg-terminal-gold text-terminal-bg">MOST POPULAR</span>
                )}
                <div className="text-xs font-bold tracking-[0.24em] text-terminal-gold">{TIER_LABEL[t].toUpperCase()}</div>
                <div className="text-xs text-terminal-text-dim mt-1 font-sans" style={{ fontSize: 13 }}>{card.tagline}</div>
                <Price tier={t} billing={billing} />
                <div className="text-[10px] text-terminal-text-dim mt-1 h-4">
                  {t === 'core' ? 'Free forever'
                    : billing === 'annual' ? `Billed annually (A$${PRICES[t].annual * 12}/yr) · save ${annualSaving(t)}%`
                    : `Billed monthly · A$${PRICES[t].annual}/mo billed annually`}
                </div>
                {card.lead && <div className="text-[10px] tracking-wider text-terminal-text-dim mt-4">{card.lead}</div>}
                <ul className={`space-y-1.5 ${card.lead ? 'mt-2' : 'mt-4'} flex-1`}>
                  {card.features.map(([label, ok]) => (
                    <li key={label} className="flex items-start gap-2 text-xs font-sans" style={{ fontSize: 12.5 }}>
                      <span className={`flex-shrink-0 font-mono ${ok === true ? 'text-terminal-green' : ok === 'soon' ? 'text-terminal-gold/70' : 'text-terminal-text-dim/40'}`} aria-hidden="true">
                        {ok === true ? '✓' : ok === 'soon' ? '◷' : '✗'}
                      </span>
                      <span className={ok === true ? 'text-terminal-text' : 'text-terminal-text-dim/60'}>
                        {label}{ok === 'soon' && <span className="ml-1.5 text-[9px] font-mono tracking-wider text-terminal-gold/70">COMING SOON</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {current ? (
                    <div className="w-full py-2.5 text-center text-xs font-bold tracking-[0.16em] border border-terminal-border text-terminal-text-dim">CURRENT PLAN</div>
                  ) : t === 'core' ? (
                    <div className="w-full py-2.5 text-center text-[10px] tracking-[0.14em] text-terminal-text-dim/60">INCLUDED FREE</div>
                  ) : (
                    <button onClick={() => startUpgrade(t, billing)}
                      className="w-full py-2.5 text-xs font-bold tracking-[0.16em] bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors"
                    >UPGRADE TO {TIER_LABEL[t].toUpperCase()}</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {isTrial && plan === 'apex' && (
          <div className="text-center text-[11px] text-terminal-text-dim mt-4">You're on a free trial with full Apex access.</div>
        )}
        <div className="text-center text-[10px] text-terminal-text-dim/50 mt-3">
          General information only — Maddex is not a financial adviser. Equity prices run on demo data until a live feed is connected.
        </div>
      </div>
    </Backdrop>
  )
}

// ── Payments coming soon + waitlist ─────────────────────────────────────────

export function ComingSoonModal({ tier, onClose }) {
  const { user } = useAuthStore()
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(WAITLIST_KEY) ?? user?.email ?? '' } catch { return user?.email ?? '' }
  })
  const [status, setStatus] = useState('idle')   // idle | saving | saved | local | invalid
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) { setStatus('invalid'); return }
    const addr = email.trim().toLowerCase()
    setStatus('saving')
    try { localStorage.setItem(WAITLIST_KEY, addr) } catch { /* private mode */ }
    // Server copy, so someone can actually be emailed at launch. Needs the
    // `waitlist` table (supabase/migrations/002_waitlist.sql); until that is
    // applied this fails and the address is only on this device — the
    // confirmation says which, rather than promising an email nobody can send.
    const { error } = await supabase.from('waitlist').insert({ email: addr, tier: tier ?? null, source: 'terminal' })
    setStatus(error && !/duplicate|unique/i.test(error.message ?? '') ? 'local' : 'saved')
  }

  return (
    <Backdrop onClose={onClose} z="z-[270]">
      <div className="relative w-full max-w-md font-mono px-7 pt-7 pb-6 shadow-2xl"
        style={{ backgroundColor: '#0B1628', backgroundImage: 'linear-gradient(180deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0) 40%)', border: '1px solid rgba(201,168,76,0.45)' }}
        role="dialog" aria-label="Payments coming soon">
        <button onClick={onClose} aria-label="Close" className="absolute top-2.5 right-3 text-terminal-text-dim hover:text-terminal-text text-xs">✕</button>
        <div className="text-[9px] tracking-[0.24em] text-terminal-gold">{tier ? `MADDEX ${TIER_LABEL[tier].toUpperCase()}` : 'MADDEX'}</div>
        <div className="text-lg font-bold text-terminal-text-bright mt-2 tracking-wide">PAYMENTS COMING SOON</div>
        <p className="text-xs text-terminal-text-dim leading-relaxed mt-2 font-sans" style={{ fontSize: 13 }}>
          We're finalising our payment system. Be the first to know when {tier ? TIER_LABEL[tier] : 'Prime'} launches:
        </p>
        {status === 'saved' || status === 'local' ? (
          <div className="mt-5 border border-terminal-green/30 bg-terminal-green/5 px-3 py-3 text-xs text-terminal-text leading-relaxed">
            <span className="text-terminal-green">✓ You're on the list.</span>{' '}
            {status === 'saved'
              ? <>We'll email <b className="text-terminal-text-bright">{email.trim()}</b> at launch with an exclusive early-adopter offer.</>
              : <>Saved on this device as <b className="text-terminal-text-bright">{email.trim()}</b>. Our waitlist server isn't connected yet, so please check back here at launch.</>}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5">
            <div className="flex gap-2">
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
                placeholder="you@example.com" aria-label="Email address" autoFocus
                className="flex-1 bg-terminal-bg border border-terminal-border focus:border-terminal-gold outline-none px-3 py-2 text-xs text-terminal-text-bright" />
              <button type="submit" disabled={status === 'saving'}
                className="px-4 py-2 text-xs font-bold tracking-[0.14em] bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-50"
              >{status === 'saving' ? '…' : 'NOTIFY ME'}</button>
            </div>
            {status === 'invalid' && <div className="text-[11px] text-terminal-red mt-1.5">Enter a valid email address.</div>}
            <div className="text-[10px] text-terminal-text-dim/70 mt-2">We'll email you at launch with an exclusive early-adopter offer. Nothing else.</div>
          </form>
        )}
      </div>
    </Backdrop>
  )
}

// ── Host ────────────────────────────────────────────────────────────────────

export default function PlanOverlays() {
  const [pricing, setPricing] = useState(false)
  const [gate, setGate] = useState(null)        // { feature, message }
  const [upgrade, setUpgrade] = useState(null)  // { tier }

  useEffect(() => {
    const onPricing = () => { setGate(null); setPricing(true) }
    const onGate = (e) => setGate(e.detail ?? null)
    const onUpgrade = (e) => { setGate(null); setUpgrade(e.detail ?? {}) }
    window.addEventListener('maddex:open-pricing', onPricing)
    window.addEventListener('maddex:gate', onGate)
    window.addEventListener('maddex:upgrade', onUpgrade)
    return () => {
      window.removeEventListener('maddex:open-pricing', onPricing)
      window.removeEventListener('maddex:gate', onGate)
      window.removeEventListener('maddex:upgrade', onUpgrade)
    }
  }, [])

  return (
    <>
      {gate && (
        <Backdrop onClose={() => setGate(null)} z="z-[255]">
          <UpgradeCard featureKey={gate.feature} requiredTier={gate.tier ?? planFor(gate.feature)} message={gate.message} onClose={() => setGate(null)} />
        </Backdrop>
      )}
      {pricing && <PricingModal onClose={() => setPricing(false)} />}
      {upgrade && <ComingSoonModal tier={upgrade.tier} onClose={() => setUpgrade(null)} />}
    </>
  )
}
