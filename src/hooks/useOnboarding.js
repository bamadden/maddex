import { useSyncExternalStore } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { createOnboardingStore, ONBOARDING_KEY } from '../services/onboardingSync'

// One onboarding store per signed-in user (or one device-only store when
// there is no user — the dev build's sign-in bypass). See
// services/onboardingSync for what it stores and why.
let current = { userId: undefined, store: null }

function storeFor(user) {
  const userId = user?.id ?? null
  if (current.store && current.userId === userId) return current.store
  const account = user ? {
    read: () => useAuthStore.getState().user?.user_metadata?.[ONBOARDING_KEY] ?? null,
    write: (state) => useAuthStore.getState().updateUserMetadata({ [ONBOARDING_KEY]: state }),
  } : null
  current = { userId, store: createOnboardingStore({ account }) }
  return current.store
}

export function useOnboarding() {
  const user = useAuthStore((s) => s.user)
  const store = storeFor(user)
  const state = useSyncExternalStore(store.subscribe, store.get)
  const sync = useSyncExternalStore(store.subscribe, store.sync)
  return { state, sync, store }
}
