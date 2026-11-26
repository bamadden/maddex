// The post-deploy smoke test's rules (scripts/smoke/sweep.mjs) and its
// workflow (.github/workflows/smoke.yml). The sweep itself drives a browser;
// these keep its checks honest without one.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MODULES, RAW_ERROR, NO_DATA_SCREENS } from '../scripts/smoke/sweep.mjs'

test('the sweep opens every module in the navigation', () => {
  const nav = fs.readFileSync('src/components/layout/NavBar.jsx', 'utf8')
  // REVIEW is the graph reviewers' queue (dev builds only), not a module readers see.
  const labels = [...nav.matchAll(/\{ id: '(\w+)',\s+label: '([^']+)'/g)].filter((m) => m[1] !== 'graphreview').map((m) => m[2].toUpperCase())
  assert.ok(labels.length >= 19)
  for (const l of labels) assert.ok(MODULES.includes(l), `${l} is not swept`)
})

test('raw error text is caught; ordinary words and figures are not', () => {
  for (const bad of ["Cannot read properties of null (reading 'toFixed')", 'TypeError: x', '[object Object]', 'NaN%', 'P/E NaN', 'x is not a function', 'Infinity%']) assert.ok(RAW_ERROR.test(bad), bad)
  for (const ok of ['Financial services', 'NASDAQ 26,823', 'not defined in the release', 'Uncapped', 'error bars', 'A$343,778', 'Calculated from your inputs']) assert.ok(!RAW_ERROR.test(ok), ok)
})

test('a module may show no badge only on its own empty or calculated screen', () => {
  assert.deepEqual(Object.keys(NO_DATA_SCREENS).sort(), ['BRIEF', 'CALC', 'PORTFOLIO'])
  assert.match('Start tracking your portfolio', NO_DATA_SCREENS.PORTFOLIO)
  assert.ok(!NO_DATA_SCREENS.PORTFOLIO.test('PORTFOLIO VALUE A$12,000'), 'a portfolio with holdings must show badges')
})

test('the sweep uses the real clock and cannot make an AI call', () => {
  const src = fs.readFileSync('scripts/smoke/sweep.mjs', 'utf8')
  const code = src.replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /Date\s*=\s*new Proxy|clockAt|setSystemTime|fake.*clock/i)
  assert.match(src, /\/api\/claude'\) \|\| \/\(\^\|\\\.\)anthropic\\\.com\$\/\.test\(u\.hostname\)\) \{ log\.ai\.push\(u\.pathname\); return req\.abort\(\) \}/)
  assert.match(src, /api\/ai-daily'\)\) return req\.respond/)
})

test('the workflow runs after each Production deploy and nightly, read-only, on the deployed commit', () => {
  const wf = fs.readFileSync('.github/workflows/smoke.yml', 'utf8')
  assert.match(wf, /deployment_status:/)
  assert.match(wf, /schedule:/)
  assert.match(wf, /github\.event\.deployment_status\.state == 'success' && github\.event\.deployment\.environment == 'Production'/)
  assert.match(wf, /ref: \$\{\{ github\.event\.deployment\.sha \|\| github\.sha \}\}/)
  assert.match(wf, /permissions:\s*\n\s*contents: read/)
  assert.match(wf, /sweep\.mjs production/)
  assert.match(wf, /sweep\.mjs modules/)
  assert.doesNotMatch(wf, /secrets\.|git push|ANTHROPIC/)
})
