// Phase 2.3: every figure on the 3 Nov unsourced list shows its class
// (DEMO / DELAYED / STALE / LIVE), source and date; nothing missing is
// drawn as zero; nothing invented is drawn at all.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { nextSpreadChange, spreadOn } from '../src/data/policySpread.js'
import { lastRateDate, strengthRows } from '../src/modules/fx/useAudStrength.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const code = (f) => read(f).split('\n').filter((l) => !/^\s*(\/\/|\{\/\*|\*)/.test(l)).join('\n')

test('AU–US spread: as at its effective date, and the date it changes (Ben b)', () => {
  assert.equal(spreadOn('2026-11-03'), 60)
  assert.deepEqual(nextSpreadChange('2026-11-03'), { date: '2026-11-04', bp: 85, au: 4.85, us: 4 })
  assert.equal(nextSpreadChange('2026-11-04'), null)
  const p = read('src/modules/fx/PolicySpreadMonitor.jsx')
  assert.match(p, /as at effective date \{formatDate\(day\)\}/)
  assert.match(p, /Changes to <b[^>]*>\{signedBp\(pending\.bp\)\}<\/b> on \{formatDate\(pending\.date\)\}/)
  assert.match(p, /toLocaleDateString\('en-CA', \{ timeZone: 'Australia\/Sydney' \}\)/, 'today is a Sydney date, not UTC')
  assert.doesNotMatch(p, /toISOString\(\)\.slice\(0, 10\)/)
})

test('Markets: breadth and sector scores are badged DEMO with a date', () => {
  assert.match(read('src/modules/markets/MarketSentimentBanner.jsx'), /<BreadthGauge changes=\{asxChanges\} \/>\s*\{USING_MOCK_DATA && asxChanges\?\.length > 0 && <DemoBadge \/>\}/)
  const r = read('src/modules/markets/SectorStrengthRadar.jsx')
  assert.match(r, /SECTOR SCORES<\/span>\s*\{USING_MOCK_DATA \? <DemoBadge \/> : <DataBadge cls="LIVE"/)
  assert.match(r, /<ScoreNote method="sector-strength" asOf=\{dataUpdatedAt \? /)
})

test('Rates: converter, AUD strength, metals and curves carry class, source and date', () => {
  const fx = read('src/modules/fx/FXModule.jsx')
  assert.match(fx, /CURRENCY CONVERTER<\/span>[\s\S]{0,200}<DataBadge cls=\{stale \? 'STALE' : 'DELAYED'\} source="ECB reference rate, via Frankfurter" at=\{stale \? cachedAt \?\? null : rates\.asOf \?\? null\}/)
  assert.match(fx, /ECB reference rates, via Frankfurter · 30 days to \$\{formatDate\(lastRateDate\(rows\)\)\}/)
  assert.match(fx, /<DataBadge cls="DELAYED" source="ExchangeRate-API" at=\{metalsRates\?\.updated/)
  assert.doesNotMatch(code('src/modules/fx/FXModule.jsx'), /● LIVE|updatedTime/, 'no LIVE claim, no render time shown as data time')
  assert.match(fx, /src: `RBA table F2 · \$\{asAtLabel\(BOND_CURVES_AS_OF\.AU\)\} · bills and 30Y indicative`/)
  const rows = strengthRows(['USD', 'EUR'], [
    { status: 'fulfilled', value: { rates: { '2026-10-01': { USD: 0.65 }, '2026-10-31': { USD: 0.66 } } } },
    { status: 'fulfilled', value: { rates: { '2026-10-02': { EUR: 0.60 }, '2026-10-30': { EUR: 0.61 } } } },
  ])
  assert.equal(lastRateDate(rows), '2026-10-31')
})

test('yield curve over time: no 12-month comparison is claimed without a verified curve', () => {
  const a = read('src/components/charts/YieldCurveAnimator.jsx')
  assert.match(a, /const hasPrev = Object\.keys\(curve\.prev \?\? \{\}\)\.length > 0/)
  assert.match(a, /hasPrev \? `yield curve · 12M ago → now · \$\{curve\.src\}` : `yield curve · \$\{curve\.src\}`/)
  assert.match(a, /\{hasPrev && <div className="px-3 pb-2 flex items-center gap-3">/, 'no PLAY control without history')
})

test('Macro: yield curve sourced and dated, no missing yield drawn as 0; heatmap names its two dates', () => {
  const m = read('src/modules/macro/MacroModule.jsx')
  assert.doesNotMatch(m, /\?\.yield \?\? 0\)/)
  assert.match(m, /AU: RBA table F2, market close \{formatDate\(BOND_CURVES_AS_OF\.AU\)\} \(30Y indicative\) · US: Treasury daily par curve, \{formatDate\(BOND_CURVES_AS_OF\.US\)\}/)
  assert.match(m, /ECB reference rates, via Frankfurter · change \$\{formatDate\(range\.from, \{ year: false \}\)\} → \$\{formatDate\(range\.to\)\}/)
})

test('Watchlist rows name their class in words; Portfolio allocation states its basis', () => {
  const w = read('src/modules/watchlist/WatchlistModule.jsx')
  assert.match(w, /: USING_MOCK_DATA \? 'DEMO' : isDelayed \? 'STALE' : 'LIVE'/)
  assert.doesNotMatch(w, /text-terminal-green ml-1">●<\/span>/)
  const p = read('src/modules/portfolio/PortfolioModule.jsx')
  assert.match(p, /by market value\{USING_MOCK_DATA \? ' at demo equity prices' : ''\}/)
  assert.match(p, /pct:\s+mktTotal \? \(\(h\.mktVal \/ mktTotal\) \* 100\)\.toFixed\(1\) : null,/)
  assert.match(p, /\{d\.pct == null \? '—' : `\$\{d\.pct\}%`\}/)
})

test('News: the story asset move is badged DEMO, and no invented sparkline is drawn', () => {
  const n = read('src/modules/news/NewsModule.jsx')
  assert.doesNotMatch(n, /generateSparkline|MiniSparkline|seededRandom/)
  assert.match(n, /\{asset\.changePct\.toFixed\(2\)\}%<\/div>\s*<DemoBadge \/>/)
})
