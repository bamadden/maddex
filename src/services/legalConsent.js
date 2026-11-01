// The two consents Maddex records:
//
//   - the first-use acknowledgement of the disclaimer (general information
//     only, not advice, objectives/situation/needs, past performance, AI can
//     make mistakes). Shown once per device and version; when signed in it is
//     also written to the account's auth metadata (no table needed), with the
//     version and time.
//   - acceptance of the Terms of Use and Privacy Policy, recorded at sign-up
//     (auth metadata `maddex_terms`, with each document's version and the
//     time) — and asked for once at sign-in from any account that has no
//     record for the current versions (Google sign-in, accounts made before).

import { DISCLAIMER_VERSION } from './disclosures.js'
import { TERMS_VERSION, PRIVACY_VERSION } from '../data/legalVersions.js'

const ACK_KEY = 'maddex_disclaimer_ack'

const readLocal = (storage) => { try { return JSON.parse(storage?.getItem(ACK_KEY) ?? 'null') } catch { return null } }

export function hasAcknowledged(user, storage = globalThis.localStorage) {
  if (user?.user_metadata?.maddex_disclaimer_ack?.version === DISCLAIMER_VERSION) return true
  return readLocal(storage)?.version === DISCLAIMER_VERSION
}

// → the record written. The account copy is best effort; the device copy is
// enough to stop the prompt repeating on this device.
export async function recordAcknowledgement({ user, updateUserMetadata, storage = globalThis.localStorage, now = new Date() } = {}) {
  const record = { version: DISCLAIMER_VERSION, at: now.toISOString() }
  try { storage?.setItem(ACK_KEY, JSON.stringify(record)) } catch { /* private mode */ }
  if (user && updateUserMetadata) {
    try { await updateUserMetadata({ maddex_disclaimer_ack: record }) } catch { /* kept on the device */ }
  }
  return record
}

export function acceptanceRecord(now = new Date()) {
  const at = now.toISOString()
  return { terms: { version: TERMS_VERSION, at }, privacy: { version: PRIVACY_VERSION, at } }
}

export function termsAccepted(user) {
  const t = user?.user_metadata?.maddex_terms
  return t?.terms?.version === TERMS_VERSION && t?.privacy?.version === PRIVACY_VERSION
}
