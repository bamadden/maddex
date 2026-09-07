// Price-alert email delivery.
//
// THE RECIPIENT IS NOT TAKEN FROM THE REQUEST BODY.
//
// The obvious shape for this endpoint accepts { email, symbol, ... } and sends
// to whatever address arrived. That is an open relay: anyone who can reach this
// URL — it is public, there is no origin check that matters — can send
// Maddex-branded email to any address they like, from our verified domain,
// until the domain's reputation is gone. It is the kind of thing that is found
// by a spammer long before it is found by a review.
//
// So the caller sends its Supabase access token, this verifies it against
// Supabase's own /auth/v1/user endpoint, and the email goes to the address on
// the verified user. A caller cannot choose the recipient because the recipient
// is never read from input.
//
// Everything interpolated into the HTML is escaped. A ticker arrives from
// client state and ends up inside markup in someone's inbox; that is an
// injection sink like any other.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c])

// A ticker, a direction and a price. Anything else is not an alert.
const cleanSymbol = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9.^-]/g, '').slice(0, 12)
const cleanNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : null
}

// One address, one alert per minute. A runaway alert loop on the client should
// cost the user one email, not a hundred and a blocked sending domain.
const lastSent = new Map()
const RATE_MS = 60_000
function rateLimited(key, now = Date.now()) {
  const prev = lastSent.get(key)
  if (prev && now - prev < RATE_MS) return true
  lastSent.set(key, now)
  if (lastSent.size > 500) {
    for (const [k, t] of lastSent) if (now - t > RATE_MS) lastSent.delete(k)
  }
  return false
}

async function verifiedEmail(token) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anon || !token) return null
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    if (!r.ok) return null
    const user = await r.json()
    return typeof user?.email === 'string' && user.email.includes('@') ? user.email : null
  } catch {
    return null
  }
}

function renderEmail({ symbol, direction, value, currentPrice }) {
  return `
    <div style="font-family:'IBM Plex Mono',Menlo,Consolas,monospace;background:#060D1A;color:#E8EDF5;padding:24px;max-width:480px;">
      <div style="color:#C9A84C;font-size:20px;font-weight:bold;margin-bottom:16px;letter-spacing:0.08em;">
        &#9889; MADDEX PRICE ALERT
      </div>
      <div style="font-size:14px;margin-bottom:8px;color:#8BA3C4;">
        ${esc(symbol)} is ${esc(direction)} your alert level
      </div>
      <div style="font-size:28px;color:#ffffff;font-weight:bold;margin-bottom:4px;">
        A$${esc(currentPrice)}
      </div>
      <div style="color:#637899;font-size:12px;margin-bottom:24px;">
        Alert set at A$${esc(value)} (${esc(direction)})
      </div>
      <div style="border-top:1px solid rgba(201,168,76,0.2);padding-top:16px;font-size:11px;color:#4A6080;line-height:1.6;">
        General information only. Not financial advice.<br>
        Equity prices in Maddex are currently demonstration data.<br>
        Manage alerts at maddex.com.au
      </div>
    </div>
  `
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const key = process.env.RESEND_API_KEY
  // 503, not 500: the endpoint is fine, the deployment has not been given a
  // key. The client treats both as "no email today" and says so in Settings.
  if (!key) return res.status(503).json({ error: 'Email delivery not configured' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')

  const email = await verifiedEmail(token)
  if (!email) return res.status(401).json({ error: 'Sign-in required' })

  const symbol = cleanSymbol(body.symbol)
  const value = cleanNumber(body.value)
  const currentPrice = cleanNumber(body.currentPrice)
  const direction = body.direction === 'below' ? 'below' : 'above'
  if (!symbol || value == null || currentPrice == null) {
    return res.status(400).json({ error: 'symbol, value and currentPrice are required' })
  }

  if (rateLimited(`${email}:${symbol}`)) return res.status(429).json({ error: 'Rate limited' })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Maddex Alerts <alerts@maddex.com.au>',
        to: [email],
        subject: `Price alert: ${symbol} ${direction} A$${value}`,
        html: renderEmail({ symbol, direction, value, currentPrice }),
      }),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      console.warn('[alert-email] Resend rejected:', r.status, detail.slice(0, 200))
      return res.status(502).json({ error: 'Delivery provider rejected the message' })
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    console.warn('[alert-email] send failed:', err?.message)
    return res.status(502).json({ error: 'Delivery failed' })
  }
}
