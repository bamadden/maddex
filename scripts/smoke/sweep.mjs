// Post-deploy smoke test (26 Nov 2026), run after every Production deploy and
// nightly by .github/workflows/smoke.yml, and by hand:
//
//   node scripts/smoke/sweep.mjs production [https://maddex.vercel.app]
//   node scripts/smoke/sweep.mjs modules    [http://localhost:5174]
//
// production — the live site, signed out. Production shows only the sign-in
//   screen to a signed-out visitor (App.jsx), so this checks that screen
//   (renders, no console error, no AI request), the security headers, and
//   that each API endpoint answers as designed. It cannot open modules.
// modules — every module, on the REAL current date (no faked clock: on 26 Nov
//   a data update crashed Macro in production, and the module sweep in the
//   browser suite fakes 7 and 9 Nov, so it passed). Run against a dev server
//   of the deployed commit (the dev build skips sign-in). Fails on an error
//   boundary, a console error or uncaught exception, raw error text on the
//   page, any AI request on load, or a module with no data badge.
//
// Every /api/claude and anthropic.com request is refused and counted (a
// failure), and /api/ai-daily is answered with an empty mock: nothing here
// can make a billed AI call. Network failures of third-party feeds (a 429
// from CoinGecko, a feed that is down) are reported as warnings, not
// failures: the app shows them as STALE or unavailable by design, and an
// outage elsewhere must not read as a broken deploy.
import puppeteer from 'puppeteer-core'

const MODE = process.argv[2]
const BASE = (process.argv[3] ?? (MODE === 'production' ? 'https://maddex.vercel.app' : 'http://localhost:5174')).replace(/\/$/, '')
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const MODULES = ['DASHBOARD', 'MARKETS', 'CRYPTO', 'RATES', 'MACRO', 'GLOBAL', 'WATCHLIST', 'PORTFOLIO', 'NEWS', 'BRIEF', 'CALENDAR', 'SCANNER', 'SCREENER', 'REPLAY', 'RELATIONSHIPS', 'BONDS', 'ETFS', 'FUTURES', 'CALC']

// Text that means an error reached the reader instead of a message.
// A module may show no data badge only when it shows no data: these screens,
// recognised by their own words, hold nothing sourced (26 Nov 2026).
export const NO_DATA_SCREENS = {
  PORTFOLIO: /Start tracking your portfolio/,  // no holdings yet
  BRIEF: /isn't ready yet/,                     // no brief generated yet
  CALC: /Calculated from your inputs/,          // results from the reader's own inputs
}

export const RAW_ERROR = /\b(TypeError|ReferenceError|SyntaxError|RangeError|Cannot read propert(y|ies) of|is not a function|is not defined|undefined is not|Unexpected token|Uncaught)\b|\[object Object\]|\bNaN(%|\b)|\bInfinity%/

const failures = []
const warnings = []
const fail = (m) => { failures.push(m); console.log(`  ✖ ${m}`) }
const pass = (m) => console.log(`  ✔ ${m}`)
const warn = (m) => { warnings.push(m); console.log(`  ⚠ ${m}`) }

async function openPage(browser, { seed = false } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const log = { ai: [], errors: [], network: [] }
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.pathname.startsWith('/api/claude') || /(^|\.)anthropic\.com$/.test(u.hostname)) { log.ai.push(u.pathname); return req.abort() }
    if (u.pathname.startsWith('/api/ai-daily')) return req.respond({ status: 200, contentType: 'application/json', body: '{"data":null}' })
    return req.continue()
  })
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // A failed third-party request also logs "Failed to load resource": that
    // is a feed outage, reported separately below.
    // So does a third-party error response without CORS headers (CoinGecko's
    // 429s carry none, so Chrome reports them as a CORS block).
    if (/^Failed to load resource/.test(t) || /has been blocked by CORS policy/.test(t)) { log.network.push(`console: ${t.match(/https?:\/\/[^/'"]+/)?.[0] ?? 'resource'} unreachable`); return }
    log.errors.push(t.slice(0, 200))
  })
  page.on('pageerror', (e) => log.errors.push(`uncaught: ${String(e.message ?? e).slice(0, 200)}`))
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/claude|anthropic/.test(r.url())) log.network.push(`${r.status()} ${new URL(r.url()).host}${new URL(r.url()).pathname}`.slice(0, 120)) })
  page.on('requestfailed', (r) => { if (!/\/api\/claude|anthropic/.test(r.url())) log.network.push(`failed ${new URL(r.url()).host}`) })
  if (seed) {
    await page.evaluateOnNewDocument(() => {
      for (const [k, v] of Object.entries({
        maddex_welcomed: '2026-01-01', maddex_first_seen: String(Date.now() - 30 * 86_400_000), maddex_onboarding_complete: 'true',
        maddex_dashboard_setup_done: 'true', maddex_notif_prompt_dismissed: 'true', maddex_whats_new_version: 'v0.2.0-beta',
        maddex_disclaimer_ack: JSON.stringify({ version: 'disclaimer-2026-11-01', at: '2026-11-01T00:00:00Z' }),
      })) localStorage.setItem(k, v)
    })
  }
  return { page, log }
}

async function runCommand(page, text) {
  await page.focus('[data-command-bar]')
  await page.evaluate(() => document.querySelector('[data-command-bar]').select?.())
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text)
  await wait(500)
  await page.keyboard.press('Enter')
}

async function production(browser) {
  console.log(`Production, signed out: ${BASE}`)
  const { page, log } = await openPage(browser)
  const res = await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await wait(3000)
  const text = await page.evaluate(() => document.body.innerText)
  const signIn = /SIGN IN/.test(text) && /general information only, not financial advice/i.test(text)
  if (signIn) pass('the sign-in screen renders, with the general-information line')
  else fail('the sign-in screen did not render')
  RAW_ERROR.test(text) ? fail(`raw error text: ${text.match(RAW_ERROR)[0]}`) : pass('no raw error text')
  log.errors.length ? fail(`console errors: ${log.errors.join(' | ')}`) : pass('no console errors')
  log.ai.length ? fail(`${log.ai.length} AI request(s) on load`) : pass('no AI request on load')
  const h = res.headers()
  for (const k of ['strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'content-security-policy-report-only']) (h[k] ? pass : fail)(`header ${k}${h[k] ? '' : ' missing'}`)
  // Each endpoint answers as designed (read-only requests; nothing is written or sent).
  const expect = [
    ['GET', '/api/waitlist', [405]],
    ['GET', '/api/waitlist?action=confirm&token=abc', [400, 503]],
    ['GET', '/api/csp-report', [405]],
    ['GET', '/api/terminal-api', [410]],
    ['GET', '/api/rss?url=https%3A%2F%2Fevil.example%2Ffeed', [403]],
    ['POST', '/api/account-export', [401]],
  ]
  for (const [method, path, ok] of expect) {
    const s = await fetch(`${BASE}${path}`, { method, headers: { accept: 'application/json' } }).then((r) => r.status).catch(() => 0)
    ok.includes(s) ? pass(`${method} ${path.split('?')[0]} → ${s}`) : fail(`${method} ${path} → ${s} (expected ${ok.join(' or ')})`)
  }
  for (const n of new Set(log.network)) warn(`network: ${n}`)
}

async function modules(browser) {
  console.log(`Every module on today's date (${new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })}, Sydney; the real clock): ${BASE}`)
  const { page, log } = await openPage(browser, { seed: true })
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForSelector('[data-command-bar]', { timeout: 60_000 })
  await wait(3000)
  for (const name of MODULES) {
    const before = log.errors.length
    await runCommand(page, name)
    await wait(2500)
    const s = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      return {
        text: main.innerText,
        badges: main.querySelectorAll('[data-class]').length,
        crashed: /\bhit an error\b/i.test(document.body.innerText),
        nested: [...document.querySelectorAll(['button', 'a[href]', '[role="button"]'].flatMap((o) => ['button', 'a[href]', '[role="button"]'].map((i) => `${o} ${i}`)).join(', '))]
          .map((x) => `"${x.innerText.replace(/\s+/g, ' ').trim().slice(0, 30)}" inside "${x.parentElement.closest('button, a[href], [role="button"]').innerText.replace(/\s+/g, ' ').trim().slice(0, 40)}"`),
      }
    })
    const problems = []
    if (s.crashed) problems.push(`error boundary: ${s.text.match(/[^\n]*hit an error[^\n]*\n?[^\n]*/i)?.[0].replace(/\s+/g, ' ').slice(0, 120)}`)
    if (RAW_ERROR.test(s.text)) problems.push(`raw error text "${s.text.match(RAW_ERROR)[0]}"`)
    if (log.errors.length > before) problems.push(`console: ${log.errors.slice(before).join(' | ').slice(0, 300)}`)
    if (s.nested.length) problems.push(`${s.nested.length} interactive element(s) nested in another: ${[...new Set(s.nested)].slice(0, 3).join('; ')}`)
    if (!s.badges && !NO_DATA_SCREENS[name]?.test(s.text)) problems.push('no data badge')
    if (problems.length) fail(`${name}: ${problems.join('; ')}`)
    else pass(`${name}: ${s.badges ? `${s.badges} data badge(s)` : 'no data shown (its own empty or calculated screen)'}`)
  }
  log.ai.length ? fail(`${log.ai.length} AI request(s) (${[...new Set(log.ai)].join(', ')})`) : pass('no AI request across every module')
  for (const n of new Set(log.network)) warn(`network: ${n}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!['production', 'modules'].includes(MODE)) { console.error('usage: sweep.mjs production|modules [base-url]'); process.exit(2) }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: process.env.CI ? ['--no-sandbox'] : [] })
  try { await (MODE === 'production' ? production(browser) : modules(browser)) } finally { await browser.close() }
  console.log(failures.length ? `\n${failures.length} smoke check(s) failed.` : `\nAll smoke checks passed${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`)
  process.exit(failures.length ? 1 : 0)
}
