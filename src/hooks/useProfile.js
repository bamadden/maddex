import { useState, useEffect } from 'react'
import { useAuthStore, CURRENCY_SYMBOLS } from '../store/useAuthStore'

export { CURRENCY_SYMBOLS }

// Thin selector over useAuthStore — the terminal's profile/auth state already
// lives in that zustand store (see src/store/useAuthStore.js: profile,
// fxRates, updateProfile, convertAmount). This hook exists so shared UI like
// DualCurrencyValue can be written once and imported the same way the
// marketing site imports its useProfile hook, without a second competing
// fetch/auth system.
export function useProfile() {
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const fxRates = useAuthStore((s) => s.fxRates)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const convertAmount = useAuthStore((s) => s.convertAmount)

  // Both of these read the clock, so they are derived in an effect rather
  // than in the render body. Re-checked hourly: a trial expiring is a state
  // change the UI has to notice on its own, not one that waits for an
  // unrelated re-render to reveal it.
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 3600000)
    return () => clearInterval(id)
  }, [])

  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null

  const isTrialExpired = profile?.subscription_tier === 'trial' && trialEndsAt != null
    ? trialEndsAt < clock
    : false

  const daysLeftInTrial = trialEndsAt != null
    ? Math.max(0, Math.ceil((trialEndsAt - clock) / (1000 * 60 * 60 * 24)))
    : 0

  return {
    profile,
    fxRates,
    loading,
    updateProfile,
    convertAmount,
    isTrialExpired,
    daysLeftInTrial,
  }
}
