// Onboarding shows once per user: persisted in the account, mirrored on the
// device, resumable, retryable when the account save fails, replayable from
// Help without resetting. The account is a test double: no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOnboardingStore, mergeOnboarding, shouldShowTour, resumeStep, ONBOARDING_KEY } from '../src/services/onboardingSync.js'

const memoryStorage = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }
}
// An account whose metadata persists across "logins" (store instances).
const fakeAccount = (initial = null) => {
  let saved = initial
  const acc = { fail: false, writes: 0, read: () => saved, write: async (s) => { acc.writes++; if (acc.fail) throw new Error('network down'); saved = structuredClone(s) } }
  return acc
}

test('first login: nothing stored anywhere → the tour shows from step 1', async () => {
  const store = createOnboardingStore({ account: fakeAccount(), storage: memoryStorage() })
  await store.ready
  assert.equal(shouldShowTour(store.get()), true)
  assert.equal(resumeStep(store.get()), 1)
})

test('second login, on a new device: the account says done → the tour does not show', async () => {
  const account = fakeAccount()
  const first = createOnboardingStore({ account, storage: memoryStorage() })
  await first.finishTour()
  const second = createOnboardingStore({ account, storage: memoryStorage() }) // empty device
  assert.equal(shouldShowTour(second.get()), false)
})

test('dismissing (EXIT SETUP) counts as finished — never shown again', async () => {
  const account = fakeAccount()
  await createOnboardingStore({ account, storage: memoryStorage() }).finishTour('dismissed')
  assert.equal(shouldShowTour(createOnboardingStore({ account, storage: memoryStorage() }).get()), false)
})

test('resume: a part-finished setup reopens at the step reached, on any device', async () => {
  const account = fakeAccount()
  const a = createOnboardingStore({ account, storage: memoryStorage() })
  await a.stepReached(2)
  await a.stepReached(3)
  const b = createOnboardingStore({ account, storage: memoryStorage() })
  assert.equal(shouldShowTour(b.get()), true)
  assert.equal(resumeStep(b.get()), 3)
})

test('failed save: progress is kept on the device, marked pending, and retry sends it', async () => {
  const account = fakeAccount()
  const storage = memoryStorage()
  const store = createOnboardingStore({ account, storage })
  account.fail = true
  const r = await store.finishTour()
  assert.equal(r.status, 'failed')
  assert.match(r.error, /network down/)
  assert.equal(JSON.parse(storage.getItem(ONBOARDING_KEY)).pending, true)
  assert.equal(shouldShowTour(store.get()), false)                         // not shown again on this device
  assert.equal(shouldShowTour(createOnboardingStore({ account, storage }).get()), false) // nor after a reload
  account.fail = false
  assert.equal((await store.retry()).status, 'synced')
  assert.equal(account.read().tour.status, 'done')
  assert.equal(JSON.parse(storage.getItem(ONBOARDING_KEY)).pending, false)
})

test('a pending device copy is uploaded at the next login', async () => {
  const account = fakeAccount()
  const storage = memoryStorage()
  account.fail = true
  await createOnboardingStore({ account, storage }).finishTour()
  account.fail = false
  const next = createOnboardingStore({ account, storage })
  assert.equal((await next.ready).status, 'synced')
  assert.equal(account.read().tour.status, 'done')
})

test('replay from Help does not reset completion', async () => {
  const account = fakeAccount()
  const store = createOnboardingStore({ account, storage: memoryStorage() })
  await store.finishTour()
  // Replaying walks the steps; stepReached is ignored once finished.
  await store.stepReached(2)
  await store.stepReached(4)
  assert.equal(store.get().tour.status, 'done')
  await store.finishTour()
  assert.equal(shouldShowTour(createOnboardingStore({ account, storage: memoryStorage() }).get()), false)
})

test('the old per-browser flags carry over and are uploaded once', async () => {
  const storage = memoryStorage()
  storage.setItem('maddex_onboarding_complete', 'true')
  storage.setItem('maddex_welcomed', '2026-01-01T00:00:00Z')
  const account = fakeAccount()
  const store = createOnboardingStore({ account, storage })
  await store.ready
  assert.equal(shouldShowTour(store.get()), false)
  assert.equal(account.read().tour.status, 'done')
  assert.equal(account.read().welcomed, '2026-01-01T00:00:00Z')
})

test('without an account (dev bypass) the device copy is the record', async () => {
  const storage = memoryStorage()
  const s = createOnboardingStore({ account: null, storage })
  assert.equal(s.sync().status, 'device-only')
  await s.stepReached(3)
  assert.equal(resumeStep(createOnboardingStore({ account: null, storage }).get()), 3)
})

test('merge: finished beats in progress; otherwise the furthest step wins', () => {
  assert.equal(mergeOnboarding({ tour: { status: 'done', step: 5 } }, { tour: { status: 'in_progress', step: 4 } }).tour.status, 'done')
  assert.equal(mergeOnboarding({ tour: { status: 'in_progress', step: 2 } }, { tour: { status: 'in_progress', step: 4 } }).tour.step, 4)
})
