import { useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { openPricing, startUpgrade } from '../../services/plans'

// WELCOME TO MADDEX — for an account on its free trial, and only then.
//
// Shown while profile.subscription_tier is 'trial' and the trial has not
// ended. A paid account (Core, Prime, Apex) never sees it; nor does an
// expired trial, which has its own screen. The trial length is read from the
// account (trial_ends_at minus created_at), not assumed. Dismissal is per
// account and per browser.

const DAY = 86400000
const key = (id) => `maddex_trial_welcome_dismissed_${id ?? 'anon'}`

export default function TrialWelcomeBanner() {
  const { profile, isTrialExpired, daysLeftInTrial } = useProfile()
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key(profile?.id)) === '1' } catch { return false } })
  if (!profile || profile.subscription_tier !== 'trial' || isTrialExpired || !profile.trial_ends_at || dismissed) return null

  const ends = new Date(profile.trial_ends_at).getTime()
  const start = profile.created_at ? new Date(profile.created_at).getTime() : null
  const length = start ? Math.max(1, Math.round((ends - start) / DAY)) : 7
  const used = Math.min(1, Math.max(0, 1 - daysLeftInTrial / length))
  const dismiss = () => { try { localStorage.setItem(key(profile.id), '1') } catch { /* private mode */ } setDismissed(true) }

  return (
    <div className="flex items-center gap-4 flex-wrap flex-shrink-0 font-mono" style={{ padding: '10px 20px', background: 'rgba(201,168,76,0.07)', borderBottom: '1px solid rgba(201,168,76,0.18)' }}>
      <div className="min-w-0">
        <div className="text-terminal-gold font-bold" style={{ fontSize: 11, letterSpacing: '0.18em' }}>WELCOME TO MADDEX</div>
        <div className="text-terminal-text-dim mt-0.5" style={{ fontSize: 10 }}>
          You&apos;re on your {length}-day trial with full Apex access · <span className="text-terminal-text-bright">{daysLeftInTrial} day{daysLeftInTrial === 1 ? '' : 's'} remaining</span>
        </div>
      </div>
      <div className="flex-1 min-w-[120px] max-w-[260px]">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(74,96,128,0.25)' }}>
          <div className="h-full rounded-full" style={{ width: `${used * 100}%`, background: '#C9A84C' }} />
        </div>
        <div className="text-terminal-text-dim/60 mt-1" style={{ fontSize: 8 }}>{Math.round(used * 100)}% of your trial used</div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={openPricing} className="text-[9px] tracking-widest px-2.5 py-1 text-terminal-text-dim hover:text-terminal-gold transition-colors" style={{ border: '1px solid rgba(201,168,76,0.25)' }}>EXPLORE FEATURES</button>
        <button onClick={() => startUpgrade('apex')} className="text-[9px] tracking-widest px-2.5 py-1 font-bold bg-terminal-gold text-terminal-bg hover:opacity-90 transition-opacity">UPGRADE NOW</button>
        <button onClick={dismiss} aria-label="Dismiss" className="text-terminal-text-dim/60 hover:text-terminal-text-bright px-1" style={{ fontSize: 12 }}>✕</button>
      </div>
    </div>
  )
}
