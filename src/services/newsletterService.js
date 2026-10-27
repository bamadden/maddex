import { supabase } from '../lib/supabase'
import { getCachedWeeklyReview, reviewWeek } from './weeklyReviewService'

// The Maddex Intelligence Brief — the weekly newsletter.
//
// Subscribers go into the same Supabase `waitlist` table as the payments
// waitlist, with source 'newsletter' (unique per email and source — see
// supabase/migrations/006_newsletter.sql). The table is insert-only from the
// client, so "already subscribed" is known two ways: this device remembers
// the address, or the insert comes back as a duplicate.
//
// The newsletter site does not exist yet; NEWSLETTER.url is the placeholder
// the editions will live at.

export const NEWSLETTER = {
  name: 'THE MADDEX INTELLIGENCE BRIEF',
  tagline: 'Weekly market intelligence for Australian investors. Delivered every Friday.',
  url: 'https://maddex.com.au/newsletter',
}

const SUBSCRIBED_KEY = 'maddex_newsletter_email'
export const NEWSLETTER_CHANGED_EVENT = 'maddex:newsletter-changed'

export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s ?? '').trim())

export function subscribedEmail() {
  try { return localStorage.getItem(SUBSCRIBED_KEY) } catch { return null }
}

// → 'subscribed' (server has it), 'already' (server already had it),
//   'local' (server unreachable — not recorded anywhere, and the UI says
//   so), 'invalid'.
export async function subscribeNewsletter(email) {
  if (!isValidEmail(email)) return 'invalid'
  const addr = email.trim().toLowerCase()
  let result = 'local'
  try {
    const { error } = await supabase.from('waitlist').insert({ email: addr, source: 'newsletter' })
    result = !error ? 'subscribed' : /duplicate|unique/i.test(error.message ?? '') ? 'already' : 'local'
  } catch { /* offline or no client */ }
  // Remembered only once the server has the address — a device-only copy
  // would show "You're subscribed" to someone nobody can email.
  if (result !== 'local') {
    try { localStorage.setItem(SUBSCRIBED_KEY, addr) } catch { /* private mode */ }
    try { window.dispatchEvent(new Event(NEWSLETTER_CHANGED_EVENT)) } catch { /* non-browser */ }
  }
  return result
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
