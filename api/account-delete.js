// Deletes the signed-in user's account: every row stored against them, their
// waitlist entries, and the login itself. The browser deletes what row-level
// security lets it first (services/accountData.deleteMyAccount); this removes
// the rest, which needs the service-role key and so can only happen here.
//
// Env (server-only, never VITE_): SUPABASE_URL, SUPABASE_ANON_KEY (to verify
// the caller's token), SUPABASE_SERVICE_KEY (to delete — the same name the
// AI guard uses). Without the
// service key it answers 503 and deletes nothing more; the UI then tells the
// user their data is gone and the login will be removed on request.

const TABLES = [
  ['ai_records', 'user_id'], ['ai_usage', 'user_id'], ['shared_links', 'user_id'], ['ai_notes', 'user_id'],
  ['price_alerts', 'user_id'], ['portfolio_holdings', 'user_id'], ['watchlist', 'user_id'],
  ['user_settings', 'user_id'], ['profiles', 'id'],
]

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_KEY
  if (!url || !anon) return res.status(503).json({ error: 'not configured' })

  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'sign in required' })
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } })
  if (!who.ok) return res.status(401).json({ error: 'invalid session' })
  const user = await who.json()

  if (!service) return res.status(503).json({ error: 'deletion of the login is not configured' })
  const admin = { apikey: service, authorization: `Bearer ${service}` }
  for (const [t, col] of TABLES) {
    await fetch(`${url}/rest/v1/${t}?${col}=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE', headers: admin }).catch(() => {})
  }
  if (user.email) await fetch(`${url}/rest/v1/waitlist?email=eq.${encodeURIComponent(user.email.toLowerCase())}`, { method: 'DELETE', headers: admin }).catch(() => {})
  const del = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers: admin })
  if (!del.ok) return res.status(502).json({ error: 'could not delete the login' })
  // No user identifiers in the log: only that a deletion happened.
  console.log('[account-delete] account deleted')
  return res.status(200).json({ ok: true })
}
