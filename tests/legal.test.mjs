// Disclosures and terms (legal-risk item 4).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { hasAcknowledged, recordAcknowledgement, acceptanceRecord, termsAccepted } from '../src/services/legalConsent.js'
import { DISCLAIMER_VERSION, DISCLAIMER_POINTS, DISCLAIMER_SHORT } from '../src/services/disclosures.js'
import { TERMS_VERSION, PRIVACY_VERSION, LEGAL_STATUS } from '../src/data/legalVersions.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

test('the disclaimer says every required thing', () => {
  const all = DISCLAIMER_POINTS.join(' ')
  for (const re of [/General information only/, /not financial advice/, /objectives, financial situation or needs/, /Past performance is not a reliable indicator/, /AI can make mistakes/, /Verify/]) assert.match(all, re)
})

test('the footer shows all four points in short form, never cut off', () => {
  const short = DISCLAIMER_SHORT.join(' · ')
  for (const re of [/General information only/, /Not personal advice/, /Past performance is not a reliable indicator of future performance/, /AI can make mistakes/]) assert.match(short, re)
  const f = read('src/components/legal/LegalNotices.jsx')
  assert.match(f, /<span data-legal-footer-text className="min-w-0 leading-snug">\{DISCLAIMER_SHORT\.join\(' · '\)\}<\/span>/)
  assert.doesNotMatch(f.slice(f.indexOf('export function LegalFooter')), /truncate (hidden )?md:/)
})

test('first-use acknowledgement: once per device and version, also kept on the account', async () => {
  const storage = mem()
  assert.equal(hasAcknowledged(null, storage), false)
  const saved = []
  const rec = await recordAcknowledgement({ user: { id: 'u' }, updateUserMetadata: async (d) => saved.push(d), storage, now: new Date('2026-11-01T01:00:00Z') })
  assert.deepEqual(rec, { version: DISCLAIMER_VERSION, at: '2026-11-01T01:00:00.000Z' })
  assert.equal(hasAcknowledged(null, storage), true)
  assert.deepEqual(saved, [{ maddex_disclaimer_ack: rec }])
  assert.equal(hasAcknowledged({ user_metadata: { maddex_disclaimer_ack: rec } }, mem()), true)
  assert.equal(hasAcknowledged({ user_metadata: { maddex_disclaimer_ack: { version: 'old' } } }, mem()), false)
  // A failed account write still records on the device.
  const s2 = mem()
  await recordAcknowledgement({ user: { id: 'u' }, updateUserMetadata: async () => { throw new Error('offline') }, storage: s2 })
  assert.equal(hasAcknowledged(null, s2), true)
})

test('terms and privacy acceptance carries version and time', () => {
  const r = acceptanceRecord(new Date('2026-11-01T02:00:00Z'))
  assert.deepEqual(r, { terms: { version: TERMS_VERSION, at: '2026-11-01T02:00:00.000Z' }, privacy: { version: PRIVACY_VERSION, at: '2026-11-01T02:00:00.000Z' } })
  assert.equal(termsAccepted({ user_metadata: { maddex_terms: r } }), true)
  assert.equal(termsAccepted({ user_metadata: {} }), false)
  assert.equal(termsAccepted({ user_metadata: { maddex_terms: { ...r, terms: { version: 'old' } } } }), false)
  assert.equal(LEGAL_STATUS, 'DRAFT, pending legal review')
})

test('sign-up requires the checkbox and stores the acceptance; other accounts are asked at sign-in', () => {
  const modal = read('src/components/auth/AuthModal.jsx')
  assert.match(modal, /if \(!suAgree\) errs\.agree/)
  assert.match(modal, /data-terms-checkbox/)
  assert.doesNotMatch(modal, /By continuing you agree/)
  assert.match(read('src/store/useAuthStore.js'), /maddex_terms: acceptanceRecord\(\)/)
  const app = read('src/App.jsx')
  assert.match(app, /if \(user && !termsAccepted\(user\) && !termsOk\)/)
  assert.match(app, /if \(!user && !isDev\) return <Suspense fallback=\{<AppLoader \/>\}><AuthModal \/><\/Suspense>/) // the sign-in guard is unchanged
  assert.match(app, /<LegalFooter \/>/)
  assert.match(app, /!acknowledged && <DisclaimerAcknowledgement/)
  assert.match(app, /const showWelcome = acknowledged && !onboarding\.welcomed/)
})

test('legal pages are marked draft; nothing claims an ASIC licence or approval', () => {
  assert.match(read('src/pages/LegalPage.jsx'), /data-legal-draft/)
  const files = fs.readdirSync('src', { recursive: true }).filter((f) => /\.(jsx?|md)$/.test(f)).map((f) => `src/${f}`)
  for (const f of files) {
    const s = read(f)
    assert.doesNotMatch(s, /\b(ASIC[- ](licensed|regulated|approved|registered|authorised)|(licensed|regulated|approved|authorised) by ASIC|(?<!(not|never) )holds? an (AFSL|Australian Financial Services Licen[cs]e))\b/i, f)
  }
})
