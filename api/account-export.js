// The rows held about the signed-in user that row-level security does not let
// them read themselves: the payments waitlist and newsletter entries (one
// table, told apart by `source`), matched on the account's email. The browser
// exports every other table directly (services/accountData.collectMyData);
// this fills the one gap, so "Export my data" covers every table that holds
// something about the user (16 Nov 2026).
//
// Read-only. Env (server-only, never VITE_): SUPABASE_URL, SUPABASE_ANON_KEY
// (to verify the caller), SUPABASE_SERVICE_KEY (to read). Without the service
// key it answers 503 and the export says this part could not be read.

export const SERVER_EXPORT_TABLES = [['waitlist', 'email']]

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
  if (!service) return res.status(503).json({ error: 'not configured' })

  const admin = { apikey: service, authorization: `Bearer ${service}` }
  const out = {}
  for (const [t, col] of SERVER_EXPORT_TABLES) {
    const value = col === 'email' ? String(user.email ?? '').toLowerCase() : user.id
    if (!value) { out[t] = []; continue }
    const r = await fetch(`${url}/rest/v1/${t}?${col}=eq.${encodeURIComponent(value)}&select=*`, { headers: admin }).catch(() => null)
    out[t] = r?.ok ? await r.json() : { unavailable: 'could not be read just now' }
  }
  return res.status(200).json({ tables: out })
}
