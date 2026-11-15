// Watchlist: device and account copies (15 Nov 2026). The account changes
// only through a confirmed action in WatchlistSyncBar, writes carry the
// user's id, and saving only adds.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { compareLists, readAccountWatchlist, addToAccount, removeFromAccount } from '../src/services/watchlistSync.js'

// A recording stand-in for the Supabase client's query builder.
function fakeClient(rows = []) {
  const calls = []
  const builder = (table) => {
    const q = { table, ops: [] }
    const chain = {
      select: (c) => { q.ops.push(['select', c]); return chain },
      eq: (k, v) => { q.ops.push(['eq', k, v]); return chain },
      in: (k, v) => { q.ops.push(['in', k, v]); return chain },
      order: (k) => { q.ops.push(['order', k]); calls.push(q); return Promise.resolve({ data: rows, error: null }) },
      upsert: (r, o) => { q.ops.push(['upsert', r, o]); calls.push(q); return Promise.resolve({ error: null }) },
      delete: () => { q.ops.push(['delete']); calls.push(q); return chain },
      then: (f) => Promise.resolve({ error: null }).then(f),
    }
    return chain
  }
  return { from: builder, calls }
}

test('compare: what is only on this device and only in the account', () => {
  assert.deepEqual(compareLists(['BHP', 'cba', 'AAPL'], ['CBA', 'CSL']), { onlyDevice: ['BHP', 'AAPL'], onlyAccount: ['CSL'], same: false })
  assert.equal(compareLists(['A', 'B'], ['b', 'a']).same, true)
})

test('reading the account filters by the user and writes nothing', async () => {
  const c = fakeClient([{ symbol: 'CBA', position: 0 }])
  assert.deepEqual(await readAccountWatchlist(c, 'u1'), ['CBA'])
  assert.deepEqual(c.calls[0].ops.map((o) => o[0]), ['select', 'eq', 'order'])
  assert.deepEqual(c.calls[0].ops[1], ['eq', 'user_id', 'u1'])
})

test('saving to the account adds only, with the user id, after the existing rows', async () => {
  const c = fakeClient()
  await addToAccount(c, 'u1', ['BHP', 'AAPL'], 3)
  const [, rows, opts] = c.calls[0].ops.find((o) => o[0] === 'upsert')
  assert.deepEqual(rows, [{ user_id: 'u1', symbol: 'BHP', name: 'BHP', position: 3 }, { user_id: 'u1', symbol: 'AAPL', name: 'AAPL', position: 4 }])
  assert.deepEqual(opts, { onConflict: 'user_id,symbol', ignoreDuplicates: true })
  assert.ok(!c.calls.some((q) => q.ops.some((o) => o[0] === 'delete')))
})

test('removing from the account names the user and the symbols', async () => {
  const c = fakeClient()
  await removeFromAccount(c, 'u1', ['CSL'])
  assert.deepEqual(c.calls[0].ops, [['delete'], ['eq', 'user_id', 'u1'], ['in', 'symbol', ['CSL']]])
})

test('the module never writes to the account itself; every change goes through a confirmation', () => {
  const mod = fs.readFileSync('src/modules/watchlist/WatchlistModule.jsx', 'utf8')
  assert.doesNotMatch(mod, /supabase\.from\('watchlist'\)/)
  assert.doesNotMatch(mod, /clearWatchlist\(\)\s*\n\s*data\.forEach/)
  assert.match(mod, /<WatchlistSyncBar user=\{user\} watchlist=\{watchlist\} addToWatchlist=\{addToWatchlist\} \/>/)
  const bar = fs.readFileSync('src/modules/watchlist/WatchlistSyncBar.jsx', 'utf8')
  assert.match(bar, /Saved on this device only/)
  // Writes happen only in confirm(), which only the CONFIRM button calls.
  const body = bar.slice(bar.indexOf('const confirm = async'), bar.indexOf('if (pending) {'))
  assert.match(body, /addToAccount|removeFromAccount/)
  const rest = bar.replace(body, '')
  assert.doesNotMatch(rest, /addToAccount\(|removeFromAccount\(|addToWatchlist\(/)
  assert.match(bar, /onClick=\{confirm\}/)
  assert.doesNotMatch(bar, /window\.confirm/)
})
