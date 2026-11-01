// A user's own data: everything Maddex holds about them, to download, and a
// deletion that removes all of it (legal-risk pass, item 7; Privacy Policy
// "Access, correction and deletion").
//
//   exportMyData()  → one JSON file: the account (email, name, consents and
//                     onboarding records from auth metadata), every row the
//                     user owns in Supabase, and the Maddex data kept in this
//                     browser. Available on every plan.
//   deleteMyAccount() → deletes every row the user can delete, asks the server
//                     (api/account-delete.js) to remove the login itself and
//                     the rows a user cannot delete (AI usage, AI records,
//                     waitlist entries), then clears this browser's Maddex data.

import { supabase } from '../lib/supabase'

// Tables a user owns, and the column that names the owner.
export const OWN_TABLES = [
  ['profiles', 'id'], ['user_settings', 'user_id'], ['watchlist', 'user_id'], ['portfolio_holdings', 'user_id'],
  ['price_alerts', 'user_id'], ['ai_notes', 'user_id'], ['shared_links', 'user_id'], ['ai_usage', 'user_id'], ['ai_records', 'user_id'],
]
// Deletable by the user under row-level security; the rest go through the server.
const USER_DELETABLE = ['watchlist', 'portfolio_holdings', 'price_alerts', 'ai_notes', 'shared_links', 'user_settings', 'profiles']

export const LOCAL_PREFIXES = ['maddex_', 'madden_']

export function localData(storage = globalThis.localStorage) {
  const out = {}
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (!LOCAL_PREFIXES.some((p) => k.startsWith(p))) continue
      const v = storage.getItem(k)
      try { out[k] = JSON.parse(v) } catch { out[k] = v }
    }
  } catch { /* storage blocked */ }
  return out
}

export function clearLocalData(storage = globalThis.localStorage) {
  try {
    const keys = []
    for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (LOCAL_PREFIXES.some((p) => k.startsWith(p))) keys.push(k) }
    for (const k of keys) storage.removeItem(k)
    return keys.length
  } catch { return 0 }
}

export async function collectMyData(user, { client = supabase, storage = globalThis.localStorage, now = new Date() } = {}) {
  const tables = {}
  if (user) {
    await Promise.all(OWN_TABLES.map(async ([t, col]) => {
      try {
        const { data, error } = await client.from(t).select('*').eq(col, user.id)
        tables[t] = error ? { unavailable: error.message } : data
      } catch (e) { tables[t] = { unavailable: e.message } }
    }))
  }
  return {
    exported_at: now.toISOString(),
    account: user ? { id: user.id, email: user.email, created_at: user.created_at, metadata: user.user_metadata ?? {} } : null,
    tables,
    this_browser: localData(storage),
    note: 'Everything Maddex holds about you: your account, the rows stored against it, and the Maddex data kept in this browser. MaddenAI prompts are not stored by Maddex; see the Privacy Policy.',
  }
}

export async function exportMyData(user) {
  const data = await collectMyData(user)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `maddex-my-data-${new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })}.json`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return data
}

// → { rows: deleted-by-client count, login: 'deleted' | 'pending', local: n }
// 'pending' means the server could not remove the login (no service key
// configured): the data is gone, and the UI says the login will be removed
// by request.
export async function deleteMyAccount(user, { client = supabase, storage = globalThis.localStorage, fetchImpl = globalThis.fetch } = {}) {
  if (!user) throw new Error('Not signed in')
  let rows = 0
  for (const t of USER_DELETABLE) {
    const col = OWN_TABLES.find(([n]) => n === t)[1]
    try { const { error } = await client.from(t).delete().eq(col, user.id); if (!error) rows++ } catch { /* the server pass covers it */ }
  }
  let login = 'pending'
  try {
    const token = (await client.auth.getSession()).data?.session?.access_token
    const r = await fetchImpl('/api/account-delete', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} })
    if (r.ok) login = 'deleted'
  } catch { /* stays pending */ }
  const local = clearLocalData(storage)
  try { await client.auth.signOut() } catch { /* already gone */ }
  return { rows, login, local }
}
