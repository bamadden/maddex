// Portfolio: this device and the account (16 Nov 2026).
//
// The holdings a reader works with live in this browser (madden_portfolio_v2).
// The account copy (Supabase `portfolio_holdings`) changes only when the
// reader confirms a change in the Portfolio's sync bar. Before this, every add
// and import wrote to the account without a user_id (the column is required
// and RLS checks it), so every write failed in silence, and opening the module
// signed in replaced the device's holdings with the account's.

// A holding is the same holding on both sides when symbol, units, average
// cost, currency and date added all match (one row per lot).
const keyOf = (h) => [String(h.symbol).toUpperCase(), Number(h.shares), Number(h.avgCost), h.costCurrency ?? 'AUD', String(h.addedAt ?? '').slice(0, 10)].join('|')

export function compareHoldings(device, account) {
  const a = new Map(account.map((h) => [keyOf(h), h]))
  const d = new Map(device.map((h) => [keyOf(h), h]))
  const onlyDevice = device.filter((h) => !a.has(keyOf(h)))
  const onlyAccount = account.filter((h) => !d.has(keyOf(h)))
  return { onlyDevice, onlyAccount, same: onlyDevice.length === 0 && onlyAccount.length === 0 }
}

const fromRow = (r) => ({
  id: r.id, symbol: r.symbol, name: r.name || r.symbol, shares: parseFloat(r.shares), avgCost: parseFloat(r.avg_buy_price),
  costCurrency: r.currency || 'AUD', addedAt: r.added_at?.slice(0, 10) ?? null, accountRow: true,
})

// The account's holdings, oldest first. Read only.
export async function readAccountHoldings(client, userId) {
  const { data, error } = await client.from('portfolio_holdings').select('*').eq('user_id', userId).order('added_at')
  if (error) throw new Error('account unavailable')
  return (data ?? []).map(fromRow)
}

// Adds holdings to the account. Never changes or removes what is there.
export async function addHoldingsToAccount(client, userId, holdings) {
  if (!holdings.length) return 0
  const rows = holdings.map((h) => ({
    user_id: userId, symbol: h.symbol, name: h.name ?? h.symbol, shares: h.shares, avg_buy_price: h.avgCost,
    currency: h.costCurrency ?? 'AUD', ...(h.addedAt ? { added_at: h.addedAt } : {}),
  }))
  const { error } = await client.from('portfolio_holdings').insert(rows)
  if (error) throw new Error('save failed')
  return rows.length
}

// Removes the named account rows only (never anything on this device).
export async function removeHoldingsFromAccount(client, userId, holdings) {
  const ids = holdings.map((h) => h.id).filter(Boolean)
  if (!ids.length) return 0
  const { error } = await client.from('portfolio_holdings').delete().eq('user_id', userId).in('id', ids)
  if (error) throw new Error('remove failed')
  return ids.length
}
