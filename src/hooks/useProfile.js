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

  const isTrialExpired = profile?.subscription_tier === 'trial' && profile?.trial_ends_at
    ? new Date(profile.trial_ends_at) < new Date()
    : false

  const daysLeftInTrial = profile?.trial_ends_at
    ? Math.max(0, Math.ceil(
        (new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
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
