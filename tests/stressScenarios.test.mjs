// Portfolio stress test (Ben's decision, 16 Nov 2026): the rate scenario is a
// generic shock the reader sets in basis points; no scenario text names a
// coming meeting, says what the RBA will do, or forecasts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
const ST = code('src/modules/portfolio/StressTest.jsx')
const scenarios = ST.slice(ST.indexOf('const SCENARIOS = ['), ST.indexOf('const CUSTOM_FACTORS'))
// Allowed: the disclaimer itself.
const FORECAST = /next meeting|next decision|RBA (hikes?|cuts?|raises?|lowers?|will|moves?)|\bwill (rise|fall|hike|cut)|expected|likely|probab|forecast|outlook|priced in|pendingRbaDecision|hikeRate|nextMeeting/i

test('no scenario text forecasts or names what the RBA will do', () => {
  assert.ok(scenarios.length > 500, 'found the scenario table')
  const strings = [...scenarios.matchAll(/(['`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((m) => m[2])
  assert.ok(strings.length > 20)
  const bad = strings.filter((t) => FORECAST.test(t))
  assert.deepEqual(bad, [])
  assert.doesNotMatch(ST, /pendingRbaDecision|RBA_HIKE_LABEL|ND\?\./)
})

test('the rate shock is generic and set by the reader, in basis points', () => {
  assert.match(scenarios, /key: 'rateShock'/)
  assert.doesNotMatch(scenarios, /key: '(rbaHike|rateHike)'/)
  assert.match(ST, /data-rate-bp/)
  assert.match(ST, /shock: \(h, bp\) => \(holdingRate\(h\)\.shock \/ 100\) \* \(bp \/ RATE_STEP\)/)
  assert.match(ST, /a what-if, not a forecast/)
})

test('the Analytics rate section and the regime prompts name no coming decision', () => {
  const pa = code('src/modules/portfolio/PortfolioAnalytics.jsx')
  assert.doesNotMatch(pa, /RBA HIKES TO|if the RBA hikes|A 25BP RBA HIKE|pendingRbaDecision/)
  const mr = code('src/services/marketRegime.js')
  assert.doesNotMatch(mr, /RISK OF MORE RBA HIKES|case for and against another|matters most/)
})
