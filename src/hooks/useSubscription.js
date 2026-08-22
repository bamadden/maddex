import { useProfile } from './useProfile'

const HIERARCHY = ['trial', 'core', 'prime', 'apex']

// A trial behaves like Apex for its 7 days, then drops back to no paid
// access at all — so "effective tier" (what gates actually check against)
// differs from the raw `subscription_tier` column once the trial expires.
export function useSubscription() {
  const { profile, isTrialExpired } = useProfile()

  const tier = profile?.subscription_tier || 'trial'
  const trialActive = tier === 'trial' && !isTrialExpired
  const effectiveTier = trialActive ? 'apex' : tier

  return {
    tier,
    isTrialExpired,
    isTrial: tier === 'trial',
    isCore:  HIERARCHY.indexOf(effectiveTier) >= HIERARCHY.indexOf('core'),
    isPrime: HIERARCHY.indexOf(effectiveTier) >= HIERARCHY.indexOf('prime'),
    isApex:  effectiveTier === 'apex',
    canAccess: (requiredTier) => HIERARCHY.indexOf(effectiveTier) >= HIERARCHY.indexOf(requiredTier),
  }
}
