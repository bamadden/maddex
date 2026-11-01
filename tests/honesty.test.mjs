// Data-honesty guards: claims the product must not make about data it does
// not have. Each test names the screen and the claim it removed.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { FEATURE_COPY, PLAN_CARDS } from '../src/services/plans.js'

const read = (f) => fs.readFileSync(f, 'utf8')

test('Portfolio does not count demo prices as live', () => {
  const src = read('src/modules/portfolio/PortfolioModule.jsx')
  assert.doesNotMatch(src, /label="LIVE PRICES"/)
  assert.match(src, /USING_MOCK_DATA \? 'DEMO'/)
})

test('upgrade and plan copy does not promise live P&L or live ASX prices while equities are demo', () => {
  const copy = JSON.stringify({ FEATURE_COPY, PLAN_CARDS })
  assert.doesNotMatch(copy, /live P&L/i)
  // Live ASX prices are listed as coming, not included.
  assert.doesNotMatch(copy, /\["Live ASX prices",true\]/)
})

// ── Sentiment: one score ────────────────────────────────────────────────────
import { calculateMarketSentimentScore, generateShortSummary } from '../src/services/maddenAiScoring.js'

test('every screen that shows a sentiment number reads the one computed score', () => {
  for (const f of ['src/components/layout/SentimentTick.jsx', 'src/modules/markets/MarketSentimentBanner.jsx', 'src/modules/dashboard/DashboardStatusBar.jsx',
    'src/modules/dashboard/widgets/MarketScoreWidget.jsx', 'src/modules/news/NewsModule.jsx', 'src/modules/brief/MorningBriefModule.jsx']) {
    assert.match(read(f), /useMarketSentiment\(\)/, f)
  }
})

test('MaddenAI\'s headline read is shown as words, never as the score', () => {
  for (const f of ['src/modules/dashboard/widgets/MarketScoreWidget.jsx', 'src/components/ui/SentimentIndicator.jsx', 'src/modules/news/NewsModule.jsx', 'src/components/layout/TopBar.jsx']) {
    assert.doesNotMatch(read(f), /(?<![.\w])(read|sentiment)\??\.score\b|MaddenAI read:/, f)
  }
})

test('the score is computed in code: same inputs, same number', () => {
  const inputs = { fearGreed: { value: 34 }, asxChanges: [0.5, -0.2, 1.1, -0.8], spxChange: 0.3, btcChange: 0.4, cryptoChanges: [0.4, 1, -1.6] }
  const a = calculateMarketSentimentScore(inputs)
  assert.equal(a.score, calculateMarketSentimentScore(structuredClone(inputs)).score)
  assert.ok(a.score >= 0 && a.score <= 100)
})

test('distinct measures carry distinct labels', () => {
  assert.match(generateShortSummary({ marketSentimentScore: { score: 50 }, asxChanges: [0], fearGreed: { value: 34, label: 'Fear' } }), /Crypto Fear & Greed 34 \(Fear\)/)
  assert.match(read('src/modules/news/NewsModule.jsx'), /head\('Headline tone'/)
  assert.match(read('src/modules/dashboard/IntelligenceScore.jsx'), /SETUP \{score\}%/)
  assert.doesNotMatch(read('src/modules/dashboard/IntelligenceScore.jsx'), /INTELLIGENCE \{score\}/)
})

test('Fear & Greed is never fabricated when the feed fails', () => {
  const src = read('src/services/api.js')
  const body = src.slice(src.indexOf('export const fetchFearGreed'), src.indexOf('export const fetchCryptoGlobal'))
  assert.doesNotMatch(body, /value: '42'|mock value/)
})

test('no screen claims dark-pool data; the volume panel says what it measures and is badged DEMO', () => {
  for (const f of fs.readdirSync('src', { recursive: true }).filter((f) => /\.jsx?$/.test(f))) {
    assert.doesNotMatch(read(`src/${f}`), /DARK POOL/i, f)
  }
  const src = read('src/modules/markets/UnusualActivityTracker.jsx')
  assert.match(src, /VOLUME VS 20-DAY AVERAGE<\/span>\s*<DemoBadge \/>/)
})

// ── One clock ───────────────────────────────────────────────────────────────
import { sydneyClock } from '../src/utils/dateUtils.js'

test('the clock is Sydney time with its zone, across daylight saving', () => {
  assert.deepEqual(sydneyClock(new Date('2026-11-01T02:06:00Z')), { time: '13:06', tz: 'AEDT', text: '13:06 AEDT' })
  assert.deepEqual(sydneyClock(new Date('2026-07-01T02:06:00Z')), { time: '12:06', tz: 'AEST', text: '12:06 AEST' })
  assert.match(sydneyClock(new Date('2026-11-01T02:06:00Z'), { hour12: true }).text, /^01:06 pm AEDT$/i)
  assert.equal(sydneyClock(new Date('2026-11-01T13:00:00Z')).time, '00:00') // midnight is 00, not 24
})

test('the top bar and dashboard read the same clock; no hard-coded zone', () => {
  assert.match(read('src/components/layout/TopBar.jsx'), /sydneyClock\(time/)
  assert.match(read('src/modules/dashboard/DashboardStatusBar.jsx'), /sydneyClock\(now/)
  assert.doesNotMatch(read('src/modules/global/GlobalModule.jsx'), /\+ ' AEST'/)
})

// ── Copy: no placeholders, no developer wording, no promises ────────────────
test('no placeholder or developer wording reaches the screen', () => {
  const jsx = fs.readdirSync('src', { recursive: true }).filter((f) => /\.jsx$/.test(f))
  for (const f of jsx) {
    const src = read(`src/${f}`).replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    assert.doesNotMatch(src, /coming soon|Live data connects on API setup|on API setup|scripted (sector|rate)|early-adopter offer|GOOD (MORNING|AFTERNOON|EVENING)/i, f)
  }
})

test('no newsletter prompt while there is nothing to subscribe to', () => {
  assert.doesNotMatch(read('src/modules/news/NewsModule.jsx'), /Newsletter/)
  assert.doesNotMatch(read('src/modules/brief/MorningBriefModule.jsx'), /Newsletter(Editions|Inline)/)
  assert.doesNotMatch(read('src/services/newsletterService.js'), /Delivered every Friday/)
})
