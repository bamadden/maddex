// The claims register (docs/CLAIMS_REGISTER.md): the claims that can drift
// are pinned here.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PLAN_CARDS, FEATURE_COPY, LIMITS, PRICES } from '../src/services/plans.js'
import { AU_ETFS } from '../src/data/etfData.js'
import { ASX_UNIVERSE } from '../src/modules/markets/useAsxUniverse.js'
import { classOfDailySource } from '../src/utils/dataClass.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const planText = JSON.stringify(PLAN_CARDS) + JSON.stringify(FEATURE_COPY)

test('FX is labelled daily, never live', () => {
  assert.doesNotMatch(planText, /Live FX/i)
  assert.match(planText, /FX reference rates \(ECB, daily\)/)
  assert.equal(classOfDailySource('live'), 'DELAYED')
  assert.equal(classOfDailySource('stale'), 'STALE')
  assert.doesNotMatch(read('src/components/layout/StatusBar.jsx'), /FX LIVE/)
  assert.match(read('src/components/layout/TickerTape.jsx'), /DELAYED · ECB DAILY/)
  assert.doesNotMatch(read('src/components/onboarding/WelcomeModal.jsx'), /global indices from live feeds/)
})

test('no unsupported plan features', () => {
  assert.doesNotMatch(planText, /Priority support|Early access/)
  assert.match(planText, /API access \(beta, demo data\)/)
})

test('plan copy matches the limits', () => {
  assert.match(planText, new RegExp(`MaddenAI \\(${LIMITS.core.aiPerDay} queries/day\\)`))
  assert.match(planText, new RegExp(`MaddenAI \\(${LIMITS.prime.aiPerDay} queries/day\\)`))
  assert.match(planText, new RegExp(`Basic watchlist \\(${LIMITS.core.watchlist} stocks\\)`))
  assert.match(planText, new RegExp(`Price alerts \\(${LIMITS.prime.alerts} active\\)`))
  assert.match(planText, new RegExp(`Research notes \\(${LIMITS.prime.researchNotesPerMonth}/month\\)`))
  assert.match(planText, new RegExp(`Morning brief \\(${LIMITS.core.briefsPerWeek}/week\\)`))
  assert.equal(PRICES.core.monthly, 0)
})

test('no absolute AI-figure claim', () => {
  for (const f of ['src/components/onboarding/WelcomeModal.jsx', 'src/components/onboarding/SetupWizard.jsx', 'src/components/settings/SettingsPanel.jsx']) {
    assert.doesNotMatch(read(f), /every figure it quotes (is one|comes from)|does not produce numbers of its own|never sources a number itself/i, f)
  }
  assert.doesNotMatch(read('src/components/ui/DataLegend.jsx'), /Every figure is labelled/)
})

test('counts on screen match the data', () => {
  assert.equal(AU_ETFS.length, 21)
  assert.match(read('src/modules/etf/ETFModule.jsx'), /21 Australian ETFs/)
  assert.equal(ASX_UNIVERSE.length, 72)
  assert.match(read('src/hooks/useMarketSentiment.js'), /72 stocks/)
})

test('the register exists and covers the audited items', () => {
  const reg = read('docs/CLAIMS_REGISTER.md')
  for (const id of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'D2', 'I1', 'I2', 'P4', 'P5', 'G1', 'L1']) assert.match(reg, new RegExp(`\\| ${id} \\|`), id)
})

test('no "real-time" or "live" promise beside equity figures while equities are DEMO (audit 11 #1)', () => {
  const pf = fs.readFileSync('src/modules/portfolio/PortfolioModule.jsx', 'utf8')
  assert.doesNotMatch(pf, /real-time P&amp;L|real-time P&L|live P&amp;L|live P&L/i)
  assert.match(pf, /at demo equity prices \(labelled DEMO\) until a licensed ASX feed is connected/)
})
