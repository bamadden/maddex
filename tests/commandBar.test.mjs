// Command bar and global search (Phase 5, docs/audit/command-bar.md).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { FKEY_MODULE } from '../src/components/layout/commandSearch.js'

const read = (f) => fs.readFileSync(f, 'utf8')

test('F1–F8 match the keys the nav shows, stop the browser default and wait while typing', () => {
  const bar = read('src/components/layout/CommandBar.jsx')
  const map = FKEY_MODULE
  const nav = Object.fromEntries([...read('src/components/layout/NavBar.jsx').matchAll(/id: '(\w+)',[^\n]*fkey: '(F\d)'/g)].map((m) => [m[2], m[1]]))
  assert.deepEqual(map, nav)
  assert.equal(Object.keys(map).length, 8)
  const fx = bar.slice(bar.indexOf('// ── Module function keys'), bar.indexOf('// ── Autocomplete'))
  assert.match(fx, /e\.preventDefault\(\)\s*\n\s*setActiveModule\(module\)/)
  assert.match(fx, /if \(typing\) return/)
  assert.match(fx, /e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey \|\| e\.shiftKey/)
  assert.doesNotMatch(fx, /'Escape'/, 'Escape belongs to App.jsx; the bar no longer grabs focus on it')
})

test('Ctrl/⌘+F is left to the browser; Ctrl/⌘+K is handled once', () => {
  const app = read('src/App.jsx')
  assert.doesNotMatch(app, /e\.key\.toLowerCase\(\) === 'f'\)\)/)
  assert.equal(app.match(/\(e\.metaKey \|\| e\.ctrlKey\)[^\n]*e\.key\.toLowerCase\(\) === 'k'/g).length, 1)
})

test('a first-visit tip does not take focus from someone typing', () => {
  const tip = read('src/components/onboarding/ContextualTip.jsx')
  assert.match(tip, /if \(el && \(el\.tagName === 'INPUT' \|\| el\.tagName === 'TEXTAREA' \|\| el\.isContentEditable\)\) return\n\s*cardRef\.current\?\.querySelector\('button'\)\?\.focus/)
})

// The search regression set (brief: at least 50 queries). Each row is a
// query and what the bar must offer for it: an asset it resolves to, a
// module, a settings item, a sector, a bond or a calculator.
import { resolveAsset, searchCatalogue, searchModules, searchSettings, moduleNamed, parseSectorQuery, parseBondQuery, calcMatches, MODULES } from '../src/components/layout/commandSearch.js'

const QUERIES = [
  // tickers and names
  ['bhp', { asset: 'BHP' }], ['BHP', { asset: 'BHP' }], ['cba', { asset: 'CBA' }], ['commbank', { asset: 'CBA' }],
  ['comonwealth bank', { asset: 'CBA' }], ['westpac', { asset: 'WBC' }], ['telstra', { asset: 'TLS' }], ['woolies', { asset: 'WOW' }],
  ['xero', { asset: 'XRO' }], ['cochlear', { asset: 'COH' }], ['pro medicus', { asset: 'PME' }], ['qantas', { asset: 'QAN' }],
  ['fortescue', { asset: 'FMG' }], ['woodside', { asset: 'WDS' }], ['macquarie', { asset: 'MQG' }], ['apple', { asset: 'AAPL' }],
  ['nvidia', { asset: 'NVDA' }], ['google', { asset: 'GOOGL' }], ['bitcoin', { asset: 'BTC' }], ['eth', { asset: 'ETH' }],
  ['aud/usd', { asset: 'AUD/USD' }], ['aussie dollar', { asset: 'AUD/USD' }],
  // indices, including the aliases added on 5 Nov
  ['asx 200', { asset: '^AXJO' }], ['xjo', { asset: '^AXJO' }], ['asx200', { asset: '^AXJO' }], ['sp500', { asset: '^GSPC' }],
  ['spx', { asset: '^GSPC' }], ['s&p', { asset: '^GSPC' }], ['vix', { asset: '^VIX' }], ['nikkei', { asset: '^N225' }],
  // modules, by name, alias and one typo
  ['markets', { module: 'markets', named: true }], ['port', { module: 'portfolio', named: true }], ['portfolo', { module: 'portfolio', named: true }],
  ['watchlst', { module: 'watchlist', named: true }], ['calender', { module: 'calendar', named: true }], ['home', { module: 'dashboard', named: true }],
  ['dash', { module: 'dashboard', named: true }], ['scan', { module: 'scanner', named: true }], ['screener', { module: 'screener', named: true }],
  ['brief', { module: 'brief', named: true }], ['replay', { module: 'replay', named: true }], ['etfs', { module: 'etf', named: true }],
  ['rates', { module: 'fx', named: true }], ['graph', { module: 'relationships', named: true }],
  // topics list the module that holds them, without navigating
  ['rba', { module: 'macro', named: false }], ['cash rate', { module: 'macro', named: false }], ['cpi', { module: 'macro', named: false }],
  ['gold', { module: 'fx', named: false }], ['earnings', { module: 'calendar', named: false }],
  // settings
  ['settings', { settings: 'SETTINGS' }], ['export my data', { settings: 'EXPORT MY DATA' }], ['delete account', { settings: 'DELETE ACCOUNT' }],
  ['dark mode', { settings: 'DISPLAY' }], ['shortcuts', { settings: 'KEYBOARD SHORTCUTS' }], ['upgrade', { settings: 'PLAN & BILLING' }],
  ['data sources', { settings: 'DATA SOURCES' }],
  // sectors, bonds, calculators
  ['banks', { sector: 'Financials' }], ['miners', { sector: 'Materials' }], ['healthcare', { sector: 'Health Care' }], ['asx energy', { sector: 'Energy' }],
  ['10y', { bonds: ['AU 10Y', 'US 10Y'] }], ['au 10y', { bonds: ['AU 10Y'] }], ['us 2y', { bonds: ['US 2Y'] }],
  ['mortgage', { calc: 'MORTGAGE' }], ['cgt', { calc: 'CGT' }], ['stamp duty', { calc: 'STAMP DUTY' }],
  // must NOT resolve to an asset: prose and half-typed commands
  ['bank', { asset: null }], ['what are banks', { asset: null }], ['compa', { asset: null }], ['inflation', { asset: null }],
]

test(`search regression set: ${QUERIES.length} queries`, () => {
  assert.ok(QUERIES.length >= 50)
  for (const [q, want] of QUERIES) {
    if ('asset' in want) assert.equal(resolveAsset(q)?.label ?? null, want.asset, `asset for "${q}"`)
    if (want.module) {
      assert.equal(searchModules(q)[0]?.key, want.module, `module for "${q}"`)
      assert.equal(moduleNamed(q), want.named ? want.module : null, `named module for "${q}"`)
    }
    if (want.settings) assert.equal(searchSettings(q)[0]?.label, want.settings, `settings for "${q}"`)
    if (want.sector) assert.equal(parseSectorQuery(q)?.sector, want.sector, `sector for "${q}"`)
    if (want.bonds) assert.deepEqual(parseBondQuery(q).map((b) => b.label), want.bonds, `bonds for "${q}"`)
    if (want.calc) assert.ok(calcMatches(q).some((c) => c.label === want.calc), `calc for "${q}"`)
  }
  assert.ok(searchCatalogue('afterpay').length === 0, 'delisted names find nothing rather than a wrong match')
})

test('every module App renders can be found, and nothing else', () => {
  const app = read('src/App.jsx')
  const rendered = [...app.slice(app.indexOf('const MODULE_MAP = {'), app.indexOf('}', app.indexOf('const MODULE_MAP = {'))).matchAll(/^\s+(\w+):/gm)].map((m) => m[1]).filter((k) => k !== 'graphreview')
  assert.deepEqual(MODULES.map((m) => m.key).sort(), rendered.sort())
  for (const m of MODULES) assert.equal(searchModules(m.label)[0]?.key, m.key, m.label)
})

test('"settings" and "maddenai" open their panels instead of rendering Markets', () => {
  const bar = read('src/components/layout/CommandBar.jsx')
  assert.match(bar, /if \(nl\.module === 'settings'\) \{ openSettings\(null\); return \}/)
  assert.match(bar, /if \(nl\.module === 'ai'\) \{ setChatOpen\(true\); return \}/)
})
