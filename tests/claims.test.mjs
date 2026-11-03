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
  assert.doesNotMatch(planText, /Priority support|Early access|API access/)
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

test('the comparison does not sell data export or deletion as a plan feature (audit 11 #2)', async () => {
  const { PLAN_CARDS } = await import('../src/services/plans.js')
  const lines = Object.values(PLAN_CARDS).flatMap((c) => c.features.map(([l]) => l))
  assert.ok(!lines.some((l) => /^export all data$/i.test(l)), 'ambiguous "Export all data" line')
  assert.ok(lines.some((l) => /one ZIP/.test(l)), 'the Apex line names the ZIP export')
  const modal = fs.readFileSync('src/components/billing/PlanModals.jsx', 'utf8')
  assert.match(modal, /Every plan, including Core, can export or delete its personal data/)
})

test('refresh and loading controls do not call mixed data "live" (audit 11 #5)', () => {
  // A refresh reloads demo equities, delayed FX and live crypto alike.
  for (const f of ['src/App.jsx', 'src/components/ui/ModuleStates.jsx', 'src/components/settings/SettingsPanel.jsx', 'src/components/layout/TopBar.jsx', 'src/services/shortcutService.js']) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /Refresh(ing)? (all )?live data|REFRESH ALL LIVE DATA|FETCHING LIVE DATA/i, f)
  }
})

test('email alerts are not offered while no sender works (Phase 3)', async () => {
  const svc = await import('../src/services/alertEmailService.js')
  assert.equal(svc.EMAIL_DELIVERY_AVAILABLE, false)
  assert.equal(svc.emailAlertsEnabled(), false)
  assert.equal(svc.setEmailAlertsEnabled(true), false, 'cannot be switched on')
  const before = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; return new Response('{}') }
  try { assert.deepEqual(await svc.sendAlertEmail({ symbol: 'CBA', direction: 'above', value: 1, currentPrice: 2 }), { sent: false, reason: 'disabled' }) } finally { globalThis.fetch = before }
  assert.equal(called, false, 'nothing is sent')
  const { PLAN_CARDS } = await import('../src/services/plans.js')
  const email = Object.values(PLAN_CARDS).flatMap((c) => c.features).find(([l]) => /email alerts/i.test(l))
  assert.equal(email?.[1], 'soon', 'shown as planned, not included')
  const copy = [fs.readFileSync('src/services/plans.js', 'utf8'), fs.readFileSync('src/components/ui/TrialNudges.jsx', 'utf8')].join('\n')
  assert.doesNotMatch(copy, /by email when it crosses|by email if you turn it on/)
})

test('API access is offered nowhere: no working API stands behind it (Phase 3)', async () => {
  const { PLAN_CARDS, GATES } = await import('../src/services/plans.js')
  const lines = Object.values(PLAN_CARDS).flatMap((c) => c.features.map(([l]) => l))
  assert.ok(!lines.some((l) => /\bAPI\b/i.test(l)), 'no plan lists API access')
  assert.ok(!('apiAccess' in GATES))
  const settings = fs.readFileSync('src/components/settings/SettingsPanel.jsx', 'utf8')
  assert.doesNotMatch(settings, /'API ACCESS'|ApiAccessSection|GENERATE API KEY|APIDocsModal/)
  assert.doesNotMatch(fs.readFileSync('src/components/layout/NavBar.jsx', 'utf8'), /API access/)
  assert.ok(!fs.existsSync('src/components/settings/APIDocsModal.jsx'))
})

test('payments are not live: every upgrade button says WAITLIST (Phase 3)', async () => {
  const { PAYMENTS_LIVE, upgradeCta } = await import('../src/services/plans.js')
  assert.equal(PAYMENTS_LIVE, false)
  assert.equal(upgradeCta('prime'), 'JOIN PRIME WAITLIST')
  assert.equal(upgradeCta('apex'), 'JOIN APEX WAITLIST')
  assert.equal(upgradeCta('Apex'), 'JOIN APEX WAITLIST', 'a label passed by an older caller')
  const files = ['src/components/billing/PlanModals.jsx', 'src/components/ui/UpgradePrompt.jsx', 'src/components/layout/AIPanel.jsx',
    'src/components/layout/NavBar.jsx', 'src/modules/dashboard/TrialWelcomeBanner.jsx', 'src/components/ui/TrialNudges.jsx', 'src/components/auth/TrialExpiredModal.jsx']
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8').replace(/PAYMENTS_LIVE\s*\?\s*(`[^`]*`|'[^']*')/g, '')
    assert.doesNotMatch(src, />\s*UPGRADE (TO|NOW)[^<]*</, `${f}: a hard-coded upgrade label`)
  }
})

test('Settings names the Apex ZIP export distinctly from the free privacy export (Phase 3)', () => {
  const s = fs.readFileSync('src/components/settings/SettingsPanel.jsx', 'utf8')
  assert.doesNotMatch(s, />EXPORT ALL DATA<|`EXPORT ALL DATA/)
  assert.match(s, /EXPORT EVERYTHING AS ZIP/)
  assert.match(s, /'EXPORT MY DATA'/)
})
