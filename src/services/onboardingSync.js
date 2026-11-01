// Onboarding state per USER, not per browser.
//
// The tour (SetupWizard), the welcome screen and the post-signup questions
// used to remember completion only in localStorage, so a new device, a
// private window, cleared site data or "delete account / sign out
// everywhere" showed them again — and a reload mid-setup restarted at step 1.
//
// Now the state lives in the signed-in account (Supabase auth user metadata,
// key `maddex_onboarding`; no table or migration needed), mirrored on the
// device. The device copy is written first, so a failed account save never
// loses progress: it is marked pending, the shell shows a retry, and the next
// successful save clears it.
//
// State: { tour: { status: 'new' | 'in_progress' | 'done' | 'dismissed',
//                  step, at }, welcomed: ISO | null, profileFlow: ISO | null }
//
// Dependency-free apart from the adapter passed in, so tests drive it with
// a fake account.

export const ONBOARDING_KEY = 'maddex_onboarding'        // metadata key and device key
const LEGACY_TOUR_KEY = 'maddex_onboarding_complete'     // 'true' when the old tour finished
const LEGACY_WELCOMED_KEY = 'maddex_welcomed'
export const TOUR_STEPS = 5

const EMPTY = { tour: { status: 'new', step: 1, at: null }, welcomed: null, profileFlow: null }

const readLocal = (storage) => {
  try {
    const raw = storage?.getItem(ONBOARDING_KEY)
    if (raw) return JSON.parse(raw)
    // Carry over the old per-browser flags once.
    const legacyTour = storage?.getItem(LEGACY_TOUR_KEY) === 'true'
    const legacyWelcome = storage?.getItem(LEGACY_WELCOMED_KEY)
    if (legacyTour || legacyWelcome) {
      return { ...EMPTY, tour: legacyTour ? { status: 'done', step: TOUR_STEPS, at: null } : EMPTY.tour, welcomed: legacyWelcome ?? null }
    }
  } catch { /* unreadable → empty */ }
  return null
}
const writeLocal = (storage, state) => { try { storage?.setItem(ONBOARDING_KEY, JSON.stringify(state)) } catch { /* private mode */ } }

const rank = { new: 0, in_progress: 1, dismissed: 2, done: 3 }

// Account and device copies merged: a finished or dismissed tour on either
// side stays finished; otherwise the furthest step wins.
export function mergeOnboarding(account, local) {
  const a = account ?? null, l = local ?? null
  if (!a && !l) return structuredClone(EMPTY)
  const pick = (x, y) => {
    if (!x) return y
    if (!y) return x
    if (rank[x.status] !== rank[y.status]) return rank[x.status] > rank[y.status] ? x : y
    return (x.step ?? 1) >= (y.step ?? 1) ? x : y
  }
  return {
    tour: { ...EMPTY.tour, ...pick(a?.tour, l?.tour) },
    welcomed: a?.welcomed ?? l?.welcomed ?? null,
    profileFlow: a?.profileFlow ?? l?.profileFlow ?? null,
  }
}

export const shouldShowTour = (state) => !['done', 'dismissed'].includes(state?.tour?.status)
export const resumeStep = (state) => Math.min(TOUR_STEPS, Math.max(1, state?.tour?.status === 'in_progress' ? state.tour.step ?? 1 : 1))

// account: { read(): state|null, write(state): Promise } for the signed-in
// user, or null when there is none (the dev build's sign-in bypass).
export function createOnboardingStore({ account = null, storage = globalThis.localStorage, now = () => new Date().toISOString() } = {}) {
  let state = mergeOnboarding(account?.read() ?? null, readLocal(storage))
  let sync = { status: account ? 'synced' : 'device-only', error: null }
  const listeners = new Set()
  const emit = () => listeners.forEach((f) => f())

  async function push() {
    if (!account) return sync
    sync = { status: 'saving', error: null }; emit()
    try {
      await account.write(state)
      sync = { status: 'synced', error: null }
      writeLocal(storage, { ...state, pending: false })
    } catch (err) {
      sync = { status: 'failed', error: err?.message ?? 'save failed' }
      writeLocal(storage, { ...state, pending: true })
    }
    emit()
    return sync
  }

  function update(patch) {
    state = { ...state, ...patch, tour: { ...state.tour, ...(patch.tour ?? {}) } }
    writeLocal(storage, { ...state, pending: !!account })
    emit()
    return push()
  }

  // An account that has never stored state but this device has (the old
  // flags, or a save that failed last time): send it up once.
  const local = readLocal(storage)
  const needsUpload = account && local && (local.pending || !account.read())

  return {
    get: () => state,
    sync: () => sync,
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f) },
    ready: needsUpload ? push() : Promise.resolve(sync),
    retry: push,
    stepReached: (step) => (state.tour.status === 'done' || state.tour.status === 'dismissed') ? Promise.resolve(sync)
      : update({ tour: { status: 'in_progress', step, at: now() } }),
    finishTour: (how = 'done') => update({ tour: { status: how === 'dismissed' ? 'dismissed' : 'done', step: TOUR_STEPS, at: now() } }),
    markWelcomed: () => (state.welcomed ? Promise.resolve(sync) : update({ welcomed: now() })),
    markProfileFlow: () => update({ profileFlow: now() }),
  }
}
