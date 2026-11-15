// Portfolio, device and account (Phase C, 16 Nov 2026): no account change
// without the reader's confirmation; writes carry the user's id.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { compareHoldings, addHoldingsToAccount, removeHoldingsFromAccount, readAccountHoldings } from '../src/services/portfolioSync.js'

const H = (symbol, shares, avgCost, addedAt = '2026-11-01') => ({ symbol, shares, avgCost, costCurrency: 'AUD', addedAt })

test('compare: lots match on symbol, units, cost, currency and date', () => {
  const r = compareHoldings([H('BHP', 10, 40), H('CBA', 5, 120)], [H('BHP', 10, 40), H('BHP', 10, 41)])
  assert.deepEqual(r.onlyDevice.map((h) => h.symbol), ['CBA'])
  assert.deepEqual(r.onlyAccount.map((h) => h.avgCost), [41])
  assert.equal(r.same, false)
  assert.equal(compareHoldings([H('BHP', 10, 40)], [H('bhp', 10, 40)]).same, true)
})

test('writes carry the user id and touch only the named rows', async () => {
  const calls = []
  const client = { from: (t) => ({
    insert: async (rows) => { calls.push(['insert', t, rows]); return { error: null } },
    delete: () => ({ eq: (c, v) => ({ in: async (c2, ids) => { calls.push(['delete', t, c, v, ids]); return { error: null } } }) }),
    select: () => ({ eq: (c, v) => ({ order: async () => { calls.push(['select', t, c, v]); return { data: [{ id: 'r1', symbol: 'BHP', shares: '10', avg_buy_price: '40', currency: 'AUD', added_at: '2026-11-01T00:00:00Z' }], error: null } } }) }),
  }) }
  await addHoldingsToAccount(client, 'u1', [H('BHP', 10, 40)])
  assert.equal(calls[0][2][0].user_id, 'u1')
  await removeHoldingsFromAccount(client, 'u1', [{ id: 'r1' }])
  assert.deepEqual(calls[1], ['delete', 'portfolio_holdings', 'user_id', 'u1', ['r1']])
  const rows = await readAccountHoldings(client, 'u1')
  assert.deepEqual(calls[2], ['select', 'portfolio_holdings', 'user_id', 'u1'])
  assert.equal(rows[0].addedAt, '2026-11-01')
})

test('the Portfolio module writes nothing to the account itself; Settings clears say what they clear', () => {
  const mod = fs.readFileSync('src/modules/portfolio/PortfolioModule.jsx', 'utf8')
  assert.doesNotMatch(mod, /supabase\.from\('portfolio_holdings'\)/)
  assert.match(mod, /<PortfolioSyncBar user=\{user\} holdings=\{holdings\} onLoad=\{loadFromAccount\} \/>/)
  const bar = fs.readFileSync('src/modules/portfolio/PortfolioSyncBar.jsx', 'utf8')
  assert.match(bar, /Saved on this device only\./)
  assert.match(bar, /role="alertdialog"/)
  const set = fs.readFileSync('src/components/settings/SettingsPanel.jsx', 'utf8')
  assert.doesNotMatch(set, /neq\('id', '00000000/)
  assert.match(set, /Removes every holding on this device/)
})

test('every list kept only in this browser says so, in the one shared sentence', () => {
  const where = {
    'src/modules/screener/ScreenerModule.jsx': 'saved screens',
    'src/components/layout/AIPanel.jsx': 'saved notes',
    'src/modules/portfolio/Transactions.jsx': 'transactions',
    'src/components/researchNote/SavedResearch.jsx': 'saved research',
    'src/modules/news/NewsModule.jsx': 'saved stories',
    'src/modules/alerts/AlertsModule.jsx': 'alerts',
    'src/components/settings/SettingsPanel.jsx': 'workspaces',
  }
  for (const [f, what] of Object.entries(where)) assert.match(fs.readFileSync(f, 'utf8'), new RegExp(`<DeviceOnlyNote what="${what}"`), f)
  assert.match(fs.readFileSync('src/modules/watchlist/WatchlistSyncBar.jsx', 'utf8'), /Saved on this device only\./)
})
