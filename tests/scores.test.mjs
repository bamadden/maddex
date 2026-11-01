// Scores and signals (legal-risk item 2): every score is labelled as a
// descriptive measure with its method one click away; no buy/sell or
// bullish/bearish call framing; holdings-aware features describe exposure only.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { METHODS } from '../src/data/methodology.js'
import { scoreToLabel } from '../src/services/maddenAiScoring.js'
import { toneWord, toneSign } from '../src/utils/tone.js'

const read = (f) => fs.readFileSync(f, 'utf8')

const CARDS = {
  'src/modules/dashboard/widgets/MarketScoreWidget.jsx': 'sentiment',
  'src/modules/markets/MarketSentimentBanner.jsx': 'sentiment',
  'src/modules/dashboard/OverviewSurface.jsx': 'sentiment',
  'src/modules/news/NewsModule.jsx': 'sentiment',
  'src/components/ui/SentimentIndicator.jsx': 'sentiment',
  'src/components/ui/RegimeBadge.jsx': 'regime',
  'src/modules/macro/RecessionMonitor.jsx': 'recession',
  'src/modules/markets/CorrelationExplorer.jsx': 'diversification',
  'src/modules/crypto/CryptoModule.jsx': 'crypto-momentum',
  'src/modules/global/MapDetailPanel.jsx': 'country-risk',
}

test('every score card carries the descriptive-measure note with its method', () => {
  for (const [f, method] of Object.entries(CARDS)) {
    assert.match(read(f), new RegExp(`<ScoreNote method="${method}"`), f)
    const m = METHODS[method]
    assert.ok(m?.what && m.how?.length && m.not, method)
  }
  const note = read('src/components/ui/ScoreNote.jsx')
  for (const s of ['Descriptive measure', 'Not a recommendation', 'As at', 's calculated']) assert.ok(note.includes(s), s)
})

test('sentiment labels describe direction, never a call', () => {
  for (let s = 0; s <= 100; s += 5) assert.doesNotMatch(scoreToLabel(s), /bull|bear/i)
  assert.equal(toneWord('CAUTIOUSLY BULLISH'), 'MIXED, LEANING POSITIVE')
  assert.equal(toneWord('bearish'), 'NEGATIVE')
  assert.equal(toneSign('STRONGLY BULLISH'), 1)
  assert.equal(toneSign('MIXED, LEANING NEGATIVE'), -1)
  for (const f of ['src/services/aiDaily.js', 'src/services/morningBriefService.js']) assert.doesNotMatch(read(f), /"(STRONGLY |CAUTIOUSLY )?BULLISH"/, f)
  assert.doesNotMatch(read('src/services/maddenAiScoring.js'), /MaddenAI detects|bullish momentum|bearish conditions/i)
  assert.doesNotMatch(read('src/modules/markets/MarketBreadth.jsx'), /'BULLISH'|'BEARISH'/)
  assert.doesNotMatch(read('src/data/futuresData.js'), /signal: 'BULLISH'/)
})

test('chart patterns and divergences are described, not called', () => {
  const svc = read('src/services/scannerService.js')
  assert.doesNotMatch(svc, /"implication"|"probability"|'BULLISH DIV'|'BEARISH DIV'|precedes capitulation/)
  assert.doesNotMatch(read('src/modules/scanner/MarketScannerModule.jsx'), /pattern\.implication|pattern\.probability/)
})

test('holdings-aware features describe exposure only', () => {
  const port = read('src/modules/portfolio/PortfolioModule.jsx')
  assert.doesNotMatch(port, /TOP OPPORTUNITY|>SUGGESTIONS<|suggestions for improvement|rebalancing considerations|specific suggestions|\?\? 'Financials'/)
  assert.match(port, /Describe only\. Do not suggest buying, selling, holding/)
  assert.doesNotMatch(read('src/modules/markets/CorrelationExplorer.jsx'), /would reduce correlation|suggestDiversifier/)
  assert.doesNotMatch(read('src/services/correlationService.js'), /export function suggestDiversifier/)
  assert.doesNotMatch(read('src/modules/portfolio/PortfolioAnalytics.jsx'), /consider diversifying/)
  assert.doesNotMatch(read('src/services/aiStarters.js'), /opportunity/i)
  for (const f of ['src/modules/relationships/RelationshipsModule.jsx', 'src/modules/relationships/RelPanels.jsx']) {
    assert.match(read(f), /CONNECTED EXPOSURE, NOT FORECAST · NOT A RECOMMENDATION/, f)
  }
})
