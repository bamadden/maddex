import { supabase } from '../lib/supabase'

// Client half of price-alert email delivery.
//
// Sends the Supabase access token rather than an address. The server derives
// the recipient from the verified session, so this cannot be used to mail
// anyone but the signed-in user — see api/alert-email.js for why that matters.

const KEY = 'maddex_email_alerts'

export function emailAlertsEnabled() {
  try { return localStorage.getItem(KEY) === 'on' } catch { return false }
}

export function setEmailAlertsEnabled(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* quota */ }
  return on
}

// Fire-and-forget. A price alert has ALREADY been delivered in-app by the time
// this runs — the toast fired, the bell updated, the sound played. Email is a
// second copy for someone who is not looking at the tab, so a failure here must
// never surface as an error over a notification that already worked.
export async function sendAlertEmail({ symbol, direction, value, currentPrice }) {
  if (!emailAlertsEnabled()) return { sent: false, reason: 'disabled' }
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return { sent: false, reason: 'signed-out' }

    const r = await fetch('/api/alert-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ symbol, direction, value, currentPrice }),
    })
    if (r.ok) return { sent: true }
    // 503 means the deployment has no RESEND_API_KEY. That is a deployment
    // state, not a user error, and Settings reads it to explain itself.
    return { sent: false, reason: r.status === 503 ? 'not-configured' : `http-${r.status}` }
  } catch {
    return { sent: false, reason: 'network' }
  }
}
