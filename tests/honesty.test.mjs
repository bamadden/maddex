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

// ── No fixed exchange rate ──────────────────────────────────────────────────
import { toAUD } from '../src/services/api.js'
import { summarise } from '../src/services/transactionService.js'
import { mergeLots } from '../src/services/portfolioCsv.js'
import { computePortfolioSnapshot } from '../src/modules/dashboard/portfolioSnapshot.js'

test('a US$ figure without an AUD/USD rate is "—", never converted at a fixed rate', () => {
  for (const f of ['src/hooks/useAudRates.js', 'src/modules/global/GlobalModule.jsx', 'src/modules/markets/TopMovers.jsx']) {
    assert.doesNotMatch(read(f), /0\.652\b|\?\? 1\.55/, f)
  }
  assert.equal(toAUD(100, 'USD', null), null)
  assert.equal(toAUD(100, 'USD', 0.64), 100 / 0.64)
  assert.equal(toAUD(100, 'AUD', null), 100)

  const noRate = () => null
  // Transactions: a US$ buy without a rate flags the total instead of adding US$ as A$.
  assert.equal(summarise([{ id: 1, type: 'BUY', symbol: 'AAPL', units: 1, price: 200, currency: 'USD', date: '2026-01-02' }], noRate).unconverted, true)
  // Portfolio: a lot with no A$ cost leaves the merged position without one.
  const [m] = mergeLots([{ type: 'us', symbol: 'AAPL', shares: 1, totalCost: 300, mktVal: 320, addedAt: 1 }, { type: 'us', symbol: 'AAPL', shares: 1, totalCost: null, mktVal: 320, addedAt: 2 }])
  assert.equal(m.totalCost, null)
  assert.equal(m.pnl, null)
  // Dashboard snapshot: a holding whose US$ cost cannot be converted is left out, not costed at zero.
  const snap = computePortfolioSnapshot([{ symbol: 'CBA', type: 'asx', shares: 1, avgCost: 100, costCurrency: 'USD', yfSym: 'CBA.AX' }], { 'CBA.AX': { last: 120 } }, noRate)
  assert.equal(snap, null)
})

// ── MaddenAI originates no score ────────────────────────────────────────────
test('no MaddenAI prompt asks for a score, and the Brief shows its outlook as words', () => {
  for (const f of ['src/services/aiDaily.js', 'src/services/morningBriefService.js']) {
    assert.doesNotMatch(read(f), /"[a-zA-Z]*[sS]core": *number|maddenAIScore/, f)
  }
  for (const f of ['src/modules/brief/MorningBriefModule.jsx', 'src/modules/brief/BriefExtras.jsx', 'src/modules/brief/briefImage.js', 'src/modules/dashboard/widgets/MorningBriefWidget.jsx']) {
    assert.doesNotMatch(read(f), /maddenAIScore|\.score\b/, f)
  }
})

// ── News relevance ─────────────────────────────────────────────────────────
import { isFinanciallyRelevant } from '../src/services/api.js'

test('the news filter matches whole words, so lifestyle stories stay out', () => {
  for (const t of ['Fraud charges laid after applause', 'Window cleaner unable to find toilet', 'Players share their story after the deal', 'Crocodile spotted on the banks of the river']) {
    assert.equal(isFinanciallyRelevant(t), false, t)
  }
  for (const t of ['ASX 200 slips', 'S&P 500 hits record', 'AUD falls after CPI', 'Woodside shares jump', 'M&A activity surges', 'Commonwealth Bank profit beats']) {
    assert.equal(isFinanciallyRelevant(t), true, t)
  }
  // MOVERS IN THE NEWS pins a headline only when it names the asset, and says its moves are demo.
  const news = read('src/modules/news/NewsModule.jsx')
  assert.doesNotMatch(news, /headline\.toUpperCase\(\)\.includes\(needle\)/)
  assert.match(news, /MOVERS IN THE NEWS<\/span>\s*<DemoBadge/)
})
