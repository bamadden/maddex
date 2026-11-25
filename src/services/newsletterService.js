import { getCachedWeeklyReview, reviewWeek } from './weeklyReviewService'

// The Maddex Intelligence Brief — the weekly newsletter.
//
// Sign-up is double opt-in through /api/waitlist (list 'newsletter',
// docs/WAITLIST_API.md; 26 Nov 2026): the endpoint emails a confirmation
// link and writes the row (waitlist, source 'newsletter') only when its owner
// confirms. The browser no longer writes to the table: migration 012 stops
// the public key from creating newsletter rows. The answer is the same
// whether or not the address is already subscribed, so this device only
// knows that a confirmation was sent, never that someone is subscribed.
//
// The newsletter site does not exist yet; NEWSLETTER.url is the placeholder
// the editions will live at.

export const NEWSLETTER = {
  name: 'THE MADDEX INTELLIGENCE BRIEF',
  // No edition has been sent yet; the copy says so rather than promising a day.
  tagline: 'A weekly newsletter for Australian investors. It has not started yet: join the list and the first edition comes to you.',
  url: 'https://maddex.com.au/newsletter',
}

// The words beside the consent box. Must match LISTS.newsletter.consent.text
// in api/_waitlist.js (a test checks): the server records that version.
export const NEWSLETTER_CONSENT = 'Email me The Maddex Intelligence Brief, a weekly newsletter. I can unsubscribe at any time.'

const PENDING_KEY = 'maddex_newsletter_pending'
export const NEWSLETTER_CHANGED_EVENT = 'maddex:newsletter-changed'

export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s ?? '').trim())

// { email, at } when this device asked for a confirmation email, else null.
export function pendingConfirmation(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage.getItem(PENDING_KEY) ?? 'null'); return v?.email ? v : null } catch { return null }
}

// → 'pending' (a confirmation email is on its way), 'invalid', 'consent',
//   'rate_limited', 'unavailable' (not open yet, or unreachable: nothing
//   recorded anywhere, and the UI says so).
export async function subscribeNewsletter(email, consent, { fetchImpl = (...a) => fetch(...a), storage = globalThis.localStorage, now = () => new Date() } = {}) {
  if (!isValidEmail(email)) return 'invalid'
  if (consent !== true) return 'consent'
  const addr = email.trim().toLowerCase()
  let r
  try {
    r = await fetchImpl('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: addr, consent: true, website: '', list: 'newsletter' }),
    })
  } catch { return 'unavailable' }
  if (r.status === 202) {
    try { storage.setItem(PENDING_KEY, JSON.stringify({ email: addr, at: now().toISOString() })) } catch { /* private mode */ }
    try { window.dispatchEvent(new Event(NEWSLETTER_CHANGED_EVENT)) } catch { /* non-browser */ }
    return 'pending'
  }
  if (r.status === 429) return 'rate_limited'
  if (r.status === 400) {
    const body = await r.json().catch(() => ({}))
    return body.error === 'invalid_email' ? 'invalid' : body.error === 'consent_required' ? 'consent' : 'unavailable'
  }
  return 'unavailable'
}

// The latest edition is the week the weekly review covers: Monday to Friday,
// dated by its Friday. The preview is the opening of that review's WEEK IN
// REVIEW section when this device has generated it — not a stand-in
// paragraph. Without one, `preview` is null and the card says the review
// generates after the Friday close.
export function latestEdition(now = new Date()) {
  const week = reviewWeek(now)
  const review = getCachedWeeklyReview(week.key)
  const body = review?.sections?.find((s) => /week in review/i.test(s.title))?.content ?? review?.headline ?? ''
  const sentences = String(body).match(/[^.!?]+[.!?]+(\s|$)/g) ?? []
  const [y, m, d] = week.friday.split('-').map(Number)
  const friday = new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase()
  return {
    title: `WEEK IN MARKETS — ${friday}`,
    weekKey: week.key,
    preview: sentences.length ? sentences.slice(0, 2).join('').trim() : null,
    url: NEWSLETTER.url,
  }
}
