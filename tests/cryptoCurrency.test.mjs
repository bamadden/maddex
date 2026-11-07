// Crypto prices carry their real currency. A US$ price is converted at a
// dated AUD/USD rate (shown) or labelled US$ — never shown as A$ unconverted.
// Every view reads one shared snapshot. No network: every source is stubbed.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadCryptoMarkets, fetchCryptoMarketsUnified, _resetCryptoSnapshots, usdConversion } from '../src/services/dataService.js'
import { transformCryptoMarkets } from '../src/services/api.js'
import { formatCryptoPrice, describeCryptoSource, pricePrefix } from '../src/utils/cryptoSource.js'

const usdRows = () => [
  { id: 'bitcoin', symbol: 'btc', name: 'bitcoin', currency: 'USD', current_price: 77_772.66, price_change_percentage_24h: 0.44, high_24h: 78_000, low_24h: 76_500, total_volume: 1_000_000, market_cap: null },
  { id: 'ethereum', symbol: 'eth', name: 'ethereum', currency: 'USD', current_price: 2_269.88, price_change_percentage_24h: 1.05, high_24h: null, low_24h: null, total_volume: null, market_cap: null },
]
const rates = (usd, date = '2026-10-30') => Object.defineProperty({ USD: usd, EUR: 0.6 }, 'asOf', { value: date, enumerable: false })
const coingeckoDown = async () => { throw new Error('HTTP 429') }
const fxOk = async () => ({ data: rates(0.7), stale: false, source: 'primary' })
const fxDown = async () => { throw new Error('Frankfurter down') }

test('the US$ fallback is converted to A$ at the AUD/USD rate, with the rate, its date and fetch time recorded', async () => {
  const r = await loadCryptoMarkets('aud', { coingecko: coingeckoDown, binance: async () => usdRows(), fxFetch: fxOk })
  assert.equal(r.meta.provider, 'Binance')
  assert.equal(r.meta.currency, 'AUD')
  assert.equal(r.data[0].currency, 'AUD')
  assert.equal(Math.round(r.data[0].current_price), Math.round(77_772.66 / 0.7)) // A$111,104, not A$77,772
  assert.equal(r.data[0].price_change_percentage_24h, 0.44) // a percentage is the same in either currency
  assert.equal(r.meta.fx.rate, 0.7)
  assert.equal(r.meta.fx.pair, 'AUD/USD')
  assert.equal(r.meta.fx.date, '2026-10-30')
  assert.ok(r.meta.fx.fetchedAt > 0)
  const coins = transformCryptoMarkets(r.data, 'aud')
  assert.equal(coins[0].currency, 'AUD')
  assert.match(formatCryptoPrice(coins[0].price, coins[0].currency), /^A\$111,10\d\.\d\d$/)
  const src = describeCryptoSource(r, 'AUD')
  assert.match(src.text, /^Binance · US\$ prices converted at AUD\/USD 0\.7000 \(30 Oct 2026 reference rate\), fetched \d\d:\d\d AE[DS]T$/)
  assert.equal(src.mismatch, false)
})

test('with no AUD/USD rate the fallback stays in US$ and is labelled US$', async () => {
  const r = await loadCryptoMarkets('aud', { coingecko: coingeckoDown, binance: async () => usdRows(), fxFetch: fxDown })
  assert.equal(r.meta.currency, 'USD')
  assert.equal(r.meta.fx, null)
  assert.equal(r.data[0].current_price, 77_772.66)
  const coins = transformCryptoMarkets(r.data, 'aud') // asked for AUD …
  assert.equal(coins[0].currency, 'USD')                // … but the row says what it is
  assert.equal(formatCryptoPrice(coins[0].price, coins[0].currency), 'US$77,772.66')
  const src = describeCryptoSource(r, 'AUD')
  assert.equal(src.mismatch, true)
  assert.match(src.text, /prices in USD · no AUD conversion available/)
})

test('CoinGecko quotes in the currency asked for, labelled as such', async () => {
  const cg = async (ccy) => ({ data: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 111_000, price_change_percentage_24h: 0.4 }], currency: ccy })
  const r = await loadCryptoMarkets('aud', { coingecko: cg, binance: async () => assert.fail('fallback not needed') })
  assert.equal(r.meta.provider, 'CoinGecko')
  assert.equal(r.meta.currency, 'AUD')
  assert.equal(transformCryptoMarkets(r.data, 'aud')[0].currency, 'AUD')
})

test('asking for US$ never converts', async () => {
  const r = await loadCryptoMarkets('usd', { coingecko: coingeckoDown, binance: async () => usdRows(), fxFetch: async () => assert.fail('no rate needed') })
  assert.equal(r.meta.currency, 'USD')
  assert.equal(r.data[0].current_price, 77_772.66)
})

test('a cross rate goes through AUD (EUR per US$ = EUR per A$ ÷ US$ per A$)', async () => {
  const c = await usdConversion('eur', { fxFetch: fxOk })
  assert.ok(Math.abs(c.usdTo - 0.6 / 0.7) < 1e-12)
  assert.equal(await usdConversion('usd', { fxFetch: fxOk }), null)
  assert.equal(await usdConversion('aud', { fxFetch: fxDown }), null)
})

test('every view gets the same snapshot: one fetch, one price per asset', async () => {
  _resetCryptoSnapshots()
  let calls = 0
  const deps = { coingecko: async (ccy) => { calls++; return { data: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 100_000 + calls }], currency: ccy } } }
  const [tape, crypto, watchlist] = await Promise.all([fetchCryptoMarketsUnified('aud', deps), fetchCryptoMarketsUnified('AUD', deps), fetchCryptoMarketsUnified('aud', deps)])
  assert.equal(calls, 1)
  assert.equal(tape, crypto)
  assert.equal(tape.data[0].current_price, watchlist.data[0].current_price)
  _resetCryptoSnapshots()
})

test('price prefixes', () => {
  assert.equal(pricePrefix('aud'), 'A$')
  assert.equal(pricePrefix('USD'), 'US$')
  assert.equal(formatCryptoPrice(0.4412, 'AUD'), 'A$0.4412')
  assert.equal(formatCryptoPrice(null, 'AUD'), '—')
})

test('crypto: a missing 24h change, market cap, volume or Fear & Greed day is unavailable, never 0% or 50', async () => {
  const { transformCryptoMarkets, transformFearGreed } = await import('../src/services/api.js')
  const [c] = transformCryptoMarkets([{ id: 'x', symbol: 'xyz', name: 'X', current_price: 1 }])
  assert.equal(c.pct24h, null); assert.equal(c.mktCap, '—'); assert.equal(c.vol24h, '—')
  const fg = transformFearGreed({ data: [{ value: '41', value_classification: 'Fear' }, { value: '39' }] })
  assert.deepEqual([fg.value, fg.prev, fg.weekAgo, fg.monthAgo], [41, 39, null, null])
  assert.equal(transformFearGreed({ data: [{}] }).value, null)
  const { calculateMarketSentimentScore, calculateCryptoMomentumIndex } = await import('../src/services/maddenAiScoring.js')
  assert.equal(calculateMarketSentimentScore({ fearGreed: { value: null } }), null, 'no F&G reading is not 50')
  assert.ok(!(calculateCryptoMomentumIndex({ coins: [{ symbol: 'BTC', change24h: 1 }], fearGreed: { value: null } }).factors ?? []).some((f) => /Fear/.test(f.name)))
  const mod = fs.readFileSync('src/modules/crypto/CryptoModule.jsx', 'utf8')
  assert.match(mod, /\{v \?\? '—'\}/, 'F&G history shows — for a missing day')
  assert.doesNotMatch(mod, /c\.pct24h \?\? 0/)
})

test('DefiLlama switched off: no saved copy is served as LIVE or STALE, and the panel says it is off', async () => {
  const store = new Map([['maddex_defi_protocols_25', JSON.stringify({ data: [{ name: 'Old' }], at: Date.now() })], ['maddex_defi_stablecoins', JSON.stringify({ data: { total: 1 }, at: Date.now() - 864e5 })]])
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
  const { licenceOff } = await import('../src/data/sourceLicence.js')
  assert.ok(licenceOff('defillama'), 'precondition: DefiLlama is switched off')
  const { defiService } = await import('../src/services/defiService.js')
  for (const r of [await defiService.getProtocols(25), await defiService.getStablecoins(), await defiService.getChains(8), await defiService.getCategories(6)]) {
    assert.deepEqual(r, { data: null, source: 'off', at: null })
  }
  assert.equal(defiService.getDataStatus().find((f) => f.label === 'DeFi TVL').status, 'off')
  const panel = fs.readFileSync('src/modules/crypto/DefiPanel.jsx', 'utf8')
  assert.doesNotMatch(panel, /live public API/)
  assert.match(panel, /switched off while its terms of use are reviewed/)
  delete globalThis.localStorage
})

test('halving card: estimate and its source only, no performance history; a missing block-time average is said', async () => {
  const card = fs.readFileSync('src/modules/crypto/CryptoExtras.jsx', 'utf8')
  assert.doesNotMatch(card, /rall(y|ies)|past performance|preceded/i)
  assert.match(card, /source="mempool\.space"/)
  assert.match(card, /10-minute target block time/)
  const svc = fs.readFileSync('src/services/defiService.js', 'utf8')
  assert.match(svc, /avgMeasured: measured/)
})

test('crypto momentum: a missing input is left out, never 50 or a 0% move; every factor is in the published method', async () => {
  const { calculateCryptoMomentumIndex, CRYPTO_MOMENTUM_WEIGHTS } = await import('../src/services/maddenAiScoring.js')
  assert.equal(calculateCryptoMomentumIndex({ coins: [], fearGreed: null }), null, 'no inputs, no score')
  assert.equal(calculateCryptoMomentumIndex({ coins: [{ symbol: 'BTC' }], fearGreed: null }), null)
  // BTC volume missing: no volume factor, rather than a neutral 50.
  const noVol = calculateCryptoMomentumIndex({ coins: [{ symbol: 'BTC', change24h: 3 }], fearGreed: null })
  assert.ok(!noVol.factors.some((f) => /volume/i.test(f.name)))
  // A coin without a 24h change does not pull the 24h factor toward 0%.
  const a = calculateCryptoMomentumIndex({ coins: [{ symbol: 'BTC', change24h: 4 }], fearGreed: null })
  const b = calculateCryptoMomentumIndex({ coins: [{ symbol: 'BTC', change24h: 4 }, { symbol: 'DOGE', change24h: null }], fearGreed: null })
  assert.equal(a.factors[0].score, b.factors[0].score)
  const method = (await import('../src/data/methodology.js')).METHODS?.['crypto-momentum'] ?? fs.readFileSync('src/data/methodology.js', 'utf8')
  const text = JSON.stringify(method)
  for (const w of Object.values(CRYPTO_MOMENTUM_WEIGHTS)) assert.match(text, new RegExp(`weight ${w}\\b`))
  assert.match(text, /BTC 24h volume over its market cap/)
  assert.doesNotMatch(fs.readFileSync('src/services/maddenAiScoring.js', 'utf8'), /Volume Conviction|change24h \|\| 0/)
})

test('My Crypto: an unpriced holding is left out of the totals, never counted as worth 0; the footer badge follows the feed', () => {
  const src = fs.readFileSync('src/modules/crypto/CryptoExtras.jsx', 'utf8')
  assert.doesNotMatch(src, /r\.value \?\? 0/)
  assert.doesNotMatch(src, /Priced live from CoinGecko/)
  assert.match(src, /left out of the totals/)
  assert.match(src, /<DataBadge cls=\{source\.cls\}/)
  assert.match(fs.readFileSync('src/modules/crypto/CryptoModule.jsx', 'utf8'), /cls: marketsDelayed \? 'STALE' : 'LIVE'/)
})
