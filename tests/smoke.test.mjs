// The post-deploy smoke test's rules (scripts/smoke/sweep.mjs) and its
// workflow (.github/workflows/smoke.yml). The sweep itself drives a browser;
// these keep its checks honest without one.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MODULES, RAW_ERROR, NO_DATA_SCREENS, DO_NOT_PRESS, scrub } from '../scripts/smoke/sweep.mjs'

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
  assert.doesNotMatch(wf, /git push|ANTHROPIC/)
  // The only secrets: the test account's, and only in the signed-in step.
  const used = [...wf.matchAll(/secrets\.(\w+)/g)].map((m) => m[1])
  assert.deepEqual([...new Set(used)].sort(), ['MADDEX_TEST_EMAIL', 'MADDEX_TEST_PASSWORD'])
  const signedIn = wf.slice(wf.indexOf('- name: Every module, signed in'))
  assert.equal(wf.indexOf('secrets.'), wf.indexOf('secrets.', wf.indexOf('- name: Every module, signed in')), 'secrets appear only in the signed-in step')
  assert.match(signedIn, /sweep\.mjs signed-in https:\/\/maddex\.vercel\.app/)
  assert.match(signedIn, /exit 0/, 'skips itself until the secrets exist')
  assert.doesNotMatch(wf, /echo[^\n]*MADDEX_TEST_(EMAIL|PASSWORD)\b(?!")/, 'never echoes a credential')
})

test('the test account\'s credentials are scrubbed from everything the sweep prints', () => {
  const secrets = ['smoke.test+maddex@example.invalid', 'smoke.test+maddex', 'p4ss-W0rd-long-random']
  assert.equal(scrub('signed in as smoke.test+maddex@example.invalid (p4ss-W0rd-long-random)', secrets), 'signed in as [test account] ([test account])')
  assert.equal(scrub('Hello smoke.test+maddex', secrets), 'Hello [test account]')
  const src = fs.readFileSync('scripts/smoke/sweep.mjs', 'utf8')
  assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ''), /console\.log\((?!scrub)/, 'every line goes through say(), which scrubs')
})

test('the card-opening pass never presses an AI or a destructive control', () => {
  for (const l of ['ASK MADDENAI', 'ANALYSE WITH AI', 'GENERATE BRIEF WITH MADDENAI', 'DELETE', 'Remove holding', 'EXPORT', 'SIGN OUT', 'JOIN WAITLIST', 'SAVE CHANGES']) assert.ok(DO_NOT_PRESS.test(l), l)
  for (const l of ['BHP Group A$63.09', 'AU CPI YoY', '▾ COMMODITY INTELLIGENCE', 'MARKET SENTIMENT 47/100']) assert.ok(!DO_NOT_PRESS.test(l), l)
})

test('docs/SMOKE_TEST.md gives numbered steps for the test account and its two secrets', () => {
  const doc = fs.readFileSync('docs/SMOKE_TEST.md', 'utf8')
  for (const k of ['MADDEX_TEST_EMAIL', 'MADDEX_TEST_PASSWORD', 'no real data', 'Terms of Use', 'subscription_tier', 'Secrets and variables', '7. **Run it once**']) assert.ok(doc.includes(k), k)
})
