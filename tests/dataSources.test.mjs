// Data sources and licences (legal-risk item 6): sources whose terms do not
// permit our use are off in code, the required credits are shown, and the
// register matches.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { NEWS_SOURCES, NEWS_SOURCES_OFF } from '../src/services/api.js'
import { SENTIMENT_FEEDS } from '../src/services/aiDaily.js'
import { LICENCE_OFF, licenceGuard, LicenceError, licenceOff } from '../src/data/sourceLicence.js'
import { CREDIT, FREE_DATA_NOTICE } from '../src/data/credits.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const doc = read('docs/DATA_SOURCES.md')

test('only news publishers whose terms permit commercial display are on', () => {
  assert.deepEqual(NEWS_SOURCES.map((s) => s.name).sort(), ['ABC Business', 'BBC News', 'RBA Releases', 'RBA Speeches', 'Yahoo Finance AU'])
  for (const name of ['AFR', 'SMH Business', 'Guardian AU', 'CNBC Markets', 'MarketWatch', 'NYT Business', 'Nikkei Asia', 'The Economist', 'CoinDesk']) {
    assert.ok(NEWS_SOURCES_OFF.some((s) => s.name === name), name)
  }
  assert.doesNotMatch(read('src/services/api.js').slice(read('src/services/api.js').indexOf('export const GEO_RSS_FEEDS')), /^\s*\{ url: 'https:\/\/www\.theguardian\.com/m)
  assert.deepEqual(SENTIMENT_FEEDS.map((u) => new URL(u).hostname).sort(), ['feeds.bbci.co.uk', 'www.abc.net.au'])
})

test('data feeds that need a licence are switched off at the fetch', () => {
  for (const id of ['defillama', 'opensky', 'openmeteo', 'imf', 'fred', 'esri', 'fmp', 'twelvedata']) {
    assert.ok(licenceOff(id), id)
    assert.throws(() => licenceGuard(id), LicenceError)
  }
  const at = {
    'src/services/defiService.js': "licenceGuard('defillama')",
    'src/services/intelTickerLive.js': "licenceGuard('defillama')",
    'src/services/imfOutlook.js': "licenceGuard('imf')",
    'src/services/countryApiService.js': "licenceGuard('imf')",
    'src/services/globalDataService.js': "licenceGuard('openmeteo')",
    'src/services/liveDataService.js': "licenceGuard('openmeteo')",
    'src/services/api.js': "licenceGuard('opensky')",
    'src/services/officialStats.js': "licenceGuard('fred')",
    'src/services/calendarService.js': "licenceGuard('fmp')",
  }
  for (const [f, call] of Object.entries(at)) assert.ok(read(f).includes(call), f)
  assert.match(read('src/modules/global/DeckGLMap.jsx'), /licenceOff\('esri'\) \? \[\]/)
})

test('required credits are shown next to the data', () => {
  assert.match(read('src/modules/crypto/CryptoModule.jsx'), /CREDIT\.coingecko\.text/)
  assert.match(read('src/modules/crypto/CryptoModule.jsx'), /CREDIT\.alternativeme\.text/)
  assert.match(read('src/components/layout/TickerTape.jsx'), /CREDIT\.coingecko\.text/)
  assert.match(read('src/components/layout/TickerTape.jsx'), /SOURCE: ECB/)
  assert.match(read('src/modules/dashboard/widgets/FXRatesWidget.jsx'), /CREDIT\.exchangerateapi\.text/)
  assert.match(read('src/modules/macro/MacroModule.jsx'), /CREDIT\.rba\.text.*CREDIT\.abs\.text/s)
  assert.match(read('src/modules/global/IntelSections.jsx'), /Credit: U\.S\. Geological Survey/)
  assert.equal(CREDIT.coingecko.text, 'Powered by CoinGecko')
  assert.equal(CREDIT.exchangerateapi.text, 'Rates By Exchange Rate API')
  assert.match(FREE_DATA_NOTICE, /published free of charge/)
  assert.match(read('src/data/legalDocs.js'), /FREE_DATA_NOTICE/)
})

test('the register covers every source, and every OFF switch', () => {
  for (const name of ['CoinGecko', 'Binance', 'alternative.me', 'DefiLlama', 'Frankfurter', 'open.er-api.com', 'Stooq', 'FRED', 'BLS', 'RBA', 'ABS', 'IMF', 'World Bank', 'USGS', 'OpenSky', 'Open-Meteo', 'Nominatim', 'mempool.space', 'PublicNode', 'CARTO', 'Esri', 'Natural Earth', 'REST Countries', 'Financial Modeling Prep', 'Twelve Data', 'The Guardian', 'Yahoo Finance', 'BBC News', 'Anthropic', 'Resend']) {
    assert.ok(doc.includes(name), name)
  }
  for (const id of Object.keys(LICENCE_OFF)) assert.ok(doc.includes(`\`${id}\``), id)
  assert.match(doc, /30 Nov 2026/)
})

// FMP fails closed. Runs the real equity and calendar services in a child
// process with every equity key set (MADDEX_TEST_ENV, tests/setup/resolve.mjs);
// the child answers each fetch locally and reports the URLs attempted.
test('FMP fails closed: with its licence switch off, no key makes a request to FMP', async () => {
  const { execFileSync } = await import('node:child_process')
  assert.ok(licenceOff('fmp'), 'this test assumes FMP is switched off')
  const keysets = [
    { VITE_FMP_API_KEY: 'probe-fmp' },
    { VITE_POLYGON_KEY: 'probe-polygon' },
    { VITE_TD_API_KEY: 'probe-td' },
    { VITE_FMP_API_KEY: 'probe-fmp', VITE_POLYGON_KEY: 'probe-polygon', VITE_TD_API_KEY: 'probe-td' },
  ]
  for (const keys of keysets) {
    const out = execFileSync(process.execPath, ['--import', './tests/setup/networkGuard.mjs', '--import', './tests/setup/resolve.mjs', 'tests/fixtures/fmpProbe.mjs'],
      { env: { ...process.env, MADDEX_TEST_ENV: JSON.stringify(keys) }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const probe = JSON.parse(out.trim().split('\n').at(-1))
    const label = Object.keys(keys).join('+')
    assert.deepEqual(probe.fmpRequests, [], `${label}: requests to FMP`)
    assert.equal(probe.usingMock, true, `${label}: equities must stay DEMO`)
    assert.equal(probe.equitySource, 'simulated', `${label}: badge source`)
    assert.ok(Object.keys(probe.tried).length >= 6, `${label}: every equity and calendar path was exercised`)
  }
  // One door to FMP, and the switch is checked before it opens.
  const api = read('src/services/api.js')
  assert.match(api, /function fmpFetch\(path, timeoutMs\) \{\n {2}licenceGuard\('fmp'\)\n {2}return fetch\(`\$\{FMP_BASE\}/)
  assert.equal(api.match(/\$\{FMP_BASE\}/g).length, 1, 'every FMP URL is built inside fmpFetch')
  assert.match(api, /HAS_LIVE_DATA_KEY = !!import\.meta\.env\.VITE_FMP_API_KEY && !licenceOff\('fmp'\)/)
})

test('Crypto Fear & Greed carries the alternative.me credit wherever Markets shows it', async () => {
  const { generateShortSummary } = await import('../src/services/maddenAiScoring.js')
  const s = generateShortSummary({ marketSentimentScore: { score: 41 }, asxChanges: [0.1, -0.2], fearGreed: { value: 26, label: 'Fear' } })
  assert.match(s, /Crypto Fear & Greed 26 \(Fear · Data from alternative\.me\)/)
  const banner = read('src/modules/markets/MarketSentimentBanner.jsx')
  assert.match(banner, /f\.name === 'Crypto Fear & Greed' && \(\s*<a href=\{CREDIT\.alternativeme\.url\}/)
})
