// Watchlist: this device and the account (15 Nov 2026).
//
// The list a reader works with lives in this browser (useStore, localStorage).
// The account copy (Supabase `watchlist`) changes only when the reader
// confirms a change in the Watchlist's sync bar; nothing here runs on its own.
// Before this, every add mirrored itself to the account without a user_id
// (the column is required and RLS checks it), so every write failed in
// silence, and opening the module replaced the device list with the account's
// whenever the account had rows.

// The two lists side by side: what is only here, what is only in the account.
export function compareLists(device, account) {
  const d = new Set(device.map((s) => s.toUpperCase()))
  const a = new Set(account.map((s) => s.toUpperCase()))
  return {
    onlyDevice: [...d].filter((s) => !a.has(s)),
    onlyAccount: [...a].filter((s) => !d.has(s)),
    same: d.size === a.size && [...d].every((s) => a.has(s)),
  }
}

// The account's symbols, in their saved order. Read only.
export async function readAccountWatchlist(client, userId) {
  const { data, error } = await client.from('watchlist').select('symbol, position').eq('user_id', userId).order('position')
  if (error) throw new Error('account unavailable')
  return (data ?? []).map((r) => r.symbol)
}

// Adds symbols to the account after its existing ones. Never removes or
// reorders anything already there (an existing symbol is left as it is).
export async function addToAccount(client, userId, symbols, startAt = 0) {
  if (!symbols.length) return 0
  const rows = symbols.map((symbol, i) => ({ user_id: userId, symbol, name: symbol, position: startAt + i }))
  const { error } = await client.from('watchlist').upsert(rows, { onConflict: 'user_id,symbol', ignoreDuplicates: true })
  if (error) throw new Error('save failed')
  return rows.length
}

// Removes the named symbols from the account only (never from this device).
export async function removeFromAccount(client, userId, symbols) {
  if (!symbols.length) return 0
  const { error } = await client.from('watchlist').delete().eq('user_id', userId).in('symbol', symbols)
  if (error) throw new Error('remove failed')
  return symbols.length
}
