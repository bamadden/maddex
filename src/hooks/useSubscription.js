import { useProfile } from './useProfile'
import { effectiveTier, devPlanOverride, canAccess as featureAllowed, LIMITS } from '../services/plans'

const HIERARCHY = ['core', 'prime', 'apex']

// The user's plan. `tier` is the raw subscription_tier ('trial' included, for
// display); `plan` is what gates check against — a live trial is Apex, an
// expired one is Core (free). See services/plans.js.
export function useSubscription() {
  const { profile, isTrialExpired } = useProfile()
  // A dev plan override is shown as that plan, not as a trial.
  const tier = devPlanOverride() ?? (profile?.subscription_tier || 'trial')
  const plan = effectiveTier(profile)

  return {
    tier,
    plan,
    isTrialExpired,
    isTrial: tier === 'trial',
    isCore:  plan === 'core',
    isPrime: HIERARCHY.indexOf(plan) >= HIERARCHY.indexOf('prime'),
    isApex:  plan === 'apex',
    limits:  LIMITS[plan],
    // Tier-level check, kept for existing callers: canAccess('prime').
    canAccess: (requiredTier) => HIERARCHY.indexOf(plan) >= HIERARCHY.indexOf(requiredTier === 'trial' ? 'core' : requiredTier),
    // Feature-level check against services/plans GATES: canUse('portfolio').
    canUse: (feature) => featureAllowed(feature, plan),
  }
}
