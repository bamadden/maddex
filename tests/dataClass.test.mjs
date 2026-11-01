// The one data-class vocabulary — LIVE, DELAYED, DEMO, STALE — and STALE
// wired to the cached-data fallback. No network: feeds are stubbed.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DATA_CLASSES, CLASS_ORDER, classifyData, classOfResult, classOfLiveSource, badgeText } from '../src/utils/dataClass.js'

// A minimal localStorage for the cache paths.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}
beforeEach(() => store.clear())

test('exactly four classes, each with a meaning', () => {
  assert.deepEqual(CLASS_ORDER, ['LIVE', 'DELAYED', 'DEMO', 'STALE'])
  for (const c of CLASS_ORDER) assert.ok(DATA_CLASSES[c].meaning.length > 30, c)
})

test('each state classifies, with DEMO over STALE over DELAYED over LIVE', () => {
  assert.equal(classifyData(), 'LIVE')
  assert.equal(classifyData({ delayed: true }), 'DELAYED')
  assert.equal(classifyData({ stale: true, delayed: true }), 'STALE')
  assert.equal(classifyData({ demo: true, stale: true }), 'DEMO')
  assert.equal(classOfResult({ stale: true, cachedAt: 1 }), 'STALE')
  assert.equal(classOfResult({ stale: false }), 'LIVE')
  assert.equal(classOfResult({ stale: false }, { demo: true }), 'DEMO')
  assert.equal(classOfLiveSource('live'), 'LIVE')
  assert.equal(classOfLiveSource('cache'), 'LIVE') // within its refresh window
  assert.equal(classOfLiveSource('stale'), 'STALE')
})

test('the badge reads class · source · time (Sydney, with zone) or date', () => {
  const at = Date.now()
  assert.match(badgeText({ cls: 'STALE', source: 'CoinGecko', at }), /^STALE · CoinGecko · \d\d:\d\d AE[DS]T$/)
  assert.match(badgeText({ cls: 'LIVE', source: 'Binance', at: Date.parse('2026-10-30T02:00:00Z') }), /^LIVE · Binance · 30 Oct 13:00 AEDT$/)
  assert.equal(badgeText({ cls: 'DELAYED', source: 'ABS', at: '2026-10-28' }), 'DELAYED · ABS · 28 Oct 2026')
  assert.equal(badgeText({ cls: 'DEMO', source: 'demo data' }), 'DEMO · demo data')
})

test('a failed crypto feed serves the cached copy, flagged STALE with its time', async () => {
  const { loadCryptoMarkets } = await import('../src/services/dataService.js')
  const down = async () => { throw new Error('down') }
  const ok = await loadCryptoMarkets('aud', { coingecko: async (c) => ({ data: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 110_000 }], currency: c }) })
  assert.equal(classOfResult(ok), 'LIVE')
  const cached = await loadCryptoMarkets('aud', { coingecko: down, binance: down })
  assert.equal(cached.stale, true)
  assert.equal(classOfResult(cached), 'STALE')
  assert.ok(cached.cachedAt > 0)
  assert.equal(cached.data[0].current_price, 110_000)
  assert.equal(cached.meta.currency, 'AUD') // the cached copy keeps its currency
})

test('a failed live feed (liveDataService) serves the cached copy, flagged STALE', async () => {
  const { liveDataService } = await import('../src/services/liveDataService.js')
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: 'success', rates: { USD: 0.7 }, time_last_update_unix: 1 }) })
  try {
    const live = await liveDataService.getFXRates()
    assert.equal(classOfLiveSource(live.source), 'LIVE')
    // Expire the cache, then fail the feed.
    const k = 'maddex_live_fx_rates'
    store.set(k, JSON.stringify({ ...JSON.parse(store.get(k)), timestamp: 0 }))
    globalThis.fetch = async () => { throw new Error('offline') }
    const stale = await liveDataService.getFXRates()
    assert.equal(stale.source, 'stale')
    assert.equal(classOfLiveSource(stale.source), 'STALE')
    assert.equal(stale.data.AUDUSD, 0.7)
  } finally { globalThis.fetch = realFetch }
})

test('no screen uses the retired wordings for a data class', () => {
  const files = fs.readdirSync('src', { recursive: true }).filter((f) => /\.jsx$/.test(f))
  for (const f of files) {
    const src = fs.readFileSync(`src/${f}`, 'utf8')
    assert.doesNotMatch(src, /['>]CACHED['<]|LIVE DEMO|● DELAYED/, f)
  }
  assert.match(fs.readFileSync('src/components/ui/ModuleStates.jsx', 'utf8'), /cls="STALE"/)
})
