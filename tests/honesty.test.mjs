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
